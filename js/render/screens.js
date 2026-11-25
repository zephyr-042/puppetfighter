/* ============================================================================
   js/render/screens.js
   RENDER (3/3): scoreboard, round / match results card, title screen, render() (picks split / solo / online layout), pause overlay.
   Loads after: render/view.js
   ============================================================================ */
// scoreboard for 3+ players in a real match
function drawBoard() {
  var i, y = 56, p;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W - 140, y - 16, 136, DP.length * 16 + 6);
  for (i = 0; i < DP.length; i++) {
    p = DP[i];
    ctx.fillStyle = sh(COLS[i], 0); ctx.fillRect(W - 134, y - 9, 9, 9);
    text(NAMES[i] + '  ' + p.score + '  ' + p.itT.toFixed(0) + 's' + (p.isIt ? ' IT' : ''), W - 120, y, 12, p.isIt ? '#ff6666' : '#ddd', 'left');
    y += 16;
  }
}

// ---------------------------------------------------------------- round / match results card
// Player indices in finishing order. Round end: lowest IT time first, and on a tie the player who is not IT right now
// comes first (exactly endRound's rule). Match end: most rounds won first, then the same IT-time order.
function resultsOrder(fin) {
  var idx = [], i, w = sim.winner;
  for (i = 0; i < DP.length; i++) idx.push(i);
  idx.sort(function (a, b) {
    var pa = DP[a], pb = DP[b];
    if (fin && pa.score != pb.score) return pb.score - pa.score;
    if (Math.abs(pa.itT - pb.itT) > 0.001) return pa.itT - pb.itT;
    if (pa.isIt != pb.isIt) return pa.isIt ? 1 : -1;
    return a - b;
  });
  // endRound decides who actually won (its 0.001 tie window is not transitive): never show anyone else on top
  if (w >= 0 && w < idx.length && idx[0] != w) { idx.splice(idx.indexOf(w), 1); idx.unshift(w); }
  return idx;
}

function drawResults() {
  var fin = sim.mode == 'matchend', n = DP.length, order = resultsOrder(fin), i, p, idx, ry, win, tied = false;
  var PW = 660, ROWH = n > 4 ? 30 : 32, x0 = Math.round((W - PW) / 2), y0 = 112, PH = 104 + n * ROWH + 44, cy = y0 + 104;
  var me = Net.mode == 'client' ? Net.me : (Net.mode == 'host' ? 0 : -1);          // "YOU" tag, online only
  // one decimal, unless two neighbours would look equal at one decimal (then the order would look arbitrary)
  var dec = 1;
  for (i = 1; i < n; i++) if (DP[order[i]].itT.toFixed(1) == DP[order[i - 1]].itT.toFixed(1) && DP[order[i]].itT != DP[order[i - 1]].itT) dec = 2;
  if (!fin && n > 1) tied = Math.abs(DP[order[0]].itT - DP[order[1]].itT) <= 0.001;

  // (each view has already dimmed itself, and the banner it drew stays bright)
  ctx.fillStyle = 'rgba(10,16,28,0.94)'; ctx.fillRect(x0, y0, PW, PH);
  ctx.strokeStyle = '#3d556e'; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, y0 + 1, PW - 2, PH - 2);
  text(fin ? 'FINAL MATCH RESULTS' : 'ROUND ' + sim.round + ' RESULTS', W / 2, y0 + 40, 28, '#fff');
  text(fin ? 'FIRST TO ' + sim.cfg.wins + ' ROUND WINS  -  LOWEST TIME AS IT WINS A ROUND' : 'LOWEST TIME AS IT WINS THE ROUND', W / 2, y0 + 64, 15, '#f1c40f');
  // column heads
  text('RANK', x0 + 22, y0 + 94, 11, '#7f8c8d', 'left');
  text('PLAYER', x0 + 96, y0 + 94, 11, '#7f8c8d', 'left');
  text(fin ? 'LAST ROUND IT' : 'IT TIME', x0 + 345, y0 + 94, 11, '#7f8c8d', 'right');
  text('ROUNDS WON', x0 + 480, y0 + 94, 11, '#7f8c8d', 'right');
  ctx.fillStyle = '#3d556e'; ctx.fillRect(x0 + 14, y0 + 99, PW - 28, 1);

  for (i = 0; i < n; i++) {
    idx = order[i]; p = DP[idx]; ry = cy + i * ROWH; win = i == 0;
    if (win) {
      ctx.fillStyle = 'rgba(241,196,15,0.22)'; ctx.fillRect(x0 + 10, ry + 2, PW - 20, ROWH - 4);
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2; ctx.strokeRect(x0 + 11, ry + 3, PW - 22, ROWH - 6);
    } else if (i % 2 == 0) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x0 + 10, ry + 2, PW - 20, ROWH - 4); }
    var tc = win ? '#ffe27a' : '#dfe6ee';
    text('#' + (i + 1), x0 + 22, ry + ROWH - 10, 22, tc, 'left');
    ctx.fillStyle = sh(COLS[idx], 0); ctx.fillRect(x0 + 68, ry + ROWH / 2 - 8, 16, 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 68.5, ry + ROWH / 2 - 7.5, 15, 15);
    text(NAMES[idx], x0 + 96, ry + ROWH - 10, 20, tc, 'left');
    if (idx == me) {
      ctx.fillStyle = '#34495e'; ctx.fillRect(x0 + 140, ry + ROWH / 2 - 8, 42, 16);
      text('YOU', x0 + 161, ry + ROWH / 2 + 4, 12, '#fff');
    }
    text(p.itT.toFixed(dec) + 's', x0 + 345, ry + ROWH - 10, 22, fin ? '#9fb3c8' : tc, 'right');
    text(p.score + ' / ' + sim.cfg.wins, x0 + 480, ry + ROWH - 10, 20, tc, 'right');
    if (win) {
      ctx.fillStyle = fin ? '#f1c40f' : '#2ecc71'; ctx.fillRect(x0 + 506, ry + ROWH / 2 - 10, 132, 20);
      text(fin ? 'CHAMPION' : '+1 POINT', x0 + 572, ry + ROWH / 2 + 5, 14, '#10161e');
    }
  }
  // footer: what happens next, and (if it applies) why a tie went the way it did
  var fy = cy + n * ROWH + 18;
  if (fin) text('SPACE / ENTER  -  BACK TO TITLE', W / 2, fy + 8, 14, '#fff');
  else {
    if (tied) { text('TIED AT ' + DP[order[0]].itT.toFixed(dec) + 's  -  NOT BEING IT WHEN TIME RAN OUT BREAKS THE TIE', W / 2, fy, 12, '#f1c40f'); fy += 18; }
    var left = Math.max(1, Math.ceil(3 - sim.mt));
    text((DP[sim.winner] && DP[sim.winner].score >= sim.cfg.wins ? 'MATCH RESULTS' : 'NEXT ROUND') + ' IN ' + left, W / 2, fy, 14, '#9fb3c8');
  }
}

function drawTitle() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a1020'); g.addColorStop(1, '#2a3f58');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  text('PUPPET TAG', W / 2, 70, 60, '#fff');
  text((sim.cfg.tpv ? 'third person' : 'first person') + ' - split screen, solo practice or online', W / 2, 98, 15, '#aaa');
  text('P1', 250, 140, 22, sh(COLS[0], 0.2));
  text('W / S  move', 250, 162, 14, '#ddd');
  text('Q / E  turn  (or mouse)', 250, 179, 14, '#ddd');
  text('A / D  strafe', 250, 196, 14, '#ddd');
  text('F  dash', 250, 213, 14, '#ddd');
  text('Space  jump', 250, 230, 14, '#ddd');
  text('Shift  slide (hold)', 250, 247, 14, '#ddd');
  text('C  grab pillar (hold)', 250, 264, 14, '#ddd');
  text('T / G  look up / down (or mouse)', 250, 281, 14, '#ddd');
  text('P2', 710, 140, 22, sh(COLS[1], 0.2));
  text('Up / Down  move', 710, 162, 14, '#ddd');
  text('Left / Right  turn', 710, 179, 14, '#ddd');
  text(',  /  .  strafe', 710, 196, 14, '#ddd');
  text('Enter  dash', 710, 213, 14, '#ddd');
  text('/  jump', 710, 230, 14, '#ddd');
  text(';  slide (hold)', 710, 247, 14, '#ddd');
  text("'  grab pillar (hold)", 710, 264, 14, '#ddd');
  text('[ / ]  look up / down', 710, 281, 14, '#ddd');
  text('Least time spent as IT when the clock ends wins the round. Touch someone while IT to tag.', W / 2, 304, 14, '#bbb');
  text('Dash into IT to shove them. Grab a pillar, spin up, release to fling where you look.', W / 2, 322, 14, '#bbb');
  var solo = sim.cfg.solo, on = Net.mode != 'local';
  text('[G] mode: ' + (on ? 'ONLINE (' + sim.p.length + ' player' + (sim.p.length == 1 ? '' : 's') + ' in lobby)' : (solo ? 'SOLO PRACTICE (idle dummies, no clock)' : '2 PLAYER SPLIT SCREEN')), W / 2, 344, 17, '#f1c40f');
  text('[L] mouse look (P1): ' + (sim.cfg.mouse ? 'on - click the game to capture' : 'off'), W / 2, 364, 17, '#f1c40f');
  text('[C] camera: ' + (sim.cfg.tpv ? 'THIRD PERSON' : 'FIRST PERSON'), W / 2, 384, 17, '#f1c40f');
  text('[T] round time: ' + (solo ? '-' : sim.cfg.time + 's'), 250, 408, 15, solo ? '#777' : '#f1c40f');
  text('[B] pillars: ' + (sim.cfg.pillars ? 'on' : 'off'), W / 2, 408, 15, '#f1c40f');
  text('[M] first to: ' + (solo ? '-' : sim.cfg.wins), 710, 408, 15, solo ? '#777' : '#f1c40f');
  text('[N] players: ' + (on ? sim.p.length + ' connected' : solo ? sim.cfg.n + ' (you + ' + (sim.cfg.n - 1) + ' dummies)' : '2'), 250, 430, 15, solo && !on ? '#f1c40f' : '#777');
  text('[V] map: ' + MAPDEFS[sim.cfg.map].name, 710, 430, 15, '#f1c40f');
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 4);
  text(Net.mode == 'client' ? 'Waiting for host to start...' : 'Press SPACE to start', W / 2, 458, 26, Net.mode == 'client' ? '#f1c40f' : '#2ecc71');
  ctx.globalAlpha = 1;
}

var paused = false;
var canLock = !!(cv.requestPointerLock || cv.mozRequestPointerLock);
function render() {
  if (sim.mode == 'title') { drawTitle(); return; }
  if (Net.mode == 'host' || Net.mode == 'client') {
    setView(960, userFov);
    renderView(Net.mode == 'client' ? Net.me : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 150, 0, 300, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 190, 0, 380, 22);
    text('ONLINE  |  ' + (Net.mode == 'host' ? 'HOST' : 'PLAYER ' + (Net.me + 1)) + '  |  ' + Net.room + '  |  ' + pingText(), W / 2, 16, 13, '#9fb3c8');
  } else if (sim.cfg.solo) {
    setView(960, userFov);
    renderView(0);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 150, 0, 300, 22);
    text('PRACTICE  -  R reset  -  P pause', W / 2, 16, 13, '#aaa');
  } else {
    setView(480, fovSplit());                      // Math.round(userFov * 0.73): 90 -> 66
    renderView(0);
    renderView(1);
    ctx.fillStyle = '#000'; ctx.fillRect(VW - 2, 0, 4, VH);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(W / 2 - 52, 0, 104, 48);
    var secs = Math.ceil(Math.max(0, sim.timeLeft));
    text(secs, W / 2, 34, 34, (secs <= 5 && sim.mode == 'play') ? '#ff5252' : '#fff');
    text('Round ' + sim.round, W / 2, 12, 11, '#7f8c8d');
  }
  var ended = sim.mode == 'roundend' || sim.mode == 'matchend';
  if (ended) drawResults();                                   // the card replaces the small scoreboard
  else if (!sim.cfg.solo && DP.length > 2) drawBoard();
  if (sim.cfg.mouse && !Input.locked && !paused && !ended) {
    text(canLock ? 'click to capture mouse' : 'drag the mouse to turn', W / 2, H - 50, 14, '#f1c40f');
  }
  if (paused) {
    dim(0.6);
    text('PAUSED', W / 2, H / 2, 50, '#fff');
    text(sim.cfg.mouse && canLock ? 'click or P to resume' : 'P to resume', W / 2, H / 2 + 34, 18, '#aaa');
  }
}
