/* ============================================================================
   js/render/screens.js
   RENDER (3/3): scoreboard, title screen, render() (picks split / solo / online layout), pause overlay.
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

function drawTitle() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a1020'); g.addColorStop(1, '#2a3f58');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  text('PUPPET TAG', W / 2, 70, 60, '#fff');
  text('first person - split screen, solo practice or online', W / 2, 98, 15, '#aaa');
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
  text('[G] mode: ' + (on ? 'ONLINE (' + sim.p.length + ' player' + (sim.p.length == 1 ? '' : 's') + ' in lobby)' : (solo ? 'SOLO PRACTICE (idle dummies, no clock)' : '2 PLAYER SPLIT SCREEN')), W / 2, 346, 17, '#f1c40f');
  text('[L] mouse look (P1): ' + (sim.cfg.mouse ? 'on - click the game to capture' : 'off'), W / 2, 368, 17, '#f1c40f');
  text('[T] round time: ' + (solo ? '-' : sim.cfg.time + 's'), 250, 394, 15, solo ? '#777' : '#f1c40f');
  text('[B] pillars: ' + (sim.cfg.pillars ? 'on' : 'off'), W / 2, 394, 15, '#f1c40f');
  text('[M] first to: ' + (solo ? '-' : sim.cfg.wins), 710, 394, 15, solo ? '#777' : '#f1c40f');
  text('[N] players: ' + (on ? sim.p.length + ' connected' : solo ? sim.cfg.n + ' (you + ' + (sim.cfg.n - 1) + ' dummies)' : '2'), 250, 416, 15, solo && !on ? '#f1c40f' : '#777');
  text('[V] map: ' + MAPDEFS[sim.cfg.map].name, 710, 416, 15, '#f1c40f');
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 4);
  text(Net.mode == 'client' ? 'Waiting for host to start...' : 'Press SPACE to start', W / 2, 455, 26, Net.mode == 'client' ? '#f1c40f' : '#2ecc71');
  ctx.globalAlpha = 1;
}

var paused = false;
var canLock = !!(cv.requestPointerLock || cv.mozRequestPointerLock);
function render() {
  if (sim.mode == 'title') { drawTitle(); return; }
  if (Net.mode == 'host' || Net.mode == 'client') {
    setView(960, 90);
    renderView(Net.mode == 'client' ? Net.me : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 150, 0, 300, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 190, 0, 380, 22);
    text('ONLINE  |  ' + (Net.mode == 'host' ? 'HOST' : 'PLAYER ' + (Net.me + 1)) + '  |  ' + Net.room + '  |  ' + pingText(), W / 2, 16, 13, '#9fb3c8');
  } else if (sim.cfg.solo) {
    setView(960, 90);
    renderView(0);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 150, 0, 300, 22);
    text('PRACTICE  -  R reset  -  P pause', W / 2, 16, 13, '#aaa');
  } else {
    setView(480, 66);
    renderView(0);
    renderView(1);
    ctx.fillStyle = '#000'; ctx.fillRect(VW - 2, 0, 4, VH);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(W / 2 - 52, 0, 104, 48);
    var secs = Math.ceil(Math.max(0, sim.timeLeft));
    text(secs, W / 2, 34, 34, (secs <= 5 && sim.mode == 'play') ? '#ff5252' : '#fff');
    text('Round ' + sim.round, W / 2, 12, 11, '#7f8c8d');
  }
  if (!sim.cfg.solo && DP.length > 2) drawBoard();
  if (sim.cfg.mouse && !Input.locked && !paused && sim.mode != 'matchend') {
    text(canLock ? 'click to capture mouse' : 'drag the mouse to turn', W / 2, H - 50, 14, '#f1c40f');
  }
  if (paused) {
    dim(0.6);
    text('PAUSED', W / 2, H / 2, 50, '#fff');
    text(sim.cfg.mouse && canLock ? 'click or P to resume' : 'P to resume', W / 2, H / 2 + 34, 18, '#aaa');
  }
}

