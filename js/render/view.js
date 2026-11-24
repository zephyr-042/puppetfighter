/* ============================================================================
   js/render/view.js
   RENDER (2/3): renderView(pi): the raycaster, third-person chase camera, sky / floor, box + pillar tops, floor holes, falling-off-the-building view, sprites, HUD.
   Loads after: render/draw.js
   ============================================================================ */
// ---------------------------------------------------------------- third-person chase camera (view only)
// How far one ray from the puppet straight backwards (dx, dz) can travel before it meets the arena
// boundary, a pillar or a box that is tall enough to be in the way. Low things (below the puppet's
// eye line) are ignored: the camera boom passes over them.
function camClearance(p, dx, dz, eyeP) {
  var rect = sim.rect, pillars = sim.pillars, boxes = sim.boxes || NOBOX, best, t, b, c, sq, k, o, hh, ex, ez, ix, iz, x1, x2, z1, z2, tn, tf;
  if (rect) {
    best = dx > 1e-5 ? (rect.hw - p.x) / dx : (dx < -1e-5 ? (-rect.hw - p.x) / dx : 1e9);
    t = dz > 1e-5 ? (rect.hd - p.z) / dz : (dz < -1e-5 ? (-rect.hd - p.z) / dz : 1e9);
    if (t < best) best = t;
  } else {
    b = p.x * dx + p.z * dz; c = p.x * p.x + p.z * p.z - sim.R * sim.R;
    best = -b + Math.sqrt(Math.max(0, b * b - c));
  }
  for (k = 0; k < pillars.length; k++) {
    o = pillars[k];
    hh = rect ? o.h : WALL_H;                              // circle maps draw pillars wall-high, so they block the view
    if (hh <= eyeP - 10) continue;
    ex = p.x - o.x; ez = p.z - o.z;
    b = ex * dx + ez * dz; sq = b * b - (ex * ex + ez * ez - o.r * o.r);
    if (sq >= 0) { t = -b - Math.sqrt(sq); if (t > 0 && t < best) best = t; }
  }
  for (k = 0; k < boxes.length; k++) {
    o = boxes[k];
    if (o.h <= eyeP - 10) continue;
    ix = Math.abs(dx) < 1e-6 ? 1e-6 : dx; iz = Math.abs(dz) < 1e-6 ? 1e-6 : dz;
    x1 = (o.x - o.hw - p.x) / ix; x2 = (o.x + o.hw - p.x) / ix; z1 = (o.z - o.hd - p.z) / iz; z2 = (o.z + o.hd - p.z) / iz;
    tn = Math.max(Math.min(x1, x2), Math.min(z1, z2)); tf = Math.min(Math.max(x1, x2), Math.max(z1, z2));
    if (tn < tf && tn > 0 && tn < best) best = tn;         // (standing on top of a box: tn < 0, so it never blocks)
  }
  return best;
}
// Camera position for the puppet p: CAM_DIST straight behind it, pulled in so it never ends up outside
// the map or inside something tall. It moves in at once but eases back out (v.camD), so sliding along
// a wall does not make the view pump. Returns {x, z, d}: d is the real distance from the puppet.
function chaseCam(p, v, eyeP) {
  var dx = -Math.cos(p.a), dz = -Math.sin(p.a);
  var clear = camClearance(p, dx, dz, eyeP);
  var want = Math.min(CAM_DIST, Math.max(CAM_MIN, clear - CAM_PAD), Math.max(0, clear - 1));   // never past the obstacle itself
  v.camD = want < v.camD ? want : v.camD + (want - v.camD) * 0.1;
  var x = p.x + dx * v.camD, z = p.z + dz * v.camD, r, lim;
  if (sim.rect) { x = clamp(x, -sim.rect.hw + 2, sim.rect.hw - 2); z = clamp(z, -sim.rect.hd + 2, sim.rect.hd - 2); }
  else { r = hyp(x, z); lim = sim.R - 2; if (r > lim) { x *= lim / r; z *= lim / r; } }
  return { x: x, z: z, d: hyp(x - p.x, z - p.z) };
}

function renderView(pi) {
  var p = DP[pi], v = vis[pi], n = DP.length;
  var i, k;
  var flopAmt = p.stun > 0 ? Math.sin(PI * (1 - p.stun / p.stunMax)) : 0;
  var bob = Math.abs(Math.sin(v.phase)) * 3 * v.moving * (p.y <= p.gy + 0.5 ? 1 : 0);
  var tpv = !!sim.cfg.tpv && !p.fell;              // third-person chase camera (a fall uses the first-person view)
  var eye = p.fell ? 55 + p.y : Math.max(14, 55 + p.y - 38 * flopAmt - 22 * v.cr + bob);   // CAMERA height above the roof level
  var focal = F0 * (1 - 0.18 * v.kick);
  var camX = p.x, camZ = p.z, camD = 0, camTilt = 0, camBlend = 0;   // camera position: the puppet itself in first person
  if (tpv) {
    var eyeT = 55 + p.y - 12 * v.cr;               // steady anchor above the puppet: no head bob, no stun drop
    var cam = chaseCam(p, v, eyeT);
    camX = cam.x; camZ = cam.z; camD = cam.d;
    camBlend = clamp((camD - CAM_NEAR) / (CAM_FADE - CAM_NEAR), 0, 1);   // 0 = first person (jammed against something), 1 = full chase view
    eye = eyeT + CAM_UP * camD / CAM_DIST;         // the lift shrinks with the boom, so the view angle stays the same
    camTilt = Math.min(0.6, (eye - eyeT + CAM_AIM) / camD) * focal * camBlend;   // look down at the puppet's chest so it stays at screen centre; eases to level when the camera is jammed in
  } else v.camD = CAM_DIST;
  var selfAlpha = camBlend;                        // your own puppet fades out as the camera closes in on it
  var horizon = VH / 2 + (tpv ? 0 : flopAmt * 70) + Math.tan(v.pitch) * focal - camTilt;   // looking up moves the horizon down
  var depth = [];
  var AR = sim.R, fog = AR * 1.67;
  var viewOffset = (Net.mode == 'host' || Net.mode == 'client') ? 0 : pi * VW;

  ctx.save();
  ctx.beginPath(); ctx.rect(viewOffset, 0, VW, VH); ctx.clip();
  var shx = 0, shy = 0;
  if (shake > 0) { shx = (Math.random() - 0.5) * shake; shy = (Math.random() - 0.5) * shake; }
  ctx.translate(viewOffset + shx, shy);
  ctx.save();                                    // world layer (restored before the HUD); tilts a little while falling
  var tilt = p.fell ? Math.sin(clock * 5 + pi) * 0.06 * clamp(-p.vy / 500, 0, 1) : 0;
  if (tilt) {
    ctx.translate(VW / 2, VH / 2); ctx.rotate(tilt);
    ctx.scale(1 + 2.2 * Math.abs(tilt), 1 + 2.2 * Math.abs(tilt));
    ctx.translate(-VW / 2, -VH / 2);
  }

  // sky + floor. Roof: an open void with a city skyline; the roof surface is drawn per column below
  var rect = sim.rect, g, g2 = ctx.createLinearGradient(0, horizon, 0, horizon + VH / 2);
  // falling off the roof: past the wall you see the building facade rush by; through the skylight it is dark inside
  var outside = !!rect && (Math.abs(p.x) > rect.hw || Math.abs(p.z) > rect.hd);
  var facade = !!rect && p.fell && outside, pit = !!rect && p.fell && !outside;
  if (rect) {
    g = ctx.createLinearGradient(0, horizon - VH / 2, 0, horizon + VH / 2);
    g.addColorStop(0, '#0a1020'); g.addColorStop(0.5, '#34506e'); g.addColorStop(1, '#0b1118');
    ctx.fillStyle = g; ctx.fillRect(-10, -10, VW + 20, VH + 20);
    if (pit) { ctx.fillStyle = '#06090d'; ctx.fillRect(-10, -10, VW + 20, VH + 20); }
    g2.addColorStop(0, '#4a5662'); g2.addColorStop(1, '#222c36');
  } else {
    g = ctx.createLinearGradient(0, horizon - VH / 2, 0, horizon);
    g.addColorStop(0, '#0a1020'); g.addColorStop(1, '#2a3f58');
    ctx.fillStyle = g; ctx.fillRect(-10, -10, VW + 20, horizon + 10);
    g2.addColorStop(0, '#2b3a4a'); g2.addColorStop(1, '#10161e');
    ctx.fillStyle = g2; ctx.fillRect(-10, horizon, VW + 20, VH - horizon + 10);
  }

  // one vertical strip of wall or pillar, hgt = its height above the floor
  function strip(ci, tp, base, hgt) {
    var shade = clamp(1.1 - tp / fog, 0.3, 1);
    var top = horizon - (hgt - eye) * focal / tp;
    var bot = horizon + eye * focal / tp;
    ctx.fillStyle = 'rgb(' + Math.round(base[0] * shade) + ',' + Math.round(base[1] * shade) + ',' + Math.round(base[2] * shade) + ')';
    ctx.fillRect(ci * COLW, top, COLW, bot - top);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(ci * COLW, top, COLW, Math.max(1, (bot - top) * 0.05));
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(ci * COLW, bot - (bot - top) * 0.06, COLW, (bot - top) * 0.06);
  }

  // one ray per column: arena edge first, then pillars and boxes far to near
  var pillars = sim.pillars, boxes = sim.boxes || NOBOX, hits = [], hi, wallD = [], hq, bb;
  var cx = camX, cz = camZ;                        // ray origin for every column
  if (rect && !facade) { cx = clamp(cx, -rect.hw + 2, rect.hw - 2); cz = clamp(cz, -rect.hd + 2, rect.hd - 2); }
  var NC = pit ? 0 : NCOL, holes = sim.holes || NOBOX;
  // colour of a top face: lighter than the sides, fogged by distance
  function topCol(c, tp) {
    var f3 = clamp(1.1 - tp / fog, 0.3, 1);
    return 'rgb(' + Math.round(Math.min(255, c[0] * 1.25 + 14) * f3) + ',' + Math.round(Math.min(255, c[1] * 1.25 + 14) * f3) + ',' + Math.round(Math.min(255, c[2] * 1.25 + 14) * f3) + ')';
  }
  for (i = 0; i < NC; i++) {
    var cxs = i * COLW + COLW / 2 - VW / 2;
    var a = Math.atan(cxs / focal);
    var ca2 = Math.cos(a);
    var ang = p.a + a;
    var dx = Math.cos(ang), dz = Math.sin(ang);
    var tmin, u, alt, wd;
    if (facade) {
      // outside the building: the wall below the roof lip with rows of windows rushing upward
      var fix = Math.abs(dx) < 1e-6 ? 1e-6 : dx, fiz = Math.abs(dz) < 1e-6 ? 1e-6 : dz;
      var fx1 = (-rect.hw - cx) / fix, fx2 = (rect.hw - cx) / fix, fz1 = (-rect.hd - cz) / fiz, fz2 = (rect.hd - cz) / fiz;
      var fnx = Math.min(fx1, fx2), fnz = Math.min(fz1, fz2), ftn = Math.max(fnx, fnz), ftf = Math.min(Math.max(fx1, fx2), Math.max(fz1, fz2));
      tmin = 0; wd = 1e9;
      if (ftn < ftf && ftn > 0) {
        wd = Math.max(1, ftn * ca2);
        u = fnx > fnz ? cz + dz * ftn : cx + dx * ftn;
        var fTop = horizon + (eye - rect.lip) * focal / wd, fBot = Math.min(VH + 2, horizon + (eye + 900) * focal / wd);
        var fsh = clamp(1.1 - wd / fog, 0.35, 1) * (fnx > fnz ? 1 : 0.82);
        ctx.fillStyle = 'rgb(' + Math.round(104 * fsh) + ',' + Math.round(108 * fsh) + ',' + Math.round(116 * fsh) + ')';
        ctx.fillRect(i * COLW, fTop, COLW, fBot - fTop);
        var uf = ((u % 40) + 40) % 40, ub = Math.floor(u / 40);
        if (uf > 12 && uf < 28) {
          for (var wh = rect.lip - 26, wr = 0; wr < 40; wh -= 34, wr++) {
            var wy0 = horizon + (eye - wh) * focal / wd;
            if (wy0 > VH) break;
            var wy1 = horizon + (eye - wh + 16) * focal / wd;
            if (wy1 < 0) continue;
            ctx.fillStyle = (((ub * 7 + wr * 13) & 3) == 0) ? 'rgba(255,214,120,' + (0.65 * fsh) + ')' : 'rgba(18,28,42,0.9)';
            ctx.fillRect(i * COLW, wy0, COLW, wy1 - wy0);
          }
        }
      } else {                                               // the ray misses the building: distant skyline
        var fbld = Math.floor(ang * 6), fbh = ((fbld * 2654435761) >>> 0) % 1000 / 1000, fsy = horizon - 14 - fbh * 100;
        ctx.fillStyle = (fbld & 1) ? '#111b29' : '#0d1622';
        ctx.fillRect(i * COLW, fsy, COLW, horizon + 50 - fsy);
      }
    } else if (rect) {
      var tx = dx > 0.00001 ? (rect.hw - cx) / dx : (dx < -0.00001 ? (-rect.hw - cx) / dx : 1e9);
      var tz = dz > 0.00001 ? (rect.hd - cz) / dz : (dz < -0.00001 ? (-rect.hd - cz) / dz : 1e9);
      tmin = Math.max(1, Math.min(tx, tz));
      u = tx < tz ? cz + dz * tmin : cx + dx * tmin;           // position along the edge, for the stripe pattern
      alt = Math.floor(u / 36) & 1;
      wd = Math.max(1, tmin * ca2);
      var botY = horizon + eye * focal / wd, lipY = horizon + (eye - rect.lip) * focal / wd;
      if (botY < VH) {
        ctx.fillStyle = g2; ctx.fillRect(i * COLW, botY, COLW, VH - botY + 1);                    // the roof surface
        for (k = 0; k < holes.length; k++) {                                                       // floor holes (skylight): dark glass
          bb = holes[k];
          var hix = Math.abs(dx) < 1e-6 ? 1e-6 : dx, hiz = Math.abs(dz) < 1e-6 ? 1e-6 : dz;
          var hx1 = (bb.x - bb.hw - cx) / hix, hx2 = (bb.x + bb.hw - cx) / hix, hz1 = (bb.z - bb.hd - cz) / hiz, hz2 = (bb.z + bb.hd - cz) / hiz;
          var hn = Math.max(Math.min(hx1, hx2), Math.min(hz1, hz2)), hf = Math.min(Math.max(hx1, hx2), Math.max(hz1, hz2));
          if (hn < hf && hf > 0 && eye > 0) {
            var yN = Math.min(VH + 2, horizon + eye * focal / Math.max(1, Math.max(hn, 1) * ca2));
            var yF = Math.max(botY, horizon + eye * focal / Math.max(1, hf * ca2));
            if (yN > yF) {
              ctx.fillStyle = '#070d14'; ctx.fillRect(i * COLW, yF, COLW, yN - yF);
              ctx.fillStyle = 'rgba(150,185,215,0.30)'; ctx.fillRect(i * COLW, yF, COLW, 2);
              if (hn > 1 && yN < VH) ctx.fillRect(i * COLW, yN - 2, COLW, 2);
            }
          }
        }
      }
      var bld = Math.floor(ang * 6), bh = ((bld * 2654435761) >>> 0) % 1000 / 1000;               // skyline beyond the edge
      var skyY = horizon - 14 - bh * 100;
      if (skyY < lipY) {
        ctx.fillStyle = (bld & 1) ? '#111b29' : '#0d1622';
        ctx.fillRect(i * COLW, skyY, COLW, lipY - skyY);
        if (bh > 0.3 && (i & 3) == 1) {
          ctx.fillStyle = 'rgba(255,214,120,0.55)';
          for (var wy = skyY + 8; wy < lipY - 4 && wy < skyY + 90; wy += 9) ctx.fillRect(i * COLW, wy, 2, 3);
        }
      }
      strip(i, wd, alt ? [122, 128, 134] : [104, 110, 116], rect.lip);
    } else {
      var bt = cx * dx + cz * dz;
      var cc = cx * cx + cz * cz - AR * AR;
      tmin = -bt + Math.sqrt(Math.max(0, bt * bt - cc));
      u = Math.atan2(cz + dz * tmin, cx + dx * tmin);
      alt = Math.floor((u + PI) * 10 / PI) & 1;
      wd = Math.max(1, tmin * ca2);
      strip(i, wd, alt ? [58, 78, 104] : [48, 66, 90], WALL_H);
    }
    depth[i] = wallD[i] = wd;
    hits.length = 0;
    for (k = 0; k < pillars.length; k++) {
      var ex = cx - pillars[k].x, ez = cz - pillars[k].z;
      var b = ex * dx + ez * dz;
      var c2 = ex * ex + ez * ez - pillars[k].r * pillars[k].r;
      var disc = b * b - c2;
      if (disc >= 0) {
        var sq = Math.sqrt(disc), t = -b - sq;
        if (t > 0 && t < tmin) hits.push({ t: t, k: k, bx: 0, f: 0, tf: -b + sq, top: 0 });
      }
    }
    for (k = 0; k < boxes.length; k++) {                      // ray against an axis-aligned box (slab test)
      bb = boxes[k];
      var ix = Math.abs(dx) < 1e-6 ? 1e-6 : dx, iz = Math.abs(dz) < 1e-6 ? 1e-6 : dz;
      var x1 = (bb.x - bb.hw - cx) / ix, x2 = (bb.x + bb.hw - cx) / ix, z1 = (bb.z - bb.hd - cz) / iz, z2 = (bb.z + bb.hd - cz) / iz;
      var nx0 = Math.min(x1, x2), nz0 = Math.min(z1, z2), tn = Math.max(nx0, nz0), tf = Math.min(Math.max(x1, x2), Math.max(z1, z2));
      if (tn < tf && tn > 0 && tn < tmin) hits.push({ t: tn, k: k, bx: 1, f: nx0 > nz0 ? 0 : 1, tf: tf, top: 0 });
      else if (rect && !facade && tn <= 0 && tf > 0 && eye > bb.h) hits.push({ t: 0.01, k: k, bx: 1, f: 0, tf: tf, top: 1 });   // standing above it
    }
    hits.sort(function (m, n2) { return n2.t - m.t; });
    for (hi = 0; hi < hits.length; hi++) {
      hq = hits[hi];
      var tp = Math.max(1, hq.t * ca2);
      if (hq.bx) {
        bb = boxes[hq.k];
        if (eye > bb.h) {                                      // seen from above: draw the top face (far edge down to the front edge)
          var tfd = Math.max(1, hq.tf * ca2), ty0 = horizon + (eye - bb.h) * focal / tfd;
          var ty1 = hq.top ? VH + 2 : horizon + (eye - bb.h) * focal / tp;
          ctx.fillStyle = topCol(bb.c, hq.top ? tfd : tp); ctx.fillRect(i * COLW, ty0, COLW, ty1 - ty0);
        }
        if (!hq.top) {
          var bs = hq.f ? 0.78 : 1;                            // the two face directions get different shading
          strip(i, tp, [bb.c[0] * bs, bb.c[1] * bs, bb.c[2] * bs], bb.h);
        }
      } else {
        var pk = pillars[hq.k];
        var pu = Math.atan2(cz + dz * hq.t - pk.z, cx + dx * hq.t - pk.x);
        var palt = Math.floor((pu + PI) * 3 / PI) & 1;
        var pc = pk.c ? (palt ? [pk.c[0] * 1.12, pk.c[1] * 1.12, pk.c[2] * 1.12] : pk.c) : (palt ? [176, 146, 110] : [150, 122, 92]);
        if (rect && eye > pk.h) {                              // roof pillars are true height: draw their tops too
          var ptf = Math.max(1, hq.tf * ca2), py0 = horizon + (eye - pk.h) * focal / ptf, py1 = horizon + (eye - pk.h) * focal / tp;
          ctx.fillStyle = topCol(pk.c || [150, 122, 92], tp); ctx.fillRect(i * COLW, py0, COLW, py1 - py0);
        }
        // circle maps draw pillars wall-high so their upper section does not reveal the wall texture
        // behind them (gameplay height is still pk.h). The roof has no wall behind, so it uses true heights.
        strip(i, tp, pc, rect ? pk.h : WALL_H);
      }
      depth[i] = tp;
    }
  }

  // screen y of the top of the nearest obstacle in front of distance dF in column ci (1e9 = none, -1e9 = fully blocked).
  // From above, a puppet behind a low obstacle is also hidden by that obstacle's top face (up to its far edge).
  // fy = height of the puppet's feet: a puppet standing on a box (fy >= box top - 2) is never clipped by that box.
  // Camera standing ABOVE a box's footprint (on a roof): the roof slab ends at the ray's exit edge, so a puppet on the
  // ground farther than that edge only shows above the exit edge's screen y (it must not draw through the roof)
  function colLim(ci, dF, fy) {
    var cs = ci * COLW + COLW / 2 - VW / 2, aa = Math.atan(cs / focal), an = p.a + aa;
    var ux = Math.cos(an), uz = Math.sin(an), cq = Math.cos(aa), lim = 1e9, kk, o2, ex2, ez2, b2, d3, sq, t3, tp3, tf3, y3, ix, iz, x1, x2, z1, z2, tn, tf, hh;
    if (wallD[ci] < dF) return -1e9;
    for (kk = 0; kk < pillars.length; kk++) {
      o2 = pillars[kk];
      ex2 = cx - o2.x; ez2 = cz - o2.z;
      b2 = ex2 * ux + ez2 * uz;
      d3 = b2 * b2 - (ex2 * ex2 + ez2 * ez2 - o2.r * o2.r);
      if (d3 >= 0) {
        sq = Math.sqrt(d3); t3 = -b2 - sq; tp3 = t3 * cq; tf3 = (-b2 + sq) * cq;
        if (t3 > 0 && tp3 < dF) {
          hh = rect ? o2.h : WALL_H;
          y3 = (rect && eye > hh && dF > tf3) ? horizon + (eye - hh) * focal / Math.max(1, tf3) : horizon - (hh - eye) * focal / tp3;
          if (y3 < lim) lim = y3;
        }
      }
    }
    for (kk = 0; kk < boxes.length; kk++) {
      o2 = boxes[kk];
      if (eye > o2.h && fy >= o2.h - 2) continue;              // standing on top of this box: it cannot hide you
      ix = Math.abs(ux) < 1e-6 ? 1e-6 : ux; iz = Math.abs(uz) < 1e-6 ? 1e-6 : uz;
      x1 = (o2.x - o2.hw - cx) / ix; x2 = (o2.x + o2.hw - cx) / ix; z1 = (o2.z - o2.hd - cz) / iz; z2 = (o2.z + o2.hd - cz) / iz;
      tn = Math.max(Math.min(x1, x2), Math.min(z1, z2)); tf = Math.min(Math.max(x1, x2), Math.max(z1, z2));
      tp3 = tn * cq; tf3 = tf * cq;
      if (tn < tf && tn > 0 && tp3 < dF) {
        y3 = (eye > o2.h && dF > tf3) ? horizon + (eye - o2.h) * focal / Math.max(1, tf3) : horizon - (o2.h - eye) * focal / tp3;
        if (y3 < lim) lim = y3;
      } else if (rect && !facade && tn <= 0 && tf > 0 && eye > o2.h && dF > tf3) {   // camera above the box: roof slab occludes the ground beyond its exit edge
        y3 = horizon + (eye - o2.h) * focal / Math.max(1, tf3);
        if (y3 < lim) lim = y3;
      }
    }
    return lim;
  }

  // opponent sprites, far to near. Low obstacles (crates, steps) hide only the part of a puppet behind them
  var ca = Math.cos(p.a), sa = Math.sin(p.a);
  var opps = [], oj, oo, ddx, ddz, nearest = null, offs = [];
  for (oj = 0; oj < n; oj++) {
    if (oj == pi && !tpv) continue;                // third person: your own puppet is drawn too
    oo = DP[oj];
    ddx = oo.x - camX; ddz = oo.z - camZ;
    opps.push({ j: oj, o: oo, dF: ddx * ca + ddz * sa, dR: -ddx * sa + ddz * ca, d: hyp(oo.x - p.x, oo.z - p.z) });
  }
  opps.sort(function (m, n2) { return n2.dF - m.dF; });
  for (k = 0; k < (pit ? 0 : opps.length); k++) {
    var op = opps[k], o = op.o, dF = op.dF, dR = op.dR, onScreen = false, me = op.j == pi;
    if (!me && (!nearest || op.d < nearest.d)) nearest = op;
    if (dF > 6) {
      var s = focal / dF;
      var sxc = VW / 2 + dR * s;
      var groundY = horizon + (eye - o.y) * s;
      var half = 28 * s;
      if (sxc + half > 0 && sxc - half < VW) onScreen = true;
      var c0 = Math.max(0, Math.floor((sxc - half) / COLW));
      var c1 = Math.min(NCOL - 1, Math.floor((sxc + half) / COLW));
      var da = o.a - p.a;
      var info = { cLat: Math.cos(da), cFwd: Math.sin(da), front: Math.cos(da) < 0,
                   shift: Math.sin(da) * 4, k: clamp(eye / dF * 1.2, 0.08, 0.6), air: o.y - o.gy };
      var headY = groundY - 105 * s, run = -1, runLim = 0, lim, hid, ci;
      for (ci = c0; ci <= c1 + 1; ci++) {
        lim = ci <= c1 ? colLim(ci, dF, o.y) : -1e9;
        hid = lim <= headY;
        if (run >= 0 && (hid || Math.abs(lim - runLim) > 6)) {
          ctx.save();
          ctx.beginPath(); ctx.rect(run * COLW, 0, (ci - run) * COLW, Math.min(VH, runLim)); ctx.clip();
          if (me) ctx.globalAlpha = selfAlpha;
          ctx.translate(sxc, groundY);
          ctx.scale(s, s);
          drawBody(op.j, o, vis[op.j], info);
          ctx.restore();
          run = -1;
        }
        if (!hid && run < 0) { run = ci; runLim = lim; }
      }
    }
    if (!onScreen && !me) offs.push(op);
  }

  // particles
  for (i = 0; i < parts.length; i++) {
    var q = parts[i];
    var qx = q.x - camX, qz = q.z - camZ;
    var qF = qx * ca + qz * sa, qR = -qx * sa + qz * ca;
    if (qF < 5) continue;
    var qs = focal / qF;
    var qsx = VW / 2 + qR * qs, qsy = horizon - (q.y - eye) * qs;
    var col = Math.floor(qsx / COLW);
    if (col < 0 || col >= NCOL || depth[col] < qF) continue;
    ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
    ctx.fillStyle = q.col;
    var sz = Math.max(1, q.size * qs);
    ctx.fillRect(qsx - sz / 2, qsy - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;

  if (!tpv) drawHands(pi, p, v, flopAmt);          // no first-person hands in third person
  ctx.restore();                                   // end of the (possibly tilted) world layer
  if (p.fell) {                                    // dropping: darker edges, then a white fade just before the respawn
    ctx.fillStyle = 'rgba(0,0,0,' + clamp((-p.y - 10) / 400, 0, 0.45) + ')'; ctx.fillRect(0, 0, VW, VH);
    if (p.y < -260) { ctx.fillStyle = 'rgba(255,255,255,' + clamp((-p.y - 260) / 100, 0, 1) + ')'; ctx.fillRect(0, 0, VW, VH); }
  }
  if (v.white > 0) { ctx.fillStyle = 'rgba(255,255,255,' + clamp(v.white, 0, 1) + ')'; ctx.fillRect(0, 0, VW, VH); }

  // tag flash
  if (v.flash > 0) {
    ctx.fillStyle = 'rgba(255,40,40,' + (v.flash * 0.5) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  // HUD
  if (p.isIt) {
    ctx.strokeStyle = 'rgba(255,50,50,' + (0.6 + 0.3 * Math.sin(clock * 8)) + ')';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, VW - 8, VH - 8);
  }
  text(NAMES[pi], 14, 28, 20, sh(COLS[pi], 0.2), 'left');
  for (k = 0; k < (sim.cfg.solo ? 0 : sim.cfg.wins); k++) {
    ctx.beginPath(); ctx.arc(20 + k * 18, 44, 6, 0, PI * 2);
    ctx.fillStyle = k < p.score ? sh(COLS[pi], 0.2) : '#2c3e50'; ctx.fill();
    ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 1; ctx.stroke();
  }
  if (!sim.cfg.solo) text('IT time ' + p.itT.toFixed(1) + 's', 14, 64, 12, '#9fb3c8', 'left');
  if (sim.mode == 'play' || sim.mode == 'countdown') {
    text(p.isIt ? 'TAG THEM!' : 'RUN!', VW / 2, 70, 22, p.isIt ? '#ff5252' : '#2ecc71');
  }
  // crosshair (not in third person: the screen centre is the puppet itself)
  if (!tpv) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(VW / 2 - 1, VH / 2 - 1, 3, 3); }
  // dash bar
  var bw = 120, bx = VW / 2 - bw / 2;
  ctx.fillStyle = '#222'; ctx.fillRect(bx, VH - 22, bw, 7);
  ctx.fillStyle = p.dashCd > 0 ? '#7f8c8d' : '#f1c40f';
  ctx.fillRect(bx, VH - 22, bw * (1 - Math.max(0, p.dashCd) / DASH_CD), 7);
  text('dash', VW / 2, VH - 28, 11, '#aaa');
  // speed readout (handy for finding techniques)
  text('spd ' + Math.round(hyp(p.vx, p.vz)), 14, VH - 14, 13, '#9fb3c8', 'left');
  // nearest opponent distance
  if (nearest) text((sim.cfg.solo ? 'dummy ' : 'opp ') + Math.round(nearest.d / 10) + 'm', VW - 14, VH - 14, 13, sh(COLS[nearest.j], 0.3), 'right');
  // arrows for opponents that are out of view, stacked at the screen edges
  var ai, ay, ax, ro;
  for (ai = 0; ai < offs.length; ai++) {
    ro = offs[ai];
    ay = VH / 2 - (offs.length - 1) * 16 + ai * 32;
    if (ro.dR > 0) { ax = VW - 20; poly([ax - 14, ay - 12, ax + 8, ay, ax - 14, ay + 12], sh(COLS[ro.j], 0.2)); }
    else { ax = 20; poly([ax + 14, ay - 12, ax - 8, ay, ax + 14, ay + 12], sh(COLS[ro.j], 0.2)); }
  }
  // events / state text
  if (msg.t < 0.9 && sim.mode != 'roundend' && sim.mode != 'matchend') {   // (the results card owns the screen at the end)
    ctx.globalAlpha = clamp(1 - msg.t / 0.9, 0, 1);
    text(msg.txt, VW / 2, 130, 44, msg.col);
    ctx.globalAlpha = 1;
  }
  if (sim.mode == 'countdown') {
    var cn = Math.max(1, Math.ceil(3 - sim.mt));
    text(cn, VW / 2, VH / 2 - 20, 80, '#fff');
  } else if (sim.mode == 'play' && sim.mt < 0.7 && !sim.cfg.solo) {
    text('GO!', VW / 2, VH / 2 - 20, 80, '#2ecc71');
  } else if (sim.mode == 'roundend' || sim.mode == 'matchend') {
    // Only a banner here, up near the top: screens.js draws the results card (who won and why) over the whole canvas.
    var endWon = sim.winner == pi, endTxt, endSz;
    if (sim.mode == 'matchend') { endTxt = endWon ? 'VICTORY' : 'DEFEAT'; endSz = 36; }
    else { endTxt = endWon ? 'ROUND WON' : 'ROUND LOST'; endSz = 30; }
    ctx.fillStyle = 'rgba(0,0,0,' + (sim.mode == 'matchend' ? 0.6 : 0.45) + ')'; ctx.fillRect(0, 0, VW, VH);   // dim this view; the banner goes on top of the dim
    var endW = endTxt.length * endSz * 0.6 + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(VW / 2 - endW / 2, 95 - endSz + 2, endW, endSz + 14);
    ctx.fillStyle = endWon ? '#2ecc71' : '#ff5252'; ctx.fillRect(VW / 2 - endW / 2, 95 - endSz + 2, endW, 3);
    text(endTxt, VW / 2, 95, endSz, endWon ? '#2ecc71' : '#ff5252');
  }
  ctx.restore();
}
