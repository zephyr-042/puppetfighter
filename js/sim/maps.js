/* ============================================================================
   js/sim/maps.js
   SIM: map data (MAPDEFS, round pillars, boxes). Add new maps here.
   Loads after: core.js
   ============================================================================ */
// =============================================================== SIM
// maps are data: arena (circle R, or an open rectangle `rect`), round pillars (grab-able) and boxes
// (platforms / crates). Add an entry here and cases in mapPillars() / mapBoxes().
var MAPDEFS = [{ name: 'Arena', R: 270 }, { name: 'Large', R: 420 },
               { name: 'Roof', R: 400, rect: { hw: 330, hd: 215, lip: 12 } }];   // rect = open rooftop 660 x 430, 12-high lip
var NOBOX = [];
function mapPillars(k) {
  var out = [], i, a;
  if (k == 0) {
    out.push({ x: -85, z: -75, r: 20, h: 40 });
    out.push({ x: 85, z: 75, r: 20, h: 40 });
    out.push({ x: -85, z: 75, r: 20, h: 40 });
    out.push({ x: 85, z: -75, r: 20, h: 40 });
  } else if (k == 1) {
    for (i = 0; i < 4; i++) { a = PI / 4 + i * PI / 2; out.push({ x: Math.cos(a) * 150, z: Math.sin(a) * 150, r: 22, h: 40 }); }
    for (i = 0; i < 8; i++) { a = PI / 8 + i * PI / 4; out.push({ x: Math.cos(a) * 300, z: Math.sin(a) * 300, r: 26, h: 40 }); }
    out.push({ x: 0, z: 0, r: 30, h: 40 });
  } else {
    // roof: two tall chimneys (grab them and sling off) and two low posts
    out.push({ x: -215, z: -120, r: 26, h: 110, c: [160, 76, 58] });
    out.push({ x: 215, z: 120, r: 26, h: 110, c: [160, 76, 58] });
    out.push({ x: -150, z: 60, r: 16, h: 44, c: [110, 125, 140] });
    out.push({ x: 150, z: -60, r: 16, h: 44, c: [110, 125, 140] });
  }
  return out;
}
// axis-aligned boxes: x,z = centre, hw/hd = half width/depth, h = height, c = colour. Solid below
// their top, walkable on top. Max jump height is ~64, so 18 / 24 / 38 / 54 are reachable in steps.
function mapBoxes(k) {
  var out = [];
  if (k == 2) {
    out.push({ x: 0, z: 0, hw: 70, hd: 45, h: 38, c: [112, 120, 130] });          // central deck
    out.push({ x: -98, z: 0, hw: 28, hd: 45, h: 18, c: [138, 144, 150] });        // deck steps
    out.push({ x: 98, z: 0, hw: 28, hd: 45, h: 18, c: [138, 144, 150] });
    out.push({ x: 0, z: -150, hw: 50, hd: 14, h: 26, c: [98, 106, 118] });        // low walls
    out.push({ x: 0, z: 150, hw: 50, hd: 14, h: 26, c: [98, 106, 118] });
    out.push({ x: -205, z: 112, hw: 30, hd: 22, h: 24, c: [148, 112, 72] });      // crates
    out.push({ x: 205, z: -112, hw: 30, hd: 22, h: 24, c: [148, 112, 72] });
    out.push({ x: -285, z: -60, hw: 28, hd: 50, h: 54, c: [104, 112, 124] });     // high perches + their steps
    out.push({ x: -240, z: -60, hw: 18, hd: 30, h: 24, c: [148, 112, 72] });
    out.push({ x: 285, z: 60, hw: 28, hd: 50, h: 54, c: [104, 112, 124] });
    out.push({ x: 240, z: 60, hw: 18, hd: 30, h: 24, c: [148, 112, 72] });
  }
  return out;
}
