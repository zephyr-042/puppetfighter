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
  netReset();
  resetNames(false);                                  // back to P1..P6 with your own name at index 0
  setRoomUI(''); netStatus('Local mode is unchanged. Create or join a room to play online.');
  paused = false;
  simToTitle(sim);
}
function netFail(msg) { leaveOnline(); netStatus(msg); }
function openOnlineRoom(code, role) {
  if (Net.channel) leaveOnline();
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) { netStatus('Enter a 6-character room code.'); return; }
  netReset();
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
      if (role == 'host') netStatus('Room ready. Share the code above; waiting for players...');
      else { netStatus('Joined room. Connecting to the host...'); Net.lastRx = ts(); startGuestJoin(); }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      netStatus('Signalling connection issue (' + status + '). Reconnecting automatically; running connections are not affected.');
    }
  });
}
document.getElementById('createRoom').onclick = function () { openOnlineRoom(makeRoomCode(), 'host'); };
document.getElementById('joinRoom').onclick = function () { openOnlineRoom(document.getElementById('roomCode').value, 'client'); };
document.getElementById('leaveRoom').onclick = leaveOnline;
document.getElementById('roomCode').onkeydown = function (e) { if (e && e.stopPropagation) e.stopPropagation(); if ((e.key || '') == 'Enter') document.getElementById('joinRoom').click(); };
window.addEventListener('beforeunload', sayBye);
