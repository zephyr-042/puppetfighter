/* ============================================================================
   js/sim/maps.js
   SIM: map data (MAPDEFS, round pillars, boxes, floor holes, spawns). Add new maps here.
   Loads after: core.js
   ============================================================================ */
// =============================================================== SIM
// maps are data: arena (circle R, or an open rectangle `rect`), round pillars (grab-able), boxes
// (platforms / crates), floor holes and optional fixed spawn points. Add an entry here and cases
// in mapPillars() / mapBoxes() / mapHoles().
var MAPDEFS = [{ name: 'Arena', R: 270 }, { name: 'Large', R: 420 },
  // Roof: a Gang Beasts style rooftop, 1520 x 1000. R is only used for fog distance on rect maps.
  { name: 'Roof', R: 900, rect: { hw: 760, hd: 500, lip: 12 },
    spawns: [{ x: -640, z: 30 }, { x: 640, z: 40 }, { x: -60, z: 330 }, { x: -250, z: -250 }, { x: 120, z: -20 }, { x: 300, z: 330 }] }];
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
    // roof. Everything round can be grabbed (orbit it, release to fling). Orbit radius reaches ~r+62,
    // so tall things stay >= 90 from the edge.
    out.push({ x: -500, z: 200, r: 26, h: 30, c: [90, 96, 104] });       // roof fans
    out.push({ x: -300, z: 330, r: 26, h: 30, c: [90, 96, 104] });
    out.push({ x: 120, z: -350, r: 26, h: 30, c: [90, 96, 104] });
    out.push({ x: 480, z: 250, r: 26, h: 30, c: [90, 96, 104] });
    out.push({ x: -640, z: -300, r: 22, h: 150, c: [205, 205, 210] });   // weather radar
    out.push({ x: 330, z: 150, r: 5, h: 220, c: [150, 150, 160] });      // antenna
    out.push({ x: -30, z: -380, r: 28, h: 100, c: [160, 76, 58] });      // chimneys
    out.push({ x: 640, z: 330, r: 28, h: 100, c: [160, 76, 58] });
  }
  return out;
}
// axis-aligned boxes: x,z = centre, hw/hd = half width/depth, h = height, c = colour. Solid below
// their top, walkable on top. Max jump height is ~64, so steps of 17 / 26 / 34 / 52 are reachable.
function mapBoxes(k) {
  var out = [], W = [148, 112, 72], G = [135, 140, 146], P = [98, 106, 118], A = [150, 154, 160];
  function b(x, z, hw, hd, h, c) { out.push({ x: x, z: z, hw: hw, hd: hd, h: h, c: c }); }
  if (k == 2) {
    // upper layer (north-east): a raised deck with steps, and the stairwell with its red door
    b(480, -300, 250, 160, 34, [118, 124, 132]);
    b(205, -300, 25, 70, 17, [140, 146, 152]);
    b(480, -118, 80, 22, 17, [140, 146, 152]);
    b(610, -390, 75, 55, 120, [126, 118, 110]);
    b(610, -332, 24, 3, 76, [185, 45, 45]);
    // billboards (ENJOY BEEF) along the south edge, OFFAL signs along the north
    b(-420, 455, 130, 7, 130, [200, 45, 45]);
    b(240, 455, 130, 7, 130, [225, 180, 45]);
    b(-380, -455, 60, 6, 90, [212, 212, 200]);
    b(-120, -455, 60, 6, 90, [212, 212, 200]);
    // air ducts, lower left
    b(-560, 330, 90, 28, 26, G);
    b(-650, 235, 28, 80, 26, G);
    // crate stacks (jump routes)
    b(-560, -180, 36, 36, 26, W); b(-488, -180, 36, 36, 52, W); b(-560, -108, 36, 36, 26, W);
    b(60, 250, 40, 30, 26, W); b(140, 250, 40, 30, 52, W);
    b(600, 120, 36, 36, 26, W); b(600, 192, 36, 36, 52, W);
    // low cover walls and air-conditioning units
    b(-250, -330, 100, 14, 26, P); b(260, 60, 14, 90, 26, P); b(-300, 120, 80, 14, 26, P);
    b(-20, -230, 55, 35, 40, A); b(330, -20, 45, 45, 30, A);
  }
  return out;
}
// holes in the floor: stand over one and you fall (like the Roof skylight)
function mapHoles(k) {
  var out = [];
  if (k == 2) out.push({ x: -100, z: -30, hw: 110, hd: 70 });
  return out;
}
