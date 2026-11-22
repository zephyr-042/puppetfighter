/* ============================================================================
   js/input.js
   INPUT: key maps, mouse state, readIn() -> {b: key bitmask, t: turn delta} per player.
   Loads after: core.js (reads `sim` at run time)
   ============================================================================ */
// =============================================================== INPUT
// bits: 1 fwd, 2 back, 4 turn L, 8 turn R, 16 strafe L, 32 strafe R, 64 dash, 128 jump, 256 slide, 512 grab
var MAPS = [
  { f: 87, b: 83, l: 81, r: 69, sl: 65, sr: 68, act: [70], jump: [32], slide: 16, grab: 67 },
  { f: 38, b: 40, l: 37, r: 39, sl: 188, sr: 190, act: [13], jump: [191], slide: 186, grab: 222 }
];
var Input = { keys: {}, dashQ: [false, false], jumpQ: [false, false], mx: 0, locked: false, drag: false, lx: 0, ly: 0, my: 0 };
function readBits(i) {
  var k = Input.keys, m = MAPS[i], b = 0;
  if (k[m.f]) b |= 1;
  if (k[m.b]) b |= 2;
  if (k[m.l]) b |= 4;
  if (k[m.r]) b |= 8;
  if (k[m.sl]) b |= 16;
  if (k[m.sr]) b |= 32;
  if (k[m.slide]) b |= 256;
  if (k[m.grab]) b |= 512;
  if (Input.dashQ[i]) { b |= 64; Input.dashQ[i] = false; }
  if (Input.jumpQ[i]) { b |= 128; Input.jumpQ[i] = false; }
  return b;
}
function readIn(i) {
  var t = 0;
  if (i == 0 && sim.cfg.mouse) { t = clamp(Input.mx * MOUSE_SENS, -1.2, 1.2); Input.mx = 0; }
  return { b: readBits(i), t: t };
}

