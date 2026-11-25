/* ============================================================================
   js/net/connection.js
   NET (4/4): Supabase signalling + relay, room open / leave, room panel buttons. Runs DOM wiring at load.
   Loads after: net/*, index.html elements, supabase-js
   ============================================================================ */
// ---------------------------------------------------------------- connection (Supabase = signalling + relay)
var SUPABASE_URL = 'https://xkzltynwpbxhdopllhzq.supabase.co';
var SUPABASE_KEY = 'sb_publishable_WK6_gMdV6DN7OQkKpZSwkQ_N4NMfpOp';
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var netStatusEl = document.getElementById('netStatus');
var DEFAULT_NET_STATUS = 'Local mode is unchanged. Host a public room or join one from the list.';
function netStatus(t) { if (Net.status === t) return; Net.status = t; if (netStatusEl) netStatusEl.textContent = t; }
function setRoomUI(code) {
  document.getElementById('roomActions').style.display = code ? 'block' : 'none';
  document.getElementById('roomLabel').textContent = code || '';
}
function makeRoomCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '', i;
  for (i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}
function sayBye() {
  var i;
  if (Net.mode == 'host') { for (i = 0; i < Net.g.length; i++) sig(Net.g[i].id, 'bye'); }
  else if (Net.mode == 'client') sig('host', 'bye');
}
function leaveOnline() {
  var i, ch = Net.channel;
  clearInterval(Net.joinTimer); clearTimeout(Net.relayTimer);
  sayBye();
  if (Net.mode == 'host') { for (i = 0; i < Net.g.length; i++) closeG(Net.g[i]); }
  else {
    try { if (Net.dc) Net.dc.close(); } catch (e) {}
    try { if (Net.pc) Net.pc.close(); } catch (e) {}
  }
  if (ch) setTimeout(function () { try { sb.removeChannel(ch); } catch (e) {} }, 300);   // let the bye messages out first
  Net.channel = null; Net.mode = 'local'; Net.role = 'local'; Net.room = '';
  sim.cfg.online = false; sim.cfg.n = 2;
  netReset(); Net.pings = null;
  resetNames(false);                                  // back to P1..P6 with your own name at index 0
  setRoomUI(''); netStatus(DEFAULT_NET_STATUS);
  paused = false;
  simToTitle(sim);
  lobbyAdvertise();                                   // stop advertising the room at once
}
function netFail(msg) { leaveOnline(); netStatus(msg); }
function openOnlineRoom(code, role) {
  if (Net.channel) leaveOnline();
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) { netStatus('Enter a 6-character room code.'); return; }
  netReset(); Net.pings = null;
  resetNames(role == 'client');                       // a guest learns every name (host included) from the host
  Net.mode = role; Net.role = role; Net.room = code; Net.id = makeRoomCode() + makeRoomCode();
  sim.cfg.solo = false; paused = false;
  if (role == 'host') { sim.cfg.online = true; sim.cfg.n = 1; } else { sim.cfg.online = false; sim.cfg.n = 2; }
  simToTitle(sim);
  setRoomUI(code); netStatus('Connecting to room ' + code + '...');
  var ch = sb.channel('puppet-tag-' + code, { config: { broadcast: { self: false } } });
  Net.channel = ch;
  ch.on('broadcast', { event: 'sig' }, function (m) {
    var p = m.payload;
    if (!p || p.from === Net.id) return;
    if (Net.mode == 'host' && p.to === 'host') hostSigIn(p);
    else if (Net.mode == 'client' && p.to === Net.id) guestSigIn(p);
  });
  // relay fallback: guest inputs -> host, host snapshots -> one guest
  ch.on('broadcast', { event: 'in' }, function (m) {
    var p = m.payload, g;
    if (Net.mode != 'host' || !p) return;
    g = gById(p.id);
    if (!g || g.dead) return;
    try { hostPacket(g, JSON.parse(p.s)); } catch (e) {}
  });
  ch.on('broadcast', { event: 'st' }, function (m) {
    var p = m.payload;
    if (Net.mode == 'client' && p && p.to === Net.id) onSnapStr(p.s);
  });
  // supabase-js calls this again after every automatic rejoin, so SUBSCRIBED can fire repeatedly
  ch.subscribe(function (status) {
    if (status === 'SUBSCRIBED') {
      var again = Net.joined; Net.joined = true;
      if (again) return;
      if (role == 'host') { netStatus('Room ready and listed in Open Rooms; waiting for players...'); lobbyAdvertise(); }
      else { netStatus('Joined room. Connecting to the host...'); Net.lastRx = ts(); startGuestJoin(); }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      netStatus('Signalling connection issue (' + status + '). Reconnecting automatically; running connections are not affected.');
    }
  });
}
// ---------------------------------------------------------------- live room browser (Supabase Realtime Presence)
// Everybody listens on one shared channel; a host in the lobby advertises its room there, and stops as soon as
// the match starts or the room is left (presence also vanishes on its own if the host's tab dies).
var lobbyKey = makeRoomCode() + makeRoomCode(), lobbyCh = null, lobbyReady = false, lobbyTracked = '', lobbyListKey = '';
var roomListEl = document.getElementById('roomList');
function roomListMsg(t) {
  var d = document.createElement('div');
  d.style.cssText = 'padding:8px;text-align:center;color:#7f8c8d';
  d.textContent = t;
  roomListEl.innerHTML = ''; roomListEl.appendChild(d);
}
function renderRoomList() {
  var rooms = [], st, key, j, m, mx, k, row, lab, btn;
  if (!roomListEl) return;
  if (!lobbyReady || !lobbyCh) { if (lobbyListKey !== 'off') { lobbyListKey = 'off'; roomListMsg('Room list unavailable - reconnecting...'); } return; }
  st = lobbyCh.presenceState();
  for (key in st) {
    for (j = 0; j < st[key].length; j++) {
      m = st[key][j]; mx = m && m.max > 0 ? m.max : 6;
      if (m && m.open && m.roomId && m.count < mx && m.roomId !== Net.room) rooms.push({ id: String(m.roomId), host: String(m.hostName || 'Host').slice(0, 16), map: String(m.map || '?').slice(0, 24), count: m.count | 0, max: mx });
    }
  }
  rooms.sort(function (a, b) { return b.count - a.count; });
  k = JSON.stringify(rooms);
  if (k === lobbyListKey) return;                     // nothing changed: leave the DOM alone (keeps hover / scroll)
  lobbyListKey = k;
  if (!rooms.length) { roomListMsg('No open rooms right now - host one!'); return; }
  roomListEl.innerHTML = '';
  rooms.forEach(function (r) {
    row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:5px 8px;margin:3px 0;background:#0b121a;border:1px solid #2c3e50';
    lab = document.createElement('span');
    lab.textContent = r.host + "'s Room \u2014 " + r.map + ' \u2014 ' + r.count + '/' + r.max + ' Players';
    btn = document.createElement('button');
    btn.textContent = 'Join';
    btn.onclick = function () { openOnlineRoom(r.id, 'client'); };
    row.appendChild(lab); row.appendChild(btn); roomListEl.appendChild(row);
  });
}
// advertise while hosting in the lobby; untrack otherwise. Cheap: only talks to Supabase when the payload changes.
function lobbyAdvertise() {
  var want = Net.mode == 'host' && sim.mode == 'title' && Net.joined && Net.room, pl, s, pr;
  if (!lobbyReady || !lobbyCh) return;
  if (want) {
    pl = { roomId: Net.room, hostName: myName || 'Host', count: sim.p.length, max: (typeof MAXP !== 'undefined' ? MAXP : 6), map: MAPDEFS[sim.cfg.map].name, open: true };
    s = JSON.stringify(pl);
    if (s !== lobbyTracked) {
      lobbyTracked = s;
      try { pr = lobbyCh.track(pl); if (pr && pr.then) pr.then(function (r) { if (r !== 'ok') lobbyTracked = ''; }, function () { lobbyTracked = ''; }); } catch (e) { lobbyTracked = ''; }
    }
  } else if (lobbyTracked) {
    lobbyTracked = '';
    try { lobbyCh.untrack(); } catch (e) {}
  }
}
function initRoomBrowser() {
  lobbyCh = sb.channel('puppet-lobby', { config: { presence: { key: lobbyKey } } });
  lobbyCh.on('presence', { event: 'sync' }, renderRoomList);
  lobbyCh.subscribe(function (status) {
    if (status === 'SUBSCRIBED') { lobbyReady = true; lobbyTracked = ''; lobbyListKey = ''; renderRoomList(); lobbyAdvertise(); }
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { lobbyReady = false; lobbyTracked = ''; lobbyListKey = ''; renderRoomList(); }
  });
}
initRoomBrowser();
setInterval(function () { lobbyAdvertise(); renderRoomList(); }, 1000);
document.getElementById('createRoom').onclick = function () { openOnlineRoom(makeRoomCode(), 'host'); };
document.getElementById('joinRoom').onclick = function () { openOnlineRoom(document.getElementById('roomCode').value, 'client'); };
document.getElementById('leaveRoom').onclick = leaveOnline;
document.getElementById('roomCode').onkeydown = function (e) { if (e && e.stopPropagation) e.stopPropagation(); if ((e.key || '') == 'Enter') document.getElementById('joinRoom').click(); };
window.addEventListener('beforeunload', sayBye);
