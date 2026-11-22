/* ============================================================================
   js/sim/state.js
   SIM: state shape (players, game), snapshots, spawns, round / match start.
   Loads after: core.js, sim/maps.js
   ============================================================================ */
function srand(s) {
  s.seed = (s.seed * 1664525 + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function mkP() {
  return { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, gy: 0, a: 0, dashT: 0, dashCd: 0, dashX: 1, dashZ: 0,
           stun: 0, stunMax: 1, stunDir: 1, isIt: false, score: 0, itT: 0,
           sl: false, grab: -1, gAng: 0, gR: 0, gL: 0, gcd: 0, coast: 0, jbuf: 0, fell: false };
}
function simNew() {
  return { mode: 'title', mt: 0, cfg: { time: 30, wins: 3, pillars: true, solo: false, mouse: true, n: 2, map: 0, online: false },
           round: 1, timeLeft: 30, tagCd: 0, lastCount: 4, lastSec: 99, seed: 12345,
           winner: -1, R: 270, rect: null, p: [mkP(), mkP()], pillars: [], boxes: [], ev: [] };
}
function simSetN(s, n) {
  while (s.p.length < n) s.p.push(mkP());
  s.p.length = n;
}
function simSnapshot(s) {
  var c = JSON.parse(JSON.stringify(s));
  c.ev = [];
  return JSON.stringify(c);
}
function simRestore(s, str) {
  var o = JSON.parse(str), k;
  for (k in o) s[k] = o[k];
  s.ev = [];
}
function setStun(p, d, dir) { p.stun = d; p.stunMax = d; p.stunDir = dir; }

function simPillars(s) {
  var d = MAPDEFS[s.cfg.map] || MAPDEFS[0];
  s.R = d.R; s.rect = d.rect || null;
  s.pillars = s.cfg.pillars ? mapPillars(s.cfg.map) : [];
  s.boxes = s.cfg.pillars ? mapBoxes(s.cfg.map) : [];
}
// spawn ring (circle maps) or ellipse (roof), everyone facing the centre. Also used to respawn after a fall
function spawnPos(s, i, n) {
  var th = PI + i * 2 * PI / n, x, z;
  if (s.rect) { x = Math.cos(th) * s.rect.hw * 0.72; z = Math.sin(th) * s.rect.hd * 0.6; }
  else { x = Math.cos(th) * s.R * 0.63; z = Math.sin(th) * s.R * 0.63; }
  return { x: x, z: z, a: Math.atan2(-z, -x) };
}
function simResetPlayers(s) {
  var i, p, sp, n = s.p.length;
  for (i = 0; i < n; i++) {
    p = s.p[i];
    sp = spawnPos(s, i, n);
    p.x = sp.x; p.z = sp.z; p.y = 0; p.gy = 0; p.a = sp.a;
    p.vx = p.vz = p.vy = 0; p.dashT = 0; p.dashCd = 0; p.stun = 0; p.isIt = false; p.itT = 0;
    p.sl = false; p.grab = -1; p.gcd = 0; p.coast = 0; p.jbuf = 0; p.fell = false;
  }
}
function simStartRound(s) {
  simPillars(s);
  simResetPlayers(s);
  // solo practice: the first dummy starts as IT, no clock, no countdown
  s.p[s.cfg.solo ? 1 : Math.floor(srand(s) * s.p.length)].isIt = true;
  s.timeLeft = s.cfg.time; s.tagCd = 0.5;
  s.mode = s.cfg.solo ? 'play' : 'countdown'; s.mt = s.cfg.solo ? 1 : 0;
  s.lastCount = 4; s.lastSec = 99;
}
function simStartMatch(s) {
  var i;
  simSetN(s, s.cfg.solo || s.cfg.online ? s.cfg.n : 2);
  for (i = 0; i < s.p.length; i++) s.p[i].score = 0;
  s.round = 1; s.winner = -1;
  simStartRound(s);
}
function simToTitle(s) {
  s.mode = 'title'; s.mt = 0;
  simSetN(s, s.cfg.solo || s.cfg.online ? s.cfg.n : 2);
  simPillars(s); simResetPlayers(s);
}

