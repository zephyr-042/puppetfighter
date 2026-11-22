/* ============================================================================
   js/main.js
   MAIN: creates the sim, fits the canvas, keyboard + mouse handlers, onPress, the fixed-step game loop. Loads LAST.
   Loads after: everything
   ============================================================================ */
// =============================================================== WIRING
var sim = simNew();
simToTitle(sim);

// the canvas keeps its internal 960x480 and is scaled to the window; the info panel is only shown
// on the title screen so the game itself gets the whole window
var uiEl = document.getElementById('ui'), uiShown = true;
function fit() {
  var h = uiShown ? uiEl.offsetHeight : 0;
  var w = Math.max(320, Math.min(window.innerWidth - 12, (window.innerHeight - h - 16) * 2));
  cv.style.width = w + 'px';
  cv.style.height = (w / 2) + 'px';
}
function syncUI() {
  var show = sim.mode == 'title';
  if (show != uiShown) { uiShown = show; uiEl.style.display = show ? 'block' : 'none'; fit(); }
}
window.onresize = fit;
fit();

function exitLock() {
  var d = document;
  if (d.exitPointerLock) d.exitPointerLock();
  else if (d.mozExitPointerLock) d.mozExitPointerLock();
}
function onPress(k) {
  var i, j, on = Net.mode != 'local';
  if (k == 27) { paused = false; exitLock(); Input.mx = 0; if (Net.mode == 'client') leaveOnline(); else simToTitle(sim); return; }
  if (sim.mode == 'title') {
    if (k == 67) { sim.cfg.tpv = !sim.cfg.tpv; return; }     // camera is local-only, so guests may toggle it too
    if (Net.mode == 'client') return;
    if (k == 32 || k == 13) { if (Net.mode == 'host') hostStart(); else simStartMatch(sim); }
    else if (k == 84) sim.cfg.time = TIMES[(TIMES.indexOf(sim.cfg.time) + 1) % TIMES.length];
    else if (k == 77) sim.cfg.wins = WINS[(WINS.indexOf(sim.cfg.wins) + 1) % WINS.length];
    else if (k == 66) { sim.cfg.pillars = !sim.cfg.pillars; simPillars(sim); }
    else if (k == 86) { sim.cfg.map = (sim.cfg.map + 1) % MAPDEFS.length; simToTitle(sim); }
    else if (k == 71 && !on) { sim.cfg.solo = !sim.cfg.solo; simToTitle(sim); }
    else if (k == 78 && !on && sim.cfg.solo) { sim.cfg.n = sim.cfg.n >= MAXP ? 2 : sim.cfg.n + 1; simToTitle(sim); }
    else if (k == 76) sim.cfg.mouse = !sim.cfg.mouse;
    return;
  }
  if (sim.mode == 'matchend') { if (k == 32 || k == 13) simToTitle(sim); return; }
  if (k == 80) { if (Net.mode == 'local') paused = !paused; return; }
  if (k == 82 && sim.cfg.solo) { simStartRound(sim); return; }
  for (i = 0; i < 2; i++) {
    for (j = 0; j < MAPS[i].act.length; j++)
      if (MAPS[i].act[j] == k) Input.dashQ[i] = true;
    for (j = 0; j < MAPS[i].jump.length; j++)
      if (MAPS[i].jump[j] == k) Input.jumpQ[i] = true;
  }
}

// mouse: pointer lock when the browser has it, otherwise click-and-drag to turn
function lockChange() {
  var d = document, was = Input.locked;
  Input.locked = (d.pointerLockElement || d.mozPointerLockElement) === cv;
  if (Input.locked) Input.drag = false;
  if (was && !Input.locked && sim.mode != 'title' && Net.mode == 'local') paused = true;
}
if (document.addEventListener) {
  document.addEventListener('pointerlockchange', lockChange, false);
  document.addEventListener('mozpointerlockchange', lockChange, false);
}
cv.onmousedown = function (e) {
  e = e || window.event;
  if (!sim.cfg.mouse || sim.mode == 'title') return;
  // Always enable drag as a fallback. Some browsers expose the Pointer Lock
  // API but refuse the request (for example in restricted preview frames).
  Input.drag = true;
  Input.lx = e.clientX; Input.ly = e.clientY;
  if (canLock && !Input.locked) {
    try { (cv.requestPointerLock || cv.mozRequestPointerLock).call(cv); } catch (err) {}
  }
  paused = false;
};
document.onmouseup = function () { Input.drag = false; };
document.onmousemove = function (e) {
  e = e || window.event;
  if (paused || sim.mode == 'title') return;
  if (Input.locked) { Input.mx += (e.movementX || e.mozMovementX || 0); Input.my += (e.movementY || e.mozMovementY || 0); }
  else if (Input.drag) { Input.mx += e.clientX - Input.lx; Input.lx = e.clientX; Input.my += e.clientY - Input.ly; Input.ly = e.clientY; }
};

document.onkeydown = function (e) {
  e = e || window.event;
  var k = e.keyCode || e.which;
  if (k == 59) k = 186;
  if ((k >= 37 && k <= 40) || k == 32 || k == 13 || k == 191 || k == 188 || k == 190 || k == 186 || k == 222) {
    if (e.preventDefault) e.preventDefault();
  }
  var was = Input.keys[k];
  Input.keys[k] = true;
  if (!was) onPress(k);
};
document.onkeyup = function (e) {
  e = e || window.event;
  var k = e.keyCode || e.which;
  if (k == 59) k = 186;
  Input.keys[k] = false;
};

var acc = 0, last = new Date().getTime();
setInterval(function () {
  var now = new Date().getTime();
  var dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  if (dt <= 0) return;
  if (!paused) {
    acc += dt;
    var n = 0;
    while (acc >= STEP && n < 5) {
      if (Net.mode == 'client') {
        clientTick();                       // guest: predict own player, send numbered inputs
      } else {
        var evBefore = sim.ev.length;
        simStep(sim, Net.getInputs(sim), STEP);
        if (Net.mode == 'host') {
          // queue this tick's events so they reach the guest with the next snapshot
          if (sim.ev.length > evBefore) Net.pendingEvents = Net.pendingEvents.concat(sim.ev.slice(evBefore));
          // while disconnected nothing flushes this list; keep only the newest so a reconnect
          // does not replay a burst of old sounds/particles
          if (Net.pendingEvents.length > 40) Net.pendingEvents.splice(0, Net.pendingEvents.length - 40);
          Net.tk++; Net.ticks++;
          if (Net.ticks % NET_STATE_EVERY == 0) sendState();
        }
      }
      acc -= STEP; n++;
    }
    if (n >= 5) acc = 0;
  }
  if (Net.mode == 'host') hostMaintain(); else if (Net.mode == 'client') guestWatch();
  buildDP(dt);
  if (!paused) {
    handleEvents();
    updateVis(Math.min(dt, 0.05));
    updateParts(dt);
  }
  syncUI();
  render();
}, 16);
