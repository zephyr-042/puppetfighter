/* ============================================================================
   js/sim/rules.js
   SIM: tag / shove, player-vs-player collision, scoring, and the 60 Hz tick (simStep).
   Loads after: sim/state.js, sim/physics.js
   ============================================================================ */
function doTag(s, ii, oi) {
  var it = s.p[ii], other = s.p[oi];
  it.isIt = false; other.isIt = true;
  s.tagCd = 1.4;
  var dx = other.x - it.x, dz = other.z - it.z, d = hyp(dx, dz) || 1;
  var nx = dx / d, nz = dz / d;
  other.vx = nx * 380; other.vz = nz * 380;
  it.vx = -nx * 220; it.vz = -nz * 220;
  it.dashT = 0; other.dashT = 0;
  setStun(other, 0.6, nx > 0 ? 1 : -1);
  s.ev.push({ t: 'tag', a: ii, b: oi, x: (it.x + other.x) / 2, z: (it.z + other.z) / 2 });
}
function doShove(s, ri, ii) {
  var runner = s.p[ri], it = s.p[ii];
  var dx = it.x - runner.x, dz = it.z - runner.z, d = hyp(dx, dz) || 1;
  var nx = dx / d, nz = dz / d;
  it.vx = nx * 420; it.vz = nz * 420;
  runner.vx = -nx * 160; runner.vz = -nz * 160;
  runner.dashT = 0; it.dashT = 0;
  setStun(it, 0.5, nx > 0 ? 1 : -1);
  s.ev.push({ t: 'shove', a: ri, b: ii, x: (it.x + runner.x) / 2, z: (it.z + runner.z) / 2 });
}
function collide(s) {
  var n = s.p.length, i, j, a, b, dx, dz, d, nx, nz, ov, ii, oi;
  for (i = 0; i < n; i++) {
    for (j = i + 1; j < n; j++) {
      a = s.p[i]; b = s.p[j];
      if (!(a.y < b.y + 72 && b.y < a.y + 72)) continue;   // bodies are 72 tall: no contact unless they overlap vertically
      dx = b.x - a.x; dz = b.z - a.z; d = hyp(dx, dz);
      if (d < 34 && d > 0.001) {                          // 34 = generous tag reach, bodies only push apart inside 28
        nx = dx / d; nz = dz / d;
        if (d < 28) { ov = (28 - d) / 2; a.x -= nx * ov; a.z -= nz * ov; b.x += nx * ov; b.z += nz * ov; }
        if (s.tagCd <= 0 && (a.isIt || b.isIt)) {
          ii = a.isIt ? i : j; oi = a.isIt ? j : i;
          if (s.p[oi].dashT > 0 && s.p[oi].stun <= 0) doShove(s, oi, ii);
          else if (s.p[ii].stun <= 0) doTag(s, ii, oi);
        }
      }
    }
  }
}
// lowest time spent as IT wins the round (tie: the one who is not IT right now)
function endRound(s) {
  var i, w = 0, a, b;
  for (i = 1; i < s.p.length; i++) {
    a = s.p[i]; b = s.p[w];
    if (a.itT < b.itT - 0.001 || (Math.abs(a.itT - b.itT) <= 0.001 && b.isIt && !a.isIt)) w = i;
  }
  s.winner = w;
  s.p[w].score++;
  for (i = 0; i < s.p.length; i++) if (s.p[i].isIt) setStun(s.p[i], 2.2, 1);
  s.mode = 'roundend'; s.mt = 0;
  s.ev.push({ t: 'roundend', w: w });
}

var NOIN = { b: 0, t: 0 };
function simStep(s, inp, dt) {
  if (s.mode == 'title') return;
  s.mt += dt;
  var i, solo = s.cfg.solo, q;
  for (i = 0; i < s.p.length; i++) { q = inp[i] || NOIN; stepP(s, i, q.b, q.t, dt); }
  for (i = 0; i < s.p.length; i++) {              // whoever starts falling off the roof becomes IT
    if (!s.p[i].fnow) continue;
    s.p[i].fnow = false;
    if (s.mode == 'play' && !s.p[i].isIt) {
      for (q = 0; q < s.p.length; q++) s.p[q].isIt = false;
      s.p[i].isIt = true; s.tagCd = 1.0;
    }
  }
  if (s.mode == 'countdown') {
    var n = Math.ceil(3 - s.mt);
    if (s.mt >= 3) { s.mode = 'play'; s.mt = 0; s.ev.push({ t: 'go' }); }
    else if (n != s.lastCount) { s.lastCount = n; s.ev.push({ t: 'count' }); }
  } else if (s.mode == 'play') {
    s.tagCd -= dt;
    collide(s);
    if (!solo) {
      for (i = 0; i < s.p.length; i++) if (s.p[i].isIt) s.p[i].itT += dt;
      s.timeLeft -= dt;
      var sec = Math.ceil(s.timeLeft);
      if (sec <= 5 && sec != s.lastSec && sec > 0) { s.lastSec = sec; s.ev.push({ t: 'tick' }); }
      if (s.timeLeft <= 0) { s.timeLeft = 0; endRound(s); }
    }
  } else if (s.mode == 'roundend') {
    if (s.mt > 3) {
      if (s.p[s.winner].score >= s.cfg.wins) { s.mode = 'matchend'; s.mt = 0; s.ev.push({ t: 'matchend' }); }
      else { s.round++; simStartRound(s); }
    }
  }
}
