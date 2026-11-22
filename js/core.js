/* ============================================================================
   js/core.js
   Canvas, constants, colours and tiny helpers shared by everything.
   Loads after: nothing (first game script)
   ============================================================================ */
var cv = document.getElementById('c');
var ctx = cv.getContext('2d');
var W = 960, H = 480, VW = 480, VH = 480, COLW = 2, NCOL = VW / COLW;
var PI = Math.PI, STEP = 1 / 60, DASH_CD = 1.3, MAXP = 6;
var F0 = (VW / 2) / Math.tan(33 * PI / 180);   // 66 degree field of view
var WALL_H = 100, SPRITE_H = 80;
var COLS = [[52, 152, 219], [230, 126, 34], [46, 204, 113], [155, 89, 182], [241, 196, 15], [26, 188, 156]];
var NAMES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
var TIMES = [20, 30, 45, 60], WINS = [1, 2, 3, 5];
var MOUSE_SENS = 0.005, PITCH_MAX = 0.6, PITCH_KEY = 1.6;   // radians per pixel, max look up/down, keyboard look speed

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function hyp(x, y) { return Math.sqrt(x * x + y * y); }
function setView(w, fovDeg) { VW = w; NCOL = w / COLW; F0 = (VW / 2) / Math.tan(fovDeg * PI / 360); }

