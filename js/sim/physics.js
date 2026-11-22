/* ============================================================================
   js/sim/physics.js
   SIM: per-player movement physics (stepP): walk, dash, jump, slide, pillar grab, boxes, roof edge, floor holes, falling.
   Loads after: core.js, sim/maps.js, sim/state.js

  Movement verbs (always available, they stack):
    dash   burst of speed, works in the air too, momentum carries on after it
    jump   works anywhere, low air control but air-strafing can add speed
    slide  hold: near-zero friction glide, tiny steering, speed boost on entry
    grab   hold near a pillar: orbit it, W/S changes radius (speed), release to fling
           in your facing direction (jump while grabbed = fling upward)
   ============================================================================ */
function tryDash(s, i, fw, st) {
  var p = s.p[i];
  if (p.dashCd > 0 || p.stun > 0 || p.grab >= 0 || p.fell) return;
  var ca = Math.cos(p.a), sa = Math.sin(p.a);
  var dx = ca * fw - sa * st, dz = sa * fw + ca * st, l = hyp(dx, dz);
  if (l < 0.01) { dx = ca; dz = sa; } else { dx /= l; dz /= l; }
  p.dashX = dx; p.dashZ = dz; p.dashT = 0.2; p.dashCd = DASH_CD;
  s.ev.push({ t: 'dash', i: i, x: p.x, z: p.z });
}

// height of the surface under a player (0 = floor, or the top of a pillar they are above)
function support(s, p) {
  var j, pl, b, bx = s.boxes || NOBOX, hs = s.holes || NOBOX, gl = 0;
  if (s.rect && (Math.abs(p.x) > s.rect.hw || Math.abs(p.z) > s.rect.hd)) gl = -1000;   // past the roof edge: nothing to stand on
  for (j = 0; j < hs.length; j++) {                                                      // over a floor hole (skylight): same
    if (Math.abs(p.x - hs[j].x) < hs[j].hw && Math.abs(p.z - hs[j].z) < hs[j].hd) gl = -1000;
  }
  for (j = 0; j < s.pillars.length; j++) {
    pl = s.pillars[j];
    if (hyp(p.x - pl.x, p.z - pl.z) < pl.r + 8 && p.y >= pl.h - 6 && pl.h > gl) gl = pl.h;
  }
  for (j = 0; j < bx.length; j++) {
    b = bx[j];
    if (Math.abs(p.x - b.x) < b.hw + 8 && Math.abs(p.z - b.z) < b.hd + 8 && p.y >= b.h - 6 && b.h > gl) gl = b.h;
  }
  return gl;
}

function stepP(s, i, bits, tdel, dt) {
  var p = s.p[i], fw = 0, st = 0, tn = 0, j, pl, l, f, k;
  var wantSlide = false, wantGrab = false;
  if (p.stun > 0) p.stun -= dt;
  var can = s.mode == 'play' && p.stun <= 0;
  var ctl = can && !p.fell;        // once you are falling off the building there is no dash / jump / slide / grab / steering
  if (ctl) {
    if (bits & 1) fw += 1;
    if (bits & 2) fw -= 1;
    if (bits & 16) st -= 1;
    if (bits & 32) st += 1;
    if (bits & 64) tryDash(s, i, fw, st);
    if (bits & 128) p.jbuf = 0.12;
    wantSlide = (bits & 256) != 0;
    wantGrab = (bits & 512) != 0;
  }
  if (can) {                       // looking around still works while falling
    if (bits & 4) tn -= 1;
    if (bits & 8) tn += 1;
  }
  if (p.jbuf > 0) p.jbuf -= dt;
  if (p.gcd > 0) p.gcd -= dt;
  if (tn) p.a += tn * 2.6 * dt;
  if (can && tdel) p.a += tdel;
  var ca = Math.cos(p.a), sa = Math.sin(p.a);
  var speed = 150 * (p.isIt ? 1.12 : 1);
  var grounded = p.y <= p.gy + 0.01 && p.vy <= 0;

  // release the pillar: fling along the facing direction (jump = fling upward)
  if (p.grab >= 0 && (!wantGrab || p.stun > 0 || p.jbuf > 0)) {
    if (can) {
      var sp2 = clamp(hyp(p.vx, p.vz) + 140, 200, 650);
      p.vx = ca * sp2; p.vz = sa * sp2;
      if (p.jbuf > 0) { p.vy = 300; p.jbuf = 0; }
      s.ev.push({ t: 'fling', i: i, x: p.x, z: p.z, y: p.y + 30 });
    }
    p.grab = -1; p.coast = 0.3; p.gcd = 0.3;
    if (p.vy > 0) grounded = false;
  }
  // grab a pillar that is within reach
  if (p.grab < 0 && wantGrab && p.dashT <= 0 && p.gcd <= 0) {
    var bj = -1, bd = 1e9, dd;
    for (j = 0; j < s.pillars.length; j++) {
      pl = s.pillars[j];
      if (p.y > pl.h + 20) continue;
      dd = hyp(p.x - pl.x, p.z - pl.z);
      if (dd < pl.r + 46 && dd < bd) { bd = dd; bj = j; }
    }
    if (bj >= 0) {
      pl = s.pillars[bj];
      var rx = p.x - pl.x, rz = p.z - pl.z, r0 = Math.max(bd, pl.r + 16);
      var vt = (-rz * p.vx + rx * p.vz) / (bd || 1);
      if (Math.abs(vt) < 60) vt = (vt < 0 ? -60 : 60);
      p.grab = bj; p.gAng = Math.atan2(rz, rx); p.gR = r0; p.gL = vt * r0;
      p.dashT = 0; p.vy = 0;
      s.ev.push({ t: 'grab', i: i, x: p.x, z: p.z });
    }
  }

  if (p.grab >= 0) {
    // orbit: angular momentum is kept, so a smaller radius = faster spin. W pulls in, S pushes out
    pl = s.pillars[p.grab];
    var mn = pl.r + 16;
    p.gR = clamp(p.gR - (fw * 70 + 14) * dt, mn, mn + 46);
    p.gL = clamp(p.gL, -650 * p.gR, 650 * p.gR);
    p.gAng += (p.gL / (p.gR * p.gR)) * dt;
    var vt2 = p.gL / p.gR;
    p.x = pl.x + Math.cos(p.gAng) * p.gR; p.z = pl.z + Math.sin(p.gAng) * p.gR;
    p.vx = -Math.sin(p.gAng) * vt2; p.vz = Math.cos(p.gAng) * vt2;
    p.vy = 0; p.sl = false; p.dashT = 0;
  } else {
    if (p.jbuf > 0 && grounded && can) {
      p.vy = 340; p.jbuf = 0; grounded = false;
      s.ev.push({ t: 'jump', i: i, x: p.x, z: p.z });
    }
    var sliding = grounded && wantSlide && p.dashT <= 0;
    if (sliding && !p.sl) {
      var sp0 = hyp(p.vx, p.vz);
      if (sp0 > 60) {
        var bs = Math.min(1.2, 460 / sp0);
        if (bs > 1) { p.vx *= bs; p.vz *= bs; }
        s.ev.push({ t: 'slide', i: i, x: p.x, z: p.z });
      }
    }
    p.sl = sliding;

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashX * 460; p.vz = p.dashZ * 460;
      if (p.dashT <= 0) p.coast = 0.35;
    } else if (p.stun > 0) {
      f = Math.pow(0.02, dt);
      p.vx *= f; p.vz *= f;
    } else {
      var fwk = fw < 0 ? fw * 0.7 : fw;
      var wx = ca * fwk - sa * st * 0.85, wz = sa * fwk + ca * st * 0.85;
      l = hyp(wx, wz);
      if (l > 1) { wx /= l; wz /= l; l = 1; }
      if (!grounded) {
        // air: no friction, you can only add speed toward where you steer (air-strafing)
        if (l > 0.01) {
          var ux = wx / l, uz = wz / l, add = 50 - (p.vx * ux + p.vz * uz);
          if (add > 0) { add = Math.min(add, 900 * dt); p.vx += ux * add; p.vz += uz * add; }
        }
      } else if (p.sl) {
        p.vx += wx * 90 * dt; p.vz += wz * 90 * dt;
        f = Math.pow(0.55, dt); p.vx *= f; p.vz *= f;
      } else {
        k = Math.min(1, dt * (p.coast > 0 ? 1.2 : 9));
        p.vx += (wx * speed - p.vx) * k;
        p.vz += (wz * speed - p.vz) * k;
      }
    }
    if (p.coast > 0) p.coast -= dt;
    var tot = hyp(p.vx, p.vz);
    if (tot > 620 && p.dashT <= 0) { p.vx *= 620 / tot; p.vz *= 620 / tot; }
    if (p.dashCd > 0) p.dashCd -= dt;
    p.x += p.vx * dt; p.z += p.vz * dt;
  }
  if (p.grab >= 0 && p.dashCd > 0) p.dashCd -= dt;

  if (p.fell && s.rect) {          // falling off the building: drift away from the wall, slightly damped
    if (Math.abs(p.x) > s.rect.hw) p.vx += (p.x > 0 ? 1 : -1) * 90 * dt;
    if (Math.abs(p.z) > s.rect.hd) p.vz += (p.z > 0 ? 1 : -1) * 90 * dt;
    p.vx *= 0.995; p.vz *= 0.995;
  }
  if (s.rect) {
    // roof: a low lip blocks anything below it. Jump over it and there is nothing to stand on
    var rhw = s.rect.hw, rhd = s.rect.hd;
    if (Math.abs(p.x) <= rhw && Math.abs(p.z) <= rhd && p.y < s.rect.lip - 2) {
      if (p.x > rhw - 14) { p.x = rhw - 14; if (p.vx > 0) p.vx *= -0.5; }
      else if (p.x < 14 - rhw) { p.x = 14 - rhw; if (p.vx < 0) p.vx *= -0.5; }
      if (p.z > rhd - 14) { p.z = rhd - 14; if (p.vz > 0) p.vz *= -0.5; }
      else if (p.z < 14 - rhd) { p.z = 14 - rhd; if (p.vz < 0) p.vz *= -0.5; }
    }
  } else {
    var d = hyp(p.x, p.z), lim = s.R - 14;
    if (d > lim) {
      var nx = p.x / d, nz = p.z / d, dot = p.vx * nx + p.vz * nz;
      p.x = nx * lim; p.z = nz * lim;
      if (dot > 0) { p.vx -= 1.5 * dot * nx; p.vz -= 1.5 * dot * nz; }
    }
  }
  var pdx, pdz, pdd, pmn;
  for (j = 0; j < s.pillars.length; j++) {
    pl = s.pillars[j];
    if (j == p.grab || p.y > pl.h - 5) continue;
    pdx = p.x - pl.x; pdz = p.z - pl.z; pdd = hyp(pdx, pdz); pmn = pl.r + 14;
    if (pdd < pmn && pdd > 0.001) {
      var qx = pdx / pdd, qz = pdz / pdd, dv = p.vx * qx + p.vz * qz;
      p.x = pl.x + qx * pmn; p.z = pl.z + qz * pmn;
      if (dv < 0) { p.vx -= 1.4 * dv * qx; p.vz -= 1.4 * dv * qz; }
    }
  }

  // boxes: solid below their top (circle of radius 14 against the rectangle), walkable on top
  var bxs = s.boxes || NOBOX, bb, bcx, bcz, bdx, bdz, bdd, bnx, bnz, bdv, bpx, bpz;
  for (j = 0; j < bxs.length; j++) {
    bb = bxs[j];
    if (p.y > bb.h - 5) continue;
    bcx = clamp(p.x, bb.x - bb.hw, bb.x + bb.hw); bcz = clamp(p.z, bb.z - bb.hd, bb.z + bb.hd);
    bdx = p.x - bcx; bdz = p.z - bcz; bdd = hyp(bdx, bdz);
    if (bdd < 14) {
      if (bdd > 0.001) { bnx = bdx / bdd; bnz = bdz / bdd; }
      else {                                          // centre is inside: leave through the nearest side
        bpx = bb.hw - Math.abs(p.x - bb.x); bpz = bb.hd - Math.abs(p.z - bb.z);
        if (bpx < bpz) { bnx = p.x >= bb.x ? 1 : -1; bnz = 0; bcx = bb.x + bnx * bb.hw; bcz = p.z; }
        else { bnx = 0; bnz = p.z >= bb.z ? 1 : -1; bcz = bb.z + bnz * bb.hd; bcx = p.x; }
      }
      p.x = bcx + bnx * 14; p.z = bcz + bnz * 14;
      bdv = p.vx * bnx + p.vz * bnz;
      if (bdv < 0) { p.vx -= 1.4 * bdv * bnx; p.vz -= 1.4 * bdv * bnz; }
    }
  }

  // vertical: gravity, floor, pillar tops
  var gl = support(s, p), wasAir = !grounded, iv = p.vy;
  if (p.grab < 0) {
    p.vy -= (p.dashT > 0 ? 250 : 900) * dt;
    if (p.fell && p.vy < -380) p.vy = -380;                     // terminal velocity: the drop lasts about a second
    p.y += p.vy * dt;
  }
  if (p.y <= gl && !p.fell) {
    if (p.vy < 0) p.vy = 0;
    p.y = gl;
    if (wasAir && iv < -40) { p.coast = 0.15; s.ev.push({ t: 'land', i: i, x: p.x, z: p.z, v: -iv }); }
  }
  p.gy = gl;
  // no floor under you (past the roof edge or over the skylight): start falling. The sim makes the faller IT (simStep)
  if (gl <= -999 && p.y < -10 && !p.fell) {
    p.fell = true; p.fnow = true; p.grab = -1; p.dashT = 0; p.sl = false; p.jbuf = 0;
    s.ev.push({ t: 'fall', i: i, x: p.x, z: p.z });
  }
  // after about 1 s of falling (y < -380): respawn above the spawn point, dazed
  if (p.fell && p.y < -380) {
    var sp = spawnPos(s, i, s.p.length);
    p.x = sp.x; p.z = sp.z; p.a = sp.a; p.y = 60; p.gy = 0; p.vx = p.vz = p.vy = 0;
    p.fell = false; p.dashT = 0; p.grab = -1; p.sl = false; p.coast = 0; p.jbuf = 0;
    setStun(p, 0.7, 1);
    s.ev.push({ t: 'respawn', i: i, x: p.x, z: p.z });
  }
}

