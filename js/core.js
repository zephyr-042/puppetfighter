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
var NAME_DEFAULTS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
var NAMES = NAME_DEFAULTS.slice();   // display names by player index. NAMES[0] = your own name (local / host); online they come from the host
var myName = 'Player';               // your chosen name, sanitized, may be '' (saved as localStorage 'pf_name')
var userFov = 90;                    // field of view in degrees, 65..115 (saved as localStorage 'pf_fov')
var TIMES = [20, 30, 45, 60], WINS = [1, 2, 3, 5];
// third-person chase camera (view only): distance behind the puppet, lift above its eye at full distance,
// how far below its eye the point held at screen centre is (aims at the chest, so feet and head both fit),
// closest the camera may be pulled in, safety gap to walls, and the two distances that blend to first person:
// at CAM_NEAR or closer the view is first person and the puppet is invisible, at CAM_FADE or further it is the full chase view
var CAM_DIST = 150, CAM_UP = 36, CAM_AIM = 10, CAM_MIN = 4, CAM_PAD = 8, CAM_NEAR = 16, CAM_FADE = 60;
var MOUSE_SENS = 0.005, PITCH_MAX = 0.6, PITCH_KEY = 1.6;   // radians per pixel, max look up/down, keyboard look speed

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function hyp(x, y) { return Math.sqrt(x * x + y * y); }
function setView(w, fovDeg) { VW = w; NCOL = w / COLW; F0 = (VW / 2) / Math.tan(fovDeg * PI / 360); }

// ---- player name + FOV settings. The panel is built here and inserted at the top of #ui, so index.html needs no changes
function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
// printable ASCII only, single spaces, trimmed, at most 12 characters. Used for local input AND for names that arrive over the network
function cleanName(s) {
  s = String(s == null ? '' : s).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').replace(/^\s+/, '').slice(0, 12);
  return s.replace(/\s+$/, '');
}
// back to P1..P6 (plain = true: do not put your own name at index 0, e.g. while joining as a guest)
function resetNames(plain) {
  var i;
  for (i = 0; i < NAME_DEFAULTS.length; i++) NAMES[i] = NAME_DEFAULTS[i];
  if (!plain) NAMES[0] = myName || 'P1';
}
var nameEl = null, fovEl = null, fovLabel = null;
function fovSplit() { return Math.round(userFov * 0.73); }       // split screen views are half as wide: narrower angle (90 -> 66)
// re-applies the FOV to the current view width right away (render() also does it every frame)
function fovApply() {
  setView(VW, VW >= 960 ? userFov : fovSplit());
  if (fovLabel) fovLabel.textContent = 'FOV: ' + userFov + '\u00B0';
}
function onNameEdit() {
  var v = nameEl.value.replace(/[^\x20-\x7E]/g, '');
  if (v.length > 12) v = v.slice(0, 12);
  if (v !== nameEl.value) nameEl.value = v;
  myName = cleanName(v);
  lsSet('pf_name', myName);
  if (typeof Net === 'undefined' || Net.mode != 'client') NAMES[0] = myName || 'P1';
  else if (Net.joined) sig('host', 'name', null, { name: myName });   // a guest tells the host about the change
}
function onFovEdit() {
  userFov = clamp(parseInt(fovEl.value, 10) || 90, 65, 115);
  lsSet('pf_fov', String(userFov));
  fovApply();
}
// keys typed into the panel must not reach the game's global key handlers (space would start the match)
function stopKeys(e) {
  e = e || window.event;
  if (e.stopPropagation) e.stopPropagation();
  if (e.keyCode == 13 && this && this.blur) this.blur();
}
(function buildSettings() {
  var ui = document.getElementById('ui'), box, l1, l2, sep, saved, f;
  saved = lsGet('pf_name');
  myName = saved === null ? 'Player' : cleanName(saved);
  f = parseInt(lsGet('pf_fov'), 10);
  userFov = (f >= 65 && f <= 115) ? f : 90;
  NAMES[0] = myName || 'P1';
  if (!ui) return;
  box = document.createElement('div');
  box.id = 'settingsPanel';
  box.style.cssText = 'max-width:960px;margin:10px auto 0;padding:8px 10px;border:1px solid #34495e;background:#101923;color:#ddd;font:13px monospace;text-align:center';
  l1 = document.createElement('label');
  l1.appendChild(document.createTextNode('Your Name '));
  nameEl = document.createElement('input');
  nameEl.id = 'playerName'; nameEl.type = 'text'; nameEl.maxLength = 12; nameEl.value = saved === null ? 'Player' : saved;
  nameEl.setAttribute('autocomplete', 'off'); nameEl.setAttribute('spellcheck', 'false');
  nameEl.style.cssText = 'width:120px;text-align:center;font:bold 14px monospace;padding:4px;background:#080d13;color:#fff;border:1px solid #526579';
  l1.appendChild(nameEl);
  sep = document.createElement('span');
  sep.style.cssText = 'padding:0 14px;color:#777';
  sep.appendChild(document.createTextNode('|'));
  l2 = document.createElement('label');
  fovLabel = document.createElement('span');
  fovLabel.id = 'fovLabel';
  fovLabel.style.cssText = 'display:inline-block;min-width:70px;color:#f1c40f';
  l2.appendChild(fovLabel);
  fovEl = document.createElement('input');
  fovEl.id = 'fovSlider'; fovEl.type = 'range'; fovEl.min = '65'; fovEl.max = '115'; fovEl.step = '1'; fovEl.value = String(userFov);
  fovEl.style.cssText = 'vertical-align:middle;width:200px';
  l2.appendChild(fovEl);
  box.appendChild(l1); box.appendChild(sep); box.appendChild(l2);
  ui.insertBefore(box, ui.firstChild);
  nameEl.oninput = onNameEdit; nameEl.onkeydown = stopKeys;
  fovEl.oninput = onFovEdit; fovEl.onkeydown = stopKeys;
  fovEl.onchange = function () { onFovEdit(); fovEl.blur(); };      // give the keyboard back to the game
  fovApply();
})();
