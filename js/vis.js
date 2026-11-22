/* ============================================================================
   js/vis.js
   VIS: local-only visuals: hand springs, crouch, vertical look (pitch), particles.
   Loads after: net/guest.js (ensureVis), core.js
   ============================================================================ */
// =============================================================== VIS (local only)
var vis = [], parts = [], shake = 0, clock = 0, msg = { txt: '', col: '#fff', t: 99 };
function mkVis() {
  return { lvx: 0, lvz: 0, phase: 0, moving: 0, kick: 0, flash: 0,
           hf: 0, hfv: 0, hl: 0, hlv: 0, df: 0, dfv: 0, dl: 0, dlv: 0, cr: 0, pitch: 0, white: 0, camD: CAM_DIST };
}
ensureVis(MAXP);

function updateVis(dt) {
  if (dt < 0.001) return;
  var i, p, v, ax, az, af, al, ca, sa, spd;
  for (i = 0; i < DP.length; i++) {
    p = DP[i]; v = vis[i];
    ca = Math.cos(p.a); sa = Math.sin(p.a);
    ax = (p.vx - v.lvx) / dt; az = (p.vz - v.lvz) / dt;
    v.lvx = p.vx; v.lvz = p.vz;
    af = clamp(ax * ca + az * sa, -3000, 3000);
    al = clamp(-ax * sa + az * ca, -3000, 3000);
    v.hfv += (-130 * v.hf - 9 * v.hfv - af * 0.9) * dt;
    v.hlv += (-130 * v.hl - 9 * v.hlv - al * 0.9) * dt;
    v.hf = clamp(v.hf + v.hfv * dt, -18, 18);
    v.hl = clamp(v.hl + v.hlv * dt, -18, 18);
    v.dfv += (-220 * v.df - 14 * v.dfv - af * 0.4) * dt;
    v.dlv += (-220 * v.dl - 14 * v.dlv - al * 0.5) * dt;
    v.df = clamp(v.df + v.dfv * dt, -6, 6);
    v.dl = clamp(v.dl + v.dlv * dt, -8, 8);
    spd = hyp(p.vx, p.vz);
    v.phase += spd * dt * 0.075;
    v.moving = Math.min(1, spd / 150);
    if (p.dashT > 0) v.kick = 1; else v.kick = Math.max(0, v.kick - dt * 3);
    v.flash = Math.max(0, v.flash - dt * 2.5);
    v.cr += ((p.sl ? 1 : 0) - v.cr) * Math.min(1, dt * 12);
    v.white = Math.max(0, v.white - dt * 1.6);          // white fade-in after a respawn
  }
  // vertical look: view-only state, never part of the sim or the network. Mouse (local player) or T/G;
  // in local split screen P2 uses [ and ]
  var lv = Net.mode == 'client' ? Net.me : 0, kk = Input.keys;
  if (sim.mode == 'title') { for (i = 0; i < vis.length; i++) vis[i].pitch = 0; }
  else {
    if (sim.cfg.mouse) vis[lv].pitch -= Input.my * MOUSE_SENS;
    if (kk[84]) vis[lv].pitch += PITCH_KEY * dt;
    if (kk[71]) vis[lv].pitch -= PITCH_KEY * dt;
    if (Net.mode == 'local' && !sim.cfg.solo) {
      if (kk[219]) vis[1].pitch += PITCH_KEY * dt;
      if (kk[221]) vis[1].pitch -= PITCH_KEY * dt;
    }
    for (i = 0; i < DP.length; i++) if (DP[i].fell) vis[i].pitch += (-PITCH_MAX - vis[i].pitch) * Math.min(1, dt * 3);   // look down while falling
    for (i = 0; i < vis.length; i++) vis[i].pitch = clamp(vis[i].pitch, -PITCH_MAX, PITCH_MAX);
  }
  Input.my = 0;
  clock += dt;
  msg.t += dt;
  if (shake > 0) { shake -= dt * 40; if (shake < 0) shake = 0; }
}

function burst3(x, z, y, n, col, spd, life, size) {
  var i, a, s;
  for (i = 0; i < n; i++) {
    a = Math.random() * PI * 2; s = Math.random() * spd;
    parts.push({ x: x, z: z, y: y, vx: Math.cos(a) * s, vz: Math.sin(a) * s,
                 vy: Math.random() * spd * 0.8, life: life * (0.5 + Math.random() * 0.5),
                 max: life, col: col, size: size });
  }
}
function updateParts(dt) {
  var i, p;
  for (i = parts.length - 1; i >= 0; i--) {
    p = parts[i];
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
    p.vy -= 500 * dt;
    if (p.y < 0) { p.y = 0; p.vy = -p.vy * 0.4; }
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
