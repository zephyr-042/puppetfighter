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
    spawns: [{ x: -640, z: 30 }, { x: 640, z: 40 }, { x: -60, z: 330 }, { x: -250, z: -250 }, { x: 120, z: -20 }, { x: 300, z: 330 }] },
  // Complex: skyline parkour map, 2100 x 1360, 180-degree point symmetric (every object has a mirror at (-x,-z)).
  { name: 'Complex', R: 1100, rect: { hw: 1050, hd: 680, lip: 14 },
    spawns: [{ x: -900, z: -300 }, { x: 900, z: 300 }, { x: -900, z: 300 }, { x: 900, z: -300 }, { x: 0, z: -580 }, { x: 0, z: 580 }] }];
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
  } else if (k == 3) {
    // Complex: swing pillars (grab, orbit, release to fling). Half the set, mirrored through the origin below.
    var half = [{ x: 250, z: -200, c: [205, 205, 210] },     // flank the central catwalk
                { x: 930, z: -540, c: [200, 120, 60] },      // outer corners: slingshot round the corner platforms
                { x: 930, z: 540, c: [200, 120, 60] }];
    for (i = 0; i < half.length; i++) {
      out.push({ x: half[i].x, z: half[i].z, r: 24, h: 140, c: half[i].c });
      out.push({ x: -half[i].x, z: -half[i].z, r: 24, h: 140, c: half[i].c });
    }
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
  if (k == 3) {
    var BR = [128, 88, 74], DK = [112, 118, 128], T1 = [138, 144, 152], T2 = [168, 174, 182], LW = [98, 106, 118], AC = [150, 154, 160];
    // mirrored pair: the same box at (x,z) and (-x,-z)
    var m = function (x, z, hw, hd, h, c) { b(x, z, hw, hd, h, c); b(-x, -z, hw, hd, h, c); };
    // central catwalk: skybridge (92) with an upper deck (92) each side, tier-1 (48) landings, step crates (24)
    b(0, 0, 90, 22, 92, T2);
    m(200, 0, 110, 70, 92, T2);
    m(400, 0, 90, 70, 48, T1);
    m(400, -130, 36, 36, 24, W); m(460, 110, 36, 36, 24, W);
    // sightline blockers: 130 high, cannot be jumped from the ground (only from the 92 deck or by pillar fling)
    m(420, -300, 70, 55, 130, BR); m(640, 250, 55, 60, 130, BR);
    // corner platforms (48), each next to a swing pillar
    m(760, -470, 80, 60, 48, DK); m(760, 470, 80, 60, 48, DK);
    // low walls and AC units: dash lanes, cover, quick vaults
    m(760, -40, 14, 140, 26, LW); m(0, -480, 150, 14, 26, LW); m(230, -410, 60, 40, 40, AC);
  }
  return out;
}
// holes in the floor: stand over one and you fall (like the Roof skylight)
function mapHoles(k) {
  var out = [];
  if (k == 2) out.push({ x: -100, z: -30, hw: 110, hd: 70 });
  if (k == 3) { out.push({ x: 0, z: -260, hw: 70, hd: 55 }); out.push({ x: 0, z: 260, hw: 70, hd: 55 }); }   // skylights beside the catwalk
  return out;
}
