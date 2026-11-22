/* =====================================================================
   Project Lorentz — "In real life" (CL.reallife).
   Where the physics of each station is used outside the classroom:
   hospitals, trains, aircraft carriers, CERN and the sky.
   A drawer opened from the top bar shows the stories for the current
   station (all of them on Home and Physics); Home also has a grid of them.
   Every number is checked against the sources listed with its story.
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, TAU, reduceMotion, fitCanvas } = CL;

  /* ---------------- the stories ---------------- */
  const PRESET = id => () => { CL.go('lab'); const s = $('#labPreset'); if (s) { s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); } };
  const CLICK = (screen, sel) => () => { CL.go(screen); setTimeout(() => { const b = $(sel); if (b) b.click(); }, 60); };
  const CARDS = {
    pet: {
      machine: 'Cyclotron', where: 'Hospitals', title: 'PET scans find cancer', art: 'pet',
      stat: ['110 min', 'half-life of fluorine-18: why the cyclotron must be close to the scanner'],
      text: [
        'A hospital cyclotron fires protons of about 10 to 20 MeV into water made with oxygen-18, turning some of it into fluorine-18. The fluorine is built into a sugar (FDG). Cancer cells use a lot of sugar, so they collect it and light up in the scan.',
        'Each fluorine-18 atom sends out a positron. It meets an electron and both turn into two gamma rays of 511 keV that fly off in opposite directions. The ring of detectors catches the pair, and the computer draws a line through the spot they came from.',
        'In Jakarta, cyclotrons for PET run at RSK Dharmais, MRCCC Siloam and RS Gading Pluit, and in November 2024 one opened at RS Mandaya Royal Puri in Tangerang.'],
      here: 'The default machine here reaches about 7.8 MeV. The hospital preset reaches about 17 MeV, inside the 10–20 MeV range used for fluorine-18.',
      try: ['Load the hospital PET cyclotron', PRESET('pet')], sim: 'pet',
      src: [['Kemenkes RI (Nov 2024): cyclotrons in Jakarta', 'https://kemkes.go.id/id/menkes-dorong-rumah-sakit-swasta-tingkatkan-layanan-dengan-teknologi-canggih-untuk-deteksi-kanker'],
        ['Silakhuddin, Jurnal Penelitian Saintek (UNY): ¹⁸O(p,n)¹⁸F with 10–20 MeV protons', 'https://journal.uny.ac.id/index.php/saintek/article/view/10555']],
    },
    decy: {
      machine: 'Cyclotron', where: 'Made in Indonesia', title: 'DECY-13, a cyclotron built by BRIN', art: 'decy',
      stat: ['13 MeV', 'about 140–157 keV gained on every turn'],
      text: [
        'Indonesia’s research agency BRIN is building its own cyclotron in Yogyakarta: DECY-13 (Development of Experimental Cyclotron in Yogyakarta, 13 MeV).',
        'It accelerates negative hydrogen ions (H⁻) to 13 MeV to make fluorine-18 for PET scans, so hospitals depend less on imported isotopes. In the design simulations the ions gain about 140 to 157 keV on each turn.'],
      here: 'Each turn crosses the gap twice, so the energy per turn is 2 × qV. Set the dee voltage to about 75 kV and the lab shows the same 150 keV per turn.',
      try: ['Set the dee voltage to 75 kV', () => { CL.go('lab'); setTimeout(() => { const n = $('#n-Vkv'); if (n) { n.value = '75'; n.dispatchEvent(new Event('change')); } }, 60); }],
      src: [['INDUSTRY.co.id: BRIN develops the DECY-13 cyclotron', 'https://www.industry.co.id/read/152149/brin-kembangkan-siklotron-decy-13-untuk-produksi-radioisotop-diagnosis-kanker'],
        ['UGM repository: DECY-13, Yogyakarta', 'https://etd.repository.ugm.ac.id/penelitian/detail/214267']],
    },
    therapy: {
      machine: 'Cyclotron', where: 'Cancer treatment', title: 'Proton therapy hits the tumour, not what is behind it', art: 'therapy',
      stat: ['230 MeV', 'protons at about two-thirds of the speed of light'],
      text: [
        'Treatment cyclotrons accelerate protons to about 230 MeV. An energy selector then slows the beam to anywhere between 70 and 230 MeV, to match how deep the tumour is.',
        'A proton loses most of its energy at the very end of its path (the Bragg peak), so the dose lands in the tumour. The tissue in front gets less, and the tissue behind it gets almost nothing.'],
      here: 'The Cyclotron has a 230 MeV therapy preset, modelled on one real therapy machine (IBA’s S2C2): a 5.7 T superconducting synchrocyclotron whose RF frequency follows the protons as relativity slows their turns.',
      try: ['Load the 230 MeV therapy machine', PRESET('therapy')],
      src: [['The Christie NHS: how proton beam therapy is delivered', 'https://christie.nhs.uk/patients-and-visitors/services/proton-beam-therapy/what-is-proton-beam-therapy/how-proton-beam-therapy-is-delivered']],
    },
    maglev: {
      machine: 'Gauss gun', where: 'Trains', title: 'Maglev trains are pulled by coils in the track', art: 'maglev',
      stat: ['603 km/h', 'record set by Japan’s L0 Series maglev, 2015'],
      text: [
        'A maglev train floats on magnetic forces. Its propulsion is a linear motor: coils in the guideway are switched on in turn, so their magnetic field travels along the track and pulls the magnets on the train forward.',
        'The Japanese L0 Series reached 603 km/h in 2015. The Shanghai maglev, from the airport to the city, carried passengers at up to 431 km/h.'],
      here: 'Your Gauss gun does the same with four coils: each one pulls the slug, then switches off as the slug reaches its middle.',
      try: ['Open the Gauss gun', () => CL.go('gauss')], sim: 'maglev',
      src: [['Wikipedia: Maglev (records, linear motors)', 'https://en.wikipedia.org/wiki/Maglev'], ['Wikipedia: SCMaglev', 'https://en.wikipedia.org/wiki/SCMaglev']],
    },
    emals: {
      machine: 'Gauss gun', where: 'Aircraft carriers', title: 'An electromagnetic catapult launches jets', art: 'emals',
      stat: ['± 3 mph', 'how close each launch gets to the speed the plane needs'],
      text: [
        'The aircraft carrier USS Gerald R. Ford launches planes with EMALS, a linear induction motor in the deck, instead of the steam catapults used since the 1950s.',
        'A row of coils pulls a shuttle along the track. A computer sets the energy for each aircraft, aiming for the exact take-off speed it needs, which is gentler on the plane.'],
      here: 'Try the switch-off point: switch a coil off too late and it pulls the slug back. EMALS times every coil by computer.',
      try: ['Open the Gauss gun', () => CL.go('gauss')], sim: 'catapult',
      src: [['Wikipedia: Electromagnetic Aircraft Launch System', 'https://en.wikipedia.org/wiki/Electromagnetic_Aircraft_Launch_System'], ['Electronic Design: EMALS power electronics', 'https://www.electronicdesign.com/technologies/power/article/21199416/carrier-based-launch-of-aircraft-to-use-power-electronics-instead-of-steam-catapult']],
    },
    solenoid: {
      machine: 'Gauss gun', where: 'All around you', title: 'Solenoids: a coil that yanks an iron rod', art: 'solenoid',
      stat: ['click', 'the sound of a car’s starter solenoid'],
      text: [
        'One coil and an iron plunger is a solenoid. Current makes the coil a magnet and it pulls the plunger in; a spring pushes it back when the current stops.',
        'Solenoids start cars, work electric door locks and washing-machine valves, and flip the flippers in pinball machines.'],
      here: 'A Gauss gun with a single coil is exactly this: a solenoid pulling a plunger, but you let the plunger fly out.',
      try: ['Open the Gauss gun', () => CL.go('gauss')],
      src: [['Northwestern Mechatronics: Solenoid theory', 'https://hades.mech.northwestern.edu/index.php/Solenoid_Theory'], ['HowStuffWorks: How solenoids work', 'https://science.howstuffworks.com/solenoid.htm']],
    },
    aurora: {
      machine: 'Cyclotron', where: 'The sky', title: 'Auroras: the Lorentz force at the poles', art: 'aurora',
      stat: ['100–240 km', 'height where the green glow is made'],
      text: [
        'The Sun sends out a wind of charged particles. Earth’s magnetic field turns most of them away, but some are caught and spiral along the field lines down to the polar regions.',
        'There they hit the upper air. Oxygen gives the common green light (557.7 nm), at roughly 100 to 240 km up.'],
      here: 'Earth is a giant cyclotron magnet: F = qv × B makes the particles circle its field lines with the cyclotron’s own frequency, f = qB/2πm. With no dees to push them round, they slide along the lines instead, a corkscrew down to the poles.',
      try: ['Open the cyclotron', () => CL.go('lab')], sim: 'aurora',
      src: [['NOAA Space Weather Prediction Center: aurora tutorial', 'https://www.swpc.noaa.gov/content/aurora-tutorial'], ['Science News Explores: how auroras light up the sky', 'https://www.snexplores.org/article/explainer-auroras-northern-lights-sky']],
    },
    lhc: {
      machine: 'Collider', where: 'CERN, Geneva', title: 'The LHC found the Higgs boson', art: 'lhc',
      stat: ['27 km', 'ring of 1232 superconducting bending magnets'],
      text: [
        'The Large Hadron Collider sends two proton beams around a 27 km ring in opposite directions and smashes them together. Its magnets are cooled to 1.9 K (−271.3 °C), colder than outer space.',
        'On 4 July 2012 the ATLAS and CMS experiments announced a new particle, the Higgs boson. From 2022 to 2026 the LHC collided protons at 13.6 TeV, the highest energy ever reached in a laboratory; it is now being upgraded to the High-Luminosity LHC.'],
      here: 'The LHC is the cyclotron’s big brother: the same r = p/(qB), but its 27 km ring cannot grow, so its magnets get stronger as the protons speed up. In the Collider, more energy makes heavier new particles, because E = mc² works both ways.',
      try: ['Make pions in the Collider', CLICK('collide', '#collPresets button[data-i="2"]')], sim: 'lhc',
      src: [['CERN: the Large Hadron Collider (facts and figures)', 'https://home.cern/science/accelerators/large-hadron-collider'], ['CERN: announcing the Higgs boson discovery', 'https://home.cern/news/series/cern70/cern70-announcing-higgs-boson-discovery'], ['CERN Courier: the LHC completes its third run', 'https://cerncourier.com/the-lhc-completes-its-third-run/']],
    },
    petscan: {
      machine: 'Collider', where: 'Hospitals', title: 'A PET scanner is a matter–antimatter collider', art: 'petscan',
      stat: ['36.5 %', 'of 22,975 patients got a different plan from their doctors after a PET scan'],
      text: [
        'Your Collider’s “Matter + antimatter” collision happens hundreds of millions of times a second inside a patient having a PET scan. The tracer gives off positrons, the electron’s antiparticle; each one meets an ordinary electron within about a millimetre, and both turn into two gamma rays of 511 keV.',
        'The pair was almost at rest, so the two gamma rays fly apart in opposite directions. A ring of crystals catches both and draws a line between them, through the spot. Thousands of lines cross where a cancer eats the most sugar.',
        'In a US registry of 22,975 PET scans, doctors changed the plan for 36.5 % of patients; of those who were going to have a biopsy, about 70 % no longer needed one.'],
      here: 'In the PET scanner simulation, switch the antimatter off: the same ring gets single flashes with no direction, and no picture. Switch time of flight off: the picture gets noisier.',
      try: ['Collide matter and antimatter', CLICK('collide', '#collPresets button[data-i="0"]')], sim: 'petscan',
      src: [['Hillner et al., J Clin Oncol 2008: the National Oncologic PET Registry', 'https://profiles.wustl.edu/en/publications/impact-of-positron-emission-tomographycomputed-tomography-and-pos/'],
        ['CERN: antimatter is used every day in hospitals, in PET scans', 'https://livefromcern-archive.web.cern.ch/antimatter/everyday/AM-everyday00.html'],
        ['CERN: how a PET scan works', 'https://livefromcern-archive.web.cern.ch/antimatter/everyday/AM-everyday01.html']],
    },
    tem: {
      machine: 'Cyclotron', where: 'Hospitals and labs', title: 'Electron microscopes saw the coronavirus first', art: 'tem',
      stat: ['1964', 'June Almeida sees the first coronavirus, in an electron microscope'],
      text: [
        'Light cannot show details much smaller than about 200 nm, because its waves are too long, and a virus is about 100 nm across. Electrons sped up through 200,000 volts behave like waves only 2.5 picometres long, so an electron microscope sees far finer detail.',
        'Glass cannot bend electrons, but a magnetic field can. Inside the coil of a magnetic lens each electron goes round in a circle, as in your cyclotron, and since the time for one turn does not depend on its sideways speed, every electron comes back to the axis at the same place: a focus.',
        'In 1964 June Almeida photographed the first coronavirus with one; its crown of spikes gave the family its name. In January 2020, scientists in China used electron microscopes to photograph the new virus behind COVID-19.'],
      here: 'Your cyclotron works because a particle’s time for one turn, T = 2πγm/(qB), does not depend on the size of its circle. In a magnetic lens that same fact brings every electron back to the axis after one turn.',
      try: ['Open the cyclotron', () => CL.go('lab')], sim: 'tem',
      src: [['National Geographic: June Almeida and the first coronavirus image', 'https://www.nationalgeographic.com/history/article/june-almeida-discovered-coronaviruses-decades-ago-little-recognition'],
        ['Chinese Academy of Sciences: the new coronavirus in the electron microscope (Zhu et al., NEJM 2020)', 'https://english.cas.cn/newsroom/cas_media/202001/t20200131_229807.shtml'],
        ['Nobel Prize in Physics 1986: Ruska and the magnetic lens', 'https://www.nobelprize.org/nobel_prizes/physics/laureates/1986/press.html'],
        ['University of Utah: electron wavelengths and light’s limit', 'https://advanced-microscopy.utah.edu/education/electron-micro/']],
    },
    web: {
      machine: 'Collider', where: 'Your phone', title: 'The Web was invented at a particle lab', art: 'web',
      stat: ['1989', 'Tim Berners-Lee’s proposal at CERN'],
      text: [
        'Physicists at CERN came from universities all over the world and needed to share their results. In 1989 Tim Berners-Lee proposed the World Wide Web to do that; the first website ran on his computer at CERN.',
        'On 30 April 1993 CERN put the Web software in the public domain, so anyone could use it for free.'],
      here: 'Big experiments make so much data that they keep inventing ways to share and process it.',
      try: null,
      src: [['CERN: a short history of the Web', 'https://home.cern/science/computing/birth-web/short-history-web'], ['CERN: the birth of the Web', 'https://home.cern/science/computing/birth-web']],
    },
  };
  const BY_SCREEN = {
    lab: ['pet', 'decy', 'therapy', 'tem', 'aurora'], gauss: ['maglev', 'emals', 'solenoid'], collide: ['petscan', 'lhc', 'web'],
  };
  const GROUPS = [['Cyclotron', ['pet', 'decy', 'therapy', 'tem', 'aurora']], ['Gauss gun', ['maglev', 'emals', 'solenoid']], ['Collider', ['petscan', 'lhc', 'web']]];
  const HOME_TILES = ['pet', 'petscan', 'tem', 'therapy', 'maglev', 'emals', 'aurora', 'lhc'];
  const SCREEN_OF = { pet: 'lab', decy: 'lab', therapy: 'lab', tem: 'lab', aurora: 'lab', maglev: 'gauss', emals: 'gauss', solenoid: 'gauss', petscan: 'collide', lhc: 'collide', web: 'collide' };
  const TITLE = { lab: 'the cyclotron', gauss: 'the Gauss gun', collide: 'the collider' };

  /* ---------------- the drawings: small looping animations ---------------- */
  const F = n => `600 ${n}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  function back(c, w, h) {
    c.fillStyle = '#070b0d'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1; c.beginPath();
    for (let x = 0.5; x < w; x += 22) { c.moveTo(x, 0); c.lineTo(x, h); }
    for (let y = 0.5; y < h; y += 22) { c.moveTo(0, y); c.lineTo(w, y); }
    c.stroke();
  }
  function txt(c, s, x, y, col = 'rgba(214,224,218,0.78)', al = 'left', n = 12) { c.font = F(n); c.fillStyle = col; c.textAlign = al; c.textBaseline = 'alphabetic'; c.fillText(s, x, y); }
  function glow(c, x, y, r, rgb, a = 1) { if (r <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  const rnd = (a, b) => a + Math.random() * (b - a);
  // half circles alternating between the dees, radius growing as the square root of the number of pushes (as on Home)
  function spiralArcs(R, n) {
    const out = []; let y = 0;
    for (let k = 0; k < n; k++) { const up = k % 2 === 0, r = R * Math.sqrt((k + 1) / n), c = up ? y - r : y + r; out.push({ r, cy: c, a0: up ? Math.PI / 2 : -Math.PI / 2 }); y = up ? c - r : c + r; }
    const sh = (out[n - 1].cy + out[n - 2].cy) / 2; for (const a of out) a.cy -= sh;
    return out;
  }
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  const ART = {
    // positron + electron → two 511 keV gamma rays, back to back; the ring lights where they land
    pet(c, w, h, t, st) {
      back(c, w, h);
      const cx = w * 0.5, cy = h * 0.52, R = Math.min(w * 0.34, h * 0.42), N = 36;
      if (!st.hits) { st.hits = new Array(N).fill(-9); st.ev = []; st.next = 0; }
      c.fillStyle = '#152029'; c.strokeStyle = 'rgba(150,185,200,0.22)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(cx, cy, R * 0.66, R * 0.5, 0, 0, TAU); c.fill(); c.stroke();
      const tx = cx + R * 0.22, ty = cy - R * 0.12;
      glow(c, tx, ty, R * 0.22, '220,80,130', 0.5 + 0.15 * Math.sin(t * 3));
      if (t > st.next) {
        st.next = t + rnd(0.18, 0.4);
        const hot = Math.random() < 0.72, a0 = Math.random() * TAU, r0 = hot ? Math.random() * R * 0.09 : Math.random() * R * 0.42;
        st.ev.push({ x: (hot ? tx : cx) + Math.cos(a0) * r0, y: (hot ? ty : cy) + Math.sin(a0) * r0 * 0.7, th: Math.random() * Math.PI, t0: t });
      }
      for (const e of st.ev) {
        const px = e.x - cx, py = e.y - cy, ux = Math.cos(e.th), uy = Math.sin(e.th), d = (t - e.t0) * R * 2.2;
        const reach = s => { const b = s * (px * ux + py * uy); return -b + Math.sqrt(b * b - (px * px + py * py) + R * R); };
        let both = true;
        for (const s of [1, -1]) {
          const dm = reach(s), dd = Math.min(d, dm), ex = e.x + s * ux * dd, ey = e.y + s * uy * dd;
          if (d < dm) { both = false; c.strokeStyle = 'rgba(255,230,140,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(e.x + s * ux * Math.max(0, dd - R * 0.25), e.y + s * uy * Math.max(0, dd - R * 0.25)); c.lineTo(ex, ey); c.stroke(); glow(c, ex, ey, 5, '255,235,160', 0.9); }
          else if (!e['h' + s]) { e['h' + s] = 1; const a = Math.atan2(ey - cy, ex - cx); st.hits[((Math.round(a / TAU * N) % N) + N) % N] = t; }
        }
        if (both) {
          if (e.tl == null) e.tl = t;
          const k = 1 - (t - e.tl) / 0.8;
          if (k > 0) { const dA = reach(1), dB = reach(-1); c.strokeStyle = `rgba(120,220,255,${0.45 * k})`; c.lineWidth = 1; c.beginPath(); c.moveTo(e.x + ux * dA, e.y + uy * dA); c.lineTo(e.x - ux * dB, e.y - uy * dB); c.stroke(); }
          else e.dead = 1;
        }
      }
      st.ev = st.ev.filter(e => !e.dead);
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU, lit = clamp(1 - (t - st.hits[i]) / 0.55, 0, 1);
        c.save(); c.translate(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6)); c.rotate(a);
        c.fillStyle = lit > 0 ? `rgb(${90 + 165 * lit},${110 + 120 * lit},${120 + 30 * lit})` : '#26343c';
        c.fillRect(-5, -R * 0.08, 10, R * 0.16); c.restore();
        if (lit > 0) glow(c, cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6), 12, '255,220,140', 0.5 * lit);
      }
      txt(c, 'detector ring', 10, h - 10, 'rgba(214,224,218,0.6)');
      txt(c, '511 keV back to back', w - 10, 18, 'rgba(255,230,140,0.85)', 'right');
    },
    // a beam swinging round the patient; the dose piles up at the end of each proton's path
    therapy(c, w, h, t) {
      back(c, w, h);
      const by = h * 0.6, x0 = w * 0.08, x1 = w * 0.66, tx = w * 0.42, ty = by - 2;
      c.fillStyle = '#1a252c'; c.fillRect(x0, by + 15, x1 - x0, 6);
      c.fillStyle = '#25333c'; c.beginPath(); c.ellipse((x0 + x1) / 2, by, (x1 - x0) / 2, 14, 0, 0, TAU); c.fill();
      c.beginPath(); c.arc(x1 + 10, by - 3, 11, 0, TAU); c.fill();
      const G = h * 0.44, ang = -Math.PI / 2 + Math.sin(t * 0.7) * 0.85, nx = tx + Math.cos(ang) * G, ny = ty + Math.sin(ang) * G;
      c.strokeStyle = 'rgba(201,128,63,0.35)'; c.lineWidth = 3; c.beginPath(); c.arc(tx, ty, G + 8, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
      c.save(); c.translate(nx, ny); c.rotate(ang); c.fillStyle = '#8c94a0'; c.fillRect(-9, -7, 18, 14); c.restore();
      const n = 26;
      for (let k = 0; k < n; k++) {
        const f = k / n, f2 = (k + 1) / n, dose = 0.22 + 0.78 * Math.exp(-(1 - f2) * 7);
        c.strokeStyle = `rgba(255,${200 - 90 * dose},${120 - 60 * dose},${0.35 + 0.6 * dose})`; c.lineWidth = 1 + dose * 4;
        c.beginPath(); c.moveTo(nx + (tx - nx) * f, ny + (ty - ny) * f); c.lineTo(nx + (tx - nx) * f2, ny + (ty - ny) * f2); c.stroke();
      }
      glow(c, tx, ty, 16 + 3 * Math.sin(t * 6), '255,120,90', 0.85);
      c.fillStyle = '#d0457a'; c.beginPath(); c.ellipse(tx, ty, 6, 5, 0, 0, TAU); c.fill();
      // the Bragg curve: dose against depth
      const gx = w * 0.74, gy = h * 0.2, gw = w * 0.22, gh = h * 0.42;
      c.strokeStyle = 'rgba(214,224,218,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx, gy + gh); c.lineTo(gx + gw, gy + gh); c.stroke();
      c.strokeStyle = '#ff8a5c'; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i <= 40; i++) { const f = i / 40, d = f < 0.82 ? 0.25 + 0.75 * Math.exp(-(0.82 - f) * 8) : Math.max(0, 1 - (f - 0.82) * 14); c[i ? 'lineTo' : 'moveTo'](gx + f * gw, gy + gh - d * gh * 0.92); }
      c.stroke();
      txt(c, 'dose', gx, gy - 4, 'rgba(214,224,218,0.6)'); txt(c, 'depth', gx + gw, gy + gh + 14, 'rgba(214,224,218,0.6)', 'right');
      txt(c, 'tumour', tx, ty + 34, 'rgba(240,150,180,0.9)', 'center');
    },
    // a small cyclotron and its energy counter, about 150 keV a turn up to 13 MeV
    decy(c, w, h, t) {
      back(c, w, h);
      const cx = w * 0.3, cy = h * 0.52, R = h * 0.38, P = (t % 7) / 7, K = 13 * Math.min(1, P / 0.86);
      c.strokeStyle = '#c9803f'; c.lineWidth = R * 0.1; c.beginPath(); c.arc(cx, cy, R * 1.16, 0, TAU); c.stroke();
      c.fillStyle = '#0d1311'; c.beginPath(); c.arc(cx, cy, R * 1.02, 0, TAU); c.fill();
      const pol = Math.cos(t * 9);
      for (const s of [-1, 1]) { c.fillStyle = (s < 0) === (pol > 0) ? 'rgba(229,72,63,0.22)' : 'rgba(62,126,230,0.22)'; c.beginPath(); c.arc(cx + s * R * 0.04, cy, R * 0.96, s < 0 ? Math.PI / 2 : -Math.PI / 2, s < 0 ? Math.PI * 1.5 : Math.PI / 2); c.closePath(); c.fill(); c.strokeStyle = 'rgba(232,168,106,0.7)'; c.lineWidth = 1; c.stroke(); }
      const arcs = spiralArcs(R * 0.92, 18), done = Math.min(1, P / 0.86) * 18, pal = CL.palette('rainbow');
      c.lineWidth = 1.6;
      for (let k = 0; k < Math.min(18, Math.ceil(done)); k++) {
        const a = arcs[k], f = Math.min(1, done - k);
        c.strokeStyle = pal[Math.round(k / 17 * 63)];
        c.beginPath(); c.arc(cx, cy + a.cy, a.r, a.a0, a.a0 - Math.PI * f, true); c.stroke();
      }
      const bx = w * 0.6, bw = w * 0.34;
      c.fillStyle = '#050d09'; c.fillRect(bx, h * 0.28, bw, h * 0.3); c.strokeStyle = 'rgba(0,0,0,0.9)'; c.strokeRect(bx, h * 0.28, bw, h * 0.3);
      txt(c, `${K.toFixed(2)} MeV`, bx + bw / 2, h * 0.5, '#9df5b8', 'center', 24);
      txt(c, 'H⁻ ions, ≈150 keV per turn', bx + bw / 2, h * 0.72, 'rgba(214,224,218,0.7)', 'center');
      txt(c, 'DECY-13, Yogyakarta', bx + bw / 2, h * 0.84, 'rgba(214,224,218,0.5)', 'center', 11);
    },
    // the train stays in view; the guideway and its coils slide underneath
    maglev(c, w, h, t) {
      back(c, w, h);
      const gy = h * 0.7, sp = 160, off = (t * sp) % 16;
      c.strokeStyle = 'rgba(214,224,218,0.12)'; c.lineWidth = 1;
      for (let i = 0; i < 9; i++) { const y = h * 0.12 + i * h * 0.06, x = w - ((t * sp * (1.4 + i * 0.13) + i * 97) % (w + 120)); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 50 + i * 4, y); c.stroke(); }
      c.fillStyle = '#2a3137'; c.fillRect(0, gy, w, h - gy);
      const trainX = w * 0.3, trainW = w * 0.46;
      for (let x = -off; x < w + 16; x += 16) {
        const rel = (x - trainX) / 48, near = clamp(1 - Math.abs(x - (trainX + trainW / 2)) / (trainW * 0.75), 0, 1);
        const ph = Math.sin(rel * Math.PI + t * 0.0), on = near > 0;
        c.fillStyle = on ? (ph > 0 ? `rgba(229,72,63,${0.25 + 0.7 * near})` : `rgba(62,126,230,${0.25 + 0.7 * near})`) : '#3a434a';
        c.fillRect(x + 2, gy - 9, 11, 8);
      }
      const hov = 4 + Math.sin(t * 3) * 0.8, ty = gy - 12 - hov;
      glow(c, trainX + trainW / 2, gy - 6, trainW * 0.6, '120,180,255', 0.12);
      c.fillStyle = '#d9dee2'; c.beginPath(); c.moveTo(trainX, ty); c.lineTo(trainX, ty - 26); c.lineTo(trainX + trainW * 0.78, ty - 26);
      c.quadraticCurveTo(trainX + trainW * 1.02, ty - 22, trainX + trainW, ty); c.closePath(); c.fill();
      c.fillStyle = '#29425e'; c.fillRect(trainX + 8, ty - 20, trainW * 0.66, 7);
      c.fillStyle = '#4a5560'; for (let i = 0; i < 5; i++) c.fillRect(trainX + 10 + i * trainW * 0.18, ty, trainW * 0.1, 3);
      txt(c, 'coils in the guideway switch on in turn', 10, h - 8, 'rgba(214,224,218,0.6)');
      txt(c, '603 km/h', w - 10, 20, '#9df5b8', 'right', 16);
    },
    // a shuttle in the deck pulls the jet; the coils under it light up one by one
    emals(c, w, h, t) {
      back(c, w, h);
      const T = 3.4, p = (t % T) / T, dy = h * 0.72, xs = w * 0.08, xe = w * 0.78;
      c.fillStyle = '#2a3137'; c.fillRect(0, dy, w, h - dy);
      const run = clamp(p / 0.55, 0, 1), x = xs + (xe - xs) * run * run;
      for (let cx = xs; cx <= xe; cx += 12) { const k = clamp(1 - Math.abs(cx - x) / 22, 0, 1); c.fillStyle = k > 0 ? `rgba(255,150,60,${0.3 + 0.7 * k})` : '#3a434a'; c.fillRect(cx, dy + 3, 8, 5); }
      let px = x, py = dy - 10, ang = 0;
      if (p > 0.55) { const q = (p - 0.55) / 0.45; px = xe + q * w * 0.5; py = dy - 10 - q * q * h * 0.9; ang = -0.25 * Math.min(1, q * 3); }
      c.save(); c.translate(px, py); c.rotate(ang);
      c.fillStyle = '#c8ced4'; c.beginPath(); c.moveTo(-34, -2); c.lineTo(20, -4); c.lineTo(30, 0); c.lineTo(20, 3); c.lineTo(-34, 3); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(-20, 12); c.lineTo(-12, 12); c.lineTo(6, 1); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-30, -1); c.lineTo(-38, -14); c.lineTo(-32, -14); c.lineTo(-22, -2); c.closePath(); c.fill();
      if (p > 0.55) glow(c, -36, 0, 14, '255,170,90', 0.7);
      c.restore();
      if (p <= 0.55) { c.fillStyle = '#ffb020'; c.fillRect(x - 4, dy - 2, 8, 4); }
      txt(c, 'linear motor in the deck', 10, h - 8, 'rgba(214,224,218,0.6)');
    },
    // current on: the coil pulls the iron in and the bolt slides; current off: the spring pushes it back
    solenoid(c, w, h, t) {
      back(c, w, h);
      const on = (t % 2.6) < 1.3, k = on ? clamp(((t % 2.6)) / 0.12, 0, 1) : 1 - clamp(((t % 2.6) - 1.3) / 0.25, 0, 1);
      const cx = w * 0.38, cy = h * 0.5, L = w * 0.3, Rr = h * 0.2;
      if (k > 0.05) { c.strokeStyle = `rgba(179,166,255,${0.35 * k})`; c.lineWidth = 1.2; for (const s of [0.6, 1, 1.45]) { c.beginPath(); c.ellipse(cx, cy, L * 0.62 * s, Rr * 1.5 * s, 0, 0, TAU); c.stroke(); } }
      const px = cx - L * 0.15 + (1 - k) * L * 0.5;
      c.fillStyle = '#8f979e'; c.fillRect(px - L * 0.25, cy - Rr * 0.45, L * 0.95, Rr * 0.9);
      c.fillStyle = '#b7bec4'; c.fillRect(px + L * 0.7, cy - Rr * 0.75, L * 0.12, Rr * 1.5);
      for (let i = 0; i <= 14; i++) { const x = cx - L / 2 + i * L / 14; c.strokeStyle = on ? '#e8a86a' : '#a86a3a'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, cy, 3, Rr, 0, 0, TAU); c.stroke(); }
      c.strokeStyle = '#9aa1a8'; c.lineWidth = 1.4; c.beginPath();
      const s0 = cx - L / 2 - 30, s1 = px - L * 0.25; for (let i = 0; i <= 10; i++) c.lineTo(s0 + (s1 - s0) * i / 10, cy + (i % 2 ? -6 : 6)); c.stroke();
      txt(c, on ? 'current on: the coil pulls the iron in' : 'current off: the spring pushes it out', 10, h - 10, on ? '#ffd27a' : 'rgba(214,224,218,0.6)');
    },
    // ions of three masses on the same push in the same field: the heavier, the bigger the semicircle
    aurora(c, w, h, t, st) {
      c.fillStyle = '#04070a'; c.fillRect(0, 0, w, h);
      const ex = w * 0.36, ey = h * 0.5, re = h * 0.18;
      if (!st.ps) { st.ps = []; st.glowN = 0; st.glowS = 0; st.next = 0; }
      const line = (L, lam, side) => { const r = L * re * Math.cos(lam) ** 2; return [ex + side * r * Math.cos(lam), ey - r * Math.sin(lam)]; };
      c.strokeStyle = 'rgba(179,166,255,0.25)'; c.lineWidth = 1;
      for (const L of [1.7, 2.5, 3.6, 5]) for (const side of [-1, 1]) { c.beginPath(); for (let i = 0; i <= 60; i++) { const lam = -1.25 + 2.5 * i / 60, [x, y] = line(L, lam, side); c[i ? 'lineTo' : 'moveTo'](x, y); } c.stroke(); }
      if (t > st.next) { st.next = t + rnd(0.25, 0.5); st.ps.push({ t0: t, y: rnd(-0.5, 0.5), dir: Math.random() < 0.5 ? 1 : -1, cap: Math.random() < 0.6 }); }
      const LC = 3.6, xeq = ex + LC * re, capT = (w + 10 - xeq) / (w * 0.75), lamEnd = Math.acos(Math.sqrt(1 / LC));
      for (const p of st.ps) {
        const age = t - p.t0;
        if (!p.cap || age < capT) { const x = w + 10 - age * w * 0.75, y = p.cap ? ey : ey + p.y * h * 0.8; glow(c, x, y, 3, '255,220,160', 0.9); if (x < -10) p.dead = 1; continue; }
        const q = clamp((age - capT) / 1.5, 0, 1), lam = p.dir * q * lamEnd, [x, y] = line(LC, lam, 1), wig = Math.sin(age * 40) * 5 * (1 - q * 0.7);
        glow(c, x + wig * Math.sin(lam), y + wig * Math.cos(lam), 3, '255,220,160', 0.9);
        if (q >= 1) { p.dead = 1; if (p.dir > 0) st.glowN = 1; else st.glowS = 1; }
      }
      st.ps = st.ps.filter(p => !p.dead);
      st.glowN *= 0.985; st.glowS *= 0.985;
      const g = c.createRadialGradient(ex - re * 0.3, ey - re * 0.3, re * 0.1, ex, ey, re);
      g.addColorStop(0, '#2f6fa8'); g.addColorStop(0.7, '#1b4870'); g.addColorStop(1, '#0d2a44');
      c.fillStyle = g; c.beginPath(); c.arc(ex, ey, re, 0, TAU); c.fill();
      for (const [s, k] of [[-1, st.glowN], [1, st.glowS]]) {
        c.strokeStyle = `rgba(80,255,150,${0.25 + 0.7 * k})`; c.lineWidth = 3 + 3 * k; c.shadowColor = 'rgba(80,255,150,0.9)'; c.shadowBlur = 10 * k;
        const mid = s < 0 ? -Math.PI / 2 : Math.PI / 2;        // around the pole, down to where the field line meets the ground
        c.beginPath(); c.arc(ex, ey, re * 1.08, mid - (Math.PI / 2 - lamEnd), mid + (Math.PI / 2 - lamEnd)); c.stroke(); c.shadowBlur = 0;
      }
      txt(c, 'wind from the Sun', w - 10, 18, 'rgba(255,220,160,0.8)', 'right');
      txt(c, 'aurora', ex, ey - re * 1.35, '#7dffb0', 'center', 13);
    },
    // two beams going opposite ways; where they cross at a detector, a collision
    lhc(c, w, h, t, st) {
      back(c, w, h);
      const cx = w / 2, cy = h * 0.52, rx = w * 0.38, ry = h * 0.32, wv = 1.3;
      c.strokeStyle = '#2b3239'; c.lineWidth = 10; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(201,128,63,0.55)'; c.lineWidth = 1; for (const d of [-2.5, 2.5]) { c.beginPath(); c.ellipse(cx, cy, rx + d, ry + d, 0, 0, TAU); c.stroke(); }
      const det = [[Math.PI / 2, 'ATLAS'], [-Math.PI / 2, 'CMS'], [Math.PI, 'ALICE'], [0, 'LHCb']];
      for (const [a, n] of det) { const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; c.fillStyle = '#4d5862'; c.fillRect(x - 9, y - 7, 18, 14); txt(c, n, x, y + (Math.sin(a) > 0.5 ? 24 : Math.sin(a) < -0.5 ? -12 : 4) , 'rgba(214,224,218,0.6)', 'center', 11); }
      const a1 = t * wv, a2 = Math.PI - t * wv;
      for (const [a, col, s] of [[a1, '90,170,255', 1], [a2, '255,170,90', -1]]) {
        for (let k = 6; k >= 0; k--) { const b = a - s * k * 0.05; glow(c, cx + Math.cos(b) * rx, cy + Math.sin(b) * ry, 4 - k * 0.4, col, 1 - k * 0.13); }
      }
      const ph = ((t * wv - Math.PI / 2) % Math.PI + Math.PI) % Math.PI;
      if (ph < 0.25 || ph > Math.PI - 0.02) {
        const k = ph < 0.25 ? 1 - ph / 0.25 : 1, a = Math.round((t * wv - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        if (!st.seed || st.a !== a) { st.a = a; st.seed = Array.from({ length: 12 }, () => [Math.random() * TAU, rnd(14, 34)]); }
        glow(c, x, y, 26 * k, '255,240,200', 0.9 * k);
        c.strokeStyle = `rgba(255,220,140,${0.8 * k})`; c.lineWidth = 1.2;
        for (const [an, L] of st.seed) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(an) * L * (1.2 - k * 0.5), y + Math.sin(an) * L * (1.2 - k * 0.5)); c.stroke(); }
      }
      txt(c, '27 km ring, 13.6 TeV', 10, 18, 'rgba(214,224,218,0.7)');
    },
    // the first web server at CERN, and pages travelling along links
    // an electron and a positron meet inside the patient; the two gamma rays fly apart to the ring; the lines build a picture
    petscan(c, w, h, t, st) {
      back(c, w, h);
      const R = Math.min(w * 0.3, h * 0.4), cx = R + 14, cy = h * 0.52, tx = cx + R * 0.18, ty = cy - R * 0.16;
      if (!st.ev) { st.ev = []; st.lines = []; st.next = 0; st.n = 0; }
      c.strokeStyle = '#3a4750'; c.lineWidth = 7; c.beginPath(); c.arc(cx, cy, R + 5, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(214,170,150,0.14)'; c.beginPath(); c.ellipse(cx, cy, R * 0.62, R * 0.44, 0, 0, TAU); c.fill();
      for (const L of st.lines) { const k = clamp(1 - (t - L.t0) / 6, 0, 1); if (k <= 0) { L.dead = 1; continue; } c.strokeStyle = `rgba(255,120,235,${0.16 * k})`; c.lineWidth = 1; c.beginPath(); c.moveTo(L.x1, L.y1); c.lineTo(L.x2, L.y2); c.stroke(); }
      st.lines = st.lines.filter(L => !L.dead);
      if (t > st.next) {
        st.next = t + rnd(0.45, 0.75);
        const hot = Math.random() < 0.7, a0 = Math.random() * TAU, r0 = hot ? Math.random() * R * 0.05 : Math.random() * R * 0.38;
        st.ev.push({ x: (hot ? tx : cx) + Math.cos(a0) * r0, y: (hot ? ty : cy) + Math.sin(a0) * r0 * 0.7, th: Math.random() * Math.PI, t0: t });
      }
      for (const e of st.ev) {
        const f = t - e.t0, ux = Math.cos(e.th), uy = Math.sin(e.th);
        const reach = s => { const px = e.x - cx, py = e.y - cy, b = s * (px * ux + py * uy); return -b + Math.sqrt(b * b - (px * px + py * py) + R * R); };
        if (f < 0.45) {                                     // the positron and an electron close in
          const u = f / 0.45, d = (1 - u) * R * 0.2;
          glow(c, e.x - d, e.y - d * 0.3, 6, '255,120,120', 1); glow(c, e.x + d, e.y + d * 0.3, 6, '120,180,255', 1);
          if (st.ev.length === 1 || e === st.ev[st.ev.length - 1]) { txt(c, 'e⁺', e.x - d - 6, e.y - d * 0.3 - 8, '#ffb0b0', 'center', 11); txt(c, 'e⁻', e.x + d + 6, e.y + d * 0.3 - 8, '#9fc8ff', 'center', 11); }
          continue;
        }
        const g = (f - 0.45) * R * 2.6;
        if (f < 0.6) glow(c, e.x, e.y, 16 * (1 - (f - 0.45) / 0.15) + 3, '255,255,255', 0.95);
        let done = true;
        for (const s of [1, -1]) {
          const dm = reach(s), dd = Math.min(g, dm), ex = e.x + s * ux * dd, ey = e.y + s * uy * dd;
          c.strokeStyle = 'rgba(255,120,240,0.9)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(e.x + s * ux * Math.max(0, dd - R * 0.3), e.y + s * uy * Math.max(0, dd - R * 0.3)); c.lineTo(ex, ey); c.stroke();
          if (g < dm) { done = false; glow(c, ex, ey, 5, '255,150,240', 1); } else glow(c, ex, ey, 9, '255,190,250', clamp(1 - (g - dm) / (R * 0.8), 0, 1));
        }
        if (done && !e.line) { e.line = 1; st.n++; st.lines.push({ x1: e.x + ux * reach(1), y1: e.y + uy * reach(1), x2: e.x - ux * reach(-1), y2: e.y - uy * reach(-1), t0: t }); }
        if (f > 1.6) e.dead = 1;
      }
      st.ev = st.ev.filter(e => !e.dead);
      // the picture the lines make: the cancer shows up as more of them cross it
      const px = cx + R + 26, side = Math.min(w - px - 12, h * 0.62), py = (h - side) / 2 + 6;
      if (side > 30) {
        c.fillStyle = '#000'; c.fillRect(px, py, side, side); c.strokeStyle = 'rgba(214,224,218,0.3)'; c.strokeRect(px + 0.5, py + 0.5, side - 1, side - 1);
        const q = side / (2.6 * R), bx = px + side / 2, by = py + side / 2, k = clamp(0.25 + st.n / 25, 0.25, 1);
        c.fillStyle = `rgba(150,40,30,${0.55 * k})`; c.beginPath(); c.ellipse(bx, by, R * 0.62 * q * 1.1, R * 0.44 * q * 1.1, 0, 0, TAU); c.fill();
        glow(c, bx + (tx - cx) * q * 1.1, by + (ty - cy) * q * 1.1, side * 0.12, '255,220,120', k);
        txt(c, 'the picture', px, py - 6, 'rgba(214,224,218,0.7)', 'left', 11);
      }
      txt(c, 'e⁺ + e⁻ → 2γ', w - 10, 16, 'rgba(255,190,245,0.9)', 'right', 12);
    },
    // a magnetic lens: electrons spiral in the coil's field and meet again on the axis; below, the virus they show
    tem(c, w, h, t) {
      back(c, w, h);
      const cx = w * 0.3, top = 12, yLens0 = h * 0.3, yLens1 = h * 0.62, yScr = h - 16, cw = Math.min(w * 0.11, 30);
      c.fillStyle = '#2a3238'; c.fillRect(cx - cw * 0.45, top, cw * 0.9, yScr - top);
      for (const sd of [-1, 1]) { const g = c.createLinearGradient(cx + sd * cw * 0.5, 0, cx + sd * cw * 1.6, 0); g.addColorStop(0, '#7a4a26'); g.addColorStop(0.5, '#c98a4a'); g.addColorStop(1, '#6a3e1e'); c.fillStyle = g; c.fillRect(Math.min(cx + sd * cw * 0.5, cx + sd * cw * 1.6), yLens0, cw * 1.1, yLens1 - yLens0); }
      c.strokeStyle = 'rgba(120,200,255,0.55)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(cx, top + 4); c.lineTo(cx, yLens0); c.stroke();
      // five electrons leaving the axis at different angles: each circles (seen from the side, a sine) and is back on the axis after one turn
      for (let i = 0; i < 5; i++) {
        const amp = cw * (0.12 + 0.07 * i), ph = t * 2.2 + i * 1.3;
        c.strokeStyle = `rgba(${150 + 20 * i},${210 - 10 * i},255,0.85)`; c.lineWidth = 1.2; c.beginPath();
        for (let k = 0; k <= 40; k++) { const u = k / 40, y = yLens0 + (yLens1 - yLens0) * u, x = cx + amp * Math.sin(Math.PI * u) * Math.cos(ph); k ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
        const u = ((t * 0.6 + i * 0.2) % 1), y = yLens0 + (yLens1 - yLens0) * u; glow(c, cx + amp * Math.sin(Math.PI * u) * Math.cos(ph), y, 4, '170,230,255', 1);
      }
      glow(c, cx, yLens1, 7, '200,255,220', 0.9);
      c.strokeStyle = 'rgba(120,255,160,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, yLens1); c.lineTo(cx - cw * 0.9, yScr); c.moveTo(cx, yLens1); c.lineTo(cx + cw * 0.9, yScr); c.stroke();
      c.fillStyle = '#56e08a'; c.fillRect(cx - cw * 1.1, yScr, cw * 2.2, 3);
      txt(c, 'magnetic', cx + cw * 1.75, (yLens0 + yLens1) / 2 - 3, 'rgba(200,190,255,0.9)', 'left', 11.5);
      txt(c, 'lens', cx + cw * 1.75, (yLens0 + yLens1) / 2 + 11, 'rgba(200,190,255,0.9)', 'left', 11.5);
      // the picture: a coronavirus with its crown of spikes
      const vx = w * 0.78, vy = h * 0.54, vr = Math.min(w * 0.1, h * 0.22);
      c.fillStyle = '#c9cbc5'; c.beginPath(); c.arc(vx, vy, vr * 1.5, 0, TAU); c.fill();
      c.strokeStyle = '#3c413e'; c.fillStyle = '#3c413e'; c.lineWidth = 1.6;
      for (let i = 0; i < 22; i++) { const a = TAU * i / 22 + t * 0.15, ca = Math.cos(a), sa = Math.sin(a); c.beginPath(); c.moveTo(vx + ca * vr, vy + sa * vr); c.lineTo(vx + ca * vr * 1.22, vy + sa * vr * 1.22); c.stroke(); c.beginPath(); c.arc(vx + ca * vr * 1.27, vy + sa * vr * 1.27, 2.2, 0, TAU); c.fill(); }
      c.fillStyle = '#868b86'; c.beginPath(); c.arc(vx, vy, vr, 0, TAU); c.fill(); c.lineWidth = 2.2; c.stroke();
      txt(c, 'a virus, 100 nm', vx, 15, 'rgba(214,224,218,0.75)', 'center', 11.5);
    },
    web(c, w, h, t, st) {
      back(c, w, h);
      if (!st.n) {
        st.n = [[0.14, 0.5], [0.36, 0.22], [0.38, 0.75], [0.58, 0.45], [0.62, 0.15], [0.78, 0.7], [0.86, 0.32], [0.55, 0.88], [0.92, 0.88]];
        st.l = [[0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [3, 5], [3, 6], [4, 6], [2, 7], [5, 8], [7, 5], [6, 5]];
        st.pk = []; st.next = 0;
      }
      const P = i => [st.n[i][0] * w, st.n[i][1] * h];
      c.strokeStyle = 'rgba(120,200,255,0.25)'; c.lineWidth = 1;
      for (const [a, b] of st.l) { const [x1, y1] = P(a), [x2, y2] = P(b); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
      if (t > st.next) { st.next = t + rnd(0.12, 0.3); const l = st.l[Math.floor(Math.random() * st.l.length)]; st.pk.push({ l: Math.random() < 0.5 ? l : [l[1], l[0]], t0: t }); }
      for (const p of st.pk) { const f = (t - p.t0) / 0.7; if (f >= 1) { p.dead = 1; continue; } const [x1, y1] = P(p.l[0]), [x2, y2] = P(p.l[1]); glow(c, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 4, '140,220,255', 1); }
      st.pk = st.pk.filter(p => !p.dead);
      st.n.forEach((_, i) => { const [x, y] = P(i); c.fillStyle = i ? '#3c4a55' : '#ffb020'; c.fillRect(x - 6, y - 5, 12, 10); });
      const [x0, y0] = P(0); txt(c, 'info.cern.ch', x0, y0 + 20, '#ffd27a', 'center');
    },
  };

  /* ---------------- animation loop: only the drawings that are on screen ---------------- */
  const live = new Map();          // canvas -> { art, st, w, h, ctx, vis }
  let raf = 0, last = 0;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { for (const e of es) { const L = live.get(e.target); if (L) L.vis = e.isIntersecting; } kick(); }) : null;
  function attach(cv, art) {
    const L = { art, st: {}, vis: !io }; live.set(cv, L);
    if (io) io.observe(cv);
    size(cv);
  }
  function size(cv) { const L = live.get(cv); if (!L) return; const r = cv.getBoundingClientRect(); if (r.width < 4) return; L.w = r.width; L.h = r.height; L.ctx = fitCanvas(cv, r.width, r.height).ctx; L.st = {}; }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    const t = now / 1000; let any = false;
    for (const [cv, L] of live) {
      if (!cv.isConnected) { live.delete(cv); continue; }
      if (!L.vis || !cv.offsetParent) continue;
      if (!L.ctx || Math.abs(cv.getBoundingClientRect().width - L.w) > 1) size(cv);
      if (!L.ctx) continue;
      any = true;
      try { ART[L.art](L.ctx, L.w, L.h, reduceMotion ? 2.2 : t, L.st); } catch (e) { console.error(e); live.delete(cv); }
    }
    if (any && !reduceMotion) raf = requestAnimationFrame(tick);
    last = now;
  }
  window.addEventListener('resize', () => { for (const cv of live.keys()) size(cv); kick(); });

  /* ---------------- markup ---------------- */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function cardHTML(id) {
    const k = CARDS[id];
    return `<article class="rl-card" id="rl-${id}" aria-labelledby="rl-${id}-t">
      <canvas class="rl-art" data-art="${k.art}" aria-hidden="true"></canvas>
      <div class="rl-body">
        <p class="rl-where">${esc(k.where)}</p>
        <h3 id="rl-${id}-t">${esc(k.title)}</h3>
        <div class="rl-stat"><b>${esc(k.stat[0])}</b><span>${esc(k.stat[1])}</span></div>
        ${k.text.map(p => `<p>${esc(p)}</p>`).join('')}
        <p class="rl-here"><span class="rl-hand">In this app:</span> ${esc(k.here)}</p>
        ${k.sim || k.try ? `<div class="rl-acts">${k.sim ? `<button type="button" class="btn-go rl-sim" data-sim="${k.sim}">Simulate it</button>` : ''}${k.try ? `<button type="button" class="pbtn rl-try" data-try="${id}">${esc(k.try[0])}</button>` : ''}</div>` : ''}
        <details class="rl-src"><summary>Sources</summary><ul>${k.src.map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}</ul></details>
      </div>
    </article>`;
  }
  let opener = null;
  function open(screen, focusId) {
    const dr = $('#rlDrawer'), body = $('#rlBody');
    screen = screen || CL.active || 'home';
    const list = BY_SCREEN[screen];
    $('#rlTitle').textContent = list ? `In real life: ${TITLE[screen]}` : 'In real life';
    $('#rlSub').textContent = list ? 'Where the physics on this screen is used outside the classroom.' : 'Where the physics of every station is used outside the classroom.';
    body.innerHTML = list ? list.map(cardHTML).join('') : GROUPS.map(([g, ids]) => `<h3 class="rl-group">${g}</h3>` + ids.map(cardHTML).join('')).join('');
    for (const cv of $$('canvas.rl-art', body)) attach(cv, cv.dataset.art);
    opener = document.activeElement;
    dr.hidden = false; $('#rlScrim').hidden = false;
    requestAnimationFrame(() => { document.body.classList.add('rl-open'); for (const cv of $$('canvas.rl-art', body)) size(cv); kick(); });
    const target = focusId && $('#rl-' + focusId);
    if (target) { setTimeout(() => { target.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); target.classList.add('is-flash'); }, 280); }
    $('#rlClose').focus({ preventScroll: true });
    $('#btnReal').setAttribute('aria-expanded', 'true');
  }
  function close() {
    const dr = $('#rlDrawer'); if (dr.hidden) return;
    document.body.classList.remove('rl-open'); $('#btnReal').setAttribute('aria-expanded', 'false');
    setTimeout(() => { dr.hidden = true; $('#rlScrim').hidden = true; for (const cv of $$('canvas.rl-art', dr)) live.delete(cv); }, reduceMotion ? 0 : 260);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  function init() {
    $('#btnReal').addEventListener('click', () => ($('#rlDrawer').hidden ? open() : close()));
    $('#rlClose').addEventListener('click', close);
    $('#rlScrim').addEventListener('click', close);
    $('#rlDrawer').addEventListener('click', ev => {
      const sb = ev.target.closest('[data-sim]');
      if (sb && CL.realsim) { close(); CL.realsim.open(sb.dataset.sim); return; }
      const b = ev.target.closest('[data-try]'); if (!b) return; const k = CARDS[b.dataset.try]; close(); k.try[1]();
    });
    document.addEventListener('keydown', ev => {
      if ($('#rlDrawer').hidden) return;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
      else if (ev.key === 'Tab') {                         // keep the keyboard inside the drawer while it is open
        const f = $$('#rlDrawer button, #rlDrawer a[href], #rlDrawer summary').filter(e => e.offsetParent);
        if (!f.length) return;
        if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
      }
    }, true);
    // Home: a grid of the stories, each opening its station's drawer at that story
    const grid = $('#usesGrid');
    if (grid) {
      grid.innerHTML = HOME_TILES.map(id => { const k = CARDS[id]; return `<button type="button" class="use" data-use="${id}"><canvas class="rl-art" data-art="${k.art}" aria-hidden="true"></canvas><span class="use-where">${esc(k.where)}</span><span class="use-t">${esc(k.title)}</span><span class="use-stat"><b>${esc(k.stat[0])}</b> ${esc(k.stat[1])}</span>${k.sim ? '<span class="use-sim">You can run it</span>' : ''}</button>`; }).join('');
      for (const cv of $$('canvas.rl-art', grid)) attach(cv, cv.dataset.art);
      grid.addEventListener('click', ev => { const b = ev.target.closest('[data-use]'); if (b) open(SCREEN_OF[b.dataset.use], b.dataset.use); });
    }
    CL.bus.on('screen', kick);
    kick();
  }
  CL.reallife = { init, open, close, kick, CARDS, art: attach };
})();
