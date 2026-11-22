/* ============================================================================
   js/net/common.js
   NET (1/4): architecture notes, tuning constants, wire format (pack/unpack), the Net object, signalling + ICE helpers.
   Loads after: core.js, input.js
   ============================================================================ */
// =============================================================== NET + ONLINE PLAY
// Star topology over WebRTC data channels. The host runs the simulation (simStep) for everybody;
// each guest sends inputs to the host and receives snapshots back. Supabase Realtime is only the
// SIGNALLING channel (room code, offer / answer / ICE, lobby) plus a RELAY fallback for a guest whose
// direct connection cannot be established within RELAY_AFTER_MS.
//   guest -> host   {i:[[seq,bits,turn],...], pt, pg}   ~15/s. The last 16 inputs are resent every
//                   packet, so a lost packet costs nothing. pt/pg = ping probe / measured ping.
//   host -> guest   one compact snapshot ~20/s: `you` (your player index), `ack` (last input the
//                   host applied), `f` (your full player), `o` (every player, compact arrays, see
//                   PF), `pe/pd` (ping echo), plus clock, round state and events.
// Data channels are unordered with no retransmits: stale data is worthless, the next one replaces it.
//
// Why a guest feels instant:
//   PREDICTION      the guest runs its own player's physics locally every tick, so controls
//                   respond immediately. Each tick's input gets a sequence number.
//   RECONCILIATION  every snapshot carries `ack`. The guest rebases its player onto the host state
//                   and replays the inputs the host has not seen yet. Small differences are
//                   blended out instead of snapping.
//   INTERPOLATION   other players are drawn INTERP_MS in the past, between two snapshots.
// Host side: each guest's inputs go through a tiny jitter buffer, one input per tick. One-shot
// buttons (dash, jump) ride inside numbered inputs, so they are never lost or doubled.
//
// Lobby: guests can join while the host is on the title screen. Player index = join order
// (host = 0). A guest that drops mid-match keeps its slot and becomes an idle puppet; slots are
// recompacted when the host returns to the title screen.
//
// Bandwidth (host upload): measured ~430 bytes per snapshot at 4 players (~600 at 6), 20/s per guest
// -> roughly 12 KB/s per guest, ~60 KB/s (0.5 Mbps) for a full 6-player room. Supabase only sees signalling,
// so its 100 events/s limit no longer matters (it still does for relay-mode guests).
var INTERP_MS = 100;        // how far in the past a guest draws other puppets (>= 2 snapshot intervals)
var NET_STATE_EVERY = 3;    // host snapshots: 60 / 3 = 20 per second per guest
var NET_INPUT_EVERY = 4;    // guest inputs:   60 / 4 = 15 per second
var RELAY_AFTER_MS = 8000;  // no direct connection after this long -> use the Supabase relay
var DROP_MS = 6000;         // no packets for this long -> the other side is gone
// STUN finds each player's public address. Strict NATs may also need a TURN server: add one here, e.g.
// { urls: 'turn:your.turn.server:3478', username: '...', credential: '...' }
var ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
var DP = [null, null];      // players as displayed this frame (predicted / interpolated on a guest)

// player fields on the wire. PF = what everybody else needs, FF = every field (your own player)
var PF = ['x', 'z', 'y', 'vx', 'vz', 'gy', 'a', 'dashT', 'stun', 'stunMax', 'stunDir', 'isIt', 'sl', 'grab', 'score', 'itT'];
var FF = PF.concat(['vy', 'dashCd', 'dashX', 'dashZ', 'gAng', 'gR', 'gL', 'gcd', 'coast', 'jbuf']);
var BOOLF = { isIt: 1, sl: 1 };
function r2(v) { return Math.round(v * 100) / 100; }
function ts() { return new Date().getTime(); }
function packP(p, F) {
  var a = [], i, v;
  for (i = 0; i < F.length; i++) { v = p[F[i]]; a.push(typeof v == 'boolean' ? (v ? 1 : 0) : r2(v)); }
  return a;
}
function unpackP(p, a, F) {
  var i;
  for (i = 0; i < F.length; i++) p[F[i]] = BOOLF[F[i]] ? a[i] === 1 : a[i];
}

var Net = {
  mode: 'local', role: 'local', me: 1, id: '', channel: null, room: '', status: 'Local mode',
  tk: 0, ticks: 0, pendingEvents: [], joined: false,
  // host: one record per guest (see hostJoin)
  g: [],
  // guest: connection
  pc: null, dc: null, ice: [], relayOn: false, relayTimer: 0, joinTimer: 0, gotSnap: false, lastRx: 0, ping: 0,
  // guest: prediction + interpolation
  seq: 0, pending: [], pp: null, ps: null, err: { x: 0, z: 0, y: 0 }, snaps: [], off: null,
  getInputs: function (s) {
    var a = [], i, n = s.p.length, g;
    for (i = 0; i < n; i++) a.push({ b: 0, t: 0 });
    a[0] = readIn(0);
    if (this.mode == 'host') {
      for (i = 0; i < this.g.length; i++) {
        g = this.g[i];
        if (g.idx > 0 && g.idx < n && !g.dead) a[g.idx] = hostGuestInput(g);
      }
    } else if (!s.cfg.solo && n > 1) a[1] = readIn(1);
    return a;
  }
};
var OWN_EV = { dash: 1, jump: 1, land: 1, slide: 1, grab: 1, fling: 1, fall: 1 };

// true when it is safe to broadcast on the Supabase channel (otherwise supabase-js falls back to one
// HTTP POST per message, which floods the network during a reconnect, so we skip sends then)
function netCanSend() {
  var c = Net.channel;
  return !!c && (c.state === undefined || c.state === 'joined');
}
function netReset() {
  Net.tk = 0; Net.ticks = 0; Net.pendingEvents = []; Net.joined = false; Net.g = [];
  Net.pc = null; Net.dc = null; Net.ice = []; Net.relayOn = false; Net.gotSnap = false; Net.lastRx = 0; Net.ping = 0; Net.me = 1;
  Net.seq = 0; Net.pending = []; Net.pp = null; Net.ps = null; Net.err = { x: 0, z: 0, y: 0 };
  Net.snaps = []; Net.off = null;
}
function sig(to, k, d) {
  if (Net.channel) Net.channel.send({ type: 'broadcast', event: 'sig', payload: { from: Net.id, to: to, k: k, d: d } });
}
function sd(d) { return window.RTCSessionDescription ? new RTCSessionDescription(d) : d; }
function addIce(o, c) {
  if (o.pc && o.pc.remoteDescription) o.pc.addIceCandidate(window.RTCIceCandidate ? new RTCIceCandidate(c) : c).catch(function () {});
  else o.ice.push(c);
}
function flushIce(o) {
  var c;
  while ((c = o.ice.shift())) addIce(o, c);
}

