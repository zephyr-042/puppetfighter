# Puppet Tag - handoff notes

```
   FILE MAP (load order = order in index.html; each file lists what it needs in its header)
     js/core.js             Canvas, constants, colours and tiny helpers shared by everything.
     js/sim/maps.js         SIM: map data (MAPDEFS, round pillars, boxes). Add new maps here.
     js/sim/state.js        SIM: state shape (players, game), snapshots, spawns, round / match start.
     js/sim/physics.js      SIM: per-player movement physics (stepP): walk, dash, jump, slide, pillar grab, boxes, roof edge, falling.
     js/sim/rules.js        SIM: tag / shove, player-vs-player collision, scoring, and the 60 Hz tick (simStep).
     js/input.js            INPUT: key maps, mouse state, readIn() -> {b: key bitmask, t: turn delta} per player.
     js/net/common.js       NET (1/4): architecture notes, tuning constants, wire format (pack/unpack), the Net object, signalling + ICE helpers.
     js/net/host.js         NET (2/4): host side: lobby, guest records, per-guest input queues, snapshots, start / maintain.
     js/net/guest.js        NET (3/4): guest side: join, prediction, reconciliation, interpolation, buildDP (displayed players), ping text.
     js/net/connection.js   NET (4/4): Supabase signalling + relay, room open / leave, room panel buttons. Runs DOM wiring at load.
     js/vis.js              VIS: local-only visuals: hand springs, crouch, vertical look (pitch), particles.
     js/events.js           Audio beeps and handleEvents(): turns sim events into sounds, particles and messages.
     js/render/draw.js      RENDER (1/3): drawing helpers, puppet body (drawBody), first-person hands (drawHands).
     js/render/view.js      RENDER (2/3): renderView(pi): chase camera (chaseCam), the raycaster, sky / floor, obstacles, sprites, HUD for one player view.
     js/render/screens.js   RENDER (3/3): scoreboard, title screen, render() (picks split / solo / online layout), pause overlay.
     js/main.js             MAIN: creates the sim, fits the canvas, keyboard + mouse handlers, onPress, the fixed-step game loop. Loads LAST.

   RULES FOR THE SPLIT
     - Classic <script> tags, no modules and no build step: all files share one global scope, exactly
       like the old single file (ES5, plain globals). Works from a static host or from file://.
     - A file may use at LOAD time (top-level statements) only what loaded before it. Inside
       functions it may call anything, because calls happen after every file has loaded.
       Top-level statements that run at load: core constants, `var Net`, `var sb = createClient`,
       DOM button wiring in net/connection.js, `ensureVis(MAXP)` in vis.js, and everything in main.js.
     - New file? Add its <script> tag in index.html at the right place and give it a header like the others.
     - Render/vis code reads players through DP[], never sim.p directly (see NET notes).
     - tools/build_single.py inlines everything back into one self-contained HTML file.

   WHAT THIS IS
     Single-file puppet tag game (third-person chase camera by default, first person with [C] on the title screen): local split screen (2 players), solo practice
     (1 human + up to 5 idle dummies), and online play for up to 6 players (host-authoritative,
     WebRTC data channels, Supabase Realtime only for signalling + a relay fallback).

   TAG RULES (N players)
     One player is IT. IT touching anyone passes the tag (1.4 s cooldown). Dashing into IT shoves
     them. Each player accumulates itT, the time spent as IT, during a round. When the clock ends
     the player with the LOWEST itT wins the round (tie: the one who is not IT). Stored in
     endRound(); a one-line change if you want a different rule. Solo practice has no clock.

   MAPS (MAPDEFS, mapPillars, mapBoxes, simPillars)
     A map is: arena (circle of radius R, or an open rectangle `rect` {hw, hd, lip}), round pillars
     (grab-able, optional colour c) and axis-aligned boxes (platforms/crates, walkable on top). The
     sim state carries R / rect / pillars / boxes; guests rebuild them from cfg.map + cfg.pillars, so
     maps must be deterministic. Maps: 0 Arena, 1 Large (circle), 2 Roof (rectangle, 660 x 430).
     Roof: the lip (12 high) blocks you unless you jump; past it there is no floor, so you fall
     (below y = -260 you respawn dazed at your spawn and become IT; simStep applies the IT swap via
     the `fell` flag). Circle maps are unchanged. Rendering: rect maps draw the void + a procedural
     skyline per column and the roof surface below the lip; boxes are ray-cast with a slab test.
     Box TOPS are not drawn (they look like floor); puppets behind low boxes are clipped per column.
     Heights are chosen for the jump (~64 high): 18 / 24 / 38 / 54 can be reached in steps.

   LAYOUT
     The canvas keeps its 960x480 internal size and is scaled by CSS to fit the window (fit()).
     The online panel + help text live in #ui, shown on the title screen and hidden in game, so
     the game gets the whole window. F11 for browser fullscreen.

   HISTORY
     v1  base game, movement verbs, online beta. Guest felt laggy (waited for host round trips).
     v2  guest-side prediction + reconciliation, host-puppet interpolation, numbered inputs with a
         host jitter buffer, events de-duplicated.
     v3  "gets laggier the longer you play, then freezes". Cause: message volume against
         Supabase's free-plan limit of 100 events/s (sent + delivered). Send rates are now
         NET_STATE_EVERY / NET_INPUT_EVERY ticks (host 20/s, guest 15/s = 70 events/s); sends are
         skipped while the channel is not joined; stale queued events are capped.
     v4  N-player sim (up to 6), map as data (two maps), multi-opponent renderer, IT-time scoring,
         window-fitted canvas and collapsible UI. Online is still 2 players; the guest uses Net.me.
     v5  online for up to 6 players: WebRTC star (host <-> each guest) with Supabase used only
         for signalling, lobby, compact per-guest snapshots, ping display, drop handling, and a
         relay fallback through Supabase for guests whose direct connection fails.
     v6  vertical look (pitch): view-only, stored in vis[i].pitch, applied as a y-shear of the
         horizon in renderView. Not part of the sim state or the network.
     v7  Roof map: open rectangular rooftop with boxes (platforms, steps, crates, perches), tall
         chimneys, falling off the edge, per-column puppet occlusion, skyline backdrop.

     v8  third-person camera (default; [C] on the title screen toggles first person). View only: no change to
         js/sim or js/net. sim.cfg.tpv is a local setting that is never sent, so each player picks their own.

   CAMERA (third person; renderView + chaseCam / camClearance in render/view.js, constants CAM_* in core.js)
     - renderView works from a camera position (camX, camZ) and height `eye`. In first person that is the puppet
       itself; in third person it is CAM_DIST behind it (straight back along -facing) and lifted CAM_UP, with the view
       tilted down so the puppet's chest (CAM_AIM below its eye) sits at screen centre. Every ray, box / pillar
       projection, particle and sprite sort uses the camera position, never p.x / p.z. Only `d` (nearest-opponent
       readout) is measured from the puppet.
     - One ray goes straight back from the puppet against the arena edge (circle or rect), pillars and boxes taller than
       the eye line - 10. The camera sits CAM_PAD short of the hit, never closer than CAM_MIN. It moves in at once and eases
       back out (vis[i].camD), so sliding along a wall does not pump. The lift scales with the distance, so the view angle is
       the same however far the camera is pulled in.
     - Jammed against something (distance < CAM_NEAR) the view blends to first person: the tilt goes to zero and the local
       puppet fades to invisible (alpha ramps up to full at CAM_FADE). Your own puppet is just another sprite in renderView
       (j == pi) and is skipped for the off-screen arrows and the nearest-opponent readout. No hands, no crosshair.
     - While falling (p.fell) the view is first person again: the facade / pit rendering is built for it.
     - The camera is a local-only view, so it works the same for the host, guests and split screen (each view has its own camD).
     - Tuning: CAM_DIST / CAM_UP / CAM_AIM in core.js. Larger CAM_DIST shows more but is pulled in constantly in the small Arena.

   NEXT IDEAS
     - Test with friends on different networks. If direct connections fail (strict NATs), add a
       TURN server to ICE_SERVERS; a free tier from a TURN provider is enough for friends.
     - Bots to fill empty slots, more maps (MAPDEFS + mapPillars), names/colours, kick, rematch
       without leaving the room.

   TESTING
     Local N-player testing needs no network: Solo, [N] picks 2-6 players (rest are idle dummies).
     Online: open the page in several windows/devices, Create room in one, Join in the others.
     To test the relay fallback, disable WebRTC on a guest (or block UDP); after about 8 s it
     switches to the relay and the status line says so.

   KNOWN LIMITS
     - Tags are decided by the host, so the guest sees them one network trip late.
     - The guest sees other puppets about INTERP_MS (100 ms) in the past by design.
     - Guest prediction does not model player-vs-player pushing; the host corrects it smoothly.
     - Pillars are drawn at wall height even though their gameplay height is pk.h.
     - The host tab must stay visible: browsers throttle background tabs and the sim slows down.
     - The relay fallback broadcasts every message to everyone in the room, so use it for 2
       players only. Joining is only possible from the lobby (title screen), not mid-match.
     - Online matches cannot be paused.
     - Third person: low boxes below the eye line do not block the camera boom (it passes over them); tall things do.
       The IT marker can poke off the top of a narrow split-screen view.
     - Pitch is a y-shear (horizon shift), not true 3D: walls stay vertical, so it is capped at
       +-0.6 rad (PITCH_MAX). Other puppets do not show where you are looking.
```
