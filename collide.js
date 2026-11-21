/* =====================================================================
   Project Lorentz — Collider screen (CL.screens.collide)
   Two beams meet head-on inside a detector. Relativistic kinematics,
   Coulomb barrier, particle creation, event display, slow-motion replay.
   ===================================================================== */
(() => {
  'use strict';
  const { PHYS, C, $, $$, clamp, TAU, e, pl, si, audio, FX, shaker, haloText, pill, hexA, hexRGB, fitCanvas, bindRange, toast, missions, reduceMotion } = CL;
  const HEP = PHYS.HEP;
  const GRID = ['p', 'pbar', 'n', 'd', 'alpha', 'c12', 'e', 'ebar', 'mu'];
  const MEV = x => { const a = Math.abs(x); return a >= 1000 ? pl(x / 1000, 4) + ' GeV' : a >= 1 ? pl(x, 4) + ' MeV' : a >= 1e-3 ? pl(x * 1000, 4) + ' keV' : pl(x * 1e6, 4) + ' eV'; };
  const S = { a: 'p', b: 'p', Ka: 150, Kb: 150, B: 1.0, labels: true, auto: true };
  const PRESETS = [
    { label: 'Matter + antimatter', a: 'e', b: 'ebar', Ka: 0.01, Kb: 0.01, note: 'An electron meets its antiparticle.' },
    { label: 'Too gentle: bounce', a: 'p', b: 'p', Ka: 0.1, Kb: 0.1 },
    { label: 'Make pions', a: 'p', b: 'p', Ka: 150, Kb: 150 },
    { label: 'Fixed target (B at rest)', a: 'p', b: 'p', Ka: 648, Kb: 0 },
    { label: 'Antiproton factory', a: 'p', b: 'p', Ka: 1500, Kb: 1500 },
    { label: 'Smash alpha particles', a: 'alpha', b: 'alpha', Ka: 40, Kb: 40 },
    { label: 'Carbon on carbon', a: 'c12', b: 'c12', Ka: 120, Kb: 120 },
    { label: 'Proton + antiproton', a: 'p', b: 'pbar', Ka: 50, Kb: 50 },
  ];
  missions.add({ id: 'coll-annihilate', screen: 'collide', title: 'Matter meets antimatter', goal: 'Collide an electron with a positron and turn their mass into light (E = mc²).' });
  missions.add({ id: 'coll-bounce', screen: 'collide', title: 'Too gentle', goal: 'Make two nuclei bounce off each other without touching: the energy must be below their Coulomb barrier.' });
  missions.add({ id: 'coll-antimatter', screen: 'collide', title: 'Antimatter from energy', goal: 'Create an antiproton in a collision of ordinary matter. (You need a lot of energy, and some luck.)' });

  let active = false, cv, ctx, W = 600, H = 500, shake, ev = null, ctlA = null, ctlB = null, v3 = null;
  let userH = +CL.store.get('cl-h-coll', 0) || 0;
  const fx = new FX();
  const VIS = { Tc: 1.0, Tp: 2.2 };          // visual seconds: approach, products

  /* ------------------------------------------------------------------
     Collision
     ------------------------------------------------------------------ */
  function fire() {
    audio.unlock();
    const res = PHYS.collide(S.a, Math.max(S.Ka, 0), S.b, Math.max(S.Kb, 0));
    ev = { res, tau: 0, speed: 1, boomed: false, replay: null, cam: 1, tracks: buildTracks(res), Kb0: S.Kb <= 0 };
    $('#collLetterbox').classList.remove('is-on'); fx.clear();
    renderBefore(res); renderEnergy(res);
    $('#collOut').innerHTML = '<p class="hint">Colliding…</p>';
    $('#collReplay').disabled = true;
    setStatus(`Beams approaching: E_cm = ${MEV(res.Ecm)}`, 'is-run');
    audio.whoosh();
  }
  function buildTracks(res) {
    return res.products.map(pr => {
      const P = HEP[pr.key];
      const th = Math.atan2(pr.py, pr.px);
      const r = PHYS.trackRadius(pr.p, pr.z, S.B);
      const rot = pr.z === 0 || S.B === 0 ? 0 : (pr.z > 0 ? 1 : -1);    // field into the screen: positive charges curl anticlockwise
      return { pr, P, th, r, rot, beta: pr.beta, color: pr.color || P.color, neutral: pr.z === 0, photon: pr.key === 'gamma' };
    });
  }
  // position along a track after arc length s (m), detector radius 1 m
  function trackPos(tk, s) {
    if (tk.rot === 0 || !isFinite(tk.r)) return { x: Math.cos(tk.th) * s, y: Math.sin(tk.th) * s };
    const a0 = tk.th - tk.rot * Math.PI / 2, cx = -tk.r * Math.cos(a0), cy = -tk.r * Math.sin(a0), a = a0 + tk.rot * s / tk.r;
    return { x: cx + tk.r * Math.cos(a), y: cy + tk.r * Math.sin(a) };
  }
  function trackLen(tk) {   // arc length until the track leaves the detector (or 1.5 loops for curlers)
    if (tk.rot === 0 || !isFinite(tk.r)) return 1.15;
    if (2 * tk.r >= 1.0) { // leaves the r = 1 m detector: solve |pos| = 1 on the circle through the origin: |pos| = 2r sin(s/2r)
      return 2 * tk.r * Math.asin(Math.min(1, 1 / (2 * tk.r)));
    }
    return Math.min(1.5 * TAU * tk.r, 4);
  }

  /* ------------------------------------------------------------------
     Drawing
     ------------------------------------------------------------------ */
  function draw(now) {
    const { ctx: c } = fitCanvas(cv, W, H); ctx = c;
    ctx.clearRect(0, 0, W, H);
    if (v3 && v3.on) { draw3D(now); fx.draw(ctx, W, H); return; }
    CL.screenBg(ctx, W, H, { grid: 0 });
    const cam = ev ? ev.cam : 1;
    const Rpx = Math.min(W, H) * 0.42 * cam, cx = W / 2, cy = H / 2;
    const k = Rpx;                                   // px per metre (detector radius 1 m)
    // detector: tracker layers, calorimeter ring, magnet
    ctx.save();
    ctx.strokeStyle = 'rgba(200,225,208,0.11)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.arc(cx, cy, Rpx * i / 5, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(200,225,208,0.06)';
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * Rpx * 0.2, cy + Math.sin(a) * Rpx * 0.2); ctx.lineTo(cx + Math.cos(a) * Rpx, cy + Math.sin(a) * Rpx); ctx.stroke(); }
    ctx.lineWidth = Rpx * 0.12; ctx.strokeStyle = 'rgba(255,170,60,0.07)';
    ctx.beginPath(); ctx.arc(cx, cy, Rpx * 1.08, 0, TAU); ctx.stroke();
    ctx.lineWidth = Rpx * 0.05; ctx.strokeStyle = 'rgba(201,128,63,0.16)';
    ctx.beginPath(); ctx.arc(cx, cy, Rpx * 1.2, 0, TAU); ctx.stroke();
    ctx.restore();
    // beam pipe
    ctx.fillStyle = 'rgba(215,228,218,0.06)'; ctx.fillRect(0, cy - 6, W, 12);
    ctx.strokeStyle = 'rgba(215,228,218,0.2)'; ctx.beginPath(); ctx.moveTo(0, cy - 6.5); ctx.lineTo(W, cy - 6.5); ctx.moveTo(0, cy + 6.5); ctx.lineTo(W, cy + 6.5); ctx.stroke();
    if (cam === 1 && !ev) {
      haloText(ctx, 'beam A →', 60, cy - 20, { font: '600 13.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#4dc3ff' });
      haloText(ctx, '← beam B', W - 60, cy - 20, { font: '600 13.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#ff6a9a' });
    }
    haloText(ctx, S.B > 0 ? `detector field ${pl(S.B, 3)} T ⊗` : 'detector field off', W - 12, H - 14, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#b9adff', align: 'right' });
    haloText(ctx, 'tracker radius 1 m', 12, H - 14, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#93a197', align: 'left' });

    if (ev) {
      const res = ev.res, tau = ev.tau, Tc = VIS.Tc;
      const bA = res.v1, bB = res.v2, bmax = Math.max(bA, bB, 1e-9), dist = W / 2 + 30;
      const bounce = res.outcome === 'bounce';
      if (tau < Tc) {
        let f = 1 - tau / Tc;
        let xa = -dist * (bA / bmax) * f, xb = dist * (bB / bmax) * f;
        if (bounce) { const gap = 26; xa = Math.min(xa, -gap / 2); xb = Math.max(xb, gap / 2); }
        drawBeam(cx + xa, cy, HEP[S.a], -1, bA);
        drawBeam(cx + xb, cy, HEP[S.b], 1, bB);
        if (bounce && f < 0.25) {
          const a = 1 - f / 0.25;
          const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
          gr.addColorStop(0, `rgba(255,120,200,${0.5 * a})`); gr.addColorStop(1, 'rgba(255,120,200,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, TAU); ctx.fill();
        }
      } else {
        const tp = tau - Tc;
        for (const tk of ev.tracks) drawTrack(tk, tp, cx, cy, k);
        if (bounce && res.rmin) haloText(ctx, `closest approach ${pl(res.rmin, 3)} fm: they never touched`, cx, cy - 34, { font: '600 13.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#ff9ccf' });
      }
    }
    fx.draw(ctx, W, H);
  }
  /* ------------------------------------------------------------------
     3-D view: the detector as a cut-away barrel, like a real event display.
     Tracks lie in the horizontal plane z = 0; the field points straight down
     (into the screen in the flat view, which is the view from above).
     ------------------------------------------------------------------ */
  const LAYERS = [0.2, 0.4, 0.6, 0.8, 1.0];
  function draw3D(now) {
    const s = v3.scene, cam = ev ? ev.cam : 1, t = now / 1000;
    if (v3.ride) s.begin(ctx, W, H, rideCam()); else s.begin(ctx, W, H, { dist: 3.9 / cam });
    const cut = s.yawNow, open = a => { const d = Math.atan2(Math.sin(a - cut), Math.cos(a - cut)); return Math.abs(d) < 0.95; };
    s.floor(-0.9, -3.4, 3.4, -3.4, 3.4, { step: 0.4, rx: 2.4, ry: 2.4, lightA: 0.2 });
    s.shadow([0, 0, -0.899], 1.75, 1.75, 0.6);
    // support cradle
    for (const x of [-0.9, 0.9]) s.box([x, 0, -0.78], [0.12, 1.25, 0.12], { rgb: [44, 52, 48], layer: 'back', spec: 0.15 });
    // iron return yoke (an octagon), magnet coil and calorimeter: cut open towards you
    const N = 48;
    const P = (r, ang, z) => [r * Math.cos(ang), r * Math.sin(ang), z];
    const ringWall = (r0, r1, h, rgb, a, emit, spec = 0.12) => {
      const cull = a >= 1, gone = i => open(TAU * (i + 0.5) / N);
      for (let i = 0; i < N; i++) {
        const a0 = TAU * i / N, a1 = TAU * (i + 1) / N, am = (a0 + a1) / 2;
        if (gone(i)) continue;
        const n0 = [Math.cos(a0), Math.sin(a0), 0], n1 = [Math.cos(a1), Math.sin(a1), 0];
        s.poly([P(r1, a0, -h), P(r1, a1, -h), P(r1, a1, h), P(r1, a0, h)], { rgb, a, out: [Math.cos(am), Math.sin(am), 0], cull, sn: [n0, n1], spec, shin: 26 });
        s.poly([P(r0, a0, -h), P(r0, a1, -h), P(r0, a1, h), P(r0, a0, h)], { rgb, a: a * 0.8, out: [-Math.cos(am), -Math.sin(am), 0], cull, sn: [n0.map(v => -v), n1.map(v => -v)], spec, shin: 26 });
        s.poly([P(r0, a0, h), P(r1, a0, h), P(r1, a1, h), P(r0, a1, h)], { rgb, a, out: [0, 0, 1], emit, cull });
        s.poly([P(r0, a0, -h), P(r0, a1, -h), P(r1, a1, -h), P(r1, a0, -h)], { rgb, a, out: [0, 0, -1], cull });
        // the cut faces where the opening starts and ends
        if (gone((i + 1) % N)) s.poly([P(r0, a1, -h), P(r1, a1, -h), P(r1, a1, h), P(r0, a1, h)], { rgb: rgb.map(c => c * 1.2), a });
        if (gone((i + N - 1) % N)) s.poly([P(r0, a0, -h), P(r1, a0, -h), P(r1, a0, h), P(r0, a0, h)], { rgb: rgb.map(c => c * 1.2), a });
      }
    };
    ringWall(1.3, 1.46, 0.62, [62, 70, 66], 1, null, 0.14);
    ringWall(1.18, 1.25, 0.56, [186, 104, 48], 1, S.B > 0 ? '255,120,40' : null, 0.5);
    ringWall(1.02, 1.14, 0.5, [120, 96, 58], 0.55, null, 0.2);
    // tracker layers: thin glassy cylinders
    for (const r of LAYERS) {
      s.circle([0, 0, 0.42], [0, 0, 1], r, 'rgba(200,225,208,0.22)', 1, {}, 64);
      s.circle([0, 0, -0.42], [0, 0, 1], r, 'rgba(200,225,208,0.14)', 1, {}, 64);
      s.circle([0, 0, 0], [0, 0, 1], r, 'rgba(200,225,208,0.1)', 1, {}, 64);
      for (let i = 0; i < 12; i++) { const a = TAU * i / 12; s.line([r * Math.cos(a), r * Math.sin(a), -0.42], [r * Math.cos(a), r * Math.sin(a), 0.42], 'rgba(200,225,208,0.07)', 1); }
    }
    // the plane the particles fly in, faintly lit
    s.poly(Array.from({ length: 48 }, (_, i) => P(1.0, TAU * i / 48, 0)), { rgb: [40, 70, 58], a: 0.18, shade: false, bias: 1e3 });
    // beam pipe along x
    s.cyl([-3.2, 0, 0], [3.2, 0, 0], 0.035, { rgb: [190, 210, 200], a: 0.14, shade: false, open: true, noCull: true }, 14);
    s.line([-3.2, 0, 0.035], [3.2, 0, 0.035], 'rgba(215,228,218,0.35)', 1);
    // the field: straight down through the tracker
    if (S.B > 0) {
      const fa = clamp(0.2 + 0.12 * S.B, 0.2, 0.55);
      for (let i = 0; i < 8; i++) {
        const a = TAU * (i + 0.5) / 8, r = 0.5 + 0.38 * (i % 2);
        s.arrow([r * Math.cos(a), r * Math.sin(a), 0.4], [r * Math.cos(a), r * Math.sin(a), -0.36], `rgba(179,166,255,${fa})`, 1.4, 0.12);
      }
      s.label([0.88 * Math.cos(TAU * 1.5 / 8), 0.88 * Math.sin(TAU * 1.5 / 8), 0.5], `B = ${pl(S.B, 3)} T, pointing down`, { color: '#b9adff', font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif' });
    }
    if (!ev) {
      s.label([-2.3, 0, 0.16], 'beam A →', { color: '#4dc3ff' });
      s.label([2.3, 0, 0.16], '← beam B', { color: '#ff6a9a' });
      const lab = (p, txt) => s.label(p, txt, { color: '#c9d4cc', font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif' });
      lab([0, -0.6, 0.5], 'tracker (5 layers)'); lab([1.08 * Math.cos(cut + 1.3), 1.08 * Math.sin(cut + 1.3), 0.62], 'calorimeter');
      lab([1.22 * Math.cos(cut - 1.3), 1.22 * Math.sin(cut - 1.3), 0.7], 'magnet coil'); lab([1.4 * Math.cos(cut + 2.2), 1.4 * Math.sin(cut + 2.2), 0.78], 'iron yoke');
    }
    if (ev) {
      const res = ev.res, tau = ev.tau, Tc = VIS.Tc;
      const bA = res.v1, bB = res.v2, bmax = Math.max(bA, bB, 1e-9), dist = 2.8;
      const bounce = res.outcome === 'bounce';
      if (tau < Tc) {
        const f = 1 - tau / Tc;
        let xa = -dist * (bA / bmax) * f, xb = dist * (bB / bmax) * f;
        if (bounce) { xa = Math.min(xa, -0.05); xb = Math.max(xb, 0.05); }
        beam3D(s, xa, HEP[S.a], -1, bA); beam3D(s, xb, HEP[S.b], 1, bB);
        if (v3.ride) s.label([xa, 0, 0.08], `riding beam A: ${HEP[S.a].sym} at v = ${pl(bA, 4)} c`, { color: '#ffd08a', dy: -10 });
      } else {
        const tp = tau - Tc;
        for (const tk of ev.tracks) track3D(s, tk, tp);
        if (bounce && res.rmin) s.label([0, 0, 0.28], `closest approach ${pl(res.rmin, 3)} fm: they never touched`, { color: '#ff9ccf' });
        // the flash of the collision, a shell of light spreading out
        const age = tp;
        if (age < 0.9 && res.outcome !== 'bounce') {
          const big = clamp(Math.log10(1 + Math.max(res.Q, 0)) / 3.4, 0.15, 1);
          s.glow([0, 0, 0], 0.15 + 2.2 * age, res.outcome === 'annihilate' ? '200,230,255' : '255,200,140', (1 - age / 0.9) * (0.35 + 0.5 * big), { core: true, reflect: -0.9 });
        }
      }
    }
    s.end();
    haloText(ctx, '3D view: drag to turn it', 12, H - 14, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#93a197', align: 'left' });
  }
  // the ride camera: behind beam A as it flies in, then behind the fastest charged particle that comes out
  function leadTrack() {
    if (!ev || !ev.tracks.length) return null;
    const charged = ev.tracks.filter(tk => !tk.neutral);
    return (charged.length ? charged : ev.tracks).reduce((a, b) => (b.pr.K > a.pr.K ? b : a));
  }
  function rideCam() {
    if (!ev) return { target: [-2.3, 0, 0], yaw: Math.PI + 0.14, pitch: 0.2, dist: 0.75, fov: 62 };
    const res = ev.res, tau = ev.tau, Tc = VIS.Tc;
    if (tau < Tc) {
      const bmax = Math.max(res.v1, res.v2, 1e-9), xa = -2.8 * (res.v1 / bmax) * (1 - tau / Tc);
      return { target: [Math.min(xa, -0.02) + 0.35, 0, 0], yaw: Math.PI + 0.14, pitch: 0.22, dist: 0.72, fov: 62 };
    }
    const tk = leadTrack(); if (!tk) return { target: [0, 0, 0], yaw: Math.PI + 0.3, pitch: 0.3, dist: 0.8, fov: 58 };
    const L = trackLen(tk), sNow = Math.min(L, (tau - Tc) * 0.75 * Math.max(tk.beta, 0.05));
    const p = trackPos(tk, Math.max(0, sNow)), q = trackPos(tk, Math.min(L, Math.max(0, sNow) + 0.03));
    let hx = q.x - p.x, hy = q.y - p.y; if (Math.hypot(hx, hy) < 1e-6) { const q0 = trackPos(tk, Math.max(0, sNow - 0.03)); hx = p.x - q0.x; hy = p.y - q0.y; }
    if (Math.hypot(hx, hy) < 1e-9) { hx = Math.cos(tk.th); hy = Math.sin(tk.th); }
    const hd = Math.atan2(hy, hx), lead = 0.12;
    return { target: [p.x + Math.cos(hd) * lead, p.y + Math.sin(hd) * lead, 0], yaw: hd + Math.PI + 0.22, pitch: 0.3, dist: 0.68, fov: 60, smooth: 0.18 };
  }
  function beam3D(s, x, P, side, beta) {
    const rgb = hexRGB(P.color), len = 0.25 + 0.6 * beta;
    s.line([x + side * len, 0, 0], [x, 0, 0], `rgba(${rgb},0.85)`, 4, { additive: true });
    const rd = v3 && v3.ride;
    s.glow([x, 0, 0], rd ? 0.07 : 0.16, rgb, 0.95, { reflect: -0.9 });
    s.sphere([x, 0, 0], rd ? 0.011 : 0.03, [255, 255, 255], { flat: true });
    if (S.labels) s.label([x, 0, 0.16], P.sym, { color: P.color, font: '700 14.5px "Barlow Condensed", "Arial Narrow", sans-serif' });
  }
  function track3D(s, tk, tp) {
    const L = trackLen(tk), sNow = Math.min(L, tp * 0.75 * Math.max(tk.beta, 0.05));
    if (sNow <= 0) return;
    const n = Math.max(6, Math.ceil(sNow / 0.012)), pts = [];
    for (let i = 0; i <= n; i++) { const p = trackPos(tk, sNow * i / n); pts.push([p.x, p.y, 0]); }
    const rgb = hexRGB(tk.color);
    if (tk.neutral) s.path(pts, `rgba(${rgb},0.85)`, tk.photon ? 2 : 1.6, { dash: tk.photon ? [7, 5] : [3, 5] });
    else { s.path(pts, `rgba(${rgb},0.3)`, 9, { additive: true, chunk: 60 }); s.path(pts, tk.color, 3, { chunk: 8 }); }
    if (!tk.neutral) for (const R of LAYERS) {                   // hits on the tracker layers
      for (let i = 0; i < n; i++) {
        const r0 = Math.hypot(pts[i][0], pts[i][1]), r1 = Math.hypot(pts[i + 1][0], pts[i + 1][1]);
        if ((r0 - R) * (r1 - R) <= 0) { s.glow(pts[i + 1], 0.045, rgb, 0.9, { reflect: -0.9 }); s.sphere(pts[i + 1], 0.012, tk.color, { flat: true }); }
      }
    }
    const pe = pts[pts.length - 1];
    if (sNow < L - 1e-6) { const rd = v3 && v3.ride; s.glow(pe, (tk.neutral ? 0.05 : 0.08) * (rd ? 0.55 : 1), rgb, 0.95, { reflect: -0.9 }); s.sphere(pe, rd ? 0.007 : 0.014, [255, 255, 255], { flat: true }); }
    if (sNow >= L - 1e-6 && (tk.neutral || Math.hypot(pe[0], pe[1]) > 0.97)) {   // a tower in the calorimeter
      const h = clamp(0.08 + 0.1 * Math.log10(1 + tk.pr.E), 0.06, 0.46), ang = Math.atan2(pe[1], pe[0]);
      const ur = [Math.cos(ang), Math.sin(ang), 0], ut = [-Math.sin(ang), Math.cos(ang), 0];
      s.box([1.03 * ur[0] + ur[0] * h / 2, 1.03 * ur[1] + ur[1] * h / 2, 0], [h / 2, 0.045, 0.07], { rgb: CL.hexRGB(tk.color).split(',').map(Number), emit: rgb, emitA: 0.35, a: 0.9, noCull: true }, [ur, ut, [0, 0, 1]]);
      s.glow([1.05 * ur[0], 1.05 * ur[1], 0], 0.12, rgb, 0.6);
    }
    if (S.labels) s.label([pe[0], pe[1], 0.09], tk.pr.sym, { color: tk.color, font: '700 13.5px "Barlow Condensed", "Arial Narrow", sans-serif' });
  }
  function drawBeam(x, y, P, side, beta) {
    const col = P.color;
    const len = 30 + 60 * beta;
    const gr = ctx.createLinearGradient(x + side * len, y, x, y);
    gr.addColorStop(0, hexA(col, 0)); gr.addColorStop(1, hexA(col, 0.9));
    ctx.strokeStyle = gr; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + side * len, y); ctx.lineTo(x, y); ctx.stroke();
    const gl = ctx.createRadialGradient(x, y, 0, x, y, 16);
    gl.addColorStop(0, hexA(col, 1)); gl.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
    if (S.labels) haloText(ctx, P.sym, x, y - 18, { font: '700 14.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: col });
  }
  function drawTrack(tk, tp, cx, cy, k) {
    const L = trackLen(tk), sNow = Math.min(L, tp * 0.75 * Math.max(tk.beta, 0.05));
    if (sNow <= 0) return;
    const n = Math.max(6, Math.ceil(sNow / 0.01));
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (tk.neutral) { ctx.setLineDash(tk.photon ? [7, 5] : [3, 5]); ctx.lineWidth = tk.photon ? 2 : 1.6; ctx.strokeStyle = hexA(tk.color, 0.85); }
    else { ctx.lineWidth = 2.4; ctx.strokeStyle = tk.color; ctx.shadowColor = tk.color; ctx.shadowBlur = 8; }
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const p = trackPos(tk, sNow * i / n); const X = cx + p.x * k, Y = cy - p.y * k; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
    ctx.restore();
    if (!tk.neutral) {   // detector hits on the tracker layers
      ctx.fillStyle = hexA(tk.color, 0.9);
      for (let lay = 1; lay <= 5; lay++) {
        for (let i = 0; i < n; i++) {
          const p0 = trackPos(tk, sNow * i / n), p1 = trackPos(tk, sNow * (i + 1) / n);
          const r0 = Math.hypot(p0.x, p0.y), r1 = Math.hypot(p1.x, p1.y), R = lay / 5;
          if ((r0 - R) * (r1 - R) <= 0) { ctx.beginPath(); ctx.arc(cx + p1.x * k, cy - p1.y * k, 2.6, 0, TAU); ctx.fill(); }
        }
      }
    }
    const pe = trackPos(tk, sNow);
    const ex = cx + pe.x * k, ey = cy - pe.y * k;
    if (sNow >= L - 1e-6 && (tk.neutral || Math.hypot(pe.x, pe.y) > 0.97)) {   // calorimeter deposit
      const h = clamp(8 + 10 * Math.log10(1 + tk.pr.E), 6, 46);
      const ang = Math.atan2(-pe.y, pe.x);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.fillStyle = hexA(tk.color, 0.7); ctx.fillRect(k * 1.02, -4, h, 8);
      ctx.restore();
    }
    if (S.labels) haloText(ctx, tk.pr.sym, ex + 10, ey - 10, { font: '700 13.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: tk.color });
  }

  /* ------------------------------------------------------------------
     Cards
     ------------------------------------------------------------------ */
  function kv(rows) { return '<div class="kv">' + rows.map(r => r === '-' ? '<div class="sep"></div>' : `<span>${r[0]}</span><b>${r[1]}</b>`).join('') + '</div>'; }
  function renderBefore(res) {
    const A = res.A, B = res.B;
    const one = (P, K, E, Pm, v, g, side) => [[`<b style="color:${P.color}">Beam ${side}: ${P.sym}</b> ${P.name}`, ''], ['kinetic energy K', MEV(K)], ['rest energy mc²', MEV(P.m)], ['total energy E = K + mc²', MEV(E)], ['momentum pc', MEV(Pm)], ['speed v/c', pl(v, 6)], ['Lorentz factor γ', isFinite(g) ? pl(g, 5) : '—']];
    $('#collBefore').innerHTML = kv([...one(A, res.Ka, res.E1, res.P1, res.v1, res.g1, 'A'), '-', ...one(B, res.Kb, res.E2, res.P2, res.v2, res.g2, 'B')]);
  }
  function renderEnergy(res) {
    const rows = [
      ['total energy E₁ + E₂', MEV(res.Etot)],
      ['total momentum (p₁ − p₂)c', MEV(res.Ptot)],
      ['<b>collision energy E<sub>cm</sub></b>', '<b>' + MEV(res.Ecm) + '</b>'],
      ['<b>available for new particles Q</b>', '<b>' + MEV(res.Q) + '</b>'],
    ];
    if (res.B.m > 0 && isFinite(res.Klab)) rows.push(['same Q with B at rest needs K_A =', MEV(res.Klab)]);
    if (res.barrier > 0) rows.push(['Coulomb barrier', MEV(res.barrier)], res.Q < res.barrier ? ['closest approach (head-on)', pl(res.rmin, 3) + ' fm'] : ['Q is above the barrier', 'the nuclei touch']);
    rows.push('-');
    for (const [lab, thr] of [['π⁰ (neutral pion)', 134.98], ['π⁺π⁻ pair', 279.14], ['K⁺K⁻ pair', 987.35], ['p p̄ pair (antiproton)', 1876.54]]) rows.push([lab + ' needs ' + MEV(thr), res.Q >= thr ? '<span style="color:var(--ok)">✓ possible</span>' : '<span style="color:var(--ink-3)">✗ not enough</span>']);
    $('#collEnergy').innerHTML = kv(rows) + `<p>E<sub>cm</sub> = √[(E₁ + E₂)² − (p₁c − p₂c)²] = √[(${MEV(res.Etot)})² − (${MEV(res.Ptot)})²] = ${MEV(res.Ecm)}. ${res.Kb <= 0 && res.B.m > 0 ? 'With B at rest, much of the energy is used up in moving the debris forward: this is why physicists build colliders.' : ''}</p>`;
  }
  function narrateColl(res) {
    const el = $('#collNarrateX'); if (!el) return;
    let h;
    if (!res) h = 'Two beams fly at each other from left and right. Pick the particles and how much energy each has, then press <b>Collide!</b> The detector\'s magnetic field curls every charged particle that comes out, so you can tell them apart.';
    else if (res.outcome === 'annihilate') h = '<b>Matter met antimatter.</b> Both particles vanished completely and their energy turned into new particles, often pure light (gamma rays). This is the most efficient "explosion" there is: E = mc².';
    else if (res.outcome === 'bounce') h = '<b>They bounced.</b> Both nuclei are positively charged, so they push each other away before they can touch, like two magnets with the same poles facing. Give them more energy to break through the barrier.';
    else if (res.outcome === 'scatter') h = `They <b>bounced off each other</b> like billiard balls${res.products.length > 2 ? ', and some of the collision energy turned into <b>brand-new particles</b>: energy can become mass (E = mc²)' : ''}. Charged tracks curl in the field; straight dashed tracks are neutral.`;
    else h = `The nuclei <b>touched</b> and the strong nuclear force took over.${res.products.some(p => ['pip', 'pim', 'Kp', 'Km', 'pbar'].includes(p.key)) ? ' Some of the energy turned into the mass of <b>new particles</b> (E = mc²).' : ''} Every collision is a little different, so press Collide again.`;
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  function surprise() {
    const keys = $$('#collA button[data-key]').map(b => b.dataset.key);
    if (!keys.length) return;
    const pick = () => keys[Math.floor(Math.random() * keys.length)];
    S.a = pick(); S.b = pick();
    const lg = (lo, hi) => +(10 ** (Math.log10(lo) + Math.random() * (Math.log10(hi) - Math.log10(lo)))).toPrecision(3);
    S.Ka = lg(1, 3000); S.Kb = Math.random() < 0.15 ? 0 : lg(1, 3000);
    sync(); preview(); fire();
  }
  function renderOut(res) {
    narrateColl(res);
    const outTitle = { annihilate: 'Annihilation: matter turned into energy', bounce: 'Coulomb bounce: they never touched', scatter: 'Scattering', nuclear: 'Nuclear collision' }[res.outcome];
    let expl;
    if (res.outcome === 'annihilate') expl = `${res.A.sym} and ${res.B.sym} are matter and antimatter. They destroyed each other completely and their energy (${MEV(res.Etot)}) reappeared as ${res.products.map(p => p.sym).join(' + ')}. ${res.products.every(p => p.key === 'gamma') && res.Q < 1 ? 'At low energy each photon carries about 511 keV, the rest energy of an electron (E = mc²). PET scanners detect exactly these photon pairs.' : ''}`;
    else if (res.outcome === 'bounce') expl = `Both are positively charged, so they repel. With Q = ${MEV(res.Q)} below the Coulomb barrier of ${MEV(res.barrier)}, they stop ${pl(res.rmin, 3)} fm apart (1 fm = 10⁻¹⁵ m) and are pushed back, before the strong nuclear force can act. Raise the energy above the barrier to make them touch.`;
    else if (res.outcome === 'scatter') expl = `The particles bounced off each other${res.products.length > 2 ? ' and some of the collision energy was turned into new particles' : ''}. Energy, momentum and charge are all conserved.`;
    else expl = `The nuclei touched and the strong force took over.${res.products.some(p => ['pip', 'pim', 'Kp', 'Km', 'pbar'].includes(p.key)) ? ' Some of the energy Q became the mass of brand-new particles (E = mc²).' : ''}${res.products.some(p => p.fromPi0) ? ' Neutral pions (π⁰) decay almost at once into two photons.' : ''}${res.products.some(p => ['n', 't', 'he3'].includes(p.key)) && !['n'].includes(res.aKey) ? ' Some nuclei broke into pieces.' : ''} The particles and directions are chosen at random within what energy and momentum conservation allow, so press Collide again for a different event.`;
    const rows = res.products.map(p => {
      const r = PHYS.trackRadius(p.p, p.z, S.B);
      return `<tr><td style="color:${p.color}">${p.sym} ${p.name}</td><td>${p.z > 0 ? '+' + p.z : p.z < 0 ? '−' + (-p.z) : '0'}</td><td>${MEV(p.E)}</td><td>${MEV(p.K)}</td><td>${MEV(p.p)}</td><td>${pl(p.beta, 4)}</td><td>${p.z === 0 ? 'straight' : isFinite(r) ? pl(r * 100, 3) + ' cm' : '—'}</td></tr>`;
    }).join('');
    const okE = Math.abs(res.sumE - res.Etot) < 1e-6 * res.Etot, okP = Math.abs(res.sumPx - res.Ptot) < 1e-6 * res.Etot && Math.abs(res.sumPy) < 1e-6 * res.Etot, okQ = res.chargeIn === res.chargeOut;
    $('#collOut').innerHTML = `<p style="margin:0 0 6px"><b style="color:var(--ink)">${outTitle}</b>. ${expl}</p>
      <div class="table-wrap"><table class="prod-table"><thead><tr><th>Particle</th><th>Charge</th><th>Energy E</th><th>Kinetic K</th><th>Momentum pc</th><th>v/c</th><th>Track radius</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="cons"><span>${okE ? '✓' : '✗'} energy: ${MEV(res.Etot)} in, ${MEV(res.sumE)} out</span><span>${okP ? '✓' : '✗'} momentum conserved</span><span>${okQ ? '✓' : '✗'} charge: ${res.chargeIn} in, ${res.chargeOut} out</span></div>
      <p>Track radius r = p/(|q|B): curling tracks are slow or highly charged; straight (dashed) tracks are neutral: photons γ and neutrons n.</p>`;
  }

  /* ------------------------------------------------------------------
     Explosion
     ------------------------------------------------------------------ */
  function centre() { if (v3 && v3.on) { const p = v3.scene.project([0, 0, 0]); if (p) return [p.x, p.y]; } return [W / 2, H / 2]; }
  function boom() {
    const res = ev.res, [cx, cy] = centre();
    if (ev) ev.boomAt = performance.now();
    const big = clamp(Math.log10(1 + Math.max(res.Q, 0)) / 3.4, 0.15, 1);
    if (res.outcome === 'bounce') {
      fx.ring(cx, cy, { speed: 160, life: 0.6, color: '255,150,210', width: 2 });
      audio.zap(); shake.kick(3, 0.3);
    } else if (res.outcome === 'annihilate') {
      fx.flash(0.95, '210,235,255');
      fx.ring(cx, cy, { speed: 700, life: 0.9, color: '220,240,255', width: 6 });
      fx.ring(cx, cy, { speed: 380, life: 1.1, color: '255,230,120', width: 3 });
      fx.burst(cx, cy, 120, { speed: 520, life: 0.9, colors: ['255,255,255', '200,230,255', '255,236,140'] });
      shake.kick(10, 0.8); audio.boom(0.9);
    } else {
      fx.flash(0.4 + 0.55 * big, '255,240,220');
      fx.ring(cx, cy, { speed: 300 + 500 * big, life: 0.8, color: '255,210,150', width: 3 + 4 * big });
      fx.ring(cx, cy, { speed: 160 + 200 * big, life: 1.0, color: '255,120,90', width: 2 });
      fx.burst(cx, cy, Math.round(50 + 150 * big), { speed: 260 + 420 * big, life: 0.9 + 0.4 * big, colors: ['255,255,255', '255,214,120', '255,140,60', '255,79,163', '54,214,255'] });
      shake.kick(4 + 12 * big, 0.6 + 0.6 * big); audio.boom(0.4 + 1.2 * big);
    }
  }
  function finishEvent() {
    const res = ev.res;
    renderOut(res);
    $('#collReplay').disabled = false;
    const txt = { annihilate: `Annihilation! ${res.products.length} new particles from ${MEV(res.Etot)}`, bounce: 'Coulomb bounce: the nuclei never touched', scatter: `Scattered at E_cm = ${MEV(res.Ecm)}`, nuclear: `Nuclear collision: ${res.products.length} particles out` }[res.outcome];
    setStatus(txt, res.outcome === 'bounce' ? 'is-warn' : 'is-good');
    const fresh = [];
    if (res.outcome === 'annihilate' && ((S.a === 'e' && S.b === 'ebar') || (S.a === 'ebar' && S.b === 'e'))) fresh.push(missions.complete('coll-annihilate'));
    if (res.outcome === 'bounce' && !HEP[S.a].lepton && !HEP[S.b].lepton) fresh.push(missions.complete('coll-bounce'));
    if (S.a !== 'pbar' && S.b !== 'pbar' && res.products.some(p => p.key === 'pbar')) fresh.push(missions.complete('coll-antimatter'));
    const got = fresh.filter(Boolean);
    if (got.length) toast($('#collToast'), `<b>Mission complete: ${got.map(m => m.title).join(', ')}</b>`, '', 6000);
  }

  /* ------------------------------------------------------------------
     Replay
     ------------------------------------------------------------------ */
  function startReplay() {
    if (!ev) return;
    ev.tau = VIS.Tc - 0.5; ev.boomed = false; ev.replay = { phase: 'slow' };
    fx.clear();
    $('#collLetterbox').classList.add('is-on');
    $('#collLbSpeed').textContent = '0.1×';
    $('#collLbInfo').textContent = `E_cm = ${MEV(ev.res.Ecm)} · Q = ${MEV(ev.res.Q)}`;
    audio.whoosh();
  }

  /* ------------------------------------------------------------------
     Loop
     ------------------------------------------------------------------ */
  function frame(now, dt) {
    if (!active) return;
    if (ev && ev.tau < VIS.Tc + VIS.Tp + 0.5) {
      let sp = 1;
      if (ev.replay) {
        const d = ev.tau - VIS.Tc;
        sp = d < -0.35 ? 0.35 : d < 0.7 ? 0.1 : 0.6;
        ev.cam = 1 + 0.9 * Math.exp(-((d - 0.1) ** 2) / 0.18);
      } else ev.cam = 1;
      const fxScale = ev.replay && sp < 0.2 ? 0.25 : 1;
      ev.tau += dt * sp;
      if (!ev.boomed && ev.tau >= VIS.Tc) { ev.boomed = true; boom(); if (!ev.replay) setStatus(`Collision! E_cm = ${MEV(ev.res.Ecm)}`, 'is-run'); }
      fx.update(dt * fxScale);
      if (ev.tau >= VIS.Tc + VIS.Tp && !ev.done) {
        ev.done = true; finishEvent();
        if (S.auto && !ev.autoReplayed && !reduceMotion) { ev.autoReplayed = true; setTimeout(() => { if (active && ev && ev.done) startReplay(); }, 700); }
      }
      if (ev.replay && ev.tau >= VIS.Tc + VIS.Tp + 0.4) { ev.replay = null; ev.cam = 1; $('#collLetterbox').classList.remove('is-on'); }
    } else fx.update(dt);
    shake.update(now);
    draw(now);
  }
  const setStatus = (t, cls = '') => { const h = $('#collStatus'); h.textContent = t; h.className = 'hud hud-status ' + cls; };

  /* ------------------------------------------------------------------
     Controls
     ------------------------------------------------------------------ */
  function grid(el, side) {
    el.innerHTML = GRID.map(k => { const P = HEP[k]; return `<button type="button" class="pbtn-part" role="radio" data-key="${k}"><span class="dot" style="background:${P.color};color:${P.color}"></span><span class="sym">${P.sym}</span><span class="nm">${P.name}</span></button>`; }).join('');
    el.addEventListener('click', ev2 => { const b = ev2.target.closest('button[data-key]'); if (!b) return; S[side] = b.dataset.key; sync(); preview(); });
  }
  function sync() {
    if (v3 && v3.updateRide) v3.updateRide();
    for (const b of $$('#collA button')) b.setAttribute('aria-checked', String(b.dataset.key === S.a));
    for (const b of $$('#collB button')) b.setAttribute('aria-checked', String(b.dataset.key === S.b));
    ctlA.sync(); ctlB.sync();
    if (S.Kb <= 0) $('#n-collKb').value = '0';
    $('#collAuto').checked = S.auto; $('#collLabels').checked = S.labels;
  }
  function preview() {
    const res = PHYS.collide(S.a, Math.max(S.Ka, 0), S.b, Math.max(S.Kb, 0), { rnd: () => 0.5 });
    renderBefore(res); renderEnergy(res);
  }
  function bindControls() {
    grid($('#collA'), 'a'); grid($('#collB'), 'b');
    ctlA = bindRange({ range: $('#r-collKa'), num: $('#n-collKa'), min: 0.001, max: 10000, log: true, get: () => S.Ka, set: v => { S.Ka = v; preview(); } });
    ctlB = bindRange({ range: $('#r-collKb'), num: $('#n-collKb'), min: 0.001, max: 10000, log: true, get: () => Math.max(S.Kb, 0.001), set: v => { S.Kb = v; preview(); } });
    bindRange({ range: $('#r-collB'), num: $('#n-collB'), min: 0, max: 4, step: 0.05, get: () => S.B, set: v => { S.B = v; if (ev) ev.tracks = buildTracks(ev.res); } });
    $('#collPresets').innerHTML = PRESETS.map((p, i) => `<button type="button" class="chip-btn" data-i="${i}">${p.label}</button>`).join('');
    $('#collPresets').addEventListener('click', ev2 => {
      const b = ev2.target.closest('button[data-i]'); if (!b) return;
      const p = PRESETS[+b.dataset.i]; Object.assign(S, { a: p.a, b: p.b, Ka: p.Ka, Kb: p.Kb });
      sync(); preview(); fire();
    });
    $('#collGo').addEventListener('click', fire);
    $('#collSurprise').addEventListener('click', () => { audio.unlock(); surprise(); });
    $('#collReplay').addEventListener('click', startReplay);
    $('#collAuto').addEventListener('change', ev2 => { S.auto = ev2.target.checked; });
    $('#collLabels').addEventListener('change', ev2 => { S.labels = ev2.target.checked; });
    $('#collFromLab').addEventListener('click', () => {
      const bm = CL.lab && CL.lab.beam(); if (!bm) return;
      const key = PHYS.LAB_TO_HEP[bm.key];
      if (!key) { toast($('#collToast'), '<b>That particle is not available in the collider.</b> Choose a proton, deuteron, alpha, carbon-12, electron or positron in the cyclotron.', 'warn', 6000); return; }
      S.a = key; S.Ka = +bm.K.toPrecision(4); sync(); preview();
      toast($('#collToast'), `<b>Beam A loaded from the cyclotron:</b> ${HEP[key].sym} at ${MEV(S.Ka)}${bm.extracted ? '' : ' (the energy the cyclotron would reach)'}.`, '', 5000);
    });
    $('#collToast .toast-close').addEventListener('click', () => { $('#collToast').hidden = true; });
    CL.bus.on('mission', renderMissions);
    document.addEventListener('keydown', e2 => {
      if (!active) return;
      const tg = e2.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      if (e2.key === ' ' && tg !== 'BUTTON' && tg !== 'SUMMARY') { e2.preventDefault(); fire(); }
    });
  }
  function renderMissions() { missions.render($('#collMissions'), 'collide'); const [d, n] = missions.count('collide'); $('#collMissionCount').textContent = `${d} / ${n}`; }
  function resize() {
    if (!active) return;
    const wrap = $('#collWrap');
    if (v3 && v3.full) { const b = v3.fullBox(); W = b.W; H = b.H; cv.style.height = H + 'px'; return; }
    cv.style.height = '';
    const w = wrap.clientWidth;
    const h = userH ? Math.round(clamp(userH, 220, 1600)) : Math.round(clamp(w * 0.72, 300, Math.max(320, window.innerHeight * 0.62)));
    wrap.style.setProperty('--arena-h', h + 'px');
    W = w; H = h;
  }
  function init() {
    cv = $('#collCanvas'); shake = shaker($('#collWrap'));
    v3 = CL.V3.attach($('#collWrap'), { home: { yaw: -1.1, pitch: 0.62, dist: 3.9, target: [0, 0, -0.08], fov: 46 }, storeKey: 'cl-3d-coll',
      full: { bar: () => $('#collWrap').nextElementSibling, onChange: () => resize() },
      ride: { label: () => `Ride the ${HEP[S.a].name.toLowerCase()}`, title: 'Ride beam A into the collision, then fly out with the fastest new particle' } });
    bindControls(); sync(); preview(); renderMissions(); narrateColl(null);
    CL.grip($('#collGrip'), {
      axis: 'y', get: () => H,
      set: (v, dragging) => { userH = Math.round(v); resize(); userH = H; if (!dragging) CL.store.set('cl-h-coll', userH); CL.sizeBadge($('#collWrap'), `${W} × ${H} px`, dragging ? 'release to keep this height' : 'double-click the corner for automatic height', dragging ? 0 : 1400); },
      reset: () => { userH = 0; CL.store.set('cl-h-coll', 0); resize(); CL.sizeBadge($('#collWrap'), `${W} × ${H} px`, 'automatic height'); },
    });
  }
  CL.screens.collide = { init, show() { active = true; requestAnimationFrame(resize); }, hide() { active = false; }, frame, resize };
})();
