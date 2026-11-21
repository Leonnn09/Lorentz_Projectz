PROJECT LORENTZ — a cyclotron you can build, break and ride
===========================================================
Built by Leonel, Michael, Gabriel and Marco.
Named after the Lorentz force, F = q(E + v x B): the electric part pushes the particle faster across the gap,
the magnetic part bends it into a circle.

Open index.html in any modern browser (Chrome, Edge, Firefox, Safari). No installation, no internet needed
(fonts load from Google Fonts when online; otherwise the page uses system fonts).

index.html       page structure: home, Cyclotron, Gauss gun, Race, Collider, Target Range and Physics screens
style.css        all styling: the "instrument bench" design (faceplates, glass screens, nixie readouts,
                   notebook paper), dark and light colour schemes, layout, controls
physics.js       the physics engine (pure functions, testable on its own):
                   electromagnet B = mu0*N*I/g, Lorentz force, exact circular orbits, gap acceleration,
                   relativity, fixed and frequency-following RF, live "chaos" engine (field changes mid-flight),
                   Bethe stopping power and ranges, relativistic collisions, mass-spectrometer racing,
                   reluctance coil gun (thick-solenoid field, saturation, RK4) and magnet-and-ball rifle
core.js          shared helpers: formatting, sound (Web Audio), particle effects, plotting, sliders, missions
lab.js           Cyclotron screen: machine view, graphs, verbose data, chaos mode, overload mode,
                   slow-motion replay, rainbow trails, measuring tape, stopwatch, field probe, notebook,
                   and the ride-along view (seen from just behind the particle, with its own slowed clock)
gauss.js         Gauss gun screen: multi-stage coil gun and the magnet-and-ball rifle, bullet time,
                   chronograph, ballistic pendulum, tin cans, coil heating, graphs and explanations
race.js          Particle Race screen: magnetic sprint and Cyclotron Grand Prix, photo-finish replay
collide.js       Collider screen: head-on collisions, Coulomb barrier, new particles, event display
targets.js       Target Range screen: slab stacks, Bragg curve, energy deposited, heating and damage
physics-page.js  Physics screen: figures, worked example with your settings, quiz
guide.js         beginner mode: Simple / Full detail switch, plain-language narration, ? tooltips
intro.js         the title sequence: the cyclotron spins up, the extracted beam burns the name in
                   (plays on opening; any key skips; add ?nointro to the address to turn it off)
main.js          navigation, home screen animation, guided tour, sound/colour/full-screen buttons, main loop

Explosions, heat glow and damage effects are illustrative; all numbers shown are computed from the physics.
