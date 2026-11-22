PROJECT LORENTZ — a cyclotron you can build, break and ride
===========================================================
Built by Leonel, Michael, Gabriel and Marco.
Named after the Lorentz force, F = q(E + v x B): the electric part pushes the particle faster across the gap,
the magnetic part bends it into a circle.

Open index.html in any modern browser (Chrome, Edge, Firefox, Safari). No installation, no internet needed
(fonts load from Google Fonts when online; otherwise the page uses system fonts).
History on the Home page (dates, sizes, energies of real cyclotrons): AIP Center for History of Physics,
Lawrence Berkeley National Laboratory, TRIUMF.

index.html       page structure: home, Cyclotron, Gauss gun, Collider and Physics screens
style.css        all styling: the "instrument bench" design (faceplates, glass screens, glowing readouts,
                   notebook paper) with the team's handwriting on top (notes, masking tape, signatures);
                   five colour schemes (Rad Lab 1939 is the default; Night shift, Bakelite, Blueprint, Daylight),
                   layout, controls
physics.js       the physics engine (pure functions, testable on its own):
                   electromagnet B = mu0*N*I/g, Lorentz force, exact circular orbits, gap acceleration,
                   relativity, fixed and frequency-following RF, live "chaos" engine (field changes mid-flight),
                   relativistic collisions, reluctance coil gun (thick-solenoid field, saturation, RK4) and
                   magnet-and-ball rifle; it still holds the Bethe stopping power and the mass-spectrometer race
                   (tested in test/test_physics2.js), although the Race and Target Range screens were removed
core.js          shared helpers: formatting, sound (Web Audio), particle effects, plotting, sliders, missions
view3d.js        a small 3-D renderer on the 2-D canvas (orbit camera, perspective, shading, depth sorting)
                   with smooth metal shading, soft shadows and a lit floor; the 3D, full-screen and Ride
                   controls every screen shares (orbit camera, chase camera, drag to look around)
lab.js           Cyclotron screen: machine view (flat, 3D and ride-along), graphs, verbose data, chaos mode, overload mode,
                   slow-motion replay, rainbow trails, measuring tape, stopwatch, field probe, notebook,
                   and the ride-along view (seen from just behind the particle, with its own slowed clock)
gauss.js         Gauss gun screen: multi-stage coil gun and the magnet-and-ball rifle, bullet time,
                   chronograph, ballistic pendulum, tin cans, coil heating, graphs and explanations
collide.js       Collider screen: head-on collisions, Coulomb barrier, new particles, event display
physics-page.js  Physics screen: figures, worked example with your settings, quiz
guide.js         beginner mode: Simple / Full detail switch, plain-language narration, ? tooltips (Simple keeps
                   only the main controls; anything marked data-level="expert" in index.html appears in Full)
intro.js         the title sequence: a handwritten cold open (Berkeley, 1931), the cyclotron spins up in 3-D
                   while the camera rises to look straight down, the extracted beam burns the name in, and the
                   four builders sign the plate (plays on opening; any key skips; add ?nointro to turn it off)
reallife.js      "In real life": where each station's physics is used (PET scans, proton therapy, Indonesia's
                   DECY-13 cyclotron, auroras, maglev, EMALS, solenoids, the LHC, the Web),
                   with small animations and sources; a drawer and a Home grid
realsim-physics.js   the physics of four real machines (pure functions, tested in test/test_realsim.js):
                   maglev — a long-stator linear synchronous motor, v = 2·tau·f, pull limited by current and power,
                     air drag 1/2·rho·Cd·A·v^2, braking as a generator; checked against Shanghai's timetable
                   catapult — EMALS (steady push) or steam (front-loaded push), engines and drag on the deck,
                     then lift, drag, thrust and gravity in the first seconds of flight after the bow
                   aurora — guiding-centre motion on a dipole field line: the spiral at f = |q|B/2·pi·gamma·m,
                     mu = p_perp^2/2mB conserved, the mirror force -mu dB/ds, the loss cone, the auroral
                     acceleration region (electric field along B), where electrons stop and what colour they make
                   LHC — CERN's ring: the field that holds a proton on the bend (B = p/q·rho), its speed (1 - beta),
                     laps per second, the energy gained per lap on the ramp, head-on vs fixed-target collision energy
realsim.js       "Real life, simulated": the four machines drawn and run inside their stations (maglev and
                   catapult in the Gauss gun, the aurora in the Cyclotron, the LHC in the Cyclotron and
                   the Collider), with controls, live readouts, graphs, the numbers with working, a check against
                   real-world data and sources. Each has a "Why is this here?" card that animates the station's
                   physics next to the real machine's and compares your own station settings with it. In Simple,
                   each simulation keeps only its main controls and shows key numbers in plain words
main.js          navigation, Home (live cyclotron with handwritten notes, station modules, cyclotrons drawn
                   to scale), guided tour, sound / colour scheme / full-screen buttons, main loop, and a guard
                   that keeps the bottom-right corner clear when a host adds a badge there (e.g. Netlify)

Explosions, heat glow and damage effects are illustrative; all numbers shown are computed from the physics.
