/* ============================================================================
   js/net/host.js
   NET (2/4): host side: lobby, guest records, per-guest input queues, snapshots, start / maintain.
   Loads after: net/common.js
   ============================================================================ */
// ---------------------------------------------------------------- host side
function gById(id) {
  var i;
  for (i = 0; i < Net.g.length; i++) if (Net.g[i].id === id) return Net.g[i];
  return null;
}
function closeG(g) {
  g.dead = true;
  try { if (g.dc) g.dc.close(); } catch (e) {}
  try { if (g.pc) g.pc.close(); } catch (e) {}
  g.dc = null; g.pc = null;
}
function liveCount() {
  var i, n = 0;
  for (i = 0; i < Net.g.length; i++) if (!Net.g[i].dead) n++;
  return n;
}
function hostResetIn(g) { g.q = []; g.hseq = 0; g.used = 0; g.last = { b: 0, t: 0 }; g.rebuf = true; g.starve = 0; }
function hostJoin(id, name) {
  var g = gById(id), pc;
  if (g) { if (name !== undefined) g.name = cleanName(name); return; }   // join requests are resent until the offer arrives
  if (sim.mode != 'title') { sig(id, 'busy'); return; }
  if (liveCount() >= MAXP - 1) { sig(id, 'full'); return; }
  g = { id: id, idx: -1, pc: null, dc: null, ice: [], relay: false, open: false, dead: false, t0: ts(), seen: ts(),
        q: [], hseq: 0, used: 0, last: { b: 0, t: 0 }, rebuf: true, starve: 0, pt: 0, ptAt: 0, ping: 0, name: cleanName(name) };
  Net.g.push(g);
  if (!window.RTCPeerConnection) return;            // that guest will fall back to the relay
  try {
    pc = g.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = function (e) { if (e.candidate) sig(id, 'ice', e.candidate); };
    g.dc = pc.createDataChannel('g', { ordered: false, maxRetransmits: 0 });
    g.dc.onopen = function () {
      if (sim.mode != 'title') { sig(id, 'busy'); closeG(g); } else { g.open = true; g.seen = ts(); }
    };
    g.dc.onmessage = function (e) { try { hostPacket(g, JSON.parse(e.data)); } catch (err) {} };
    pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
      .then(function () { sig(id, 'offer', pc.localDescription); }).catch(function () {});
  } catch (e) {}
}
function hostSigIn(m) {
  var g;
  if (m.k == 'join') { hostJoin(m.from, m.name); return; }
  if (m.k == 'name') {                              // a guest changed its name while in the lobby / match
    g = gById(m.from);
    if (g && !g.dead) g.name = cleanName(m.name);
    return;
  }
  if (m.k == 'relay') {
    hostJoin(m.from);
    g = gById(m.from);
    if (!g || g.dead) return;
    if (sim.mode != 'title') { sig(g.id, 'busy'); closeG(g); return; }
    g.relay = true; g.open = true; g.seen = ts();
    return;
  }
  g = gById(m.from);
  if (!g || g.dead) return;
  if (m.k == 'answer' && g.pc) {
    g.pc.setRemoteDescription(sd(m.d)).then(function () { flushIce(g); }).catch(function () {});
  } else if (m.k == 'ice') addIce(g, m.d);
  else if (m.k == 'bye') closeG(g);
}
function hostPacket(g, o) {
  var arr = o.i, k, e, now = ts();
  g.seen = now;
  if (o.pt) { g.pt = o.pt; g.ptAt = now; }
  g.ping = o.pg || 0;
  if (!arr) return;
  if (arr.length && arr[arr.length - 1][0] < g.hseq - 120) hostResetIn(g);   // guest restarted its counter
  for (k = 0; k < arr.length; k++) {
    e = arr[k];
    if (e[0] > g.hseq) { g.q.push({ s: e[0], b: e[1], t: e[2] }); g.hseq = e[0]; }
  }
  if (g.q.length > 200) g.q.splice(0, g.q.length - 200);
}
function hostGuestInput(g) {
  var q = g.q, it, a, n;
  if (g.rebuf && q.length >= 2) g.rebuf = false;
  if (!g.rebuf && q.length) {
    // too far behind: fold the extra ticks together so latency cannot build up
    while (q.length > 6) { a = q.shift(); n = q[0]; n.b |= (a.b & 192); n.t += a.t; }
    it = q.shift();
    g.used = it.s; g.last = it; g.starve = 0;
    return { b: it.b, t: it.t };
  }
  // starved: hold the movement keys briefly, never repeat dash/jump or turning
  g.rebuf = true; g.starve++;
  if (g.starve > 12) return { b: 0, t: 0 };
  return { b: g.last.b & ~192, t: 0 };
}
function hostSendTo(g, str) {
  if (g.dc && g.dc.readyState == 'open') {
    if (g.dc.bufferedAmount > 65536) return;        // congested: drop this snapshot, the next one replaces it
    try { g.dc.send(str); } catch (e) {}
  } else if (g.relay && netCanSend()) {
    Net.channel.send({ type: 'broadcast', event: 'st', payload: { to: g.id, s: str } });
  }
}
// display names, host first: [hostName, guest1Name, ...]. A blank guest name becomes 'P' + (player number);
// duplicates get the player number appended so the scoreboard rows stay distinguishable
function hostNames() {
  var out = [], i, k, g, j, nm;
  for (i = 0; i < sim.p.length; i++) out.push(i == 0 ? (myName || 'P1') : 'P' + (i + 1));
  for (k = 0; k < Net.g.length; k++) {
    g = Net.g[k];
    if (g.idx > 0 && g.idx < out.length && g.name) out[g.idx] = g.name;
  }
  for (i = 1; i < out.length; i++) {
    for (j = 0; j < i; j++) {
      if (out[j].toLowerCase() == out[i].toLowerCase()) { out[i] = out[i].slice(0, 10) + ' ' + (i + 1); break; }
    }
  }
  return out;
}
// the host's own NAMES[] follows the lobby too
function syncHostNames() {
  var nm = hostNames(), i;
  for (i = 0; i < nm.length && i < NAME_DEFAULTS.length; i++) NAMES[i] = nm[i];
}
// ping per player index for the lobby screen (host = 0, a guest's ping is the round trip it measured itself)
function hostPings() {
  var out = [], i, k, g;
  for (i = 0; i < sim.p.length; i++) out.push(0);
  for (k = 0; k < Net.g.length; k++) {
    g = Net.g[k];
    if (!g.dead && g.open && g.idx > 0 && g.idx < out.length) out[g.idx] = Math.round(g.ping || 0);
  }
  return out;
}
function sendState() {
  var i, g, o = [], now = ts(), base, live = [], snap, nm, nk;
  for (i = 0; i < Net.g.length; i++) if (Net.g[i].open && !Net.g[i].dead && Net.g[i].idx > 0) live.push(Net.g[i]);
  if (!live.length) { Net.pendingEvents = []; return; }
  for (i = 0; i < sim.p.length; i++) o.push(packP(sim.p[i], PF));
  snap = { mode: sim.mode, mt: r2(sim.mt), round: sim.round, tl: r2(sim.timeLeft), tc: r2(sim.tagCd),
           w: sim.winner, tm: sim.cfg.time, wn: sim.cfg.wins, mp: sim.cfg.map, pl: sim.cfg.pillars ? 1 : 0,
           tk: Net.tk, lob: sim.p.length, ev: Net.pendingEvents, o: o };
  nm = hostNames(); nk = nm.join('|');                // names: sent when they change, and every 10th snapshot (0.5 s) in case one is lost
  if (nk !== Net.namesKey || ++Net.nameTick >= 10) { snap.names = nm; snap.pgs = hostPings(); Net.namesKey = nk; Net.nameTick = 0; }
  base = JSON.stringify(snap).slice(1);
  Net.pendingEvents = [];
  for (i = 0; i < live.length; i++) {
    g = live[i];
    if (g.idx >= sim.p.length) continue;
    hostSendTo(g, '{"you":' + g.idx + ',"ack":' + g.used + ',"pe":' + g.pt + ',"pd":' + (now - g.ptAt) +
                  ',"f":' + JSON.stringify(packP(sim.p[g.idx], FF)) + ',' + base);
  }
}
// re-derive the player list while on the title screen: drop dead guests, number the rest in join order
function lobbySync() {
  var live = [], i, g, k = 0;
  for (i = 0; i < Net.g.length; i++) { g = Net.g[i]; if (g.dead) closeG(g); else live.push(g); }
  Net.g = live;
  for (i = 0; i < live.length; i++) { g = live[i]; if (g.open) g.idx = ++k; else g.idx = -1; }
  sim.cfg.n = 1 + k;
  if (sim.p.length != sim.cfg.n) simToTitle(sim);
  netStatus(k > 0 ? 'Lobby: ' + (k + 1) + ' players connected. Press SPACE to start the match.'
                  : 'Room ready and listed in Open Rooms; waiting for players...');
}
function hostMaintain() {
  var now = ts(), i, g;
  for (i = 0; i < Net.g.length; i++) {
    g = Net.g[i];
    if (g.dead) continue;
    if (g.open && now - g.seen > DROP_MS) closeG(g);
    else if (!g.open && now - g.t0 > 25000) closeG(g);
  }
  if (sim.mode == 'title') lobbySync();
  syncHostNames();
  if (sim.mode != 'title') netStatus('Match in progress (' + sim.p.length + ' players).');
}
function hostStart() {
  var i, g;
  lobbySync();
  if (sim.cfg.n < 2) { netStatus('Waiting for at least one player to join...'); return; }
  for (i = 0; i < Net.g.length; i++) {
    g = Net.g[i];
    if (!g.open && !g.dead) { sig(g.id, 'busy'); closeG(g); }
  }
  simStartMatch(sim);
  if (typeof lobbyAdvertise == 'function') lobbyAdvertise();   // sim.mode left 'title': stop advertising now
}
