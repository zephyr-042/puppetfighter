/* ============================================================================
   js/sim/maps.js
   SIM: map data (MAPDEFS, round pillars, boxes, floor holes, spawns). Add new maps here.
   Loads after: core.js
   ============================================================================ */
// =============================================================== SIM
// maps are data: arena (circle R, or an open rectangle `rect`), round pillars (grab-able), boxes
// (platforms / crates), floor holes and optional fixed spawn points. Add an entry here and cases
// in mapPillars() / mapBoxes() / mapHoles(). Maps: 0 Arena, 1 Large, 2 Roof, 3 Complex, 4 District.
var MAPDEFS = [{ name: 'Arena', R: 270 }, { name: 'Large', R: 420 },
  // Roof: a Gang Beasts style rooftop, 1520 x 1000. R is only used for fog distance on rect maps.
  { name: 'Roof', R: 900, rect: { hw: 760, hd: 500, lip: 12 },
    spawns: [{ x: -640, z: 30 }, { x: 640, z: 40 }, { x: -60, z: 330 }, { x: -250, z: -250 }, { x: 120, z: -20 }, { x: 300, z: 330 }] },
  // Complex: skyline parkour map, 2100 x 1360, 180-degree point symmetric (every object has a mirror at (-x,-z)).
  { name: 'Complex', R: 1100, rect: { hw: 1050, hd: 680, lip: 14 },
    spawns: [{ x: -900, z: -300 }, { x: 900, z: 300 }, { x: -900, z: 300 }, { x: 900, z: -300 }, { x: 0, z: -580 }, { x: 0, z: 580 }] },
  // District: huge asymmetric parkour map, 4200 x 2700, four neighbourhoods round a central hub (no symmetry on purpose).
  // x: west -> east, z: north (-) -> south (+). Spawns, in player order: P1 west lane, P2 east lane (far apart, same distance
  // from the hub), then maze court, swing yard, north-east ground, docks. All stand on open floor, 200+ from anything.
  { name: 'District', R: 2200, rect: { hw: 2100, hd: 1350, lip: 14 },
    spawns: [{ x: -1480, z: 130 },
            { x: 1480, z: -120 },
            { x: -950, z: -650 },
            { x: -1500, z: 1000 },
            { x: 400, z: -1120 },
            { x: 1500, z: 1050 }] }];
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
  } else if (k == 4) {
    // District: 9 swing pillars, 180-200 tall, every one 110+ from walls, boxes, holes and the edge (orbit reaches r+62, plus the body)
    // NW maze
    out.push({ x: -1500, z: -480, r: 26, h: 190, c: [205, 205, 210] });               // maze plaza: sling out of the alley maze
    // NE scaffolding
    out.push({ x: 700, z: -1100, r: 26, h: 195, c: [200, 120, 60] });                 // north of the scaffolds: fling-jump up onto tier 1 / 2
    out.push({ x: 1200, z: -1060, r: 26, h: 185, c: [200, 120, 60] });                // beside the pit: fling across it
    // SW swing yard: three pillars about 300 apart, one fling each
    out.push({ x: -1600, z: 540, r: 26, h: 185, c: [205, 205, 210] });                // swing 1
    out.push({ x: -1330, z: 690, r: 26, h: 195, c: [205, 205, 210] });                // swing 2
    out.push({ x: -1060, z: 540, r: 26, h: 185, c: [205, 205, 210] });                // swing 3 (chain them across the yard)
    // SE docks
    out.push({ x: 1650, z: 900, r: 26, h: 200, c: [200, 120, 60] });                  // crane mast
    // hub
    out.push({ x: -400, z: -60, r: 26, h: 180, c: [205, 205, 210] });                 // hub W
    out.push({ x: 390, z: 30, r: 26, h: 180, c: [205, 205, 210] });                   // hub E
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
  if (k == 4) {
    // District. 42 boxes, none overlapping. Climbable platforms only ever rise by 40 or less (jump apex is ~64);
    // the 175 buildings and the 175 tower are sightline blockers and cannot be climbed.
    var BR = [128, 88, 74], T1 = [76, 86, 100], T2 = [94, 102, 116], T3 = [116, 124, 138], BG = [170, 134, 48], DK = [96, 102, 112];
    var RED = [168, 62, 50], BLU = [52, 96, 150], GRN = [60, 122, 86], ORG = [204, 132, 52], CORE = [112, 118, 128], STEP = [138, 144, 152];
    // ---- NORTH-WEST, The Maze Alley: h175 brick, alleys 100 wide, L-corners, T-junctions, an open court (spawn) and a plaza (pillar)
    b(-1700, -1150, 200, 50, 175, BR);      // L arm (with the stem below: a corner with a hiding pocket)
    b(-1550, -975, 50, 125, 175, BR);       // L stem
    b(-1250, -1100, 150, 100, 175, BR);     // block
    b(-850, -1130, 150, 70, 175, BR);       // block
    b(-560, -1050, 60, 150, 175, BR);       // tall block on the avenue
    b(-1800, -850, 100, 150, 175, BR);      // west block
    b(-1250, -850, 150, 50, 175, BR);       // T bar
    b(-1250, -700, 50, 100, 175, BR);       // T stem
    b(-560, -660, 60, 120, 175, BR);        // east block
    b(-1775, -400, 125, 100, 175, BR);      // plaza-side block
    b(-1100, -375, 150, 75, 175, BR);       // south block
    b(-710, -400, 90, 50, 175, BR);         // stub: second wall of an L with the east block
    // ---- NORTH-EAST, Multi-Tier Scaffolding: 36 -> 76 -> 116 (steps of 40), skybridges (h116, 44 wide) over the skylight pit
    b(570, -700, 140, 200, 36, T1);         // W1 tier 1
    b(780, -700, 70, 160, 76, T2);          // W2 tier 2
    b(925, -700, 75, 120, 116, T3);         // W3 tier 3, beside the pit
    b(1240, -700, 240, 22, 116, BG);        // skybridge A: across the pit
    b(1560, -700, 80, 120, 116, T3);        // E3 tier 3
    b(1710, -680, 70, 140, 76, T2);         // E2 tier 2
    b(1880, -700, 100, 200, 36, T1);        // E1 tier 1
    b(1560, -910, 22, 90, 116, BG);         // skybridge B: north to the tower deck
    b(1560, -1070, 120, 70, 116, T3);       // N3 tier 3
    b(1750, -1070, 70, 70, 76, T2);         // N2 tier 2
    b(1900, -1070, 80, 70, 36, T1);         // N1 tier 1
    // ---- SOUTH-WEST, The Swing Yard: open courtyard, one flank tower, low cover
    b(-760, 760, 90, 90, 175, DK);          // flank tower: sling round it
    b(-1810, 314, 90, 14, 26, P);           // low cover wall
    // ---- SOUTH-EAST, The Crate Docks: containers (h64 / h32), crate steps, low walls (h26)
    b(560, 380, 140, 50, 64, RED);          // container (red)
    b(740, 370, 40, 40, 32, W);             // crate step up to it
    b(700, 610, 140, 50, 64, BLU);          // container (blue)
    b(880, 620, 40, 40, 32, W);             // crate step
    b(1130, 448, 130, 48, 32, GRN);         // low container (green)
    b(1300, 460, 40, 40, 32, W);            // crate
    b(1380, 460, 40, 40, 64, W);            // crate stack top (64)
    b(1130, 748, 130, 48, 64, ORG);         // container (orange)
    b(1300, 750, 40, 40, 32, W);            // crate step
    b(520, 860, 100, 14, 26, P);            // low wall
    b(1474, 660, 14, 100, 26, P);           // low wall
    // ---- CENTRAL HUB: stepped core 36 -> 72, crate, low wall
    b(0, 0, 120, 80, 72, CORE);             // core (72)
    b(-170, 0, 50, 60, 36, STEP);           // step W (36)
    b(10, -115, 70, 35, 36, STEP);          // step N (36)
    b(175, 20, 55, 50, 36, STEP);           // step E (36)
    b(230, 200, 40, 40, 36, W);             // crate (36)
    b(-260, 144, 80, 14, 26, P);            // low wall (26)
  }
  return out;
}
// holes in the floor: stand over one and you fall (like the Roof skylight)
function mapHoles(k) {
  var out = [];
  if (k == 2) out.push({ x: -100, z: -30, hw: 110, hd: 70 });
  if (k == 3) { out.push({ x: 0, z: -260, hw: 70, hd: 55 }); out.push({ x: 0, z: 260, hw: 70, hd: 55 }); }   // skylights beside the catwalk
  if (k == 4) {
    out.push({ x: 1200, z: -700, hw: 200, hd: 130 });   // NE pit under skybridge A
    out.push({ x: 60, z: -330, hw: 110, hd: 60 });   // hub skylight, north of the core
    out.push({ x: -70, z: 300, hw: 90, hd: 60 });   // hub skylight, south of the core
  }
  return out;
}
