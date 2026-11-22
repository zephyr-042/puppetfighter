/* ============================================================================
   js/events.js
   Audio beeps and handleEvents(): turns sim events into sounds, particles and messages.
   Loads after: vis.js
   ============================================================================ */
// audio
var ac = null;
function beep(f, d, type, vol) {
  try {
    if (!ac) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ac = new C();
    }
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.value = f;
    g.gain.setValueAtTime(vol || 0.05, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + d);
  } catch (e) {}
}
function setMsg(t, c) { msg.txt = t; msg.col = c; msg.t = 0; }

function handleEvents() {
  var i, e;
  for (i = 0; i < sim.ev.length; i++) {
    e = sim.ev[i];
    if (e.t == 'dash') {
      burst3(e.x, e.z, 4, 8, 'rgb(200,200,200)', 90, 0.4, 3);
      beep(300, 0.1, 'sawtooth', 0.04);
    } else if (e.t == 'tag') {
      burst3(e.x, e.z, 40, 26, 'rgb(255,80,80)', 220, 0.7, 5);
      burst3(e.x, e.z, 40, 12, 'rgb(255,230,120)', 180, 0.6, 4);
      if (vis[e.b]) vis[e.b].flash = 1;
      shake = 10;
      setMsg('TAG!', '#ff5252');
      beep(180, 0.25, 'square', 0.07); beep(90, 0.3, 'sawtooth', 0.06);
    } else if (e.t == 'shove') {
      burst3(e.x, e.z, 40, 16, 'rgb(255,255,255)', 180, 0.5, 4);
      shake = 7; setMsg('BONK!', '#f1c40f');
      beep(240, 0.15, 'triangle', 0.08);
    } else if (e.t == 'jump') {
      burst3(e.x, e.z, 2, 5, 'rgb(190,190,190)', 60, 0.3, 3); beep(420, 0.08, 'triangle', 0.04);
    } else if (e.t == 'land') {
      burst3(e.x, e.z, 2, 6, 'rgb(190,190,190)', 70, 0.3, 3);
      if (e.v > 300) shake = 4;
      beep(120, 0.06, 'triangle', 0.04);
    } else if (e.t == 'slide') {
      burst3(e.x, e.z, 2, 8, 'rgb(200,200,200)', 80, 0.4, 3); beep(200, 0.15, 'sawtooth', 0.03);
    } else if (e.t == 'grab') {
      beep(520, 0.07, 'square', 0.04);
    } else if (e.t == 'fling') {
      burst3(e.x, e.z, e.y, 10, 'rgb(120,220,255)', 160, 0.4, 3); beep(700, 0.12, 'sawtooth', 0.05);
    } else if (e.t == 'fall') {
      shake = 6; setMsg('FELL OFF!', '#f1c40f'); beep(150, 0.4, 'sawtooth', 0.06);
    } else if (e.t == 'count') { beep(440, 0.12, 'square', 0.05); }
    else if (e.t == 'go') { beep(880, 0.3, 'square', 0.06); }
    else if (e.t == 'tick') { beep(660, 0.08, 'square', 0.04); }
    else if (e.t == 'roundend') { shake = 12; beep(200, 0.5, 'sawtooth', 0.07); }
    else if (e.t == 'matchend') { beep(523, 0.15, 'square', 0.06); beep(659, 0.15, 'square', 0.06); beep(784, 0.4, 'square', 0.06); }
  }
  sim.ev.length = 0;
}

