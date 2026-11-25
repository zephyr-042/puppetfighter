/* ============================================================================
   js/net/guest.js
   NET (3/4): guest side: join, prediction, reconciliation, interpolation, buildDP (displayed players), ping text.
   Loads after: net/common.js, sim/physics.js
   ============================================================================ */
// ---------------------------------------------------------------- guest side
function startGuestJoin() {
  sig('host', 'join', null, { name: myName });          // the chosen name travels with the join request
  Net.joinTimer = setInterval(function () { sig('host', 'join', null, { name: myName }); }, 2000);
  Net.relayTimer = setTimeout(function () {
    if (Net.dc && Net.dc.readyState == 'open') return;
    Net.relayOn = true; clearInterval(Net.joinTimer);
    sig('host', 'relay');
    netStatus('Direct connection failed - using the relay (slower; best with 2 players).');
  }, window.RTCPeerConnection ? RELAY_AFTER_MS : 0);
}
function guestSigIn(m) {
  var pc;
  if (m.k == 'offer') {
    if (Net.pc || !window.RTCPeerConnection) return;
    clearInterval(Net.joinTimer);
    try {
      pc = Net.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = function (e) { if (e.candidate) sig('host', 'ice', e.candidate); };
      pc.ondatachannel = function (e) {
        var ch = Net.dc = e.channel;
        ch.onopen = function () { clearTimeout(Net.relayTimer); netStatus('Connected to the host. Waiting for the match...'); };
        ch.onmessage = function (ev) { onSnapStr(ev.data); };
      };
      pc.setRemoteDescription(sd(m.d)).then(function () { flushIce(Net); return pc.createAnswer(); })
        .then(function (a) { return pc.setLocalDescription(a); })
        .then(function () { sig('host', 'answer', pc.localDescription); }).catch(function () {});
    } catch (e) {}
  } else if (m.k == 'ice') addIce(Net, m.d);
  else if (m.k == 'busy') netFail('The match is already in progress. Try again when the host is back in the lobby.');
  else if (m.k == 'full') netFail('The room is full (6 players).');
  else if (m.k == 'bye') netFail('The host closed the room.');
}
function guestSend(str) {
  if (Net.dc && Net.dc.readyState == 'open') { try { Net.dc.send(str); } catch (e) {} }
  else if (Net.relayOn && netCanSend()) Net.channel.send({ type: 'broadcast', event: 'in', payload: { id: Net.id, s: str } });
}
function guestWatch() {
  if (Net.lastRx && ts() - Net.lastRx > (Net.gotSnap ? DROP_MS : 20000))
    netFail(Net.gotSnap ? 'Lost connection to the host.' : 'Could not reach the host. Check the room and try again.');
}
// advance the predicted own player by one tick, mirroring the order used in simStep
function predStep(ps, inp) {
  if (ps.mode == 'title') return;
  ps.mt += STEP;
  stepP(ps, Net.me, inp.b, inp.t, STEP);
  ps.p[Net.me].fnow = false;
  if (ps.mode == 'countdown' && ps.mt >= 3) { ps.mode = 'play'; ps.mt = 0; }
}
function clientTick() {
  var inp = readIn(0), k;
  Net.seq++;
  Net.pending.push({ s: Net.seq, b: inp.b, t: inp.t });
  if (Net.pending.length > 60) Net.pending.shift();
  if (Net.ps) {
    predStep(Net.ps, inp);
    for (k = 0; k < Net.ps.ev.length; k++) sim.ev.push(Net.ps.ev[k]);   // local feedback for own actions
    Net.ps.ev.length = 0;
  }
  Net.ticks++;
  if (Net.ticks % NET_INPUT_EVERY == 0) sendInputs();
}
function sendInputs() {
  var arr = [], k, e, n = Net.pending.length;
  // resend the recent unacked inputs every packet: a lost packet costs nothing
  for (k = Math.max(0, n - 16); k < n; k++) { e = Net.pending[k]; arr.push([e.s, e.b, e.t]); }
  guestSend(JSON.stringify({ i: arr, pt: ts(), pg: Math.round(Net.ping) }));
}
function onSnapStr(str) {
  var inc;
  try { inc = JSON.parse(str); } catch (e) { return; }
  if (!inc || !inc.o || inc.o.length < 2 || !inc.f || !(inc.you >= 0 && inc.you < inc.o.length)) return;
  try { onSnapshot(inc); } catch (e) { netStatus('Received an invalid game update.'); }
}
function onSnapshot(inc) {
  var now = ts(), k, e, i, n = inc.o.length, st = inc.tk * STEP * 1000, o = now - st, ps = [], q;
  if (inc.you !== Net.me) {                          // the host (re)numbered us: restart prediction
    Net.me = inc.you; Net.pp = null; Net.ps = null; Net.pending = []; Net.err = { x: 0, z: 0, y: 0 };
  }
  Net.gotSnap = true; Net.lastRx = now;
  if (inc.pe) {                                      // ping = time since our probe was sent, minus the host's hold time
    k = now - inc.pe - (inc.pd || 0);
    if (k >= 0 && k < 5000) Net.ping = Net.ping ? Net.ping * 0.8 + k * 0.2 : k;
  }
  // host clock -> local clock offset (tracks the fastest packets, drifts up slowly)
  if (Net.off === null || Math.abs(o - Net.off) > 500) Net.off = o;
  else if (o < Net.off) Net.off += (o - Net.off) * 0.3;
  else Net.off += (o - Net.off) * 0.02;
  // authoritative state
  simSetN(sim, n);
  if (inc.names) {                                   // everybody's display names, host first (sanitized again here)
    for (i = 0; i < inc.names.length && i < NAME_DEFAULTS.length; i++) NAMES[i] = cleanName(inc.names[i]) || NAME_DEFAULTS[i];
  }
  if (inc.pgs) Net.pings = inc.pgs;                  // everybody's ping to the host (lobby screen)
  for (i = 0; i < n; i++) unpackP(sim.p[i], inc.o[i], PF);
  unpackP(sim.p[Net.me], inc.f, FF);
  sim.mode = inc.mode; sim.mt = inc.mt; sim.round = inc.round; sim.timeLeft = inc.tl; sim.tagCd = inc.tc; sim.winner = inc.w;
  sim.cfg.solo = false; sim.cfg.n = n; sim.cfg.time = inc.tm; sim.cfg.wins = inc.wn;
  if (sim.cfg.map !== inc.mp || sim.cfg.pillars !== !!inc.pl) { sim.cfg.map = inc.mp; sim.cfg.pillars = !!inc.pl; simPillars(sim); }
  for (i = 0; i < n; i++) { q = sim.p[i]; ps.push({ x: q.x, z: q.z, y: q.y, a: q.a, vx: q.vx, vz: q.vz }); }
  Net.snaps.push({ st: st, p: ps });
  if (Net.snaps.length > 12) Net.snaps.shift();
  // events: a guest plays its own actions from prediction, everything else from the host
  for (k = 0; k < (inc.ev || []).length; k++) {
    e = inc.ev[k];
    if (!(OWN_EV[e.t] && e.i === Net.me)) sim.ev.push(e);
  }
  netStatus(sim.mode == 'title' ? 'Lobby: ' + n + ' players. Waiting for the host to start...' : 'Playing online (' + n + ' players).');
  reconcile(inc);
}
function reconcile(inc) {
  var i, old = Net.pp, ox, oz, oy, np, rs, rp, dx, dz, dy;
  while (Net.pending.length && Net.pending[0].s <= (inc.ack || 0)) Net.pending.shift();
  np = JSON.parse(JSON.stringify(sim.p[Net.me]));
  rp = sim.p.slice(); rp[Net.me] = np;
  rs = { mode: sim.mode, mt: sim.mt, R: sim.R, rect: sim.rect, spawns: sim.spawns, holes: sim.holes, pillars: sim.pillars, boxes: sim.boxes, cfg: sim.cfg, ev: [], p: rp };
  for (i = 0; i < Net.pending.length; i++) { predStep(rs, Net.pending[i]); rs.ev.length = 0; }
  if (old) {
    // keep what is on screen continuous: error = shown position before - corrected position now
    ox = old.x + Net.err.x; oz = old.z + Net.err.z; oy = old.y + Net.err.y;
    dx = ox - np.x; dz = oz - np.z; dy = oy - np.y;
    if (hyp(dx, dz) < 100 && Math.abs(dy) < 80) { Net.err.x = dx; Net.err.z = dz; Net.err.y = dy; }
    else { Net.err.x = 0; Net.err.z = 0; Net.err.y = 0; }
  }
  Net.pp = np; Net.ps = rs;
}
function angDiff(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
// interpolated state of every player (the guest's own entry is ignored by buildDP)
function interpRemote() {
  var b = Net.snaps, n = b.length, rt, i, A, B, f = 0, dt = 0, out = [], j, a, c;
  if (!n || Net.off === null) return null;
  rt = ts() - Net.off - INTERP_MS;
  if (rt <= b[0].st) { A = B = b[0]; }
  else if (rt >= b[n - 1].st) { A = B = b[n - 1]; dt = Math.min(0.12, (rt - A.st) / 1000); }   // late: extrapolate a little
  else {
    for (i = n - 2; i > 0; i--) if (b[i].st <= rt) break;
    A = b[i]; B = b[i + 1];
    f = (rt - A.st) / ((B.st - A.st) || 1);
  }
  for (j = 0; j < A.p.length; j++) {
    a = A.p[j]; c = B.p[j] || a;
    if (dt) out.push({ x: a.x + a.vx * dt, z: a.z + a.vz * dt, y: a.y, a: a.a, vx: a.vx, vz: a.vz });
    else if (hyp(c.x - a.x, c.z - a.z) > 150) out.push(f < 0.5 ? a : c);   // teleport (round reset)
    else out.push({ x: a.x + (c.x - a.x) * f, z: a.z + (c.z - a.z) * f, y: a.y + (c.y - a.y) * f,
                    a: a.a + angDiff(a.a, c.a) * f, vx: a.vx + (c.vx - a.vx) * f, vz: a.vz + (c.vz - a.vz) * f });
  }
  return out;
}
function mixP(base, o) {
  var c = {}, k;
  for (k in base) c[k] = base[k];
  for (k in o) c[k] = o[k];
  return c;
}
function ensureVis(n) { while (vis.length < n) vis.push(mkVis()); }
// players as drawn this frame. Local/host: the sim itself. Guest: predicted self + interpolated others
function buildDP(dt) {
  var n = sim.p.length, i, r, f, e;
  ensureVis(n);
  DP.length = n;
  if (Net.mode != 'client' || !Net.pp || sim.mode == 'title') { for (i = 0; i < n; i++) DP[i] = sim.p[i]; return; }
  r = interpRemote();
  for (i = 0; i < n; i++) DP[i] = (r && r[i] && i != Net.me) ? mixP(sim.p[i], r[i]) : sim.p[i];
  f = Math.exp(-dt * 12);
  e = Net.err; e.x *= f; e.z *= f; e.y *= f;
  DP[Net.me] = mixP(Net.pp, { x: Net.pp.x + e.x, z: Net.pp.z + e.z, y: Net.pp.y + e.y });
}
function pingText() {
  var i, m = 0;
  if (Net.mode == 'client') return Net.ping ? Math.round(Net.ping) + ' ms' : '... ms';
  for (i = 0; i < Net.g.length; i++) if (!Net.g[i].dead && Net.g[i].ping > m) m = Net.g[i].ping;
  return m ? 'worst ping ' + m + ' ms' : 'ping ...';
}
