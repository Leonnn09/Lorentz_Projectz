PROJECT LORENTZ — a cyclotron you can build, break and ride
===========================================================
Built by Leonel, Michael, Gabriel and Marco.
Named after the Lorentz force, F = q(E + v x B): the electric part pushes the particle faster across the gap,
the magnetic part bends it into a circle.

Open index.html in any modern browser (Chrome, Edge, Firefox, Safari). No installation, no internet needed
(fonts load from Google Fonts when online; otherwise the page uses system fonts).
History on the Home page (dates, sizes, energies of real cyclotrons): AIP Center for History of Physics,
Lawrence Berkeley National Laboratory, TRIUMF.

index.html       page structure: home, Cyclotron, Gauss gun, Race, Collider, Target Range and Physics screens
style.css        all styling: the "instrument bench" design (faceplates, glass screens, glowing readouts,
                   notebook paper) with the team's handwriting on top (notes, masking tape, signatures);
                   five colour schemes (Rad Lab 1939 is the default; Night shift, Bakelite, Blueprint, Daylight),
                   layout, controls
physics.js       the physics engine (pure functions, testable on its own):
                   electromagnet B = mu0*N*I/g, Lorentz force, exact circular orbits, gap acceleration,
                   relativity, fixed and frequency-following RF, live "chaos" engine (field changes mid-flight),
                   Bethe stopping power and ranges, relativistic collisions, mass-spectrometer racing,
                   reluctance coil gun (thick-solenoid field, saturation, RK4) and magnet-and-ball rifle
core.js          shared helpers: formatting, sound (Web Audio), particle effects, plotting, sliders, missions
view3d.js        a small 3-D renderer on the 2-D canvas (orbit camera, perspective, shading, depth sorting)
                   with smooth metal shading, soft shadows and a lit floor; the 3D, full-screen and Ride
                   controls every screen shares (orbit camera, chase camera, drag to look around)
lab.js           Cyclotron screen: machine view (flat, 3D and ride-along), graphs, verbose data, chaos mode, overload mode,
                   slow-motion replay, rainbow trails, measuring tape, stopwatch, field probe, notebook,
                   and the ride-along view (seen from just behind the particle, with its own slowed clock)
gauss.js         Gauss gun screen: multi-stage coil gun and the magnet-and-ball rifle, bullet time,
                   chronograph, ballistic pendulum, tin cans, coil heating, graphs and explanations
race.js          Particle Race screen: magnetic sprint and Cyclotron Grand Prix, photo-finish replay
collide.js       Collider screen: head-on collisions, Coulomb barrier, new particles, event display
targets.js       Target Range screen: slab stacks, Bragg curve, energy deposited, heating and damage
physics-page.js  Physics screen: figures, worked example with your settings, quiz
guide.js         beginner mode: Simple / Full detail switch, plain-language narration, ? tooltips
intro.js         the title sequence: a handwritten cold open (Berkeley, 1931), the cyclotron spins up in 3-D
                   while the camera rises to look straight down, the extracted beam burns the name in, and the
                   four builders sign the plate (plays on opening; any key skips; add ?nointro to turn it off)
main.js          navigation, Home (live cyclotron with handwritten notes, station modules, cyclotrons drawn
                   to scale), guided tour, sound / colour scheme / full-screen buttons, main loop, and a guard
                   that keeps the bottom-right corner clear when a host adds a badge there (e.g. Netlify)

Explosions, heat glow and damage effects are illustrative; all numbers shown are computed from the physics.
