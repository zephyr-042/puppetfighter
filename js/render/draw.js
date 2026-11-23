/* ============================================================================
   js/render/draw.js
   RENDER (1/3): drawing helpers, puppet body (drawBody), first-person hands (drawHands).
   Loads after: core.js
   ============================================================================ */
// =============================================================== RENDER
function sh(c, a) {
  var r = [], i, v;
  for (i = 0; i < 3; i++) {
    v = a >= 0 ? c[i] + (255 - c[i]) * a : c[i] * (1 + a);
    r.push(Math.round(v));
  }
  return 'rgb(' + r.join(',') + ')';
}
function text(t, x, y, size, color, align) {
  ctx.fillStyle = color || '#fff';
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.textAlign = align || 'center';
  ctx.fillText(t, x, y);
}
function ell(x, y, rx, ry) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, PI * 2);
  ctx.restore();
}
function poly(pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}
function dim(a) { ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.fillRect(0, 0, W, H); }

// puppet seen from the front/back, local units, feet at (0,0), y up is negative.
// Crouch / slide pose (v.cr follows p.sl, which is on the wire, so every player shows it): shoulders and head sink
// 22, knees bend with the feet kicked forward and out, arms out for balance, body leans back.
function drawBody(idx, p, v, info) {
  var c = COLS[idx], i, s;
  var spd = hyp(p.vx, p.vz);
  var cr = p.stun > 0 ? 0 : v.cr;
  var moving = Math.min(1, spd / 150) * (1 - 0.85 * cr);
  var bob = Math.abs(Math.sin(v.phase)) * 2.5 * moving * (info.air > 0.5 ? 0 : 1);
  var flop = 0;
  if (p.stun > 0 && p.stunMax > 0) flop = Math.sin(PI * (1 - p.stun / p.stunMax)) * 1.45 * p.stunDir;
  var flail = p.stun > 0 ? Math.sin(clock * 22) * 12 : 0;
  var hx = clamp(v.hl * info.cLat + v.hf * info.cFwd, -18, 18);
  var hy = clamp(v.hf * 0.25, -6, 6);
  var hdx = clamp(v.dl * info.cLat + v.df * info.cFwd, -8, 8);
  var drop = 22 * cr;
  var hipY = -26 + drop * 0.45;

  // shadow (stays on the surface under the puppet)
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ell(0, info.air, 16 + 7 * cr, (16 + 7 * cr) * info.k); ctx.fill();

  ctx.save();
  ctx.rotate(flop);
  ctx.lineCap = 'round';
  if (cr > 0.001) {                                  // lean back while sliding (forward axis shows on screen through cFwd)
    var pvy = -30 + drop * 0.3;
    ctx.translate(0, pvy); ctx.rotate(-0.28 * cr * info.cFwd); ctx.translate(0, -pvy);
  }

  ctx.lineWidth = 5;
  for (i = 0; i < 2; i++) {
    s = i == 0 ? -1 : 1;
    var ph = v.phase + (i == 0 ? 0 : PI);
    var fx = s * 6 + Math.sin(ph) * moving * 6 + (p.stun > 0 ? flail * s : 0) + cr * (s * 7 + info.cFwd * 12);
    var lift = Math.max(0, Math.cos(ph)) * 5 * moving;
    var fy = -lift - 2 - cr * 3;
    var kx = (s * 5 + fx) / 2 + cr * (s * 4 + info.cFwd * 9), ky = (hipY - bob + fy) / 2 - cr * 5;
    ctx.strokeStyle = sh(c, -0.35);
    ctx.beginPath(); ctx.moveTo(s * 5, hipY - bob); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = sh(c, -0.5);
    ctx.fillRect(fx - 4, fy - 2, 8, 4);
  }

  ctx.fillStyle = sh(c, 0);
  ctx.fillRect(-8, -50 - bob + drop, 16, 24 - drop * 0.45);
  ctx.fillStyle = sh(c, 0.25);
  ctx.fillRect(-8, -50 - bob + drop, 16, 5);

  ctx.lineWidth = 4;
  for (i = 0; i < 2; i++) {
    s = i == 0 ? -1 : 1;
    var rx = s * 6, ay = 20;
    if (cr > 0.05) { rx = s * (6 + 9 * cr); ay = 20 - cr * 14; }
    if (p.dashT > 0) { rx = s * 10; ay = 4; }
    if (p.grab >= 0) { rx = s * 4; ay = -14; }
    if (p.stun > 0) { rx = s * (14 + flail * 0.4); ay = -6 + Math.cos(clock * 20 + i) * 8; }
    var shx = s * 10, shy = -48 - bob + drop;
    var ex = shx + rx + hx, ey = shy + ay + hy;
    ctx.strokeStyle = sh(c, -0.2);
    ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = sh(c, 0.35);
    ctx.fillRect(ex - 3, ey - 3, 6, 6);
  }

  var cx = hdx, cy = -63 - bob + drop, hs = 11;
  ctx.fillStyle = sh(c, 0.15);
  ctx.fillRect(cx - hs, cy - hs, hs * 2, hs * 2);
  poly([cx - hs, cy - hs, cx + hs, cy - hs, cx + hs + 6, cy - hs - 6, cx - hs + 6, cy - hs - 6], sh(c, 0.5));
  poly([cx + hs, cy - hs, cx + hs + 6, cy - hs - 6, cx + hs + 6, cy + hs - 6, cx + hs, cy + hs], sh(c, -0.25));
  if (p.stun > 0) {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    for (i = -1; i <= 1; i += 2) {
      var ex2 = cx + i * 5;
      ctx.beginPath(); ctx.moveTo(ex2 - 2, cy - 4); ctx.lineTo(ex2 + 2, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex2 + 2, cy - 4); ctx.lineTo(ex2 - 2, cy); ctx.stroke();
    }
  } else if (info.front) {
    for (i = -1; i <= 1; i += 2) {
      var ex3 = cx + info.shift + i * 5;
      ctx.fillStyle = '#fff'; ctx.fillRect(ex3 - 2, cy - 5, 4, 6);
      ctx.fillStyle = '#111'; ctx.fillRect(ex3 - 1 + (info.shift > 0 ? 1 : -1) * 0.5, cy - 3, 2, 3);
    }
  }
  ctx.restore();

  if (p.isIt) {
    var my = -100 + drop * 0.6 + Math.sin(clock * 8) * 4;
    poly([-9, my - 10, 9, my - 10, 0, my + 2], '#ff4444');
    text('IT', 0, my - 14, 14, '#ff6666');
  }
}

function drawHands(pi, p, v, horizonShift) {
  var i, s, bobx = Math.sin(v.phase) * 6 * v.moving, boby = Math.abs(Math.cos(v.phase)) * 6 * v.moving;
  var c = COLS[pi];
  var lowHands = v.cr * 25;
  for (i = 0; i < 2; i++) {
    s = i == 0 ? -1 : 1;
    var sx = VW / 2 + s * VW * 0.3, sy = VH + 20;
    var hx = VW / 2 + s * VW * 0.2 + v.hl * 3 + bobx * s * 0.5;
    var hy = VH - 80 - v.hf * 3 + boby + lowHands + v.pitch * 70;
    if (p.dashT > 0) { hx = VW / 2 + s * VW * 0.1; hy = VH - 190; }
    if (p.grab >= 0) { hx = VW / 2 + s * VW * 0.06; hy = VH - 150; }
    if (p.stun > 0) { hx = VW / 2 + s * (120 + Math.sin(clock * 20) * 30); hy = VH - 200 + Math.cos(clock * 18 + i) * 40; }
    ctx.lineCap = 'round';
    ctx.strokeStyle = sh(c, -0.25); ctx.lineWidth = 34;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = sh(c, 0.35);
    ctx.fillRect(hx - 18, hy - 18, 36, 36);
  }
}
