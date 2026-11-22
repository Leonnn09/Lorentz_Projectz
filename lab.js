/* =====================================================================
   Project Lorentz — the Cyclotron screen (CL.screens.lab)
   Machine view, controls, graphs, verbose data, chaos mode (live engine),
   overload mode, slow-motion replay, rainbow trails, tools and notebook.
   ===================================================================== */
(() => {
  'use strict';
  const { PHYS, C, $, $$, clamp, TAU, DEG, e, pl, en, len, si, pct, store, skin, audio, FX, shaker, arrow, haloText, pill, hexA, hexRGB, palette,
    niceTicks, tickLabel, unitFor, timeUnit, energyUnit, lengthUnit, powUnit, bindRange, toast, missions, reduceMotion } = CL;

  const GAP_NOMINAL = 0.02;      // m — gap width used to quote the electric-field strength
  const MAX_REVS = 10000;

  /* ------------------------------------------------------------------
     Settings, presets, missions
     ------------------------------------------------------------------ */
  const DEFAULTS = {
    preset: 'default',
    particle: 'proton', customMassU: 1.00728, customZ: 1,
    fieldInput: 'current', coils: 2, turns: 400, current: 50, targetB: 1.0, gapCm: 5, dir: 'cw',
    R: 0.40, Vkv: 200, rfMode: 'fixed', rel: true, detunePct: 0, injDeg: 0,
    speed: 'normal',
    show: { vel: true, force: true, efield: true, field: true, trail: true, radius: true, current: true, labels: true },
    trail: 'energy', pal: 'rainbow',
    graphA: 'v', graphB: 'K', tab: 'now', working: true,
    chaos: false, chaosMult: 1, chaosFlicker: 0, chaosAutoRF: false,
    over: false,
  };
  const PHYS_KEYS = ['particle', 'customMassU', 'customZ', 'fieldInput', 'coils', 'turns', 'current', 'targetB', 'gapCm', 'dir', 'R', 'Vkv', 'rfMode', 'rel', 'detunePct', 'injDeg'];
  const clone = o => JSON.parse(JSON.stringify(o));
  let S = clone(DEFAULTS);

  const SL = {
    coils: { min: 1, max: 6, step: 1, int: true, unit: '' },
    turns: { min: 10, max: 1000, step: 10, int: true, unit: '' },
    current: { min: 0, max: 100, step: 0.5, unit: 'A', over: 2000 },
    targetB: { min: 0, max: 6, step: 0.01, unit: 'T', over: 20 },
    gapCm: { min: 2, max: 20, step: 0.5, unit: 'cm' },
    R: { min: 0.04, max: 1.5, step: 0.005, unit: 'm' },
    Vkv: { min: 1, max: 500, log: true, unit: 'kV', over: 3000 },
    detunePct: { min: -3, max: 3, step: 0.05, unit: '%' },
    injDeg: { min: -80, max: 80, step: 1, unit: '°' },
    chaosMult: { min: 0, max: 3, step: 0.01, unit: '×' },
    chaosFlicker: { min: 0, max: 30, step: 0.5, unit: '%' },
  };
  const LIVE_KEYS = ['coils', 'turns', 'current', 'targetB', 'gapCm', 'Vkv'];
  const SPEEDS = { slow: 0.25, normal: 1, fast: 5, turbo: 40 };   // revolutions per real second

  const PRESETS = {
    custom: { label: 'Your own settings', note: '' },
    default: {
      label: 'Teaching cyclotron (default)', set: {},
      note: 'A small proton cyclotron: 2 coils × 400 turns at 50 A give about 1 T. Protons leave at about 7.8 MeV after about 20 turns.',
    },
    lawrence: {
      label: 'Livingston’s 4-inch cyclotron, 1931',
      set: { particle: 'custom', customMassU: 2.0151, customZ: 1, fieldInput: 'field', targetB: 1.16, R: 0.05, Vkv: 1 },
      note: 'In January 1931 the first working cyclotron accelerated hydrogen molecular ions (H₂⁺, entered here as a custom ion of 2.0151 u and charge +1e) to 80 keV using only about 1 kV. The field and radius are chosen to match that energy.',
    },
    twentyseven: {
      label: 'Inspired by Lawrence’s 27-inch (1930s), deuterons',
      set: { particle: 'deuteron', fieldInput: 'field', targetB: 1.5, R: 0.30, Vkv: 50 },
      note: 'Berkeley’s 27-inch cyclotron accelerated deuterons to nearly 5 MeV. Here B = 1.5 T and R = 0.30 m give about 4.9 MeV.',
    },
    pet: {
      label: 'Hospital PET cyclotron (about 17 MeV protons)',
      set: { fieldInput: 'field', targetB: 1.5, R: 0.40, Vkv: 100, detunePct: -0.8 },
      note: 'Hospitals make fluorine-18 for PET scans with 10–20 MeV protons. Relativity would make a perfectly tuned machine lose step, so the RF is set 0.8 % low (real PET cyclotrons shape the field instead).',
    },
    therapy: {
      label: 'Proton-therapy synchrocyclotron (230 MeV)',
      set: { fieldInput: 'field', targetB: 5.7, R: 0.407, Vkv: 15, rfMode: 'fm' },
      note: 'Like IBA’s S2C2: a 5.7 T superconducting synchrocyclotron for 230 MeV therapy protons. The RF frequency follows the particle. The real machine needs about 40,000 turns; this one uses a higher voltage, so it needs about 7,700.',
    },
    alpha: {
      label: 'Alpha particles, frequency follows particle',
      set: { particle: 'alpha', fieldInput: 'field', targetB: 1.5, R: 0.5, Vkv: 200, rfMode: 'fm' },
      note: 'Alpha particles (2 protons + 2 neutrons) in a 1.5 T synchrocyclotron reach about 27 MeV: almost what a proton would get, because K_max ∝ q²/m.',
    },
    electron: {
      label: 'Electrons: why cyclotrons fail',
      set: { particle: 'electron', fieldInput: 'field', targetB: 0.05, R: 0.30, Vkv: 20 },
      note: 'Electrons become relativistic almost at once (γ = 2 at 511 keV). With a fixed RF frequency this one falls out of step near 80 keV. Can you rescue it?',
    },
    overload: {
      label: 'Overload test: superconducting magnet at its limit',
      set: { fieldInput: 'current', current: 480, rfMode: 'fm' }, over: true,
      note: 'Overload mode is on and the coils carry 480 A: about 9.7 T, past the magnet’s limit. Press play and watch the warnings. (The failure and explosion are illustrative.)',
    },
  };

  const MISSIONS = [
    { id: 'pet', title: 'PET isotope factory', goal: 'Extract a proton beam of 10–20 MeV: the energy range hospitals use to make fluorine-18 for PET scans.' },
    { id: 'fifth', full: true, title: 'One fifth of light speed', goal: 'With relativity on, make a proton travel faster than 0.2c (20 % of the speed of light). Watch out for the RF timing.' },
    { id: 'compact', title: 'Pocket-sized cyclotron', goal: 'Extract protons with at least 5 MeV from dees no bigger than R = 0.25 m.' },
    { id: 'magnet', title: 'Strong but thrifty magnet', goal: 'Make a field of at least 1.5 T while the coil current is 40 A or less.' },
    { id: 'electron', full: true, title: 'Rescue the electron', goal: 'With relativity on, extract an electron with at least 2 MeV. A fixed frequency will fail: why?' },
    { id: 'record', full: true, title: 'Classic cyclotron record', goal: 'Fixed frequency, relativity on: extract protons with at least 20 MeV. The best classic machines reached about 22 MeV. (Hint: Advanced RF tuning.)' },
  ];
  for (const m of MISSIONS) missions.add({ ...m, screen: 'lab' });

  const GRAPH_OPTS = [
    ['v', 'Speed v vs time'],
    ['K', 'Kinetic energy K vs time'],
    ['r', 'Orbit radius r vs time'],
    ['x', 'Sideways position x vs time'],
    ['f', 'Particle frequency vs RF frequency'],
    ['g', 'Lorentz factor γ vs time'],
    ['dK', 'Energy gained at each gap crossing'],
    ['Kr', 'Kinetic energy vs orbit radius'],
  ];

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  let D = null, run = null, pred = null, ghost = null, live = false;
  let cum = [0], cumA = [0];                 // path length and angle before each segment
  let playT = 0, playing = false, segIdx = 0, endShown = false, skipping = false;
  let Kref = 1, vref = 1, extent = 0, lastKi = -1;
  let wallFx = false, extFx = false, targetFx = false, hotSpot = null, floaters = [];
  let replay = null, fail = null, stress = 0, alarmOn = false, chaosFlip = 1;
  let stats = { flips: 0, nudges: 0, changes: 0 };
  let active = false, started = false, v3 = null, lid = 0;
  const view = { size: 600, dpr: 1, zoom: 1, panX: 0, panY: 0, base: 1, autoZoom: false };
  let viewCv, viewCtx, staticCv, staticCtx, trailCv, trailCtx;
  let staticDirty = true, trailDirty = true, trailDrawn = 0, staticSign = 0, staticMag = 0;
  let geom = { cx: 0, cy: 0, Rp: 1, w: 8, h: 1 }, deeL = null, deeR = null, coilGeom = null;
  let coilPhase = 0, uiDirty = true, lastUI = 0;
  const graphs = [];
  const fx = new FX();
  let shake = null, shakeAll = null;
  const tools = { tape: false, watch: false, probe: false };
  let userSize = +store.get('cl-stage-size', 0) || 0;      // 0 = automatic size
  let tape = null, tapeDrag = null, probePos = null;
  const sw = { running: false, t0: 0, acc: 0 };
  let notebook = store.get('cl-notebook', []) || [];
  const ctls = {};

  const isLiveRunning = () => live && run && run.status === 'running';

  /* ------------------------------------------------------------------
     Colours for both skins
     ------------------------------------------------------------------ */
  const DARK = {
    yoke0: '#2c322e', yoke1: '#1c211e', yoke2: '#0d100e', ring: 'rgba(255,255,255,0.03)', ring2: 'rgba(0,0,0,0.3)',
    bolt: '#3b433e', boltHi: 'rgba(230,240,232,0.38)', rim: '#3a433e', rimHi: 'rgba(230,240,232,0.22)',
    vac0: '#16201b', vac1: '#0c120f', vac2: '#050807', deeFill: 'rgba(201,128,63,0.12)', deeLine: 'rgba(230,166,104,0.95)', deeGlow: 'rgba(255,140,60,0.45)',
    gapFill: 'rgba(255,190,110,0.09)', sym: 'rgba(179,166,255,0.42)', grid: 'rgba(220,235,225,0.08)', gridText: 'rgba(220,235,225,0.5)',
    label: 'rgba(238,242,236,0.94)', halo: 'rgba(6,9,7,0.85)', outLabel: '#cfd8d0', outHalo: 'rgba(6,9,7,0.85)', copperLabel: '#ffc58f',
    scale: '#e3ebe4', scaleHalo: 'rgba(6,9,7,0.9)', trailPlain: '#ffc34d', ghost: 'rgba(220,232,222,0.35)', source: '#c9d1cb',
    steel: ['#47514b', '#2c3430', '#3d4641'], steelLine: '#68736c', sideBg: '#080c0a', sideText: '#dfe7df', sideHalo: 'rgba(6,9,7,0.85)', sideField: '179,166,255',
    graph: { v: '#4fd67f', K: '#ff8a3d', r: '#4dabf7', x: '#8c9eff', g: '#da77f2', f: '#b3a6ff', dK: '#ff8a3d', Kr: '#ff8a3d', rf: '#ffb020', ghost: '#7f8b83', ghost2: '#59645d', theory: '#93a197', hoverBg: 'rgba(238,242,236,0.94)', hoverFg: '#0b0f0c', cursor: 'rgba(220,232,222,0.35)' },
  };
  // the machine view and the scopes are dark glass screens in both colour schemes
  const PALS = { control: DARK, classroom: DARK };
  const P = () => PALS[skin.name] || PALS.control;

  /* ------------------------------------------------------------------
     Derived quantities and the run
     ------------------------------------------------------------------ */
  function derived() {
    const part = PHYS.particle(S.particle, S.customMassU, S.customZ);
    const gap = S.gapCm / 100;
    let I, Bmag;
    if (S.fieldInput === 'current') { I = S.current; Bmag = PHYS.magnetField(S.coils, S.turns, I, gap); }
    else { Bmag = S.targetB; I = PHYS.magnetCurrent(S.coils, S.turns, Bmag, gap); }
    const Bz = S.dir === 'cw' ? -Bmag : Bmag;    // clockwise current seen from above → B points into the screen
    const q = part.z * C.e;
    const Pp = {
      mass: part.mass, charge: q, B: Bz, R: S.R, V: S.Vkv * 1e3, rfMode: S.rfMode,
      detune: S.detunePct / 100, relativistic: S.rel, injPhase: S.injDeg * DEG, maxRevs: MAX_REVS,
    };
    return { part, gap, I, Bmag, Bz, q, absq: Math.abs(q), m: part.mass, mc2: part.mass * C.c * C.c, P: Pp, N: S.coils * S.turns };
  }

  function buildRun() {
    D = derived();
    pred = PHYS.predictions(D.P);
    live = S.chaos && D.Bmag > 1e-9;
    chaosFlip = 1; stats = { flips: 0, nudges: 0, changes: 0 };
    if (live) {
      run = PHYS.createLive(D.P);
      run.mult = S.chaosMult; run.flip = 1; run.autoRF = S.chaosAutoRF || S.rfMode === 'fm';
      if (S.chaosFlicker > 0) run.setFlicker(S.chaosFlicker / 100); else run.restart();
    } else run = PHYS.computeRun(D.P);
    prepRun();
  }

  function prepRun() {
    cum = [0]; cumA = [0]; segIdx = 0;
    if (live) {
      Kref = Math.max(pred.Kmax * Math.max(1, S.chaosMult) ** 2, 1e-30);
      extent = S.R;
    } else {
      Kref = Math.max(run.status === 'extracted' ? pred.Kmax : 0, run.Kpeak, 1e-30);
      let ext = 0;
      for (const s of run.segs) if (s.type === 'arc') ext = Math.max(ext, Math.hypot(s.cx, s.cy) + s.r);
      extent = ext;
    }
    vref = Math.max(PHYS.kin(Kref, D.m, S.rel).v, 1e-9);
    // tiny orbits (e.g. electrons in a strong field): zoom in automatically
    if (!live && run.rot !== 0 && extent > 0 && extent < 0.2 * S.R) {
      view.zoom = clamp(2 ** Math.floor(Math.log2(0.8 * S.R / extent)), 1, 128); view.panX = view.panY = 0; view.autoZoom = true; view.follow = false; syncZoomKey();
    } else if (view.autoZoom) { view.zoom = 1; view.panX = view.panY = 0; view.autoZoom = false; syncZoomKey(); }
    playT = 0; endShown = false; skipping = false;
    lastKi = kickIndexAt(0);
    wallFx = extFx = targetFx = false; hotSpot = null; floaters = [];
    endReplay(true);
    setupView();
    staticDirty = trailDirty = true; uiDirty = true;
    hideToast();
    refreshStaticUI();
  }

  /* ------------------------------------------------------------------
     Run queries (work for the exact run and the live chaos run)
     ------------------------------------------------------------------ */
  function segAt(t) {
    const segs = run.segs, last = segs.length - 1;
    let i = clamp(segIdx, 0, last);
    const inside = j => t >= segs[j].t0 && (t < segs[j].t1 || j === last);
    if (inside(i) && (i === last || segs[i + 1].t0 > t)) return i;
    if (i < last && inside(i + 1) && (i + 1 === last || segs[i + 2].t0 > t)) return (segIdx = i + 1);
    let lo = 0, hi = last;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid].t0 <= t) lo = mid; else hi = mid - 1; }
    return (segIdx = lo);
  }
  function ensureCum(i) {
    const segs = run.segs;
    for (let k = cum.length - 1; k < i; k++) {
      const s = segs[k];
      cum.push(cum[k] + (s.type === 'exit' ? 0 : s.v * (s.t1 - s.t0)));
      cumA.push(cumA[k] + (s.type === 'arc' ? s.w * (s.t1 - s.t0) : 0));
    }
  }
  function stateAt(t) {
    const i = segAt(t), s = run.segs[i];
    const tt = clamp(t, s.t0, Math.max(s.t0, s.t1));
    const p = PHYS.posAt(s, tt);
    ensureCum(i);
    const st = { i, s, t, x: p.x, y: p.y, ux: p.ux, uy: p.uy, v: s.v, K: s.K, p: s.p, g: s.g, r: s.r, B: Math.abs(s.Bz || 0), a: 0, fx: 0, fy: 0 };
    if (s.type === 'arc') {
      st.a = s.w * (tt - s.t0);
      st.cx = s.cx; st.cy = s.cy;
      const dx = s.cx - p.x, dy = s.cy - p.y, dl = Math.hypot(dx, dy) || 1;
      st.fx = dx / dl; st.fy = dy / dl;
      st.path = cum[i] + s.r * st.a;
      st.revs = (cumA[i] + st.a) / TAU;
    } else {
      st.path = cum[i] + (s.type === 'exit' ? 0 : s.v * (tt - s.t0));
      st.revs = cumA[i] / TAU;
    }
    return st;
  }
  const rfPhase = t => { const s = run.segs[segAt(t)]; return s.phiStart + s.wRF * (t - s.t0); };
  const rfFreqNow = st => st.s.wRF / TAU;
  function kickIndexAt(t) {
    const k = run.kicks; let lo = 0, hi = k.length - 1;
    if (!k.length || k[0].t > t) return -1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (k[mid].t <= t) lo = mid; else hi = mid - 1; }
    return lo;
  }
  const runEnded = () => run.status !== 'running' && playT >= run.tStop - 1e-18;
  const totalRevs = () => { if (run.status === 'running') return NaN; ensureCum(run.segs.length); let n = 0; for (let k = 0; k < run.segs.length; k++) n += run.segs[k].type === 'arc' ? run.segs[k].w * (run.segs[k].t1 - run.segs[k].t0) : 0; return n / TAU; };
  function speedRevs() {
    if (replay) return 0.1;
    if (pov.on) return POV_SPEEDS[S.speed] || POV_SPEEDS.normal;
    if (S.speed === 'turbo') return Math.max(SPEEDS.turbo, isFinite(pred.nRev) ? pred.nRev / 12 : 0);
    return SPEEDS[S.speed];
  }
  const slowFactor = () => 1 / (speedRevs() * run.T0);

  function advance(revs) {
    if (isLiveRunning()) {
      run.advance(revs * run.T0);
      playT = run.t;
      if (run.status !== 'running') onLiveFinished();
      return;
    }
    let rem = revs, guard = 0;
    const segs = run.segs;
    while (rem > 1e-12 && playT < run.tEnd && guard++ < 200000) {
      const i = segAt(playT), s = segs[i];
      const per = s.type === 'arc' ? TAU / s.w : run.T0;
      const left = s.t1 - playT, need = rem * per;
      if (need < left) { playT += need; rem = 0; }
      else { playT = s.t1; rem -= left / per; if (i === segs.length - 1) break; }
    }
    if (playT >= run.tEnd) { playT = run.tEnd; setPlaying(false); }
  }
  function onLiveFinished() {
    if (run.Kpeak > Kref * 1.01) { Kref = run.Kpeak * 1.05; vref = PHYS.kin(Kref, D.m, S.rel).v; trailDirty = true; refreshLegend(); }
    run.revs = totalRevs();
    uiDirty = true;
  }
  function fastForward() {
    const t0 = performance.now();
    while (isLiveRunning() && performance.now() - t0 < 22) run.advance(run.T0 * 25);
    playT = run.t;
    if (!isLiveRunning()) { onLiveFinished(); skipping = false; playT = run.tEnd; setPlaying(false); }
  }

  /* ------------------------------------------------------------------
     View geometry
     ------------------------------------------------------------------ */
  let rim = null, rimHover = false, rimLock = false, rimPending = null, narrT = 0;
  function setupView() { if (rimLock) return; view.base = (view.size / 2) * 0.955 / (1.28 * S.R); }
  const sc = () => view.base * view.zoom;
  const X = x => view.size / 2 + (x - view.panX) * sc();
  const Y = y => view.size / 2 - (y - view.panY) * sc();
  const toPhys = (sx, sy) => ({ x: (sx - view.size / 2) / sc() + view.panX, y: -(sy - view.size / 2) / sc() + view.panY });
  // zoom about a point on the screen (the physics point under it stays put)
  function zoomAt(z, sx = view.size / 2, sy = view.size / 2) {
    const p = toPhys(sx, sy);
    view.zoom = clamp(z, 1, 128);
    if (view.zoom < 1.001) { view.zoom = 1; view.panX = view.panY = 0; view.follow = false; }
    else { view.panX = p.x - (sx - view.size / 2) / sc(); view.panY = p.y + (sy - view.size / 2) / sc(); }
    view.autoZoom = false; staticDirty = trailDirty = true; uiDirty = true;
    syncZoomKey();
  }
  // the zoom keys: + and − step through the shared levels, the level key steps 1× → 2× → 3× → 1×. Zoomed in from a key,
  // the view follows the particle so it never leaves the picture; dragging, the wheel or a pinch hand the view back.
  function zoomKey(z) { zoomAt(z); view.follow = view.zoom > 1; uiDirty = true; }
  function syncZoomKey() { if (!(v3 && v3.on)) CL.zoom.show($('#zoomFit'), view.zoom); }
  function followParticle(dt) {
    if (!view.follow || view.zoom <= 1 || !run || !run.segs || !run.segs.length) return;
    const st = stateAt(playT), k = 1 - Math.exp(-Math.max(dt, 0) * 25);
    const nx = view.panX + (st.x - view.panX) * k, ny = view.panY + (st.y - view.panY) * k;
    if (Math.hypot(nx - view.panX, ny - view.panY) * sc() < 0.35) return;
    view.panX = nx; view.panY = ny; staticDirty = trailDirty = true;
  }

  // Room for the machine view: on wide screens the stage column sits next to the 310 px control
  // column and the info column (at least 340 px wide).
  function room() {
    const lab = $('#screen-lab .lab'), stage = $('#stage');
    const cs = getComputedStyle(lab);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    if (window.innerWidth > 1180) return { desktop: true, maxW: Math.floor(lab.clientWidth - padX - 310 - 340 - 24), H: lab.clientHeight - padY };
    return { desktop: false, maxW: Math.floor(stage.clientWidth || lab.clientWidth - padX), H: window.innerHeight * 0.78 };
  }
  function layout() {
    const lab = $('#screen-lab .lab'), tb = $('#screen-lab .timebar'), stage = $('#stage');
    if (!lab || !active) return;
    const wrap0 = $('#stageWrap');
    if (v3 && v3.full) {                // full screen: the view fills the screen above the floating control bar
      const box = v3.fullBox(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.dpr = dpr; wrap0.style.width = wrap0.style.height = '';
      if (pov.on || v3.on) {
        view.w = box.W; view.h = box.H; view.size = Math.min(box.W, box.H);
        viewCv.width = Math.round(box.W * dpr); viewCv.height = Math.round(box.H * dpr);
        viewCv.style.width = box.W + 'px'; viewCv.style.height = box.H + 'px';
      } else {
        const size = Math.floor(Math.min(box.W, box.H)); view.w = view.h = 0; view.size = size;
        for (const cv of [viewCv, staticCv, trailCv]) { cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); }
        viewCv.style.width = viewCv.style.height = size + 'px';
        setupView(); staticDirty = trailDirty = true;
      }
      wrap0.classList.toggle('is-wide', view.size >= 560); wrap0.classList.toggle('is-compact', view.size < 500);
      return;
    }
    viewCv.style.width = viewCv.style.height = '';
    if (pov.on) {                      // riding: the view fills the whole lab, wide like a cinema screen
      const cs = getComputedStyle(lab), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const w = Math.max(280, Math.floor(lab.clientWidth - padX));
      stage.style.setProperty('--stage-size', w + 'px');
      const nav = $('.navbar'), portrait = window.innerHeight > window.innerWidth * 1.2;
      const availH = (window.innerWidth > 1180 ? lab.clientHeight - padY : window.innerHeight - (nav ? nav.offsetHeight : 0) - padY - 12) - tb.offsetHeight - 10;
      const h = Math.floor(clamp(availH, 240, w * (portrait ? 1.35 : 0.8)));
      wrap0.style.width = w + 'px'; wrap0.style.height = h + 'px';
      wrap0.classList.toggle('is-wide', w >= 560); wrap0.classList.toggle('is-compact', w < 500);
      view.w = w; view.h = h; view.dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewCv.width = Math.round(w * view.dpr); viewCv.height = Math.round(h * view.dpr);
      return;
    }
    wrap0.style.width = wrap0.style.height = ''; view.w = view.h = 0;
    const a = room(), setW = w => stage.style.setProperty('--stage-size', w + 'px');
    let size;
    if (userSize) size = clamp(userSize, 260, Math.max(260, a.maxW));   // the user dragged the corner
    else if (a.desktop) {
      // automatic: as big as fits together with the time bar under it. The time bar's height depends
      // on its width (it wraps), so shrink step by step until both fit.
      size = Math.max(260, a.maxW);
      for (let i = 0; i < 8; i++) {
        setW(size);
        const fit = Math.floor(Math.min(a.H - tb.offsetHeight - 10, a.maxW));
        if (fit >= size || fit <= 260) { size = Math.max(260, Math.min(size, fit)); break; }
        size = fit;
      }
    } else size = Math.min(a.maxW, a.H);
    size = Math.floor(clamp(size, 260, 1600));
    setW(size);
    const wrap = $('#stageWrap'), split = $('#labSplit');
    if (split) split.style.left = (parseFloat(getComputedStyle(lab).paddingLeft) + size) + 'px';
    wrap.classList.toggle('is-wide', size >= 560);
    wrap.classList.toggle('is-compact', size < 500);
    view.size = size;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const cv of [viewCv, staticCv, trailCv]) { cv.width = Math.round(size * view.dpr); cv.height = Math.round(size * view.dpr); }
    setupView();
    staticDirty = trailDirty = true;
    for (const G of graphs) sizeGraph(G);
    drawSideView($('#sideView'));
    if (!tape) tape = { a: { x: 0, y: 0 }, b: { x: S.R, y: 0 } };
  }

  /* ------------------------------------------------------------------
     Static layer: magnet, coils, chamber, dees, field symbols, labels
     ------------------------------------------------------------------ */
  function makeDeePaths(cx, cy, Rp) {
    const w = Math.max(8, Rp * 0.07), h = Math.sqrt(Math.max(Rp * Rp - w * w / 4, 0));
    const th = Math.acos(clamp((w / 2) / Rp, -1, 1));
    deeR = new Path2D(); deeR.moveTo(cx + w / 2, cy - h); deeR.arc(cx, cy, Rp, -th, th, false); deeR.closePath();
    deeL = new Path2D(); deeL.moveTo(cx - w / 2, cy + h); deeL.arc(cx, cy, Rp, Math.PI - th, Math.PI + th, false); deeL.closePath();
    geom = { cx, cy, Rp, w, h };
  }
  // commanded field (ignores flicker) used for the field symbols
  function fieldCommanded() {
    if (!live) return D.Bz;
    return run.P.B * run.mult * run.flip;
  }

  function drawStatic() {
    const ctx = staticCtx, s = view.size, k = sc(), pc = P();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);
    const cx = X(0), cy = Y(0), Rp = S.R * k;

    // iron yoke / pole cap
    const g = ctx.createRadialGradient(cx, cy - Rp * 0.25, Rp * 0.2, cx, cy, Rp * 2.3);
    g.addColorStop(0, pc.yoke0); g.addColorStop(0.55, pc.yoke1); g.addColorStop(1, pc.yoke2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.lineWidth = 1;
    const ringStep = Math.max(5, Rp * 0.035);
    for (let i = 0; i < 40; i++) {
      const rr = Rp * 1.30 + i * ringStep;
      ctx.strokeStyle = i % 2 ? pc.ring : pc.ring2;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
    }
    const br = clamp(Rp * 0.018, 2.5, 7);
    for (let i = 0; i < 16; i++) {
      const a = (i + 0.5) / 16 * TAU, bx = cx + Math.cos(a) * Rp * 1.36, by = cy + Math.sin(a) * Rp * 1.36;
      ctx.fillStyle = pc.bolt; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
      ctx.fillStyle = pc.boltHi; ctx.beginPath(); ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.42, 0, TAU); ctx.fill();
    }

    // coils
    const inner = Rp * 1.10, outer = Rp * 1.26, n = S.coils, bw = (outer - inner) / n;
    for (let i = 0; i < n; i++) {
      const r0 = inner + i * bw + 0.8, r1 = inner + (i + 1) * bw - 0.8;
      const cg = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
      cg.addColorStop(0, '#7f3f15'); cg.addColorStop(0.45, '#e3a462'); cg.addColorStop(1, '#9a5020');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, r1, 0, TAU); ctx.arc(cx, cy, r0, 0, TAU, true); ctx.fill();
      const nl = clamp(Math.round(S.turns / 100), 1, 10);
      ctx.strokeStyle = 'rgba(85, 40, 12, 0.42)'; ctx.lineWidth = 0.8;
      for (let j = 1; j <= nl; j++) { const rr = r0 + (r1 - r0) * j / (nl + 1); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); }
    }
    coilGeom = { inner, outer, bw, n };

    // vacuum chamber
    const Rc = Rp * 1.06;
    ctx.fillStyle = pc.rim; ctx.beginPath(); ctx.arc(cx, cy, Rc + Math.max(3, Rp * 0.022), 0, TAU); ctx.fill();
    ctx.strokeStyle = pc.rimHi; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, Rc + Math.max(3, Rp * 0.022) - 0.5, 0, TAU); ctx.stroke();
    const gv = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rc);
    gv.addColorStop(0, pc.vac0); gv.addColorStop(0.7, pc.vac1); gv.addColorStop(1, pc.vac2);
    ctx.fillStyle = gv; ctx.beginPath(); ctx.arc(cx, cy, Rc, 0, TAU); ctx.fill();

    // polar measuring grid inside the chamber
    if (S.show.labels && Rp > 80) {
      const step = niceStep(S.R / 4);
      ctx.strokeStyle = pc.grid; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
      for (let r = step; r < S.R * 1.0001; r += step) { ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, TAU); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.font = '500 11.5px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.fillStyle = pc.gridText; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      for (let r = step; r < S.R * 1.0001; r += step) ctx.fillText(len(r, 2), cx + r * k * 0.7071 + 3, cy + r * k * 0.7071 - 2);
    }

    // dees and gap
    makeDeePaths(cx, cy, Rp);
    // the dees are hollow copper boxes: a faint copper sheen that brightens towards the rim
    const dg = ctx.createRadialGradient(cx, cy, Rp * 0.1, cx, cy, Rp);
    dg.addColorStop(0, 'rgba(201,128,63,0.05)'); dg.addColorStop(0.82, 'rgba(201,128,63,0.12)'); dg.addColorStop(1, 'rgba(236,170,108,0.24)');
    ctx.fillStyle = dg; ctx.fill(deeL); ctx.fill(deeR);
    ctx.save();
    if (pc.deeGlow) { ctx.shadowColor = pc.deeGlow; ctx.shadowBlur = 10; }
    ctx.strokeStyle = pc.deeLine; ctx.lineWidth = 1.6; ctx.stroke(deeL); ctx.stroke(deeR);
    ctx.restore();
    ctx.fillStyle = pc.gapFill;
    ctx.fillRect(cx - geom.w / 2, cy - geom.h, geom.w, 2 * geom.h);

    // magnetic field symbols (⊗ into / ⊙ out of the screen); density grows with |B|
    const Bc = fieldCommanded(), Bm = Math.abs(Bc);
    staticSign = Math.sign(Bc); staticMag = Bm;
    if (S.show.field && Bm > 1e-6) {
      const sp = clamp(54 / Math.sqrt(Bm), 18, 90);
      const r = clamp(sp * 0.16, 3, 6);
      const into = Bc < 0;
      ctx.strokeStyle = pc.sym; ctx.fillStyle = pc.sym; ctx.lineWidth = 1.2;
      const i0 = Math.floor((0 - cx) / sp) - 1, i1 = Math.ceil((s - cx) / sp) + 1;
      const j0 = Math.floor((0 - cy) / sp) - 1, j1 = Math.ceil((s - cy) / sp) + 1;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const px = cx + (i + 0.5) * sp, py = cy + (j + 0.5) * sp;
        if (Math.hypot(px - cx, py - cy) > Rc - r - 3) continue;
        if (Math.abs(px - cx) < geom.w / 2 + r + 1) continue;
        ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke();
        if (into) {
          const d = r * 0.6;
          ctx.beginPath(); ctx.moveTo(px - d, py - d); ctx.lineTo(px + d, py + d); ctx.moveTo(px + d, py - d); ctx.lineTo(px - d, py + d); ctx.stroke();
        } else { ctx.beginPath(); ctx.arc(px, py, r * 0.32, 0, TAU); ctx.fill(); }
      }
    }

    // comparison run
    if (ghost) {
      ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = pc.ghost; ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (const sg of ghost.run.segs) pathSeg(ctx, sg);
      ctx.stroke(); ctx.restore();
    }

    // ion source
    const s0 = run.segs[0];
    const sx = X(s0.type === 'arc' ? s0.cx + s0.r * Math.cos(s0.th0) : s0.x0), sy = Y(s0.type === 'arc' ? s0.cy + s0.r * Math.sin(s0.th0) : s0.y0);
    ctx.fillStyle = pc.source; ctx.strokeStyle = '#2b3550'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, TAU); ctx.fill(); ctx.stroke();

    if (S.show.labels) {
      const lf = '600 14px "Barlow Condensed", "Arial Narrow", sans-serif';
      const dy = cy + Rp * 0.80;
      haloText(ctx, 'Dee 1', cx + Rp * 0.40, dy, { font: lf, color: pc.label, haloColor: pc.halo, align: 'right' });
      haloText(ctx, 'Dee 2', cx - Rp * 0.40, dy, { font: lf, color: pc.label, haloColor: pc.halo, align: 'left' });
      haloText(ctx, 'gap', cx, cy - Rp * 0.94, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: 'rgba(255,214,160,0.95)', haloColor: pc.halo });
      if (Rp > 120) haloText(ctx, 'ion source', sx - 10, sy + 16, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: pc.label, haloColor: pc.halo, align: 'right' });
      if (view.zoom === 1) {
        haloText(ctx, `Copper coil${S.coils > 1 ? 's' : ''}: ${S.coils} × ${S.turns} turns`, 14, s - 58, { font: '600 13.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: pc.copperLabel, haloColor: pc.outHalo, align: 'left' });
        haloText(ctx, 'Steel yoke (magnet pole underneath)', 14, s - 40, { font: '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: pc.outLabel, haloColor: pc.outHalo, align: 'left' });
      }
    }

    // scale bar
    const target = 90 / k;
    const mag = 10 ** Math.floor(Math.log10(target));
    const L = [1, 2, 5, 10].map(f => f * mag).reduce((b, c2) => Math.abs(c2 - target) < Math.abs(b - target) ? c2 : b);
    const Lpx = L * k, x0 = 14, y0 = s - 16;
    ctx.strokeStyle = pc.scale; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(x0, y0 - 5); ctx.lineTo(x0, y0); ctx.lineTo(x0 + Lpx, y0); ctx.lineTo(x0 + Lpx, y0 - 5); ctx.stroke();
    haloText(ctx, len(L, 2), x0 + Lpx / 2, y0 - 10, { font: '700 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: pc.scale, haloColor: pc.scaleHalo });
    staticDirty = false;
  }
  function niceStep(x) { const m = 10 ** Math.floor(Math.log10(x)), f = x / m; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * m; }

  /* ------------------------------------------------------------------
     Trail
     ------------------------------------------------------------------ */
  function pathSeg(ctx, s) {
    const k = sc();
    if (s.type === 'arc') {
      if (!(s.span > 0)) return;
      ctx.moveTo(X(s.cx + s.r * Math.cos(s.th0)), Y(s.cy + s.r * Math.sin(s.th0)));
      ctx.arc(X(s.cx), Y(s.cy), s.r * k, -s.th0, -(s.th0 + s.rot * s.span), s.rot > 0);
    } else {
      const L = s.v * (s.t1 - s.t0);
      if (!(L > 0)) return;
      ctx.moveTo(X(s.x0), Y(s.y0)); ctx.lineTo(X(s.x0 + s.ux * L), Y(s.y0 + s.uy * L));
    }
  }
  const trailWidth = () => clamp(0.9 + view.size / 520, 1.4, 2.6);
  function trailBin(sg) {
    if (S.trail === 'plain') return -1;
    const f = S.trail === 'speed' ? sg.v / vref : sg.K / Kref;
    return Math.round(clamp(f, 0, 1) * 63);
  }
  const trailColor = sg => { const b = trailBin(sg); return b < 0 ? P().trailPlain : palette(S.pal)[b]; };
  function drawSegs(from, to) {
    const ctx = trailCtx;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.lineWidth = trailWidth(); ctx.lineCap = 'round';
    const bins = new Map();
    for (let i = from; i < to; i++) {
      const sg = run.segs[i];
      const b = trailBin(sg);
      if (!bins.has(b)) bins.set(b, []);
      bins.get(b).push(sg);
    }
    const pal = palette(S.pal);
    for (const [b, list] of bins) {
      ctx.strokeStyle = b < 0 ? P().trailPlain : pal[b]; ctx.beginPath();
      for (const sg of list) pathSeg(ctx, sg);
      ctx.stroke();
    }
  }
  function updateTrail(cur) {
    if (trailDirty || cur < trailDrawn) {
      trailCtx.setTransform(1, 0, 0, 1, 0, 0);
      trailCtx.clearRect(0, 0, trailCv.width, trailCv.height);
      // while the zoomed view follows the particle the trail is drawn again every frame, so on a long run (thousands of
      // turns, too close together to tell apart at this zoom) only the last 300 turns are drawn
      trailDrawn = view.follow && view.zoom > 1 ? Math.max(0, cur - 600) : 0; trailDirty = false;
    }
    if (cur > trailDrawn) { drawSegs(trailDrawn, cur); trailDrawn = cur; }
  }

  /* ------------------------------------------------------------------
     Ride the particle: a chase camera that flies along with the
     particle inside the hollow copper dees.
     World: x, y in the dee plane (m), z up (towards the viewer of the
     top view). Sizes are true to scale: the dees are hollow boxes about
     0.36 × the pole gap high, and the field lines run straight up and
     down between the magnet poles.
     ------------------------------------------------------------------ */
  const POV_SPEEDS = { slow: 0.1, normal: 0.28, fast: 1, turbo: 4 };   // revolutions per real second while riding
  const pov = { on: false, flash: 0, flashCol: '255,190,90', jolt: 0, yaw: 0, pitch: 0, drag: null, pops: [], beatAt: -9, tickAt: -9, rfN: null,
    trail: [], trailSeg: 0, trailRun: null, tauCum: [0], tauRun: null, wallFx: false, extFx: false, hint: false };
  const POV_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
  function povGeom() {
    const R = run.R || S.R, gap = S.gapCm / 100;
    return { R, h: clamp(0.36 * gap, 0.006, 0.04), hp: gap / 2, wg: clamp(0.03 * R, 0.004, 0.02), Rch: R * 1.06 };
  }
  function properTime(st) {                       // time on the particle's own clock: τ = ∫ dt / γ
    if (pov.tauRun !== run) { pov.tauCum = [0]; pov.tauRun = run; }
    const segs = run.segs, c = pov.tauCum;
    for (let k = c.length - 1; k < st.i && k < segs.length; k++) c.push(c[k] + (segs[k].t1 - segs[k].t0) / (segs[k].g || 1));
    return c[Math.min(st.i, c.length - 1)] + (playT - st.s.t0) / (st.g || 1);
  }
  function povAddSeg(s, tEnd, out) {
    if (s.type === 'exit') return;
    const t1 = Math.min(tEnd, s.t1);
    if (!(t1 > s.t0)) return;
    const n = s.type === 'arc' ? Math.max(1, Math.min(400, Math.ceil(Math.abs(s.w) * (t1 - s.t0) / 0.12))) : 1;
    const col = trailColor(s);
    for (let k = 0; k <= n; k++) { const p = PHYS.posAt(s, s.t0 + (t1 - s.t0) * k / n); out.push({ x: p.x, y: p.y, c: col }); }
  }
  function povTrail(st) {
    if (pov.trailRun !== run || st.i < pov.trailSeg) { pov.trail = []; pov.trailSeg = 0; pov.trailRun = run; }
    while (pov.trailSeg < st.i) { povAddSeg(run.segs[pov.trailSeg], Infinity, pov.trail); pov.trailSeg++; }
    if (pov.trail.length > 5000) pov.trail.splice(0, pov.trail.length - 3500);
    const cur = []; povAddSeg(st.s, playT, cur);
    return cur;
  }
  function drawPOV(dt, now) {
    const st = stateAt(playT);
    const ctx = viewCtx, W = view.w || view.size, H = view.h || view.size, g = povGeom();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    // ---- camera: a little behind and above the particle, looking along its velocity
    let ux = st.ux, uy = st.uy;
    if (!isFinite(ux) || !isFinite(uy) || (Math.abs(ux) + Math.abs(uy) < 1e-9)) { ux = 1; uy = 0; }
    if (!pov.drag) { pov.yaw *= Math.exp(-dt * 2.5); pov.pitch *= Math.exp(-dt * 2.5); }
    pov.jolt *= Math.exp(-dt * 6); pov.flash *= Math.exp(-dt * 4.5);
    const back = 0.016, up = Math.min(0.0055, g.h * 0.55);
    const yaw = Math.atan2(uy, ux) + pov.yaw, pitch = -0.19 + pov.pitch - 0.05 * pov.jolt;
    const cp = Math.cos(pitch), sp = Math.sin(pitch), hx = Math.cos(yaw), hy = Math.sin(yaw);
    const Fv = [hx * cp, hy * cp, sp], Rv = [hy, -hx, 0], Uv = [-hx * sp, -hy * sp, cp];
    const Cx = st.x - ux * back, Cy = st.y - uy * back, Cz = up;
    const f = Math.max(W, H * 1.4) / 2 / Math.tan((49 + 5 * pov.jolt) * Math.PI / 180), cyS = H * 0.5, near = 0.0012;
    const yH = cyS + f * Math.tan(pitch);                 // the horizon: where far floor and ceiling meet
    const tr = (x, y, z) => { const dx = x - Cx, dy = y - Cy, dz = z - Cz; return [dx * Rv[0] + dy * Rv[1], dx * Uv[0] + dy * Uv[1] + dz * Uv[2], dx * Fv[0] + dy * Fv[1] + dz * Fv[2]]; };
    const pr = p => [W / 2 + f * p[0] / p[2], cyS - f * p[1] / p[2]];
    const segTo = (a, b) => {
      if (a[2] < near && b[2] < near) return null;
      if (a[2] < near) { const t = (near - a[2]) / (b[2] - a[2]); a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]; }
      else if (b[2] < near) { const t = (near - b[2]) / (a[2] - b[2]); b = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, near]; }
      return [pr(a), pr(b)];
    };
    const fillPoly = (pts, style) => {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ia = a[2] >= near, ib = b[2] >= near;
        if (ia) out.push(a);
        if (ia !== ib) { const t = (near - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]); }
      }
      if (out.length < 3) return;
      ctx.fillStyle = style; ctx.beginPath();
      out.forEach((p, i) => { const q = pr(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath(); ctx.fill();
    };
    const fog = d => clamp(1 - d / 0.42, 0, 1);
    const rfDead = fail && fail.type === 'rf';
    const pol = rfDead ? 0 : Math.sign(D.q) * Math.cos(rfPhase(playT));   // +1 = left dee positive
    // ---- background: the dark vacuum between the magnet poles
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d1210'); bg.addColorStop(0.5, '#050807'); bg.addColorStop(1, '#0a0e0c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // ---- the two dees: copper floor and ceiling plates, D-shaped, with the gap between them
    const yR = Math.sqrt(Math.max(g.R * g.R - g.wg * g.wg / 4, 0)), th0 = Math.atan2(yR, g.wg / 2);
    const deeShape = side => { const pts = []; for (let i = 0; i <= 56; i++) { const a = th0 - (2 * th0) * i / 56; pts.push([side * g.R * Math.cos(a), g.R * Math.sin(a)]); } pts.push([side * g.wg / 2, -yR]); pts.push([side * g.wg / 2, yR]); return pts; };
    const dees = [deeShape(1), deeShape(-1)];
    // chamber wall (steel) far away, then the dee outer walls (copper), drawn back to front
    const quads = [];
    const ring = (rad, z0, z1, col, from, to, n) => {
      for (let i = 0; i < n; i++) {
        const a0 = from + (to - from) * i / n, a1 = from + (to - from) * (i + 1) / n;
        const x0 = rad * Math.cos(a0), y0 = rad * Math.sin(a0), x1 = rad * Math.cos(a1), y1 = rad * Math.sin(a1);
        const mx = (x0 + x1) / 2 - Cx, my = (y0 + y1) / 2 - Cy, d = Math.hypot(mx, my);
        quads.push({ d, col, pts: [tr(x0, y0, z0), tr(x1, y1, z0), tr(x1, y1, z1), tr(x0, y0, z1)], shade: fog(d * 0.7) });
      }
    };
    ring(g.Rch, -g.hp, g.hp, 'steel', 0, TAU, 96);
    ring(g.R, -g.h, g.h, 'copper', -th0, th0, 40);
    ring(g.R, -g.h, g.h, 'copper', Math.PI - th0, Math.PI + th0, 40);
    quads.sort((a, b) => b.d - a.d);
    // floor and ceiling of each dee (drawn first: they are the "ground" and "sky")
    // dark copper, lit from near the camera: a vertical gradient is a true depth cue on a level floor
    const floorG = ctx.createLinearGradient(0, H, 0, yH);
    floorG.addColorStop(0, 'rgb(84,46,20)'); floorG.addColorStop(0.4, 'rgb(40,22,10)'); floorG.addColorStop(1, 'rgb(8,6,4)');
    const ceilG = ctx.createLinearGradient(0, 0, 0, yH);
    ceilG.addColorStop(0, 'rgb(48,27,12)'); ceilG.addColorStop(0.5, 'rgb(22,13,7)'); ceilG.addColorStop(1, 'rgb(7,5,4)');
    dees.forEach((shape, i) => {
      const side = i === 0 ? 1 : -1, plus = (side < 0) === (pol > 0);
      fillPoly(shape.map(([x, y]) => tr(x, y, -g.h)), floorG);
      const tint = Math.abs(pol) * (plus ? 0.34 : 0.3), rgb = plus ? '229,72,63' : '48,112,240';
      // the dee's charge shows as a glow that is strongest close to you and fades into the distance
      const tg = (y0, y1, a) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},${a * 0.12})`); return gr; };
      if (tint > 0.01) fillPoly(shape.map(([x, y]) => tr(x, y, -g.h)), tg(H, yH, tint));
      fillPoly(shape.map(([x, y]) => tr(x, y, g.h)), ceilG);
      if (tint > 0.01) fillPoly(shape.map(([x, y]) => tr(x, y, g.h)), tg(0, yH, tint * 0.6));
    });
    // the gap between the dees glows with the accelerating voltage
    if (Math.abs(pol) > 0.02) for (const z of [-g.h, g.h]) fillPoly([tr(-g.wg / 2, -yR, z), tr(g.wg / 2, -yR, z), tr(g.wg / 2, yR, z), tr(-g.wg / 2, yR, z)], `rgba(255,176,60,${0.35 * Math.abs(pol)})`);
    for (const q of quads) {
      const k = q.col === 'steel' ? 0.5 + 0.5 * q.shade : 0.3 + 0.7 * q.shade;
      fillPoly(q.pts, q.col === 'steel' ? `rgb(${Math.round(16 + 12 * k)},${Math.round(20 + 14 * k)},${Math.round(18 + 12 * k)})` : `rgb(${Math.round(30 + 62 * k)},${Math.round(17 + 34 * k)},${Math.round(8 + 14 * k)})`);
    }
    // bright copper seams where the dee walls meet floor and ceiling: they draw the shape of the room
    for (const [a0, a1] of [[-th0, th0], [Math.PI - th0, Math.PI + th0]]) {
      const N = 48;
      for (let i = 0; i < N; i++) {
        const b0 = a0 + (a1 - a0) * i / N, b1 = a0 + (a1 - a0) * (i + 1) / N;
        const x0 = g.R * Math.cos(b0), y0 = g.R * Math.sin(b0), x1 = g.R * Math.cos(b1), y1 = g.R * Math.sin(b1);
        const d = Math.hypot((x0 + x1) / 2 - Cx, (y0 + y1) / 2 - Cy), al = 0.15 + 0.7 * fog(d * 0.8);
        ctx.strokeStyle = `rgba(255,170,96,${al})`; ctx.lineWidth = d < 0.12 ? 2 : 1.3; ctx.beginPath();
        for (const z of [-g.h, g.h]) { const s2 = segTo(tr(x0, y0, z), tr(x1, y1, z)); if (s2) { ctx.moveTo(s2[0][0], s2[0][1]); ctx.lineTo(s2[1][0], s2[1][1]); } }
        ctx.stroke();
      }
    }
    // engraved grid on the copper floor: rings every 2 cm, spokes every 15°
    ctx.lineWidth = 1;
    const gridLines = [[], [], []];
    const addGrid = (x0, y0, x1, y1, z) => {
      if (Math.abs((x0 + x1) / 2) < g.wg / 2) return;
      const d = Math.hypot((x0 + x1) / 2 - Cx, (y0 + y1) / 2 - Cy); if (d > 0.42) return;
      const s2 = segTo(tr(x0, y0, z), tr(x1, y1, z)); if (!s2) return;
      gridLines[d < 0.1 ? 0 : d < 0.22 ? 1 : 2].push(s2);
    };
    for (let rr = 0.02; rr < g.R; rr += 0.02) {
      const n = Math.max(24, Math.round(rr / 0.006));
      for (let i = 0; i < n; i++) { const a0 = TAU * i / n, a1 = TAU * (i + 1) / n; addGrid(rr * Math.cos(a0), rr * Math.sin(a0), rr * Math.cos(a1), rr * Math.sin(a1), -g.h); }
    }
    for (let i = 0; i < 24; i++) { const a = TAU * i / 24; for (let k = 0; k < 10; k++) { const r0 = g.R * k / 10, r1 = g.R * (k + 1) / 10; addGrid(r0 * Math.cos(a), r0 * Math.sin(a), r1 * Math.cos(a), r1 * Math.sin(a), -g.h); } }
    [0.5, 0.26, 0.11].forEach((al, i) => { ctx.strokeStyle = `rgba(255,164,92,${al})`; ctx.lineWidth = i ? 1 : 1.25; ctx.beginPath(); for (const [p, q] of gridLines[i]) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } ctx.stroke(); });
    // edges of the dees along the gap (the copper lips you fly between)
    ctx.strokeStyle = 'rgba(240,180,120,0.75)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (const side of [1, -1]) for (const z of [-g.h, g.h]) {
      const N = 40;
      for (let i = 0; i < N; i++) { const y0 = -yR + 2 * yR * i / N, y1 = -yR + 2 * yR * (i + 1) / N; const s2 = segTo(tr(side * g.wg / 2, y0, z), tr(side * g.wg / 2, y1, z)); if (s2) { ctx.moveTo(s2[0][0], s2[0][1]); ctx.lineTo(s2[1][0], s2[1][1]); } }
    }
    ctx.stroke();
    const fogBand = ctx.createLinearGradient(0, yH - H * 0.2, 0, yH + H * 0.2);
    fogBand.addColorStop(0, 'rgba(5,8,7,0)'); fogBand.addColorStop(0.5, 'rgba(5,8,7,0.7)'); fogBand.addColorStop(1, 'rgba(5,8,7,0)');
    ctx.fillStyle = fogBand; ctx.fillRect(0, yH - H * 0.2, W, H * 0.4);
    // ---- the magnetic field: straight lines from pole to pole, a "forest" you fly through
    const Bref = Math.max(Math.abs(run.P.B), 1e-9), fB = clamp(st.B / Bref, 0, 1.6);
    if (fB > 0.02) {
      const spc = 0.018, reach = 0.32, lines = [[], [], []], chev = [];
      const i0 = Math.floor((Cx - reach) / spc), i1 = Math.ceil((Cx + reach) / spc), j0 = Math.floor((Cy - reach) / spc), j1 = Math.ceil((Cy + reach) / spc);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = (i + 0.5) * spc, y = (j + 0.5) * spc;
        if (x * x + y * y > g.Rch * g.Rch) continue;
        const dx = x - Cx, dy = y - Cy, d = Math.hypot(dx, dy);
        if (d > reach || dx * Fv[0] + dy * Fv[1] < -0.01) continue;
        const s2 = segTo(tr(x, y, -g.hp), tr(x, y, g.hp)); if (!s2) continue;
        lines[d < 0.07 ? 0 : d < 0.16 ? 1 : 2].push(s2);
        if (d < 0.055) chev.push([x, y]);
      }
      const al = Math.min(1, fB);
      [0.6, 0.32, 0.13].forEach((a, i) => { ctx.strokeStyle = `rgba(185,172,255,${a * al})`; ctx.lineWidth = i === 0 ? 1.8 : i === 1 ? 1.2 : 1; ctx.beginPath(); for (const [p, q] of lines[i]) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } ctx.stroke(); });
      // arrowheads show which way B points (down = into the screen of the top view)
      const dir = (st.s.Bz || run.P.B) < 0 ? -1 : 1;
      ctx.strokeStyle = `rgba(200,190,255,${0.75 * al})`; ctx.lineWidth = 1.4; ctx.beginPath();
      for (const [x, y] of chev) for (const z of [g.h * 0.5]) {
        const a = tr(x, y, z), b = tr(x, y, z + dir * 0.0025);
        if (a[2] < near || b[2] < near) continue;
        const p = pr(a), q = pr(b), vx = q[0] - p[0], vy = q[1] - p[1], L = Math.hypot(vx, vy) || 1, s2 = clamp(L * 0.9, 2, 7);
        const nx = vx / L, ny = vy / L;
        ctx.moveTo(q[0] - nx * s2 - ny * s2 * 0.7, q[1] - ny * s2 + nx * s2 * 0.7); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0] - nx * s2 + ny * s2 * 0.7, q[1] - ny * s2 - nx * s2 * 0.7);
      }
      ctx.stroke();
    }
    // ---- electric field across the gap: arrows from the + dee to the − dee
    if (Math.abs(pol) > 0.05 && Math.abs(Cx) < 0.35) {
      const a = Math.abs(pol), dirx = pol > 0 ? 1 : -1;
      ctx.strokeStyle = `rgba(255,190,90,${0.75 * a})`; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let y = Math.round((Cy - 0.25) / 0.03) * 0.03; y <= Cy + 0.25; y += 0.03) {
        if (Math.abs(y) > yR) continue;
        for (const z of [-g.h * 0.5, 0, g.h * 0.5]) {
          const x0 = -dirx * g.wg * 0.42, x1 = dirx * g.wg * 0.42;
          const s2 = segTo(tr(x0, y, z), tr(x1, y, z)); if (!s2) continue;
          const [p, q] = s2, vx = q[0] - p[0], vy = q[1] - p[1], L = Math.hypot(vx, vy); if (L < 3) continue;
          const nx = vx / L, ny = vy / L, hs = Math.min(8, L * 0.35);
          ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
          ctx.moveTo(q[0] - nx * hs - ny * hs * 0.6, q[1] - ny * hs + nx * hs * 0.6); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0] - nx * hs + ny * hs * 0.6, q[1] - ny * hs - nx * hs * 0.6);
        }
      }
      ctx.stroke();
    }
    // ---- the beam pipe after extraction
    if (run.extract && playT >= run.extract.t - 1e-15) {
      const ex = run.extract, nx = -ex.uy, ny = ex.ux, rr = 0.012;
      ctx.lineWidth = 1.2;
      for (let j = 0; j < 12; j++) {                 // long seams down the tube
        const a = TAU * j / 12, ox = rr * Math.cos(a) * nx, oy = rr * Math.cos(a) * ny, z = rr * Math.sin(a);
        ctx.strokeStyle = 'rgba(170,190,180,0.35)'; ctx.beginPath();
        for (let k = 0; k < 24; k++) { const s2 = segTo(tr(ex.x + ex.ux * k * 0.025 + ox, ex.y + ex.uy * k * 0.025 + oy, z), tr(ex.x + ex.ux * (k + 1) * 0.025 + ox, ex.y + ex.uy * (k + 1) * 0.025 + oy, z)); if (s2) { ctx.moveTo(s2[0][0], s2[0][1]); ctx.lineTo(s2[1][0], s2[1][1]); } }
        ctx.stroke();
      }
      for (let k = 0; k < 24; k++) {
        const s0 = k * 0.025;
        ctx.strokeStyle = `rgba(200,214,206,${0.25 + 0.45 * (1 - k / 24)})`;
        ctx.beginPath(); let pen = false;
        for (let j = 0; j <= 24; j++) {
          const a = TAU * j / 24, x = ex.x + ex.ux * s0 + rr * Math.cos(a) * nx, y = ex.y + ex.uy * s0 + rr * Math.cos(a) * ny, z = rr * Math.sin(a);
          const p = tr(x, y, z); if (p[2] < near) { pen = false; continue; }
          const q = pr(p); if (pen) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); pen = true; }
        }
        ctx.stroke();
      }
    }
    // ---- the path so far: the spiral you have already flown, glowing on the mid-plane
    const cur = povTrail(st);
    const drawTrail = (pts, alpha, lw = 2) => {
      let lastCol = null, pen = false, prev = null, prevC = null;
      ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.globalAlpha = alpha;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i], c3 = tr(pt.x, pt.y, 0);
        if (prev) {
          const s2 = segTo(prevC, c3);
          if (s2) {
            if (pt.c !== lastCol) { if (pen) ctx.stroke(); ctx.strokeStyle = pt.c; ctx.beginPath(); lastCol = pt.c; pen = true; ctx.moveTo(s2[0][0], s2[0][1]); }
            else ctx.moveTo(s2[0][0], s2[0][1]);
            ctx.lineTo(s2[1][0], s2[1][1]);
          }
        }
        prev = pt; prevC = c3;
      }
      if (pen) ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (pov.trail.length && cur.length) cur.unshift(pov.trail[pov.trail.length - 1]);
    ctx.globalCompositeOperation = 'lighter';
    drawTrail(pov.trail, 0.16, 7); drawTrail(cur, 0.22, 8);
    ctx.globalCompositeOperation = 'source-over';
    drawTrail(pov.trail, 0.85); drawTrail(cur, 1, 2.4);
    // ---- the particle itself
    const pc3 = tr(st.x, st.y, 0);
    let pScr = null;
    if (pc3[2] > near) {
      pScr = pr(pc3);
      const rad = clamp(f * 0.0012 / pc3[2], 3, 40), col = hexRGB(D.part.color || '#ffb020');
      const gl = ctx.createRadialGradient(pScr[0], pScr[1], 0, pScr[0], pScr[1], rad * 4.5);
      gl.addColorStop(0, 'rgba(255,255,255,1)'); gl.addColorStop(0.18, `rgba(${col},0.95)`); gl.addColorStop(0.5, `rgba(${col},0.25)`); gl.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(pScr[0], pScr[1], rad * 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pScr[0], pScr[1], rad * 0.55, 0, TAU); ctx.fill();
    }
    // ---- one-off events seen from inside
    if (run.wall && playT >= run.wall.t - 1e-18 && !pov.wallFx && playT > 0) {
      pov.wallFx = true; pov.flash = 1.4; pov.flashCol = '255,75,62'; pov.jolt = 2;
      pov.pops.push({ text: 'hit the dee wall!', born: now, bad: true });
      if (pScr) fx.burst(pScr[0], pScr[1], 50, { speed: 260, life: 0.9, colors: ['255,220,150', '255,120,60'] });
    } else if (!(run.wall && playT >= run.wall.t - 1e-18)) pov.wallFx = false;
    if (run.extract && playT >= run.extract.t && !pov.extFx && playT > 0) {
      pov.extFx = true; pov.flash = 1; pov.flashCol = '255,230,170';
      pov.pops.push({ text: `out of the machine: ${en(run.Kfinal, 3)}`, born: now, big: true });
    } else if (!(run.extract && playT >= run.extract.t)) pov.extFx = false;
    // the RF voltage peaks: a soft metronome tick
    const rfN = Math.floor(rfPhase(playT) / Math.PI);
    if (pov.rfN !== null && rfN !== pov.rfN && playing && !rfDead && Math.abs(rfN - pov.rfN) < 4 && S.speed !== 'turbo') { pov.tickAt = now; audio.metro(); }
    pov.rfN = rfN;
    // ---- screen effects: kick flash, speed streaks, floating text
    if (pov.flash > 0.02) { ctx.fillStyle = `rgba(${pov.flashCol},${0.3 * Math.min(1, pov.flash)})`; ctx.fillRect(0, 0, W, H); }
    if (pov.jolt > 0.05 && !reduceMotion) {
      ctx.strokeStyle = `rgba(255,230,190,${0.35 * Math.min(1, pov.jolt)})`; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 26; i++) { const a = i * 2.39996, r0 = W * (0.2 + 0.05 * Math.sin(i * 7.1)), r1 = r0 + W * 0.18 * pov.jolt; ctx.moveTo(W / 2 + Math.cos(a) * r0, cyS + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * r1, cyS + Math.sin(a) * r1); }
      ctx.stroke();
    }
    pov.pops = pov.pops.filter(p => now - p.born < (p.big ? 2600 : 1200));
    for (const p of pov.pops) {
      const age = (now - p.born) / (p.big ? 2600 : 1200), y = (pScr ? pScr[1] : cyS) - 30 - age * 50;
      ctx.globalAlpha = Math.min(1, 2.2 * (1 - age));
      pill(ctx, p.text, W / 2, Math.max(70, y), p.bad ? 'rgba(255,75,62,0.95)' : 'rgba(255,190,90,0.96)', p.bad ? '#fff' : '#231300', `700 ${p.big ? 19 : 16}px ${POV_FONT}`);
      ctx.globalAlpha = 1;
    }
    fx.draw(ctx, W, H);
    povHud(ctx, st, now, W, H);
    return st;
  }
  // heads-up display: name, minimap, and the dashboard of nixie readouts
  function povHud(ctx, st, now, W, H) {
    const small = W < 470, rfDead = fail && fail.type === 'rf';
    haloText(ctx, `Riding a${/^[aeiou]/i.test(D.part.name) ? 'n' : ''} ${D.part.name.toLowerCase()}`, 14, 62, { font: `600 ${small ? 15 : 18}px ${POV_FONT}`, color: '#ffd28a', align: 'left' });
    const outside = st.s.type === 'exit';
    if (!small) haloText(ctx, outside ? 'outside the magnet: no field here, so you fly straight down the beam pipe' : st.B > 1e-9 ? `B = ${pl(st.B, 3)} T: the purple field lines run ${(st.s.Bz || run.P.B) < 0 ? 'down' : 'up'} through the machine` : 'no magnetic field: nothing bends the path', 14, 84, { font: `500 13.5px ${POV_FONT}`, color: '#c9c2ff', align: 'left' });
    // minimap, top right
    const mr = small ? 40 : 54, mx = W - mr - 12, my = mr + 12, g = povGeom(), ks = mr * 0.9 / g.Rch;
    ctx.fillStyle = 'rgba(8,11,9,0.86)'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(230,166,104,0.8)'; ctx.beginPath(); ctx.arc(mx, my, g.R * ks, 0, TAU); ctx.moveTo(mx, my - g.R * ks); ctx.lineTo(mx, my + g.R * ks); ctx.stroke();
    if (pov.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255,200,120,0.6)'; ctx.beginPath();
      const step = Math.max(1, Math.floor(pov.trail.length / 600));
      for (let i = 0; i < pov.trail.length; i += step) { const p = pov.trail[i]; const x = mx + p.x * ks, y = my - p.y * ks; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.lineTo(mx + st.x * ks, my - st.y * ks); ctx.stroke();
    }
    const px = mx + st.x * ks, py = my - st.y * ks, yaw = Math.atan2(st.uy, st.ux) + pov.yaw;
    ctx.fillStyle = 'rgba(255,190,90,0.25)'; ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, mr * 0.55, -yaw - 0.85, -yaw + 0.85); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, TAU); ctx.fill();
    // dashboard along the bottom
    const ki = kickIndexAt(playT), k = ki >= 0 ? run.kicks[ki] : null;
    const plates = [
      { label: 'speed', val: `${pl(st.v / C.c, 3)} c`, sub: `${e(st.v, 3)} m/s` },
      { label: 'kinetic energy', val: en(st.K, 3), sub: `+${en(run.qV, 3)} per perfect push` },
      { label: 'lap', val: `${Math.floor(st.revs) + 1}`, sub: isFinite(pred.nRev) ? `of about ${Math.max(1, Math.round(pred.nRev))}` : '' },
      { beat: true },
    ];
    if (small) plates.splice(2, 1);
    const gap = 8, ph = small ? 58 : 66, y0 = H - ph - 10, units = plates.length + 0.8, pu = (W - 20 - gap * (plates.length - 1)) / units;
    let xc = 10;
    plates.forEach((p, i) => {
      const pw = p.beat ? pu * 1.8 : pu, x0 = xc; xc += pw + gap;
      ctx.fillStyle = 'rgba(20,25,22,0.9)'; ctx.fillRect(x0, y0, pw, ph);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x0 + 1, y0 + 1, pw - 2, 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      if (!p.beat) {
        ctx.font = `600 12.5px ${POV_FONT}`; ctx.fillStyle = '#a9b3ab'; ctx.fillText(p.label, x0 + 8, y0 + 5);
        ctx.fillStyle = '#0c0907'; ctx.fillRect(x0 + 6, y0 + 21, pw - 12, ph - 27 - (small ? 0 : 12));
        ctx.save(); ctx.font = `300 ${small ? 20 : 23}px ${POV_FONT}`; ctx.fillStyle = '#ffcf9e'; ctx.shadowColor = 'rgba(255,106,0,0.9)'; ctx.shadowBlur = 9;
        ctx.textBaseline = 'middle'; ctx.fillText(p.val, x0 + 11, y0 + 21 + (ph - 27 - (small ? 0 : 12)) / 2 + 1, pw - 18); ctx.restore();
        if (!small && p.sub) { ctx.font = `500 11.5px ${POV_FONT}`; ctx.fillStyle = '#8d998f'; ctx.textBaseline = 'bottom'; ctx.fillText(p.sub, x0 + 8, y0 + ph - 3, pw - 14); }
      } else {
        ctx.font = `600 12.5px ${POV_FONT}`; ctx.fillStyle = '#a9b3ab'; ctx.fillText('rhythm', x0 + 8, y0 + 5);
        const lampOn = (t0, col) => { const age = now - t0; return age < 160 ? col : null; };
        const lampRow = (x, y, on, col, label) => {
          ctx.fillStyle = on ? `rgb(${col})` : '#2e2418'; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.fill();
          if (on) { ctx.save(); ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 12; ctx.fill(); ctx.restore(); }
          ctx.font = `500 12.5px ${POV_FONT}`; ctx.fillStyle = '#d3dcd5'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + 10, y);
        };
        lampRow(x0 + 14, y0 + 28, !!lampOn(pov.tickAt), '255,176,32', small ? 'RF peak' : 'voltage peak');
        lampRow(x0 + 14 + Math.min(pw * 0.48, 120), y0 + 28, !!lampOn(pov.beatAt), '95,211,141', small ? 'gap push' : 'you cross the gap');
        let txt = 'waiting for the first push', col = '#a9b3ab';
        if (k && k.n > 0) {
          const c = Math.cos(k.psi);
          if (k.reflected || c <= 0) { txt = 'out of step: the voltage now slows you down'; col = '#ff8a7a'; }
          else if (c < 0.6) { txt = 'falling behind: the pushes are getting weaker'; col = '#ffb020'; }
          else if (c < 0.96) { txt = 'slightly out of step'; col = '#ffd28a'; }
          else { txt = 'in step: a full push every crossing'; col = '#5fd38d'; }
        }
        if (rfDead || D.Bmag < 1e-9) { txt = rfDead ? 'no voltage: the RF has tripped' : 'no field, so no rhythm'; col = '#ff8a7a'; }
        ctx.font = `600 13px ${POV_FONT}`; ctx.fillStyle = col; ctx.textBaseline = 'bottom'; ctx.fillText(txt, x0 + 8, y0 + ph - 5, pw - 14);
      }
    });
    // time dilation: the particle's own clock runs slow by γ
    if (st.g > 1.0005 && !small) {
      const tau = properTime(st);
      haloText(ctx, `your clock ${si(tau, 's', 4)}, lab clock ${si(playT, 's', 4)}: relativity slows your clock by ${pct(1 - 1 / st.g, 2)}`, W / 2, y0 - 12, { font: `500 13px ${POV_FONT}`, color: '#c9d2cb' });
    }
  }
  function setRide(on) {
    pov.on = !!on && !!run;
    if (pov.on && v3 && v3.on) v3.set(false, true);
    $('#stageWrap').classList.toggle('is-pov', pov.on);
    $('#screen-lab .lab').classList.toggle('is-riding', pov.on);
    layout(); requestAnimationFrame(() => { if (active) layout(); });
    pov.pops = []; pov.flash = 0; pov.jolt = 0; pov.yaw = pov.pitch = 0; pov.rfN = null; pov.wallFx = pov.extFx = false; pov.drag = null;
    rimHover = false; viewCv.classList.remove('is-rim', 'is-tape');
    if (pov.on) {
      if (replay) endReplay();
      if (runEnded() && !isLiveRunning()) { playT = 0; endShown = false; hideToast(); lastKi = kickIndexAt(0); }
      if (!fail) setPlaying(true);
      if (!pov.hint) { pov.hint = true; showToast('<b>You are riding along with the particle.</b> Drag to look around. Listen: every time you cross the gap you get a push (thump), and the voltage peaks tick. Press <kbd>V</kbd> or the button to go back to the top view.', '', 7000); }
    } else { staticDirty = trailDirty = true; }
    updateRideBtn(); uiDirty = true;
  }
  function updateRideBtn() {
    const b = $('#btnRide'); if (!b || !D) return;
    const label = pov.on ? 'Back to top view' : `Ride the ${D.part.name.toLowerCase()}`;
    const l = $('#rideLabel'); if (l.textContent !== label) l.textContent = label;
    b.classList.toggle('is-on', pov.on); b.setAttribute('aria-pressed', String(pov.on));
  }

  /* ------------------------------------------------------------------
     3-D view of the whole machine: the iron yoke, the stacked copper coils
     (as many as you set), the pole gap, the vacuum chamber, the two dees
     and the spiral. The top pole and its coils are lifted off so you can see
     inside. Everything is drawn to scale with the dee radius R and gap g.
     The scene is split at the mid-plane: what is below, the beam, then what
     is above, so the spiral is always drawn between the two halves.
     ------------------------------------------------------------------ */
  function draw3D(dt, now) {
    const st = stateAt(playT), g = povGeom(), R = g.R, gap = S.gapCm / 100;
    const ctx = viewCtx, W = view.w || view.size, H = view.h || view.size, sc = v3.scene;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    sc.begin(ctx, W, H, { target: [0, 0, R * 0.35], dist: R * 6.4 });
    const above = sc.eye[2] >= 0;
    sc.order = above ? ['lo', 'mid', 'hi'] : ['hi', 'mid', 'lo'];
    lid = Math.min(1, lid + dt / 1.6);
    const lift = R * 1.75 * (reduceMotion ? 1 : 1 - Math.pow(1 - clamp(lid * 1.4 - 0.4, 0, 1), 3));
    const hp = 0.3 * R, tp = 0.2 * R, Rpole = 1.08 * R, ci = 1.13 * R, co = 1.34 * R;
    const z1 = gap / 2, zTop = z1 + hp;                       // pole face, top of the pole
    const IRON = [62, 70, 68], COP = [201, 128, 63];
    const grp = z => z >= 0 ? 'hi' : 'lo';
    // a vertical slab from z0 to z1 that may cross the mid-plane: drawn as two halves
    const vbox = (c, hx, hy, za, zb, st2) => {
      if (za < 0 && zb > 0) { vbox(c, hx, hy, za, 0, st2); vbox(c, hx, hy, 0, zb, st2); return; }
      sc.box([c[0], c[1], (za + zb) / 2], [hx, hy, (zb - za) / 2], { ...st2, group: grp((za + zb) / 2) });
    };
    // ---- the floor it stands on, and the bottom half of the magnet (and the yoke's side legs)
    const plateX = 1.78 * R, plateY = 1.38 * R, zF = -zTop - tp - 0.002 * R;
    sc.floor(zF, -3.4 * R, 3.4 * R, -2.8 * R, 2.8 * R, { step: 0.25 * R, rx: 2.6 * R, ry: 2.2 * R, lightA: 0.2 });
    sc.shadow([0, 0, zF + 0.001 * R], 2.2 * R, 1.8 * R, 0.65);
    vbox([0, 0, 0], plateX, plateY, -zTop - tp, -zTop, { rgb: IRON, spec: 0.18, stroke: 'rgba(255,255,255,0.08)' });
    for (const sg of [1, -1]) vbox([sg * 1.6 * R, 0, 0], 0.18 * R, 0.85 * R, -zTop, zTop, { rgb: IRON, spec: 0.18, stroke: 'rgba(255,255,255,0.08)' });
    sc.cyl([0, 0, -zTop], [0, 0, -z1], Rpole, { rgb: [104, 114, 109], spec: 0.35, shin: 30, group: 'lo' }, 56);
    const nTop = Math.ceil(S.coils / 2), nBot = Math.floor(S.coils / 2), span = hp - 0.04 * R, gc = 0.015 * R;
    const nl = clamp(Math.round(S.turns / 100), 1, 10);
    const coil = (za, zb, group) => {
      sc.tube([0, 0, za], [0, 0, zb], ci, co, { rgb: COP, amb: 0.45, spec: 0.5, shin: 30, group }, 64);
      for (let j = 1; j <= nl; j++) { const z = za + (zb - za) * j / (nl + 1); sc.circle([0, 0, z], [0, 0, 1], co + 0.002 * R, 'rgba(90,44,14,0.6)', 1, { group }, 40); }
    };
    const stack = (n, sgn, off) => {
      if (!n) return;
      const hc = (span - (n - 1) * gc) / n;
      for (let i = 0; i < n; i++) { const a = z1 + 0.02 * R + i * (hc + gc), b = a + hc; if (sgn > 0) coil(a + off, b + off, 'hi'); else coil(-b, -a, 'lo'); }
    };
    stack(nBot, -1, 0);
    // ---- top half, lifted off
    vbox([0, 0, 0], plateX, plateY, zTop + lift, zTop + tp + lift, { rgb: IRON, a: 0.9, spec: 0.18, stroke: 'rgba(255,255,255,0.08)' });
    sc.cyl([0, 0, z1 + lift], [0, 0, zTop + lift], Rpole, { rgb: [104, 114, 109], spec: 0.35, shin: 30, group: 'hi' }, 56);
    stack(nTop, 1, lift);
    if (lift > 0.05 * R) for (const [x, y] of [[1.6 * R, 0.6 * R], [-1.6 * R, -0.6 * R], [1.6 * R, -0.6 * R], [-1.6 * R, 0.6 * R]]) sc.line([x, y, zTop], [x, y, zTop + lift], 'rgba(200,215,205,0.35)', 1, { dash: [4, 4], group: 'hi' });
    // ---- vacuum chamber wall (glassy steel) and the field between the poles
    const N = 48, Rc = g.Rch;
    for (let i = 0; i < N; i++) {
      const a0 = TAU * i / N, a1 = TAU * (i + 1) / N, am = (a0 + a1) / 2, out = [Math.cos(am), Math.sin(am), 0];
      for (const [za, zb] of [[-z1 * 0.92, 0], [0, z1 * 0.92]]) sc.poly([[Rc * Math.cos(a0), Rc * Math.sin(a0), za], [Rc * Math.cos(a1), Rc * Math.sin(a1), za], [Rc * Math.cos(a1), Rc * Math.sin(a1), zb], [Rc * Math.cos(a0), Rc * Math.sin(a0), zb]], { rgb: [150, 170, 160], a: 0.18, spec: 0.5, shin: 40, out, group: grp((za + zb) / 2), sn: [[Math.cos(a0), Math.sin(a0), 0], [Math.cos(a1), Math.sin(a1), 0]] });
    }
    const Bz = D.Bz, fa = clamp(0.25 + 0.15 * D.Bmag, 0.25, 0.6);
    if (Math.abs(Bz) > 1e-9) for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const x = i * R * 0.27, y = j * R * 0.27; if (Math.hypot(x, y) > R * 0.95) continue;
      const zA = Bz < 0 ? z1 : -z1, zB = -zA;
      sc.line([x, y, zA], [x, y, 0], `rgba(179,166,255,${fa})`, 1.2, { group: grp(zA) });
      sc.line([x, y, 0], [x, y, zB], `rgba(179,166,255,${fa})`, 1.2, { group: grp(zB) });
      const hz = zB * 0.55, d = Math.abs(zB - hz) * 0.9;
      sc.line([x, y, zB], [x + d * 0.5, y, hz], `rgba(179,166,255,${fa})`, 1.2, { group: grp(zB) });
      sc.line([x, y, zB], [x - d * 0.5, y, hz], `rgba(179,166,255,${fa})`, 1.2, { group: grp(zB) });
    }
    // ---- the dees: hollow copper D's, tinted by the RF voltage (red +, blue −)
    const ph = rfPhase(playT), pol = Math.sign(D.q || 1) * Math.cos(ph), h = g.h, wg = g.wg / 2, th = Math.acos(clamp(wg / R, 0, 1));
    for (const sgn of [1, -1]) {
      const shape = [];
      for (let k = 0; k <= 32; k++) { const a = -th + 2 * th * k / 32; shape.push([sgn * R * Math.cos(a), R * Math.sin(a)]); }
      const plus = (sgn < 0) === (pol > 0), tint = Math.abs(pol);
      const emit = plus ? '229,72,63' : '62,126,230';
      for (const [za, zb] of [[-h, 0], [0, h]]) sc.prism(shape, za, zb, { rgb: COP, a: 0.36, spec: 0.45, shin: 26, noCull: true, stroke: 'rgba(240,180,120,0.35)', emit, emitA: 0.35 * tint, noTop: za < 0, noBottom: zb > 0, group: grp((za + zb) / 2), topA: 0.22 });
    }
    // ---- the spiral and the particle, in the mid-plane
    const cur = povTrail(st), all = pov.trail.concat(cur);
    let run0 = [], col0 = null;
    const flush = () => { if (run0.length > 1) sc.path(run0, col0, 2, { group: 'mid', chunk: 400 }); };
    for (const p of all) { if (p.c !== col0) { if (run0.length) { const last = run0[run0.length - 1]; flush(); run0 = [last]; } else run0 = []; col0 = p.c; } run0.push([p.x, p.y, 0]); }
    flush();
    if (run.extract && playT >= run.extract.t) {
      const ex = run.extract;
      sc.cyl([ex.x, ex.y, 0], [ex.x + ex.ux * 0.7 * R, ex.y + ex.uy * 0.7 * R, 0], 0.03 * R, { rgb: [170, 186, 178], a: 0.3, noCull: true, open: true, shade: false, group: 'mid' }, 14);
    }
    sc.glow([st.x, st.y, 0], 0.09 * R, '255,200,120', 0.95, { group: 'mid' });
    sc.sphere([st.x, st.y, 0], 0.012 * R, [255, 255, 255], { flat: true, group: 'mid' });
    // ---- labels
    const L = (p, t2, c = '#dfe6df') => sc.label(p, t2, { color: c, font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif' });
    L([plateX * 0.75, -plateY, zTop + tp + lift + 0.04 * R], 'iron yoke (top pole lifted off)');
    L([co * Math.cos(-0.9), co * Math.sin(-0.9), -z1 - hp * 0.5], `copper coil${S.coils > 1 ? 's' : ''}: ${S.coils} × ${S.turns} turns`, '#e8c8a8');
    L([-R * 0.55, R * 0.45, h + 0.03 * R], 'dee', '#f0c090'); L([R * 0.55, -R * 0.45, h + 0.03 * R], 'dee', '#f0c090');
    const gx = -1.24 * R, gy = -0.6 * R;
    sc.line([gx, gy, -z1], [gx, gy, z1], 'rgba(255,212,59,0.85)', 1.4, { group: 'hi' });
    for (const z of [-z1, z1]) sc.line([gx - 0.03 * R, gy, z], [gx + 0.03 * R, gy, z], 'rgba(255,212,59,0.85)', 1.4, { group: grp(z) });
    L([gx - 0.05 * R, gy, 0], `pole gap g = ${pl(S.gapCm, 3)} cm`, '#ffd43b');
    sc.end();
    haloText(ctx, `B = ${pl(D.Bmag, 3)} T, ${D.Bz < 0 ? 'down' : 'up'} through the gap · dee radius R = ${pl(S.R * 100, 3)} cm`, 12, H - 14, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#b9adff', align: 'left' });
    return st;
  }
  /* ------------------------------------------------------------------
     Frame
     ------------------------------------------------------------------ */
  function drawFrame(dt, now) {
    if (pov.on) return drawPOV(dt, now);
    if (v3 && v3.on) return draw3D(dt, now);
    if (live && run.status === 'running') {
      const Bc = fieldCommanded();
      if (Math.sign(Bc) !== staticSign || Math.abs(Math.abs(Bc) - staticMag) > 0.08 * Math.max(staticMag, 1e-6)) staticDirty = true;
    }
    followParticle(dt);
    if (staticDirty) drawStatic();
    const st = stateAt(playT);
    if (S.show.trail) updateTrail(st.i);
    const ctx = viewCtx, s = view.size, pc = P(), k = sc();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(staticCv, 0, 0, s, s);
    const rfDead = fail && fail.type === 'rf';
    const ph = rfPhase(playT);
    const pol = rfDead ? 0 : Math.sign(D.q) * Math.cos(ph);        // (V_dee2 − V_dee1) / V : +1 = left dee positive
    const { cx, cy, Rp, w, h } = geom;

    // dee polarity
    const a = Math.abs(pol) * 0.24;
    if (a > 0.01) {
      const pos = `rgba(255, 92, 92, ${a})`, neg = `rgba(72, 132, 255, ${a})`;
      ctx.fillStyle = pol > 0 ? pos : neg; ctx.fill(deeL);
      ctx.fillStyle = pol > 0 ? neg : pos; ctx.fill(deeR);
    }
    const badge = (x, y, plus) => {
      const al = 0.3 + 0.7 * Math.abs(pol);
      ctx.fillStyle = plus ? `rgba(229,72,77,${al})` : `rgba(59,123,246,${al})`;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${al})`; ctx.font = '700 13px "Barlow", "Segoe UI", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(plus ? '+' : '−', x, y + 0.5);
    };
    if (S.show.labels && Rp > 60 && !rfDead) {
      badge(cx + Rp * 0.40 + 14, cy + Rp * 0.80, pol < 0);
      badge(cx - Rp * 0.40 - 14, cy + Rp * 0.80, pol > 0);
    }
    // the edge of the dees can be dragged to change the dee radius R
    if (!replay && !fail && !tools.tape && (rimHover || rim || (playT <= 0 && !playing))) {
      if (rimHover || rim) { ctx.save(); ctx.setLineDash([7, 5]); ctx.strokeStyle = 'rgba(255,176,32,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.stroke(); ctx.restore(); }
      const hx = cx + Rp * Math.SQRT1_2, hy = cy + Rp * Math.SQRT1_2;
      if (hx < s - 10 && hy < s - 10) {
        const gk = ctx.createRadialGradient(hx - 2, hy - 2, 0, hx, hy, 8); gk.addColorStop(0, '#fff0c4'); gk.addColorStop(0.5, '#ffb020'); gk.addColorStop(1, '#a06400');
        ctx.fillStyle = gk; ctx.beginPath(); ctx.arc(hx, hy, 7.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 1.2; ctx.stroke();
        arrow(ctx, hx + 10, hy + 10, hx + 19, hy + 19, 5, 'rgba(255,190,80,0.9)', 1.6);
        arrow(ctx, hx - 10, hy - 10, hx - 19, hy - 19, 5, 'rgba(255,190,80,0.9)', 1.6);
        if (rimHover && !rim) haloText(ctx, 'drag to resize the machine', clamp(hx, 90, s - 90), clamp(hy + 30, 20, s - 20), { font: '600 14px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#ffd28a' });
      }
    }

    // current in the coils (+ overload heat glow)
    const coilDead = fail && (fail.type === 'coil' || fail.type === 'quench');
    if (coilGeom && D.I > 0 && !coilDead) {
      const lv = S.over ? overLevels() : null;
      if (lv && lv.coil > 0.25) {
        const hgl = clamp((lv.coil - 0.25) / 0.85, 0, 1) * (0.75 + 0.25 * Math.sin(now / 90));
        const rm = (coilGeom.inner + coilGeom.outer) / 2;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,${Math.round(150 - 90 * hgl)},${Math.round(60 - 40 * hgl)},${0.55 * hgl})`;
        ctx.lineWidth = (coilGeom.outer - coilGeom.inner) * (1 + 0.6 * hgl);
        ctx.beginPath(); ctx.arc(cx, cy, rm, 0, TAU); ctx.stroke(); ctx.restore();
      }
      if (S.show.current) {
        const flipSign = live ? Math.sign(fieldCommanded()) * Math.sign(D.Bz || -1) : 1;
        const om = (0.5 + 2.4 * Math.min(1, D.I / 100)) * (S.dir === 'cw' ? 1 : -1) * (flipSign || 1);
        if (!reduceMotion) coilPhase += om * dt;
        ctx.fillStyle = 'rgba(255, 236, 160, 0.95)';
        for (let i = 0; i < coilGeom.n; i++) {
          const rm = coilGeom.inner + (i + 0.5) * coilGeom.bw;
          const nd = 26, ds = clamp(coilGeom.bw * 0.16, 1.4, 3.2);
          for (let j = 0; j < nd; j++) {
            const an = j / nd * TAU + coilPhase + i * 0.4;
            ctx.beginPath(); ctx.arc(cx + Math.cos(an) * rm, cy + Math.sin(an) * rm, ds, 0, TAU); ctx.fill();
          }
        }
      }
    }

    // path so far
    if (S.show.trail) {
      ctx.drawImage(trailCv, 0, 0, s, s);
      const sg = st.s;
      ctx.lineWidth = trailWidth(); ctx.lineCap = 'round';
      ctx.strokeStyle = trailColor(sg);
      ctx.beginPath();
      if (sg.type === 'arc') {
        if (st.a > 0) {
          ctx.moveTo(X(sg.cx + sg.r * Math.cos(sg.th0)), Y(sg.cy + sg.r * Math.sin(sg.th0)));
          ctx.arc(X(sg.cx), Y(sg.cy), sg.r * k, -sg.th0, -(sg.th0 + sg.rot * st.a), sg.rot > 0);
        }
      } else { ctx.moveTo(X(sg.x0), Y(sg.y0)); ctx.lineTo(X(st.x), Y(st.y)); }
      ctx.stroke();
    }

    // electric field in the gap
    if (S.show.efield && Math.abs(pol) > 0.04) {
      const dir = pol > 0 ? 1 : -1, mag = Math.abs(pol);
      const L = Math.max(6, w - 3) * mag;
      const col = `rgba(255, 166, 70, ${0.35 + 0.6 * mag})`;
      for (let i = 0; i < 7; i++) {
        const yy = cy - h * 0.82 + 2 * h * 0.82 * i / 6;
        arrow(ctx, cx - dir * L / 2, yy, cx + dir * L / 2, yy, 5, col, 2);
      }
    }

    // flash at the most recent gap crossing
    const ki = kickIndexAt(playT);
    if (ki >= 0 && run.rot !== 0) {
      const kick = run.kicks[ki];
      const age = (playT - kick.t) / run.T0;
      if (age >= 0 && age < 0.14) {
        const f = age / 0.14, px = X(0), py = Y(kick.y);
        ctx.strokeStyle = `rgba(255, 200, 120, ${0.85 * (1 - f)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 5 + 20 * f, 0, TAU); ctx.stroke();
        if (S.show.efield && kick.W > 0) {
          arrow(ctx, px, py, px + kick.dir * 30, py, 7, `rgba(255, 166, 70, ${1 - f})`, 3);
          haloText(ctx, 'F = qE', px + kick.dir * 34, py - 12, { font: '700 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: `rgba(255,200,140,${1 - f})`, haloColor: `rgba(6,9,7,${0.8 * (1 - f)})`, align: kick.dir > 0 ? 'left' : 'right' });
        }
      }
    }

    // particle position (normal, or the failure overlay)
    let px = X(st.x), py = Y(st.y), ux = st.ux, uy = st.uy, fxv = st.fx, fyv = st.fy, onArc = st.s.type === 'arc';
    if (fail) {
      const fp = failPos();
      px = X(fp.x); py = Y(fp.y); ux = fp.ux; uy = fp.uy; fxv = fp.fx; fyv = fp.fy; onArc = fp.arc;
      if (fail.type !== 'rf') {
        ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,107,107,0.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X(fail.x), Y(fail.y)); ctx.lineTo(px, py); ctx.stroke(); ctx.restore();
      }
    }

    // radius of the current orbit
    if (S.show.radius && onArc && !fail && !replay && !(run.wall && runEnded())) {
      const ox = X(st.cx), oy = Y(st.cy);
      const rpx = Math.hypot(px - ox, py - oy);
      if (rpx > 6) {
        ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(225, 233, 255, 0.7)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(ox - 4, oy); ctx.lineTo(ox + 4, oy); ctx.moveTo(ox, oy - 4); ctx.lineTo(ox, oy + 4); ctx.stroke();
        if (rpx > 46) pill(ctx, 'r = ' + len(st.r), (ox + px) / 2, (oy + py) / 2, 'rgba(6,9,7,0.82)', '#eef2ec');
      }
    }

    // extraction label and target
    if (run.extract && playT >= run.tStop && !fail) {
      const ex = run.extract, last = run.segs[run.segs.length - 1];
      const L2 = last.v * (last.t1 - last.t0);
      const tx = X(ex.x + ex.ux * L2), ty = Y(ex.y + ex.uy * L2);
      if (playT >= run.tEnd - 1e-18) {
        ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tx, ty, 9, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.stroke();
      }
      const lx = X(ex.x + ex.ux * L2 * 0.5), ly = Y(ex.y + ex.uy * L2 * 0.5);
      pill(ctx, 'beam out: ' + en(ex.K, 3), clamp(lx, 70, s - 70), clamp(ly - 16, 50, s - 40), 'rgba(255,212,59,0.95)', '#1f1600');
    }

    // hot spot where the beam hit the wall
    if (hotSpot) {
      const age = (now - hotSpot.born) / 1000;
      const hx = X(hotSpot.x), hy = Y(hotSpot.y), al = Math.max(0.18, Math.exp(-age / 2.5));
      const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26);
      gl.addColorStop(0, `rgba(255,240,200,${al})`); gl.addColorStop(0.35, `rgba(255,120,60,${al * 0.8})`); gl.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx, hy, 26, 0, TAU); ctx.fill();
    }
    if (run.wall && runEnded() && !fail) {
      const wx = X(run.wall.x), wy = Y(run.wall.y);
      pill(ctx, 'beam lost: hit the dee wall', clamp(wx, 100, s - 100), clamp(wy - 30, 50, s - 40), 'rgba(255,107,107,0.95)', '#2a0606');
    }

    // vectors
    const big = !!replay;
    const frac = clamp(st.v / vref, 0, 1.2);
    const VL = (big ? 30 : 16) + (big ? 70 : 50) * frac;
    const showV = (S.show.vel || big) && st.v > 0, showF = (S.show.force || big) && onArc;
    const lblY = y => big ? clamp(y, s * 0.1 + 14, s * 0.91 - 14) : y;
    const lblX = (x, dir) => big ? clamp(x, dir >= 0 ? 8 : 150, dir >= 0 ? s - 150 : s - 8) : x;
    if (showV) {
      arrow(ctx, px, py, px + ux * VL, py - uy * VL, big ? 12 : 9, '#3fdc7c', big ? 4 : 3);
      haloText(ctx, big ? 'v = ' + e(st.v, 3) + ' m/s' : 'v', lblX(px + ux * (VL + (big ? 14 : 10)), ux), lblY(py - uy * (VL + (big ? 14 : 10))), { font: big ? '700 14px "Barlow Condensed", "Arial Narrow", sans-serif' : 'italic 700 13px "Barlow", serif', color: '#3fdc7c', haloColor: 'rgba(6,9,7,0.9)', align: big ? (ux >= 0 ? 'left' : 'right') : 'center' });
    }
    if (showF) {
      const Fmag = D.absq * st.v * st.B;
      arrow(ctx, px, py, px + fxv * VL, py - fyv * VL, big ? 12 : 9, '#ff5ca8', big ? 4 : 3);
      haloText(ctx, big ? 'F = ' + e(Fmag, 3) + ' N' : 'F', lblX(px + fxv * (VL + (big ? 14 : 10)), fxv), lblY(py - fyv * (VL + (big ? 14 : 10)) + (big && Math.abs(fyv) < 0.3 ? 16 : 0)), { font: big ? '700 14px "Barlow Condensed", "Arial Narrow", sans-serif' : 'italic 700 13px "Barlow", serif', color: '#ff7cb9', haloColor: 'rgba(6,9,7,0.9)', align: big ? (fxv >= 0 ? 'left' : 'right') : 'center' });
    }

    // particle
    const hidden = fail && fail.hit;
    if (!hidden && px > -30 && px < s + 30 && py > -30 && py < s + 30) {
      const col = D.part.color;
      const gr = big ? 26 : 17;
      const gl = ctx.createRadialGradient(px, py, 0, px, py, gr);
      gl.addColorStop(0, hexA(col, 0.95)); gl.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, gr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 6.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#17202e'; ctx.font = '700 11px "Barlow", "Segoe UI", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(D.part.z > 0 ? '+' : '−', px, py + 0.5);
    }

    drawFloaters(ctx, now);
    if (replay) drawReplayLog(ctx, st);
    if (tools.tape && tape) drawTape(ctx);
    fx.draw(ctx, s, s);
    return st;
  }

  /* floating "+ΔK" labels at gap crossings */
  function drawFloaters(ctx, now) {
    floaters = floaters.filter(f => now - f.born < f.life * 1000);
    for (const f of floaters) {
      const age = (now - f.born) / (f.life * 1000);
      const al = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85;
      ctx.globalAlpha = clamp(al, 0, 1);
      const x = X(f.x) + (f.dx || 0), y = Y(f.y) - 18 - 28 * age;
      pill(ctx, f.text, clamp(x, 60, view.size - 60), clamp(y, 30, view.size - 30), f.bg || 'rgba(255,190,90,0.95)', f.fg || '#231300', f.big ? '700 14.5px "Barlow Condensed", "Arial Narrow", sans-serif' : '600 13px "Barlow Condensed", "Arial Narrow", sans-serif');
      ctx.globalAlpha = 1;
    }
  }
  function drawReplayLog(ctx, st) {
    const ki = kickIndexAt(playT);
    if (ki < 0) return;
    const rows = [];
    for (let k = Math.max(0, ki - 3); k <= ki; k++) rows.push(run.kicks[k]);
    const x0 = 14, y0 = 0.1 * view.size + 10, lh = 19;
    ctx.fillStyle = 'rgba(6,9,7,0.78)'; ctx.strokeStyle = 'rgba(255,212,59,0.6)'; ctx.lineWidth = 1;
    const wbox = 252, hbox = 26 + rows.length * lh;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, wbox, hbox, 8); else ctx.rect(x0, y0, wbox, hbox); ctx.fill(); ctx.stroke();
    ctx.font = '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.fillStyle = '#ffd43b'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('GAP CROSSINGS: ENERGY GAINED', x0 + 10, y0 + 13);
    ctx.font = '500 12.5px "Barlow Condensed", "Arial Narrow", sans-serif';
    rows.forEach((kk, j) => {
      const yy = y0 + 26 + j * lh + lh / 2 - 2;
      ctx.fillStyle = j === rows.length - 1 ? '#ffffff' : '#a9b3ab';
      const sign = kk.W >= 0 ? '+' : '−';
      ctx.fillText(`#${kk.n}  ${sign}${en(Math.abs(kk.W), 3)} → ${en(kk.K, 4)}`, x0 + 10, yy);
    });
  }

  /* ------------------------------------------------------------------
     Electromagnet side view (control panel and physics page)
     ------------------------------------------------------------------ */
  function drawSideView(cv) {
    if (!cv || !D) return;
    const rect = cv.getBoundingClientRect();
    if (rect.width < 20) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = rect.width, H = rect.height, pc = P();
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const big = H > 200, pad = 8;
    const plate = big ? 28 : 18, leg = big ? 30 : 20;
    const midY = H / 2, cx = W / 2;
    const gapPx = clamp((big ? 12 : 9) + (S.gapCm - 2) / 18 * (big ? 34 : 22), 8, big ? 48 : 32);
    const poleW = W * 0.38;
    const ox = pad, oy = pad, ow = W - 2 * pad, oh = H - 2 * pad;
    const steel = ctx.createLinearGradient(0, 0, 0, H);
    steel.addColorStop(0, pc.steel[0]); steel.addColorStop(0.5, pc.steel[1]); steel.addColorStop(1, pc.steel[2]);
    ctx.fillStyle = steel; ctx.strokeStyle = pc.steelLine; ctx.lineWidth = 1;
    const box = (x, y, w2, h2) => { ctx.fillRect(x, y, w2, h2); ctx.strokeRect(x + 0.5, y + 0.5, w2 - 1, h2 - 1); };
    box(ox, oy, ow, plate); box(ox, oy + oh - plate, ow, plate);
    box(ox, oy, leg, oh); box(ox + ow - leg, oy, leg, oh);
    const topPoleH = midY - gapPx / 2 - (oy + plate);
    box(cx - poleW / 2, oy + plate - 1, poleW, topPoleH + 1);
    box(cx - poleW / 2, midY + gapPx / 2, poleW, topPoleH + 1);

    const nTop = Math.ceil(S.coils / 2), nBot = Math.floor(S.coils / 2);
    const winL = [ox + leg + 3, cx - poleW / 2 - 3], winR = [cx + poleW / 2 + 3, ox + ow - leg - 3];
    const avail = topPoleH - 6;
    const into = S.dir === 'cw';
    const drawCoil = (y, bh, side) => {
      const [x0, x1] = side < 0 ? winL : winR;
      const cw = x1 - x0;
      const cg = ctx.createLinearGradient(x0, 0, x1, 0);
      cg.addColorStop(0, '#a85a22'); cg.addColorStop(0.5, '#e6a866'); cg.addColorStop(1, '#a85a22');
      ctx.fillStyle = cg; ctx.strokeStyle = '#6b3510';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y, cw, bh, 3); else ctx.rect(x0, y, cw, bh); ctx.fill(); ctx.stroke();
      const sym = (side < 0) === into ? 'x' : 'o';
      const cell = big ? 10 : 7.5;
      const cols = Math.max(1, Math.floor((cw - 4) / cell)), rows = Math.max(1, Math.floor((bh - 2) / cell));
      const show = Math.min(cols * rows, clamp(Math.round(S.turns / 40), 1, 60));
      const rr = cell * 0.34;
      ctx.strokeStyle = 'rgba(60, 25, 5, 0.85)'; ctx.fillStyle = 'rgba(60, 25, 5, 0.85)'; ctx.lineWidth = 0.9;
      for (let k = 0; k < show; k++) {
        const c = k % cols, r2 = Math.floor(k / cols);
        const px = x0 + 2 + cell * (c + 0.5) + (cw - 4 - cols * cell) / 2, py = y + 1 + cell * (r2 + 0.5) + (bh - 2 - rows * cell) / 2;
        ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.stroke();
        if (sym === 'x') { const d = rr * 0.62; ctx.beginPath(); ctx.moveTo(px - d, py - d); ctx.lineTo(px + d, py + d); ctx.moveTo(px + d, py - d); ctx.lineTo(px - d, py + d); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(px, py, rr * 0.3, 0, TAU); ctx.fill(); }
      }
    };
    const bh = Math.min((avail - 2 * (Math.max(nTop, 1) - 1)) / Math.max(nTop, 1), big ? 30 : 20);
    for (let i = 0; i < nTop; i++) { const y = oy + plate + 3 + i * (bh + 2); drawCoil(y, bh, -1); drawCoil(y, bh, 1); }
    for (let i = 0; i < nBot; i++) { const y = oy + oh - plate - 3 - bh - i * (bh + 2); drawCoil(y, bh, -1); drawCoil(y, bh, 1); }

    const dh = Math.max(3, gapPx * 0.42), dw = poleW * 0.46;
    ctx.fillStyle = 'rgba(205, 216, 232, 0.9)'; ctx.strokeStyle = '#4c5a70';
    ctx.fillRect(cx - 3 - dw, midY - dh / 2, dw, dh); ctx.strokeRect(cx - 3 - dw + 0.5, midY - dh / 2 + 0.5, dw - 1, dh - 1);
    ctx.fillRect(cx + 3, midY - dh / 2, dw, dh); ctx.strokeRect(cx + 3 + 0.5, midY - dh / 2 + 0.5, dw - 1, dh - 1);

    if (D.Bmag > 1e-9) {
      const na = big ? 9 : 7, al = clamp(0.45 + D.Bmag / 2.5, 0.45, 1), fc = pc.sideField;
      for (let i = 0; i < na; i++) {
        const xx = cx - poleW / 2 + poleW * (i + 0.5) / na;
        if (Math.abs(xx - cx) < 4) continue;
        const yTop = midY - gapPx / 2 + 1, yBot = midY + gapPx / 2 - 1;
        if (into) arrow(ctx, xx, yTop, xx, yBot, 5, `rgba(${fc}, ${al})`, 1.6);
        else arrow(ctx, xx, yBot, xx, yTop, 5, `rgba(${fc}, ${al})`, 1.6);
      }
      ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = `rgba(${fc}, 0.8)`; ctx.lineWidth = 1.3;
      const xa = cx + poleW * 0.28, xb = ox + ow - leg / 2, ya = oy + plate / 2, yb = oy + oh - plate / 2;
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xa, yb); ctx.lineTo(xb, yb); ctx.lineTo(xb, ya); ctx.closePath(); ctx.stroke();
      ctx.restore();
      const mid = (xa + xb) / 2, ah = 6, colA = `rgba(${fc}, 0.95)`;
      if (into) { arrow(ctx, mid - 6, yb, mid + 6, yb, ah, colA, 1.3); arrow(ctx, xb, midY + 6, xb, midY - 6, ah, colA, 1.3); arrow(ctx, mid + 6, ya, mid - 6, ya, ah, colA, 1.3); }
      else { arrow(ctx, mid + 6, yb, mid - 6, yb, ah, colA, 1.3); arrow(ctx, xb, midY - 6, xb, midY + 6, ah, colA, 1.3); arrow(ctx, mid - 6, ya, mid + 6, ya, ah, colA, 1.3); }
    }

    const f = big ? '600 13.5px "Barlow Condensed", "Arial Narrow", sans-serif' : '600 12px "Barlow Condensed", "Arial Narrow", sans-serif';
    haloText(ctx, 'iron yoke', ox + leg + 6, oy + plate / 2, { font: f, align: 'left', color: pc.sideText, haloColor: pc.sideHalo, halo: 3 });
    haloText(ctx, 'B', cx + poleW / 2 - 9, midY, { font: (big ? 'italic 700 14px' : 'italic 700 12px') + ' "Barlow", serif', color: `rgb(${pc.sideField})`, haloColor: pc.sideHalo });
    haloText(ctx, `g = ${pl(S.gapCm, 3)} cm`, cx - poleW / 2 + 4, midY + gapPx / 2 + (big ? 13 : 10), { font: f, align: 'left', color: pc.sideText, haloColor: pc.sideHalo });
    haloText(ctx, 'coil', winL[0] + 2, oy + plate + 3 + bh / 2, { font: f, align: 'left', color: '#fff', haloColor: 'rgba(90,40,10,0.75)', halo: 3 });
    if (big) {
      haloText(ctx, 'pole', cx, oy + plate + topPoleH * 0.45, { font: f, color: pc.sideText, haloColor: pc.sideHalo });
      haloText(ctx, 'dees', cx - dw / 2 - 3, midY - dh / 2 - 8, { font: f, color: pc.sideText, haloColor: pc.sideHalo });
      haloText(ctx, into ? '⊗ = current into page   ⊙ = out of page' : '⊙ = current out of page   ⊗ = into page', W / 2, H - 4, { font: '600 12px "Barlow Condensed", "Arial Narrow", sans-serif', base: 'bottom', color: pc.sideText, haloColor: pc.sideHalo });
    }
  }

  /* ------------------------------------------------------------------
     Graphs
     ------------------------------------------------------------------ */
  function sizeGraph(G) {
    const r = G.cv.getBoundingClientRect();
    if (r.width < 20) return;
    G.w = r.width; G.h = r.height;
    G.cv.width = Math.round(G.w * view.dpr); G.cv.height = Math.round(G.h * view.dpr);
  }
  function arcsOf(R) {
    if (!R._arcs || R._arcsN !== R.segs.length) {
      R._arcs = R.segs.filter(s2 => s2.type === 'arc' && s2.t1 > s2.t0);
      R._arcT = Float64Array.from(R._arcs, a2 => a2.t0); R._arcsN = R.segs.length;
    }
    return R._arcs;
  }
  // Data source for one graph type and one run
  function seriesFor(type, R, Dd) {
    const sm = R.samples, n = sm.n;
    const o = { kind: 'time', n, t: sm.t };
    if (type === 'v') o.y = i => sm.v[i];
    else if (type === 'K') o.y = i => sm.K[i];
    else if (type === 'r') o.y = i => sm.r[i];
    else if (type === 'x') o.y = i => sm.x[i];
    else if (type === 'g') o.y = i => sm.g[i];
    else if (type === 'f') {
      if (R.rot === 0 && !R.live) return null;
      if (sm.B) { o.y = i => Dd.absq * sm.B[i] / (TAU * sm.g[i] * Dd.m); o.y2 = i => sm.w[i] / TAU; }
      else {
        o.y = i => Dd.absq * Dd.Bmag / (TAU * sm.g[i] * Dd.m);
        o.y2 = R.fm ? (i => (1 + R.detune) * Dd.absq * Dd.Bmag / (TAU * sm.g[i] * Dd.m)) : (() => R.wRF / TAU);
      }
    } else if (type === 'dK') {
      if (!R._kickT || R._kickN !== R.kicks.length) { R._kickT = Float64Array.from(R.kicks, k => k.t); R._kickN = R.kicks.length; }
      o.kind = 'kick'; o.n = R.kicks.length; o.t = R._kickT; o.y = i => R.kicks[i].W; o.xv = i => i;
    } else if (type === 'Kr') {
      const arcs = arcsOf(R);
      if (!arcs.length) return null;
      o.kind = 'kr'; o.n = arcs.length; o.t = R._arcT; o.y = i => arcs[i].K; o.xv = i => arcs[i].r;
    }
    return o;
  }
  const valAt = (type, st) => type === 'x' ? st.x : type === 'v' ? st.v : type === 'K' ? st.K : type === 'r' ? (isFinite(st.r) ? st.r : 0) : type === 'g' ? st.g : D.absq * st.B / (TAU * st.g * D.m);

  function drawGraph(G, stNow) {
    const ctx = G.ctx, W = G.w, H = G.h, pc = P(), gc = pc.graph;
    if (!W) return;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const type = S[G.key];
    const sr = seriesFor(type, run, D);
    const gs = ghost ? seriesFor(type, ghost.run, ghost.D) : null;
    const pad = { l: 54, r: 12, t: 12, b: 32 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    ctx.font = '12px "Barlow", "Segoe UI", sans-serif';
    if (!sr || !sr.n) {
      ctx.fillStyle = skin.c('--plot-text'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sr ? 'Press play to start the run' : 'No circular motion: B = 0 (add current to the coils)', W / 2, H / 2);
      return;
    }
    let xmin = 0, xmax, ymin = 0, ymax = 0, xu, yu;
    const scan = (s2) => {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < s2.n; i++) { const v = s2.y(i); if (v < lo) lo = v; if (v > hi) hi = v; if (s2.y2) { const v2 = s2.y2(i); if (v2 < lo) lo = v2; if (v2 > hi) hi = v2; } }
      return [lo, hi];
    };
    let [lo, hi] = scan(sr);
    if (gs && gs.n) { const [lo2, hi2] = scan(gs); lo = Math.min(lo, lo2); hi = Math.max(hi, hi2); }
    const tEndNow = run.status === 'running' ? Math.max(playT * 1.08, (pred.tAccClassical || 0) * 1.05, run.T0 * 4) : run.tEnd;
    if (sr.kind === 'time') { xmax = Math.max(tEndNow, gs ? ghost.run.tEnd || 0 : 0); xu = timeUnit(xmax); }
    else if (sr.kind === 'kick') { xmax = Math.max(sr.n - 1, gs ? gs.n - 1 : 0, 1); xu = { f: 1, u: '' }; }
    else {
      let m = 0; for (let i = 0; i < sr.n; i++) m = Math.max(m, sr.xv(i));
      if (gs) for (let i = 0; i < gs.n; i++) m = Math.max(m, gs.xv(i));
      xmax = Math.max(m, S.R) * 1.02; xu = lengthUnit(xmax);
    }
    if (!isFinite(xmax) || xmax <= 0) xmax = 1e-9;
    let ylabel;
    const qV = D.absq * S.Vkv * 1e3;
    if (type === 'v') { ymin = 0; ymax = hi * 1.08; yu = powUnit(ymax, 'm/s'); ylabel = 'v (' + yu.u + ')'; }
    else if (type === 'K' || type === 'Kr') { ymin = 0; ymax = hi * 1.08; yu = energyUnit(ymax); ylabel = 'K (' + yu.u + ')'; }
    else if (type === 'dK') { ymin = Math.min(0, lo * 1.1); ymax = Math.max(hi, qV) * 1.1; yu = energyUnit(Math.max(Math.abs(ymin), ymax)); ylabel = 'ΔK (' + yu.u + ')'; }
    else if (type === 'r') { ymin = 0; ymax = Math.max(hi, S.R) * 1.06; yu = lengthUnit(ymax); ylabel = 'r (' + yu.u + ')'; }
    else if (type === 'x') { const m = Math.max(Math.abs(lo), Math.abs(hi), 1e-12) * 1.08; ymin = -m; ymax = m; yu = lengthUnit(m); ylabel = 'x (' + yu.u + ')'; }
    else if (type === 'g') { ymin = Math.min(1, lo); ymax = Math.max(hi, 1 + 1e-6); const d = (ymax - ymin) || 1e-3; ymin -= d * 0.05; ymax += d * 0.08; yu = { f: 1, u: '' }; ylabel = 'γ'; }
    else if (type === 'f') { ymin = 0; ymax = hi * 1.12; yu = unitFor(ymax, 'Hz', ['G', 'M', 'k', '']); ylabel = 'f (' + yu.u + ')'; }
    if (!(ymax > ymin)) ymax = ymin + 1;
    const XP = x => pad.l + (x - xmin) / (xmax - xmin) * pw;
    const YP = y => pad.t + (1 - (y - ymin) / (ymax - ymin)) * ph;

    ctx.strokeStyle = skin.c('--plot-grid'); ctx.lineWidth = 1; ctx.fillStyle = skin.c('--plot-text');
    ctx.font = '12.5px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of niceTicks(ymin / yu.f, ymax / yu.f, 4)) {
      const yy = Math.round(YP(v * yu.f)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
      ctx.fillText(tickLabel(v), pad.l - 6, yy);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const v of niceTicks(xmin / xu.f, xmax / xu.f, Math.max(3, Math.floor(pw / 80)))) {
      const xx = Math.round(XP(v * xu.f)) + 0.5;
      ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, pad.t + ph); ctx.stroke();
      ctx.fillText(tickLabel(v), xx, pad.t + ph + 4);
    }
    ctx.strokeStyle = skin.c('--plot-axis'); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph); ctx.lineTo(W - pad.r, pad.t + ph); ctx.stroke();
    if (ymin < 0) { ctx.beginPath(); ctx.moveTo(pad.l, YP(0)); ctx.lineTo(W - pad.r, YP(0)); ctx.stroke(); }
    ctx.fillStyle = skin.c('--plot-strong'); ctx.font = '600 11.5px "Barlow", "Segoe UI", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(ylabel, pad.l + 6, pad.t + 2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    const xlabel = sr.kind === 'time' ? 'time t (' + xu.u + ')' : sr.kind === 'kick' ? 'gap crossing number' : 'orbit radius r (' + xu.u + ')';
    ctx.fillText(xlabel, W - pad.r, H - 1);

    const col = gc[type];
    ctx.save(); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3; ctx.strokeStyle = gc.theory;
    const tlabel = (txt, x, y, align) => {
      ctx.save(); ctx.setLineDash([]); ctx.fillStyle = gc.theory; ctx.font = '11px "Barlow", "Segoe UI", sans-serif';
      const tw = ctx.measureText(txt).width;
      let xx = x, al = align || 'right', yy = clamp(y, pad.t + 12, pad.t + ph);
      if (al === 'right' && xx - tw < pad.l + 4) { xx = pad.l + 4; al = 'left'; }
      if (al === 'left' && xx + tw > W - pad.r - 2) { xx = W - pad.r - 2; al = 'right'; }
      if (yy < pad.t + 30 && (al === 'left' ? xx : xx - tw) < pad.l + 110) { xx = W - pad.r - 2; al = 'right'; yy = pad.t + 30; }
      ctx.textAlign = al; ctx.textBaseline = 'bottom'; ctx.fillText(txt, xx, yy); ctx.restore();
    };
    if (type === 'K' && run.rot !== 0 && !live) {
      const tE = Math.min(run.tStop, xmax);
      const Kend = Math.min(qV * (1 + 2 * tE / run.T0), ymax);
      const tEnd2 = (Kend / qV - 1) * run.T0 / 2;
      ctx.beginPath(); ctx.moveTo(XP(0), YP(qV)); ctx.lineTo(XP(tEnd2), YP(Kend)); ctx.stroke();
      tlabel('ideal: +|q|V per crossing', XP(tEnd2) - 4, YP(Kend) - 2);
    } else if (type === 'r' || type === 'x') {
      const yy = YP(S.R);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
      tlabel('dee edge R', W - pad.r - 2, yy - 2);
      if (type === 'x') { const y2 = YP(-S.R); ctx.beginPath(); ctx.moveTo(pad.l, y2); ctx.lineTo(W - pad.r, y2); ctx.stroke(); }
    } else if (type === 'dK') {
      const yy = YP(qV);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
      tlabel('perfect timing: |q|V', W - pad.r - 2, yy - 2);
    } else if (type === 'Kr' && D.Bmag > 0) {
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const r = xmax * i / 80, p = D.absq * D.Bmag * r;
        const K = S.rel ? Math.sqrt(p * p * C.c * C.c + D.mc2 * D.mc2) - D.mc2 : p * p / (2 * D.m);
        if (i === 0) ctx.moveTo(XP(r), YP(K)); else ctx.lineTo(XP(r), YP(Math.min(K, ymax * 1.5)));
      }
      ctx.stroke();
      tlabel(S.rel ? 'theory: K from p = |q|Br' : 'theory: K = (qBr)²/2m', XP(xmax * 0.62), YP(ymax * 0.92), 'right');
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.rect(pad.l, pad.t - 1, pw + 1, ph + 2); ctx.clip();
    const plotSeries = (s2, yfun, tLimit, color, width, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.lineJoin = 'round';
      if (s2.kind === 'kick') {
        ctx.beginPath();
        for (let i = 0; i < s2.n; i++) {
          if (s2.t[i] > tLimit) break;
          const xx = XP(s2.xv(i)); ctx.moveTo(xx, YP(0)); ctx.lineTo(xx, YP(yfun(i)));
        }
        ctx.stroke();
        return null;
      }
      ctx.beginPath();
      let col2 = null, first = true, mn = 0, mx = 0, fst = 0, lst = 0;
      const flush = () => {
        if (col2 === null) return;
        if (first) { ctx.moveTo(col2, fst); first = false; } else ctx.lineTo(col2, fst);
        ctx.lineTo(col2, mn); ctx.lineTo(col2, mx); ctx.lineTo(col2, lst);
      };
      for (let i = 0; i < s2.n; i++) {
        if (s2.t[i] > tLimit) break;
        const xx = Math.round(XP(s2.kind === 'kr' ? s2.xv(i) : s2.t[i]) * 2) / 2, yy = YP(yfun(i));
        if (xx !== col2) { flush(); col2 = xx; mn = mx = fst = lst = yy; }
        else { if (yy < mn) mn = yy; if (yy > mx) mx = yy; lst = yy; }
      }
      flush();
      return () => ctx.stroke();
    };
    if (gs && gs.n) {
      const done = plotSeries(gs, gs.y, Infinity, gc.ghost, 1.6, [4, 3]); if (done) done();
      if (gs.y2) { const d2 = plotSeries(gs, gs.y2, Infinity, gc.ghost2, 1.4, [2, 3]); if (d2) d2(); }
    }
    const st = stNow;
    const fin = plotSeries(sr, sr.y, playT, col, 2);
    if (fin) {
      if (sr.kind === 'time') ctx.lineTo(XP(playT), YP(valAt(type, st)));
      ctx.stroke();
    }
    if (sr.y2) {
      const fin2 = plotSeries(sr, sr.y2, playT, gc.rf, 2, [6, 3]);
      if (fin2) { ctx.lineTo(XP(playT), YP(rfFreqNow(st))); ctx.stroke(); }
    }
    ctx.setLineDash([]);
    let cxp = null, cyp = null;
    if (sr.kind === 'time') { cxp = XP(playT); cyp = YP(valAt(type, st)); }
    else if (sr.kind === 'kr' && st.s.type === 'arc') { cxp = XP(st.r); cyp = YP(st.K); }
    if (cxp !== null && isFinite(cyp)) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(cxp, cyp, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    if (type === 'f') {
      ctx.font = '600 11px "Barlow", "Segoe UI", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = gc.f; ctx.fillText('particle f = |q|B/(2πγm)', W - pad.r - 4, pad.t + 2);
      ctx.fillStyle = gc.rf; ctx.fillText('RF voltage f_RF', W - pad.r - 4, pad.t + 16);
    }

    // hover readout
    if (G.hover != null && G.hover >= pad.l && G.hover <= W - pad.r) {
      const xv = xmin + (G.hover - pad.l) / pw * (xmax - xmin);
      let txt = null, hy = null;
      if (sr.kind === 'time' && xv <= playT) {
        const sth = stateAt(xv);
        const yv = valAt(type, sth);
        const yt = type === 'v' ? e(yv) + ' m/s' : type === 'K' ? en(yv, 4) : (type === 'r' || type === 'x') ? len(yv) : type === 'g' ? pl(yv, 6) : si(yv, 'Hz', 4);
        txt = `t = ${si(xv, 's')} · ${yt}`; hy = YP(yv);
        stateAt(playT);
      } else if (sr.kind === 'kick') {
        const i = Math.round(xv);
        if (i >= 0 && i < sr.n && sr.t[i] <= playT) { const kk = run.kicks[i]; txt = `crossing ${i} · ΔK = ${en(kk.W, 4)} · ψ = ${pl(kk.psi / DEG, 3)}°`; hy = YP(kk.W); }
      } else if (sr.kind === 'kr') {
        let best = -1, bd = Infinity;
        for (let i = 0; i < sr.n; i++) { if (sr.t[i] > playT) break; const d = Math.abs(sr.xv(i) - xv); if (d < bd) { bd = d; best = i; } }
        if (best >= 0) { txt = `r = ${len(sr.xv(best))} · K = ${en(sr.y(best), 4)}`; hy = YP(sr.y(best)); }
      }
      ctx.strokeStyle = gc.cursor; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(G.hover + 0.5, pad.t); ctx.lineTo(G.hover + 0.5, pad.t + ph); ctx.stroke();
      if (txt) {
        if (hy !== null) { ctx.fillStyle = gc.hoverBg; ctx.beginPath(); ctx.arc(G.hover, hy, 3, 0, TAU); ctx.fill(); }
        ctx.font = '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif';
        const tw = ctx.measureText(txt).width + 12;
        const bx = clamp(G.hover - tw / 2, pad.l, W - pad.r - tw);
        ctx.fillStyle = gc.hoverBg; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, pad.t + ph - 22, tw, 19, 5); else ctx.rect(bx, pad.t + ph - 22, tw, 19);
        ctx.fill(); ctx.fillStyle = gc.hoverFg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, bx + 6, pad.t + ph - 12);
      }
    }
  }

  /* ------------------------------------------------------------------
     Verbose data panels
     ------------------------------------------------------------------ */
  const qS = () => e(D.absq, 4) + ' C';
  const mS = () => e(D.m, 4) + ' kg';
  const BS = (B = D.Bmag) => pl(B, 4) + ' T';
  const zS = () => (Math.abs(D.part.z) === 1 ? '' : Math.abs(D.part.z)) + 'e';

  function whereRow(st) {
    const s = st.s;
    let short, long;
    const gapHalf = (geom.w / 2) / sc();
    if (fail) { short = fail.type === 'rf' ? 'Coasting (RF off)' : 'Flying straight (no field)'; long = fail.type === 'rf' ? 'The RF system has tripped, so the gap no longer pushes the particle. The magnetic field still bends it, so it goes round and round on the same circle.' : 'The magnetic field has collapsed. With nothing to bend it, the particle flies in a straight line into the chamber wall.'; }
    else if (s.type === 'exit') { short = 'Leaving the machine'; long = 'It reached the edge of the dees (radius R) and was extracted. Outside the magnetic field nothing bends it, so it flies in a straight line toward the target.'; }
    else if (s.type === 'line') { short = 'Flying straight'; long = 'There is no magnetic field here, so nothing pushes the particle sideways. It moves in a straight line until it leaves the machine.'; }
    else if (playT < 1e-30) { short = 'At the ion source'; long = 'The particle has just been released from the ion source in the centre and receives its first push across the gap.'; }
    else if (Math.abs(st.x) < gapHalf) { short = 'Crossing the gap'; long = 'Between the dees the electric field pushes the particle forward. This is the only place where it gains (or loses) energy.'; }
    else {
      short = 'Inside ' + (st.x > 0 ? 'Dee 1 (right)' : 'Dee 2 (left)');
      long = 'Inside the hollow metal dee there is no electric field, only the magnetic force. It bends the path into part of a circle while the speed stays exactly the same.';
    }
    return { id: 'where', label: 'Where is it?', val: short, sub: long };
  }

  function rowsNow(st) {
    const rows = [], s = st.s, c = C.c, m = D.m, q = D.absq, B = st.B;
    const v = st.v, g = st.g, r = st.r, K = st.K, p = st.p, arc = s.type === 'arc';
    const ki = kickIndexAt(playT), nk = ki + 1;
    const qV = q * S.Vkv * 1e3;
    rows.push(whereRow(st));
    rows.push({ sec: 'Motion right now' });
    let vWork;
    if (arc) vWork = S.rel ? `v = |q|Br / (γm) = (${qS()} × ${BS(B)} × ${e(r, 4)} m) / (${pl(g, 6)} × ${mS()}) = ${e(v, 4)} m/s`
      : `v = |q|Br / m = (${qS()} × ${BS(B)} × ${e(r, 4)} m) / ${mS()} = ${e(v, 4)} m/s`;
    else vWork = S.rel ? `v = c√(1 − 1/γ²) = ${e(c, 4)} m/s × √(1 − 1/${pl(g, 6)}²) = ${e(v, 4)} m/s` : `v = √(2K/m) = √(2 × ${e(K, 4)} J / ${mS()}) = ${e(v, 4)} m/s`;
    rows.push({
      id: 'v', label: 'Speed v', val: e(v, 4) + ' m/s', cls: !S.rel && v > c ? 'is-bad' : '',
      sub: `${pct(v / c)} of the speed of light · ${e(v * 3.6)} km/h. At this speed it would go around Earth's equator ${pl(v / C.equator, 2)} times every second.` + (!S.rel && v > c ? ' <b>Faster than light: impossible.</b> Classical physics has broken down. Switch relativity on.' : ''),
      work: vWork,
    });
    rows.push({
      id: 'K', label: 'Kinetic energy K', val: en(K, 4),
      sub: `= ${e(K, 4)} J. Collected from ${nk} push${nk === 1 ? '' : 'es'} at the gap, each worth up to |q|V = ${en(qV)}.`,
      work: S.rel ? `K = (γ − 1)mc² = (${pl(g, 6)} − 1) × ${en(D.mc2, 6)} = ${en(K, 4)}` : `K = ½mv² = ½ × ${mS()} × (${e(v, 4)} m/s)² = ${e(K, 4)} J = ${en(K, 4)}`,
    });
    if (arc) {
      rows.push({
        id: 'r', label: 'Orbit radius r', val: len(r, 4),
        sub: 'The radius of the circle it is following right now. Each push makes it faster, so the next half circle is bigger.',
        work: S.rel ? `r = γmv / (|q|B) = (${pl(g, 6)} × ${mS()} × ${e(v, 4)} m/s) / (${qS()} × ${BS(B)}) = ${e(r, 4)} m`
          : `r = mv / (|q|B) = (${mS()} × ${e(v, 4)} m/s) / (${qS()} × ${BS(B)}) = ${e(r, 4)} m`,
      });
      const F = q * v * B, acc = v * v / r;
      rows.push({
        id: 'F', label: 'Magnetic force F', val: e(F, 4) + ' N',
        sub: `Always at 90° to the velocity, pointing to the centre of the circle. It changes the direction of motion but never the speed: the magnetic force does no work. It is ${e(F / (m * C.g), 2)} times the particle's weight.`,
        work: `F = |q|vB sin 90° = ${qS()} × ${e(v, 4)} m/s × ${BS(B)} = ${e(F, 4)} N`,
      });
      rows.push({
        id: 'a', label: 'Centripetal acceleration a', val: e(acc, 4) + ' m/s²',
        sub: `About ${e(acc / C.g, 2)} times the acceleration due to gravity on Earth.`,
        work: `a = v²/r = (${e(v, 4)} m/s)² / ${e(r, 4)} m = ${e(acc, 4)} m/s²  ·  check: ${S.rel ? 'γma' : 'ma'} = ${e((S.rel ? g : 1) * m * acc, 4)} N = F ✓`,
      });
    }
    rows.push({
      id: 'p', label: 'Momentum p', val: e(p, 4) + ' kg·m/s',
      sub: `= ${pl(p * c / C.MeV, 4)} MeV/c. In a magnetic field it is the momentum that sets the radius: r = p/(|q|B).`,
      work: S.rel ? `p = γmv = ${pl(g, 6)} × ${mS()} × ${e(v, 4)} m/s = ${e(p, 4)} kg·m/s` : `p = mv = ${mS()} × ${e(v, 4)} m/s = ${e(p, 4)} kg·m/s`,
    });
    rows.push({
      id: 'g', label: 'Lorentz factor γ', val: S.rel ? pl(g, 7) : '1 (relativity off)',
      cls: S.rel && g - 1 > 0.05 ? 'is-warn' : '',
      sub: S.rel ? `γ = 1/√(1 − v²/c²). The particle behaves as if its mass were γm = ${e(g * m, 4)} kg, ${pct(g - 1, 2)} more than at rest. ${g - 1 < 0.01 ? 'Relativity barely matters yet.' : 'Relativity matters here: each turn takes noticeably longer.'}`
        : `Relativity is switched off, so the lab uses Newton's laws with a constant mass.${v > 0.1 * c ? ' Above about 10 % of c this becomes inaccurate.' : ''}`,
      work: S.rel ? `γ = 1 + K/(mc²) = 1 + ${en(K, 4)} / ${en(D.mc2, 6)} = ${pl(g, 7)}` : '',
    });
    if (arc) {
      const f = q * B / (TAU * g * m);
      rows.push({ sec: 'Going round' });
      rows.push({
        id: 'f', label: 'Revolution frequency f', val: si(f, 'Hz', 4),
        sub: `One revolution takes T = ${si(1 / f, 's', 4)}; angular velocity ω = ${e(TAU * f, 4)} rad/s. Big circle or small, the time is the same as long as γ stays close to 1.`,
        work: `f = |q|B / (2πγm) = (${qS()} × ${BS(B)}) / (2π × ${pl(g, 6)} × ${mS()}) = ${si(f, 'Hz', 4)}`,
      });
    }
    rows.push({
      id: 'prog', label: 'Progress', val: pl(st.revs, 3) + ' rev',
      sub: `${Math.max(0, nk - 1)} gap crossings after the first push · ${si(playT, 's')} after release · path so far ${len(st.path)}.`,
      work: `Real time is slowed down about ${e(slowFactor(), 2)} times so that you can watch it.`,
    });
    if (live) {
      const Bc = fieldCommanded();
      rows.push({ sec: 'Magnetic field chaos' });
      rows.push({
        id: 'chB', label: 'Field right now', val: BS(B) + (s.Bz < 0 ? ' ⊗' : s.Bz > 0 ? ' ⊙' : ''),
        cls: Math.abs(Bc) < 1e-9 ? 'is-bad' : '',
        sub: `Your electromagnet gives ${BS(D.Bmag)}. Chaos settings: strength ×${pl(S.chaosMult, 3)}, ${chaosFlip < 0 ? 'flipped' : 'not flipped'}, random flicker ±${pl(S.chaosFlicker, 3)} %. Every change starts a new circle from where the particle is, with the same speed: a magnetic field can only turn a particle, never speed it up.`,
        work: `B = B₀ × ${pl(S.chaosMult, 3)} × (${chaosFlip < 0 ? '−1' : '+1'}) × (1 + flicker) = ${BS(B)}`,
      });
      rows.push({
        id: 'chRF', label: 'RF timing', val: run.autoRF ? 'follows the particle' : 'fixed',
        cls: run.autoRF ? 'is-good' : (Math.abs(Bc / run.P.B) - 1 > 0.02 || chaosFlip < 0 || S.chaosFlicker > 0 ? 'is-warn' : ''),
        sub: run.autoRF ? 'The RF frequency is re-tuned to the particle\'s own frequency |q|B/(2πγm) after every change, so the pushes stay in step.' :
          `The RF still runs at ${si(run.wRF / TAU, 'Hz', 4)}, tuned for the original field. If the field changes, the particle's own frequency changes with it, the timing drifts and the pushes stop working.`,
      });
      rows.push({ id: 'chEv', label: 'Disturbances so far', val: `${stats.flips} flips · ${stats.nudges} nudges`, sub: `${stats.changes} changes of field strength while the particle was flying.` });
    }
    if (run.rot !== 0 || live) {
      const ph = rfPhase(playT), phDisp = PHYS.wrap(ph + (D.q < 0 ? Math.PI : 0));
      const Vnow = (fail && fail.type === 'rf') ? 0 : S.Vkv * Math.cos(phDisp);
      const fRF = rfFreqNow(st);
      rows.push({ sec: 'The accelerating gap' });
      rows.push({
        id: 'rf', label: 'Voltage between the dees now', val: (Vnow >= 0 ? '+' : '−') + pl(Math.abs(Vnow), 3) + ' kV',
        sub: (fail && fail.type === 'rf') ? 'The RF system has tripped after a spark-over: there is no voltage across the gap.' :
          `Dee 2 (left) is ${Vnow >= 0 ? 'positive' : 'negative'} compared with Dee 1, so the electric field across a ${GAP_NOMINAL * 100} cm gap is about ${e(Math.abs(Vnow) * 1e3 / GAP_NOMINAL, 3)} V/m, pointing ${Vnow >= 0 ? 'right →' : '← left'}. The voltage reverses ${e(2 * fRF, 3)} times per second (f_RF = ${si(fRF, 'Hz', 4)})${(run.fm || (live && run.autoRF)) ? ', tuned automatically to stay in step with the particle' : ''}.`,
        work: `V(t) = V₀ cos(2πf_RF t + ψ₀) = ${pl(S.Vkv, 4)} kV × cos(${pl(phDisp / DEG, 3)}°) = ${pl(Vnow, 4)} kV`,
      });
      if (ki >= 0) {
        const kk = run.kicks[ki], psiD = kk.psi / DEG;
        rows.push({
          id: 'kick', label: 'Last push at the gap', val: (kk.W >= 0 ? '+' : '−') + en(Math.abs(kk.W), 4),
          cls: kk.W < 0 || kk.reflected ? 'is-bad' : Math.abs(psiD) > 45 ? 'is-warn' : 'is-good',
          sub: (ki === 0 ? 'The first push, out of the ion source. ' : `Crossing number ${ki}. `) +
            `The voltage was ${pl(Math.abs(psiD), 3)}° ${psiD >= 0 ? 'past' : 'before'} its peak when the particle crossed. ΔK = |q|V cos ψ, so perfect timing (ψ = 0°) would give ${en(qV)}.` +
            (kk.reflected ? ' The field pointed the wrong way and turned the particle back into the same dee.' : kk.W < 0 ? ' The field now points backwards, so it is slowing the particle down.' : ''),
          work: `ΔK = |q|V cos ψ = ${zS()} × ${pl(S.Vkv, 4)} kV × cos(${pl(psiD, 3)}°) = ${en(kk.W, 4)}`,
        });
      }
    }
    return rows;
  }

  function outcomeRow() {
    if (!runEnded()) return { id: 'out', label: 'Simulation result', val: 'running…', sub: 'Let the run finish, or press <b>Skip to end</b>, to compare the simulation with these predictions.' };
    const qV = D.absq * S.Vkv * 1e3, revs = live ? run.revs : run.revs;
    if (run.status === 'extracted') {
      const d = (run.Kfinal - pred.Kmax) / pred.Kmax;
      const kicks = run.kicks.slice(1);
      const meanPsi = kicks.length ? kicks.reduce((a, k) => a + Math.abs(k.psi), 0) / kicks.length / DEG : 0;
      return {
        id: 'out', label: 'Simulation result', val: en(run.Kfinal, 4), cls: 'is-good',
        sub: `Extracted after ${pl(revs, 3)} revolutions and ${si(run.tStop, 's')}${live ? '' : `, having travelled ${len(run.path)}`}. Theory: ${en(pred.Kmax, 4)} after ${pl(pred.nRev, 3)} revolutions. Difference ${d >= 0 ? '+' : '−'}${pl(Math.abs(d) * 100, 2)} %: ` +
          (live && (S.chaosMult !== 1 || stats.flips || S.chaosFlicker) ? 'the field was changed during the run, so the final orbit had a different field from the prediction.' :
            `energy arrives in steps of up to ${en(qV)}, so the last orbit does not land exactly on R` + (meanPsi > 5 ? `, and the pushes were not perfectly timed (average |ψ| = ${pl(meanPsi, 2)}°).` : '.')),
      };
    }
    if (run.status === 'lost') return { id: 'out', label: 'Simulation result', val: 'lost at ' + en(run.Kpeak, 3), cls: 'is-bad', sub: lostReason() };
    if (run.status === 'wall') return { id: 'out', label: 'Simulation result', val: 'hit wall at ' + en(run.Kfinal, 3), cls: 'is-bad', sub: `Its orbit (radius ${len(run.rfinal)}) was off-centre or too small when it reached the edge, so it struck the wall of the dees. ` + lostReason() };
    if (run.status === 'limit') return { id: 'out', label: 'Simulation result', val: 'stopped', cls: 'is-warn', sub: `After ${MAX_REVS.toLocaleString('en-US')} revolutions the particle still had not reached the edge (it had ${en(run.Kfinal)}). Raise the dee voltage V so that fewer turns are needed.` };
    return { id: 'out', label: 'Simulation result', val: en(run.Kfinal, 3), sub: 'No magnetic field: one push, then straight out of the machine.' };
  }

  function chaosCaused() { return live && (stats.flips || stats.nudges || stats.changes || S.chaosMult !== 1 || S.chaosFlicker > 0); }
  function lostCause() {
    if (chaosCaused()) return `Cause: chaos. The field was ${stats.flips ? 'flipped, ' : ''}${S.chaosMult !== 1 || stats.changes ? 'changed in strength, ' : ''}${S.chaosFlicker > 0 ? 'flickering, ' : ''}${stats.nudges ? 'and the particle was nudged, ' : ''}so the particle's own frequency no longer matched the RF${run.autoRF ? ', or its orbit was pushed off-centre' : ''}. ${run.autoRF ? '' : 'Try <b>RF re-tunes to the particle</b>.'}`;
    const gPeak = S.rel ? 1 + run.Kpeak / D.mc2 : 1;
    const relCause = S.rfMode === 'fixed' && S.rel && (gPeak - 1) > Math.abs(S.detunePct) / 100;
    if (relCause) {
      return `Cause: relativity. At its peak energy (${en(run.Kpeak)}) γ = ${pl(gPeak, 5)}, so each half turn took ${pct(gPeak - 1, 2)} longer than the fixed-frequency RF expects. The particle arrives later and later until the voltage points the wrong way and slows it down. Fixes: choose <b>Follows particle</b> (a synchrocyclotron), raise V so fewer turns are needed, or tune the RF slightly low in Advanced RF tuning.`;
    }
    return `Cause: the RF frequency is ${pl(Math.abs(S.detunePct), 3)} % ${S.detunePct > 0 ? 'above' : 'below'} the particle's own frequency, so the timing drifts by about ${pl(Math.abs(S.detunePct) * 3.6, 3)}° every revolution until the voltage slows it down. Set the RF frequency offset back to 0 %.`;
  }
  const lostReason = () => `It peaked at ${en(run.Kpeak)}, below the ${en(pred.Kmax)} this machine could reach. ` + lostCause();
  function shortCause() {
    if (chaosCaused()) return 'The chaos disturbances broke the timing between the particle and the RF voltage.';
    const gPeak = S.rel ? 1 + run.Kpeak / D.mc2 : 1;
    if (S.rfMode === 'fixed' && S.rel && (gPeak - 1) > Math.abs(S.detunePct) / 100)
      return `Relativity: near its peak (${en(run.Kpeak)}) each half turn took ${pct(gPeak - 1, 2)} longer than the fixed-frequency RF expects.`;
    return `The RF frequency is ${pl(Math.abs(S.detunePct), 3)} % off the particle's own frequency, so the timing drifts every turn.`;
  }

  function applicationRow(K) {
    const MeV = K / C.MeV, key = D.part.key;
    let txt;
    if (key === 'proton') {
      if (MeV < 1) txt = 'Like the first Berkeley cyclotrons: hydrogen ions of 80 keV in January 1931, and 1.22 MeV protons by January 1932. Enough to begin nuclear-physics experiments.';
      else if (MeV < 10) txt = 'Enough for nuclear-reaction experiments. Compact medical cyclotrons below about 12 MeV make short-lived PET isotopes such as nitrogen-13 and oxygen-15.';
      else if (MeV <= 20) txt = '<b>In the 10–20 MeV range hospitals use to make fluorine-18</b>, the tracer in most PET scans.';
      else if (MeV < 70) txt = 'Higher-energy isotope production: iodine-123, for example, needs protons of about 25–30 MeV.';
      else if (MeV <= 250) txt = '<b>Proton-therapy range (70–250 MeV)</b>: enough to reach tumours deep inside the body.';
      else txt = "Research territory: TRIUMF's 18 m cyclotron in Canada reaches 520 MeV.";
    } else if (key === 'electron' || key === 'positron') {
      txt = 'Electron beams are normally made with linear accelerators or synchrotrons rather than cyclotrons, because electrons become relativistic at very low energy (γ = 2 at just 511 keV).';
    } else {
      txt = 'Cyclotrons also accelerate deuterons, alpha particles and heavier ions, for nuclear-physics research and for making medical isotopes.';
    }
    return { id: 'app', label: 'What could this beam do?', val: en(K, 3), sub: txt };
  }

  function rowsPredict() {
    const rows = [], q = D.absq, B = D.Bmag, R = S.R, V = S.Vkv * 1e3, c = C.c, qV = q * V;
    if (B < 1e-9) {
      rows.push({ id: 'nob', label: 'No magnetic field', val: 'B = 0', cls: 'is-bad', sub: 'With no field there is no circular motion, so the cyclotron formulas do not apply. Give the coils some current.' });
      rows.push(outcomeRow());
      return rows;
    }
    rows.push({ sec: 'Resonance' });
    rows.push({
      id: 'fc', label: 'Cyclotron frequency f', val: si(pred.fc, 'Hz', 4),
      sub: `The RF voltage has to flip twice per revolution, so its frequency must equal f: the resonance condition. Period T = ${si(pred.T, 's', 4)}. ` +
        (S.rfMode === 'fm' ? 'In synchrocyclotron mode the RF starts at this value and is lowered as γ grows.' : S.detunePct ? `Your RF is set ${pl(Math.abs(S.detunePct), 3)} % ${S.detunePct > 0 ? 'above' : 'below'} this, at ${si(pred.fRF, 'Hz', 4)}.` : 'Your RF is tuned exactly to it.'),
      work: `f = |q|B / (2πm) = (${qS()} × ${BS()}) / (2π × ${mS()}) = ${si(pred.fc, 'Hz', 4)}`,
    });
    rows.push({ sec: 'At the edge of the dees (r = R)' });
    rows.push({
      id: 'kmax', label: 'Maximum kinetic energy', val: en(pred.Kmax, 4),
      sub: (S.rel ? `Relativistic value; the classical ½mv² formula gives ${en(pred.Kcl, 4)}. ` : 'Classical value (relativity off). ') +
        'The dee voltage does not appear: V changes how many turns it takes, not the final energy.',
      work: `K_max = (qBR)² / (2m) = (${qS()} × ${BS()} × ${pl(R, 3)} m)² / (2 × ${mS()}) = ${e(pred.Kcl, 4)} J = ${en(pred.Kcl, 4)}` +
        (S.rel ? `   ·   with relativity: p = qBR, K = √((pc)² + (mc²)²) − mc² = ${en(pred.Krel, 4)}` : ''),
    });
    const vbad = !S.rel && pred.vmax > c;
    rows.push({
      id: 'vmax', label: 'Maximum speed', val: e(pred.vmax, 4) + ' m/s', cls: vbad ? 'is-bad' : '',
      sub: `${pct(pred.vmax / c)} of the speed of light.` + (vbad ? ' <b>Faster than light: impossible.</b> Classical physics breaks down here; switch relativity on.' : ''),
      work: S.rel ? `p = qBR = ${e(pred.pmax, 4)} kg·m/s, γ = ${pl(pred.grel, 6)}, v_max = p/(γm) = ${e(pred.vrel, 4)} m/s`
        : `v_max = qBR / m = (${qS()} × ${BS()} × ${pl(R, 3)} m) / ${mS()} = ${e(pred.vcl, 4)} m/s`,
    });
    rows.push({
      id: 'nrev', label: 'Revolutions needed', val: pl(pred.nRev, 4),
      sub: `Two pushes per revolution, each up to |q|V = ${en(qV)}, so up to ${en(2 * qV)} per turn.` + (pred.nRev > MAX_REVS ? ` More than the lab's limit of ${MAX_REVS.toLocaleString('en-US')} revolutions: raise V.` : ''),
      cls: pred.nRev > MAX_REVS ? 'is-warn' : '',
      work: `N = K_max / (2|q|V) = ${en(pred.Kmax, 4)} / ${en(2 * qV, 4)} = ${pl(pred.nRev, 4)}`,
    });
    rows.push({
      id: 'tacc', label: 'Acceleration time', val: si(pred.tAccClassical, 's', 4),
      sub: 'The time from source to exit, t = N × T. Surprise: πBR²/(2V) contains no mass and no charge, so every particle takes the same time in the same machine.' + (S.rel && pred.grel > 1.01 ? ' (Relativity makes the real time a little longer.)' : ''),
      work: `t = πBR² / (2V) = π × ${BS()} × (${pl(R, 3)} m)² / (2 × ${e(V, 3)} V) = ${si(pred.tAccClassical, 's', 4)}`,
    });
    rows.push({
      id: 'path', label: 'Distance travelled', val: len(pred.path),
      sub: "The spiral is long: about ⅔ × N × 2πR, because the orbit radius grows like √n. For comparison, particles in TRIUMF's 18 m cyclotron travel about 45 km.",
      work: `≈ ⅔ × ${pl(pred.nRev, 4)} × 2π × ${pl(R, 3)} m = ${len(pred.path)}`,
    });
    rows.push({ sec: 'This run in the simulation' });
    rows.push(outcomeRow());
    const gR = pred.grel;
    rows.push({
      id: 'rel', label: 'Is relativity important?', val: S.rel ? 'γ = ' + pl(gR, 5) + ' at R' : 'switched off',
      cls: gR - 1 > 0.05 ? 'is-warn' : '',
      sub: `At the edge the particle moves at ${pct(pred.vrel / c)} of c. ` +
        (gR - 1 < 0.005 ? 'Hardly: classical formulas are accurate to within about 1 % here.'
          : gR - 1 < 0.05 ? 'A little: each turn takes slightly longer, so a fixed-frequency cyclotron slowly drifts out of step (see Advanced RF tuning).'
            : 'Yes: a fixed frequency cannot keep up. Machines for this energy are synchrocyclotrons, isochronous cyclotrons or synchrotrons.'),
      work: `γ = 1 + K/(mc²) = 1 + ${en(pred.Krel, 4)} / ${en(D.mc2, 6)} = ${pl(gR, 6)}`,
    });
    const beamP = 10e-6 * (run.status === 'extracted' ? run.Kfinal : pred.Kmax) / C.e;
    rows.push({
      id: 'power', label: 'Beam power at 10 μA', val: si(beamP, 'W'),
      sub: 'A real beam carries many particles. A beam current of 10 μA is about 6 × 10¹³ particles per second (for charge e); its power is P = I × K / e.',
      work: `P = I × K/e = 10 μA × ${en(run.status === 'extracted' ? run.Kfinal : pred.Kmax, 4)} / e = ${si(beamP, 'W', 4)}`,
    });
    rows.push({ sec: 'Real world' });
    rows.push(applicationRow(run.status === 'extracted' ? run.Kfinal : pred.Kmax));
    return rows;
  }

  function rowsMagnet() {
    const rows = [], N = D.N, I = D.I, B = D.Bmag, g = D.gap, mu0 = C.mu0;
    const realism = PHYS.fieldRealism(B);
    const eng = PHYS.coilEngineering(S.coils, S.turns, I, S.R);
    rows.push({ sec: 'Coils' });
    rows.push({
      id: 'N', label: 'Total number of turns N', val: N.toLocaleString('en-US') + ' turns',
      sub: `${S.coils} coil${S.coils > 1 ? 's' : ''} × ${S.turns} turns. The coils are connected in series, so the same current flows through every turn.`,
      work: `N = ${S.coils} × ${S.turns} = ${N}`,
    });
    rows.push({
      id: 'I', label: S.fieldInput === 'current' ? 'Current I (you set this)' : 'Current needed I', val: pl(I, 4) + ' A',
      cls: I > 300 ? 'is-warn' : '',
      sub: S.fieldInput === 'field' ? `The current that produces ${BS()} across a ${pl(S.gapCm, 3)} cm gap with ${N} turns.` : 'The current through every turn of every coil.',
      work: S.fieldInput === 'field' ? `I = Bg / (μ₀N) = (${BS()} × ${pl(g, 3)} m) / (${e(mu0, 6)} T·m/A × ${N}) = ${pl(I, 4)} A` : '',
    });
    rows.push({
      id: 'NI', label: 'Ampere-turns NI', val: pl(N * I, 4) + ' A',
      sub: 'What really sets the field is the product N × I. For example 800 turns × 50 A and 400 turns × 100 A give exactly the same field.',
      work: `NI = ${N} × ${pl(I, 4)} A = ${pl(N * I, 5)} A`,
    });
    rows.push({ sec: 'Field in the gap' });
    rows.push({
      id: 'B', label: 'Magnetic field B', val: pl(B, 4) + ' T',
      cls: realism.level === 'ok' ? 'is-good' : realism.level === 'warn' ? 'is-warn' : realism.level === 'bad' ? 'is-bad' : '',
      sub: `${realism.label}. ${realism.text} For scale, Earth's own field is about 0.00005 T.`,
      work: `B = μ₀NI / g = (${e(mu0, 6)} T·m/A × ${N} × ${pl(I, 4)} A) / ${pl(g, 3)} m = ${pl(B, 5)} T`,
    });
    const into = D.Bz < 0, pos = D.part.z > 0, rotNow = (D.q * D.Bz > 0) ? -1 : 1;
    rows.push({
      id: 'dir', label: 'Direction', val: into ? 'into the screen ⊗' : 'out of the screen ⊙',
      sub: `The current flows ${S.dir === 'cw' ? 'clockwise' : 'anticlockwise'} seen from above. Curl the fingers of your right hand along the current: your thumb points ${into ? 'down, into' : 'up, out of'} the screen. ` +
        (B > 0 ? `By F = qv × B, a ${pos ? 'positive' : 'negative'} particle therefore circles ${rotNow > 0 ? 'anticlockwise' : 'clockwise'}.` : ''),
    });
    rows.push({
      id: 'gap', label: 'Pole gap g', val: pl(S.gapCm, 3) + ' cm',
      sub: 'B ∝ 1/g: halving the gap doubles the field for the same current, but the dees and the beam need room between the poles.',
    });
    if (B > 0) {
      const Bair = mu0 * N * I / (2 * eng.rCoil);
      rows.push({
        id: 'air', label: 'What the iron does', val: '×' + pl(B / Bair, 3),
        sub: `Without the iron yoke the same coils, as a flat loop of radius ${len(eng.rCoil)}, would give only about ${e(Bair, 3)} T at the centre. The iron guides the field around the loop so that nearly all the ampere-turns act across the narrow gap.`,
        work: `B(no iron) ≈ μ₀NI / (2r) = (${e(mu0, 6)} × ${pl(N * I, 5)}) / (2 × ${pl(eng.rCoil, 3)} m) = ${e(Bair, 4)} T`,
      });
      const Eb = B * B / (2 * mu0) * Math.PI * eng.rCoil * eng.rCoil * g;
      rows.push({
        id: 'store', label: 'Energy stored in the gap field', val: si(Eb, 'J'),
        sub: `A magnetic field stores energy: B²/(2μ₀) per cubic metre. This energy is why a magnet that suddenly fails (a quench) is dangerous: it all turns into heat. For comparison, the LHC's magnets store gigajoules.`,
        work: `E ≈ B²/(2μ₀) × πr²g = (${BS()})² / (2 × ${e(mu0, 4)}) × π × (${pl(eng.rCoil, 3)} m)² × ${pl(g, 3)} m = ${si(Eb, 'J', 4)}`,
      });
    }
    rows.push({ sec: 'Engineering estimate (copper conductor of 1 cm² cross-section)' });
    rows.push({
      id: 'wire', label: 'Length of copper', val: len(eng.length),
      sub: `Each turn goes once around a coil of mean radius ${len(eng.rCoil)} (just outside the poles). That is about ${pl(eng.copperMass / 1000, 3)} tonnes of copper.`,
      work: `L = N × 2πr = ${N} × 2π × ${pl(eng.rCoil, 3)} m = ${len(eng.length, 4)}`,
    });
    rows.push({
      id: 'res', label: 'Resistance of the coils', val: pl(eng.resistance, 3) + ' Ω',
      sub: 'Copper resistivity ρ = 1.68 × 10⁻⁸ Ω·m at 20 °C.',
      work: `R = ρL / A = (1.68 × 10⁻⁸ Ω·m × ${pl(eng.length, 4)} m) / (1.0 × 10⁻⁴ m²) = ${pl(eng.resistance, 4)} Ω`,
    });
    rows.push({
      id: 'pow', label: 'Heat produced in the coils', val: si(eng.power, 'W'),
      cls: eng.power > 1e6 ? 'is-bad' : eng.power > 2e5 ? 'is-warn' : '',
      sub: `The power supply must provide ${pl(eng.voltage, 3)} V at ${pl(I, 4)} A, and all of that power turns into heat. That is why large magnets use hollow, water-cooled copper (current density here: ${pl(eng.currentDensity, 3)} A/mm²).`,
      work: `P = I²R = (${pl(I, 4)} A)² × ${pl(eng.resistance, 4)} Ω = ${si(eng.power, 'W', 4)}`,
    });
    if (S.over) {
      const lv = overLevels();
      rows.push({ sec: 'Overload mode (illustrative limits)' });
      rows.push({ id: 'oc', label: 'Coil heating', val: Math.round(lv.coil * 100) + ' % of limit', cls: lv.coil >= 1 ? 'is-bad' : lv.coil >= 0.7 ? 'is-warn' : '', sub: 'Heat grows with I² (P = I²R). The lab sets the cooling limit at 800 A: above it the copper overheats.', work: `(I / 800 A)² = (${pl(I, 4)} / 800)² = ${pl(lv.coil, 3)}` });
      rows.push({ id: 'oq', label: 'Magnet quench risk', val: Math.round(lv.quench * 100) + ' %', cls: lv.quench >= 1 ? 'is-bad' : lv.quench >= 0.7 ? 'is-warn' : '', sub: 'Above about 2 T a real cyclotron needs superconducting coils. The lab assumes they quench (stop superconducting) above 9 T, a little above the LHC dipoles\' 8.3 T.', work: `(B − 2 T) / (9 T − 2 T) = (${pl(lv.B, 4)} − 2) / 7 = ${pl(lv.quench, 3)}` });
      rows.push({ id: 'or', label: 'RF spark-over risk', val: Math.round(lv.rf * 100) + ' %', cls: lv.rf >= 1 ? 'is-bad' : lv.rf >= 0.7 ? 'is-warn' : '', sub: `A huge voltage across the gap pulls electrons out of the metal and sparks jump across. The lab's limit is 1000 kV (about ${e(1e6 / GAP_NOMINAL, 2)} V/m across a 2 cm gap).`, work: `(V / 1000 kV)² = (${pl(S.Vkv, 4)} / 1000)² = ${pl(lv.rf, 3)}` });
    }
    return rows;
  }

  let dataCache = { tab: null, ids: '', els: new Map() };
  function renderData(st) {
    if (S.tab === 'notebook') return;
    const body = $('#dataBody');
    const rows = S.tab === 'now' ? rowsNow(st) : S.tab === 'predict' ? rowsPredict() : rowsMagnet();
    const ids = rows.map(r => r.sec ? '#' + r.sec : r.id).join('|');
    if (dataCache.tab !== S.tab || dataCache.ids !== ids) {
      body.innerHTML = '';
      dataCache = { tab: S.tab, ids, els: new Map() };
      for (const r of rows) {
        if (r.sec) { const hd = document.createElement('div'); hd.className = 'dsec'; hd.textContent = r.sec; body.appendChild(hd); continue; }
        const el = document.createElement('div'); el.className = 'drow';
        el.innerHTML = '<div class="drow-head"><div class="drow-label"></div><div class="drow-val"></div></div><div class="drow-sub"></div><div class="drow-work"></div>';
        body.appendChild(el);
        dataCache.els.set(r.id, { el, label: el.querySelector('.drow-label'), val: el.querySelector('.drow-val'), sub: el.querySelector('.drow-sub'), work: el.querySelector('.drow-work'), last: {} });
      }
    }
    for (const r of rows) {
      if (r.sec) continue;
      const c = dataCache.els.get(r.id); if (!c) continue;
      const L = c.last;
      if (L.label !== r.label) { c.label.textContent = r.label; L.label = r.label; }
      if (L.val !== r.val) { c.val.textContent = r.val; L.val = r.val; }
      if (L.sub !== r.sub) { c.sub.innerHTML = r.sub || ''; L.sub = r.sub; }
      const w = r.work || '';
      if (L.work !== w) { c.work.textContent = w; c.work.hidden = !w; L.work = w; }
      const cls = 'drow' + (r.cls ? ' ' + r.cls : '');
      if (L.cls !== cls) { c.el.className = cls; L.cls = cls; }
    }
  }

  /* ------------------------------------------------------------------
     Live tiles, status, timeline
     ------------------------------------------------------------------ */
  function setText(id, txt) { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; }
  const compact = s => s.replace(' × ', '×');
  function updateLive(st) {
    const beg = document.body.classList.contains('is-beginner');   // Beginner: plain numbers, no powers of ten
    if (beg) {
      setText('tileV', pct(st.v / C.c) + ' of light');
      setText('tileVsub', Math.round(st.v / 1000).toLocaleString('en-US') + ' km every second');
      setText('tileK', en(st.K, 3));
      setText('tileKsub', 'energy of motion: it grows at every push');
    } else {
      setText('tileV', compact(e(st.v, 3)) + ' m/s');
      setText('tileVsub', pct(st.v / C.c) + ' of light speed');
      setText('tileK', en(st.K, 3));
      setText('tileKsub', compact(e(st.K, 3)) + ' J');
    }
    if (st.s.type === 'arc') { setText('tileR', len(st.r, 3)); setText('tileRsub', beg ? 'the machine is ' + len(S.R) + ' to the edge' : 'dee radius R = ' + len(S.R)); }
    else { setText('tileR', st.s.type === 'exit' ? 'straight' : '∞'); setText('tileRsub', st.s.type === 'exit' ? 'left the field' : 'no field: straight line'); }
    setText('tileN', pl(st.revs, 3));
    setText('tileNsub', run.rot === 0 && !live ? 'no circular motion' : beg ? 'of about ' + Math.max(1, Math.round(pred.nRev)) + ' before it leaves' : 'of ≈ ' + pl(pred.nRev, 3) + ' predicted');

    const hud = $('#hudStatus');
    let txt, cls = '';
    const ki = kickIndexAt(playT);
    if (fail) { txt = fail.type === 'rf' ? 'RF spark-over: the RF tripped' : fail.type === 'quench' ? 'Magnet quench: field lost' : 'Coil burn-out: field lost'; cls = 'is-bad'; }
    else if (replay) { txt = 'Slow-motion replay of the final orbits, 0.1×'; cls = 'is-warn'; }
    else if (runEnded() && run.status === 'extracted') { txt = `Extracted at ${en(run.Kfinal, 3)} after ${pl(live ? run.revs : run.revs, 3)} revolutions`; cls = 'is-good'; }
    else if (runEnded() && run.status === 'nofield') { txt = 'No magnetic field: straight out after one push'; cls = 'is-warn'; }
    else if (runEnded() && run.status === 'lost') { txt = `Lost step with the RF at ${en(run.Kpeak, 3)}`; cls = 'is-bad'; }
    else if (runEnded() && run.status === 'limit') { txt = `Stopped after ${MAX_REVS.toLocaleString('en-US')} revolutions`; cls = 'is-warn'; }
    else if (runEnded() && run.status === 'wall') { txt = `Beam lost: hit the dee wall at ${en(run.Kfinal, 3)}`; cls = 'is-bad'; }
    else if (ki >= 0 && run.kicks[ki].W < 0) { txt = 'Out of step: the RF is now slowing it down'; cls = 'is-bad'; }
    else if (!playing) txt = playT <= 0 ? 'Ready: press play' : `Paused at lap ${pl(st.revs, 3)}`;
    else if (st.s.type === 'line') { txt = 'No field: flying straight'; cls = 'is-warn'; }
    else if (skipping) { txt = 'Fast-forwarding…'; cls = 'is-run'; }
    else { txt = `Accelerating: lap ${Math.floor(st.revs) + 1} of about ${Math.max(1, Math.round(pred.nRev))}`; cls = 'is-run'; }
    if (view.zoom > 1 && !(v3 && v3.on) && !pov.on) txt += `  · zoom ${CL.zoom.label(view.zoom)}${view.follow ? ', following it' : ''}`;
    if (hud.textContent !== txt) hud.textContent = txt;
    const hc = 'hud hud-status ' + cls;
    if (hud.className !== hc) hud.className = hc;

    // chaos HUD
    const hc2 = $('#hudChaos');
    hc2.hidden = !live;
    if (live) setText('hudChaosB', `B = ${pl(st.B, 3)} T ${st.s.Bz < 0 ? '⊗' : st.s.Bz > 0 ? '⊙' : ''}, ×${pl(Math.abs(fieldCommanded() / run.P.B), 3)}${run.autoRF ? ', RF follows' : ''}`);

    // timeline
    const scrub = $('#scrub');
    const runningLive = isLiveRunning();
    scrub.disabled = runningLive;
    const tE = runningLive ? Math.max(playT, (pred.tAccClassical || run.T0) * 1.05) : run.tEnd;
    const fr = tE > 0 ? playT / tE : 0;
    if (document.activeElement !== scrub) scrub.value = String(Math.round(fr * 1000) || 0);
    scrub.style.setProperty('--fill', (fr * 100).toFixed(1) + '%');
    setText('timeLabel', runningLive ? `t = ${si(playT, 's')}, live chaos run` : `t = ${si(playT, 's')} of ${si(run.tEnd, 's')}`);
    setText('slowdown', replay ? `slow motion: ≈ ${e(slowFactor(), 2)}× slower than real` : `slowed down ≈ ${e(slowFactor(), 2)}×`);
    const canReplay = runEnded() && (run.rot !== 0 || live) && !fail;
    const rb = $('#btnReplay');
    if (rb.disabled === canReplay) rb.disabled = !canReplay;
    if (S.over) updateMeters();
    updateRideBtn();
    const nowN = performance.now(); if (nowN - narrT > 350) { narrT = nowN; narrateLab(st); }
  }
  // plain-language narration for beginners
  function narrateLab(st) {
    const el = $('#labNarrateX'); if (!el || !document.body.classList.contains('is-beginner')) return;
    const nm = D.part.name.toLowerCase(), lap = Math.floor(st.revs) + 1, ki = kickIndexAt(playT);
    let h;
    if (fail) h = `<b>The machine failed.</b> Overload mode pushed it past its limits (${fail.type === 'rf' ? 'a spark jumped across the gap' : fail.type === 'quench' ? 'the magnet suddenly lost its superconductivity' : 'a coil overheated'}). Real accelerators have safety systems that switch off first. Press <b>Repair</b>.`;
    else if (D.Bmag < 1e-9) h = 'There is no current in the coils, so there is <b>no magnetic field</b>. Nothing bends the particle: after one push it flies off in a straight line. Turn up the coil current.';
    else if (pov.on && !runEnded()) h = `You are <b>riding the ${nm}</b>. The purple lines are the magnetic field, running straight through the machine; it keeps steering you round in a curve. Each time you cross the gap you get a push (<b>thump</b>) and you speed up${D.part.key === 'electron' || D.part.key === 'positron' ? '. Listen closely: an electron is so light that relativity makes its laps take longer, so its thumps slowly fall behind the voltage\'s tick, until the pushes turn into brakes' : '. Listen: the thumps keep a <b>steady beat</b> even though you go faster and the circles get bigger. That steady beat is the whole trick of a cyclotron'}.`;
    else if (replay) h = 'Slow-motion replay: watch each push at the gap. The particle speeds up a little every time it crosses, so each half circle is slightly bigger than the last.';
    else if (runEnded() && run.status === 'extracted') h = `Done! The ${nm} reached <b>${en(run.Kfinal, 3)}</b> after ${pl(run.revs, 3)} laps and left the machine at ${pct(st.v / C.c, 2)} of the speed of light. To go even faster you need a <b>stronger magnet or a bigger machine</b> (drag the edge of the dees). A bigger voltage only means fewer laps.`;
    else if (runEnded() && run.status === 'wall') h = 'The beam <b>hit the wall</b> of a dee before it could leave. The field changed while it flew, or the particle fell out of step with the voltage.';
    else if (runEnded() && run.status === 'lost') h = `The particle <b>fell out of step</b> at ${en(run.Kpeak, 3)}: the voltage started arriving at the wrong moment and slowed it down. Near light speed a particle takes longer for each lap (relativity), so the rhythm no longer matches. The <em>Follows particle</em> RF mode fixes this.`;
    else if (ki >= 0 && run.kicks[ki].W < 0) h = 'The pushes now arrive at the <b>wrong moment</b>, so the voltage is slowing the particle down.';
    else if (playT <= 0) h = `Press <b>play</b>. A ${nm} starts in the middle. The magnet bends its path into a circle, and every time it crosses the gap between the two copper dees, the voltage gives it a push, like pushing a swing at just the right moment.`;
    else h = `Lap ${lap}: the ${nm} is moving at <b>${pct(st.v / C.c, 2)} of the speed of light</b> (${Math.round(st.v / 1000).toLocaleString('en-US')} km every second). Each push makes it faster, and a faster particle needs a bigger circle, so the path <b>spirals outwards</b>. Yet every lap takes the same time: that is the trick that makes a cyclotron work.${live ? ' <em>Chaos mode:</em> changing the field changes the circle size at once.' : ''}`;
    if (el.innerHTML !== h) el.innerHTML = h;
  }

  /* ------------------------------------------------------------------
     Toast, run end and missions
     ------------------------------------------------------------------ */
  const showToast = (html, kind, ms = 12000) => toast($('#labToast'), html, kind, ms);
  const hideToast = () => { const t = $('#labToast'); if (t) t.hidden = true; };

  function onRunEnd() {
    endShown = true;
    if (replay) return;
    let html, kind = '';
    const revs = run.revs;
    if (run.status === 'extracted') {
      html = `<b>Beam extracted at ${en(run.Kfinal, 3)}</b><br>Speed ${e(run.vfinal, 3)} m/s (${pct(run.vfinal / C.c)} of c) after ${pl(revs, 3)} revolutions in ${si(run.tStop, 's')}. Theory predicted ${en(pred.Kmax, 3)}. Press <b>Replay 0.1×</b> to watch the last orbits in slow motion.`;
    } else if (run.status === 'lost') {
      kind = 'bad';
      html = `<b>The particle fell out of step at ${en(run.Kpeak, 3)}</b> (this machine could reach ${en(pred.Kmax, 3)})<br>${shortCause()} Fixes in <b>Predictions</b>.`;
    } else if (run.status === 'wall') {
      kind = 'bad';
      html = `<b>Beam lost: the particle hit the dee wall at ${en(run.Kfinal, 3)}</b> (this machine could reach ${en(pred.Kmax, 3)})<br>${chaosCaused() ? shortCause() : 'Badly timed pushes moved its orbit off-centre. ' + shortCause()} Details in <b>Predictions</b>.`;
    } else if (run.status === 'limit') {
      kind = 'warn'; html = `<b>Stopped after ${MAX_REVS.toLocaleString('en-US')} revolutions</b><br>Raise the dee voltage so the particle needs fewer turns.`;
    } else {
      kind = 'warn'; html = `<b>No magnetic field</b><br>The particle got one push (${en(run.Kfinal, 3)}) and flew straight out. The magnetic field is what brings it back to the gap for more pushes.`;
    }
    const done = checkMissions(stateAt(playT));
    if (done.length) { html += `<br><b>Mission complete: ${done.map(m => m.title).join(', ')}</b>`; audio.fanfare(); }
    showToast(html, kind);
  }

  function missionMet(id, st) {
    if (S.preset !== 'custom' && S.preset !== 'default') return false;   // missions count with your own settings only
    if (live) return false;
    const MeV = C.MeV, ext = run.status === 'extracted' && runEnded(), key = D.part.key;
    switch (id) {
      case 'pet': return ext && key === 'proton' && run.Kfinal >= 10 * MeV && run.Kfinal <= 20 * MeV;
      case 'fifth': return key === 'proton' && S.rel && playT > 0 && st.v > 0.2 * C.c;
      case 'compact': return ext && key === 'proton' && S.R <= 0.25 + 1e-9 && run.Kfinal >= 5 * MeV;
      case 'magnet': return D.Bmag >= 1.5 - 1e-9 && D.I <= 40 + 1e-9 && D.I > 0;
      case 'electron': return ext && key === 'electron' && S.rel && run.Kfinal >= 2 * MeV;
      case 'record': return ext && key === 'proton' && S.rel && S.rfMode === 'fixed' && run.Kfinal >= 20 * MeV;
      default: return false;
    }
  }
  function checkMissions(st) {
    const fresh = [];
    for (const m of MISSIONS) if (!missions.done[m.id] && missionMet(m.id, st)) { const r = missions.complete(m.id); if (r) fresh.push(r); }
    return fresh;
  }
  function renderMissions() {
    missions.render($('#labMissions'), 'lab');
    const [d, n] = missions.count('lab');
    $('#labMissionCount').textContent = `${d} / ${n}`;
  }

  /* ------------------------------------------------------------------
     Event detection during playback (gap crossings, extraction, wall)
     ------------------------------------------------------------------ */
  function detectEvents(now) {
    const ki = kickIndexAt(playT);
    if (ki !== lastKi) {
      if (ki > lastKi && ki - lastKi < 8 && (playing || replay)) {
        for (let k = Math.max(lastKi + 1, 0); k <= ki; k++) onKick(run.kicks[k], now);
      }
      lastKi = ki;
    }
    if (run.extract) {
      if (playT >= run.extract.t && !extFx && playT > 0) { extFx = true; extractFx(); }
      else if (playT < run.extract.t - 1e-15) extFx = false;
      if (playT >= run.tEnd - 1e-18 && !targetFx && playT > 0) {
        targetFx = true;
        const ex = run.extract, last = run.segs[run.segs.length - 1], L2 = last.v * (last.t1 - last.t0);
        fx.ring(X(ex.x + ex.ux * L2), Y(ex.y + ex.uy * L2), { speed: 120, life: 0.6, color: '255,212,59' });
      } else if (playT < run.tEnd - 1e-15) targetFx = false;
    }
    if (run.wall) {
      if (playT >= run.wall.t - 1e-18 && !wallFx && playT > 0) { wallFx = true; beamLoss(run.wall.x, run.wall.y, S.over, now); }
      else if (playT < run.wall.t - 1e-15) { wallFx = false; }
    }
  }
  function onKick(k, now) {
    if (!k || k.n === 0) return;
    if (pov.on) {
      const good = k.W >= 0 && !k.reflected;
      pov.beatAt = now; pov.flash = good ? 0.7 : 1; pov.flashCol = good ? '255,190,90' : '255,75,62'; pov.jolt = good ? 1 : 1.4;
      pov.pops.push({ text: k.reflected ? 'turned back!' : `${k.W >= 0 ? '+' : '−'}${en(Math.abs(k.W), 3)}`, born: now, bad: !good });
      if (S.speed !== 'turbo') audio.thunk(0.2 + 0.6 * clamp(k.K / Kref, 0, 1));
      return;
    }
    const sp = speedRevs();
    if (sp <= 6) audio.tick(clamp(k.K / Kref, 0, 1));
    if (replay || sp <= 1.01) {
      const good = k.W >= 0 && !k.reflected;
      floaters.push({
        x: 0, y: k.y, dx: k.dir * (replay ? 34 : 24), born: now, life: replay ? 3.2 : 1.3, big: !!replay,
        text: k.reflected ? 'turned back!' : `${k.W >= 0 ? '+' : '−'}${en(Math.abs(k.W), 3)}${replay ? ' → ' + en(k.K, 3) : ''}`,
        bg: good ? 'rgba(255,190,90,0.95)' : 'rgba(255,107,107,0.95)', fg: good ? '#231300' : '#2a0606',
      });
      if (replay) fx.ring(X(0), Y(k.y), { speed: 90, life: 0.8, color: '255,200,120', width: 2 });
    }
  }
  function extractFx() {
    const ex = run.extract;
    fx.burst(X(ex.x), Y(ex.y), 26, { speed: 200, life: 0.6, color: '255,220,120', dir: Math.atan2(-ex.uy, ex.ux), spread: 0.5 });
    audio.whoosh();
  }
  function beamLoss(x, y, big, now) {
    const sx = X(x), sy = Y(y);
    fx.burst(sx, sy, big ? 160 : 70, { speed: big ? 460 : 300, life: big ? 1.1 : 0.8, colors: ['255,230,160', '255,170,70', '255,90,60', '255,255,255'] });
    fx.ring(sx, sy, { speed: big ? 520 : 300, life: 0.6, color: '255,200,120' });
    if (big) { fx.flash(0.75, '255,120,80'); fx.puff(sx, sy, 12); fx.burst(sx, sy, 24, { speed: 260, life: 1.4, colors: ['120,130,150', '90,100,120'], debris: true, gravity: 140 }); shake.kick(12, 0.9); shakeAll.kick(4, 0.6); audio.boom(1); }
    else { fx.flash(0.25, '255,180,120'); shake.kick(5, 0.4); audio.crunch(); }
    hotSpot = { x, y, born: now || performance.now() };
  }

  /* ------------------------------------------------------------------
     Overload mode
     ------------------------------------------------------------------ */
  function overLevels() {
    const B = D.Bmag * (live ? S.chaosMult : 1);
    return { coil: (D.I / 800) ** 2, quench: Math.max(0, (B - 2) / 7), rf: (S.Vkv / 1000) ** 2, B };
  }
  function meterColor(l) { return l >= 1 ? 'var(--bad)' : l >= 0.5 ? 'var(--amber)' : 'var(--ok)'; }
  function updateMeters() {
    const lv = overLevels();
    for (const [k, id] of [['coil', 'mCoil'], ['quench', 'mQuench'], ['rf', 'mRF']]) {
      const el = $('#' + id), v = lv[k];
      el.style.width = Math.min(100, v * 100).toFixed(1) + '%';
      el.style.background = meterColor(v);
      setText(id + 'V', Math.round(v * 100) + ' %');
    }
  }
  function updateOverload(now, dt) {
    const lv = overLevels();
    const top = Math.max(lv.coil, lv.quench, lv.rf);
    const runningNow = playing && !fail && !runEnded();
    const warn = runningNow && top >= 0.7;
    if (warn !== alarmOn) { alarmOn = warn; $('#labAlarm').classList.toggle('is-on', warn); audio.alarm(warn); }
    if (!runningNow) { stress = Math.max(0, stress - dt * 0.5); return; }
    if (warn) shake.kick(clamp(1 + 5 * (top - 0.7), 0, 7), 0.25);
    if (lv.rf >= 0.85 && Math.random() < dt * 6 * lv.rf) {
      const { cx, cy, h } = geom, yy = cy + (Math.random() * 2 - 1) * h * 0.8;
      fx.bolt(cx - geom.w * 1.2, yy, cx + geom.w * 1.2, yy + (Math.random() - 0.5) * 20, { jag: 5 });
      if (Math.random() < 0.3) audio.spark();
    }
    if (lv.coil >= 0.85 && coilGeom && Math.random() < dt * 3) {
      const a = Math.random() * TAU, r = (coilGeom.inner + coilGeom.outer) / 2;
      fx.puff(geom.cx + Math.cos(a) * r, geom.cy + Math.sin(a) * r, 1, { shade: 70 });
    }
    if (top >= 1) {
      stress += dt * (top - 0.95) * 2;
      if (stress >= 1) {
        const which = lv.quench >= lv.coil && lv.quench >= lv.rf ? 'quench' : lv.coil >= lv.rf ? 'coil' : 'rf';
        triggerFailure(which, now);
      }
    } else stress = Math.max(0, stress - dt * 0.5);
  }
  function triggerFailure(type, now) {
    const st = stateAt(playT);
    fail = { type, start: now, x: st.x, y: st.y, ux: st.ux, uy: st.uy, s: st.s, tSim: playT, coast: 0, hit: false, downShown: false, flyD: 0 };
    stress = 0; skipping = false;
    setPlaying(false);
    alarmOn = false; $('#labAlarm').classList.add('is-on'); audio.alarm(false);
    endReplay(true);
    const { cx, cy, Rp } = geom, rc = coilGeom ? (coilGeom.inner + coilGeom.outer) / 2 : Rp * 1.18;
    fx.flash(1, type === 'rf' ? '190,220,255' : '255,255,255');
    shake.kick(16, 1.4); shakeAll.kick(7, 1.0);
    audio.boom(type === 'rf' ? 0.6 : 1.6);
    if (type === 'quench') {
      fx.ring(cx, cy, { r0: rc, speed: 520, life: 1.2, color: '200,230,255', width: 6 });
      fx.ring(cx, cy, { r0: rc * 0.8, speed: 380, life: 1.0, color: '255,255,255', width: 3 });
      for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; fx.puff(cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, 2, { shade: 215 }); }
      for (let i = 0; i < 6; i++) { const a = Math.random() * TAU; fx.burst(cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, 30, { speed: 380, life: 1, colors: ['190,225,255', '255,255,255', '140,200,255'] }); }
    } else if (type === 'coil') {
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; fx.puff(cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, 3, { shade: 60 + Math.random() * 40 }); }
      for (let i = 0; i < 7; i++) { const a = Math.random() * TAU; fx.burst(cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, 36, { speed: 420, life: 1.1, colors: ['255,210,90', '255,130,40', '255,80,40', '255,255,220'] }); }
      fx.burst(cx, cy - Rp * 1.18, 30, { speed: 300, life: 1.6, colors: ['200,110,50', '160,80,30'], debris: true, gravity: 200 });
      fx.ring(cx, cy, { r0: rc, speed: 420, life: 1.0, color: '255,160,80', width: 5 });
    } else {
      for (let i = 0; i < 6; i++) fx.bolt(cx - geom.w * 1.5, cy + (Math.random() * 2 - 1) * geom.h * 0.9, cx + geom.w * 1.5, cy + (Math.random() * 2 - 1) * geom.h * 0.9, { jag: 9, life: 0.3 });
      fx.burst(cx, cy, 80, { speed: 360, life: 0.9, colors: ['200,230,255', '255,255,255', '140,180,255'] });
      audio.zap();
    }
    uiDirty = true;
  }
  function failPos() {
    if (fail.type === 'rf') {
      const s = fail.s;
      if (s.type === 'arc') {
        const p = PHYS.posAt(s, fail.tSim + fail.coast);
        const dx = s.cx - p.x, dy = s.cy - p.y, dl = Math.hypot(dx, dy) || 1;
        return { x: p.x, y: p.y, ux: p.ux, uy: p.uy, fx: dx / dl, fy: dy / dl, arc: true };
      }
      return { x: fail.x, y: fail.y, ux: fail.ux, uy: fail.uy, fx: 0, fy: 0, arc: false };
    }
    return { x: fail.x + fail.ux * fail.flyD, y: fail.y + fail.uy * fail.flyD, ux: fail.ux, uy: fail.uy, fx: 0, fy: 0, arc: false };
  }
  function updateFailure(now, dt) {
    const age = (now - fail.start) / 1000;
    if (fail.type === 'rf') {
      fail.coast += dt * 0.6 * run.T0;
      if (age < 0.9 && Math.random() < dt * 14) { const { cx, cy, h } = geom; fx.bolt(cx - geom.w * 1.4, cy + (Math.random() * 2 - 1) * h * 0.85, cx + geom.w * 1.4, cy + (Math.random() * 2 - 1) * h * 0.85, { jag: 8 }); if (Math.random() < 0.5) audio.spark(); }
    } else if (!fail.hit) {
      fail.flyD += dt * S.R * 0.9;
      const p = failPos(), Rw = S.R * 1.03;
      if (Math.hypot(p.x, p.y) >= Rw) { fail.hit = true; beamLoss(p.x, p.y, true, now); }
    }
    if (!fail.downShown && age > (fail.type === 'rf' ? 1.6 : 1.9)) { fail.downShown = true; showDown(); }
  }
  function showDown() {
    const t = fail.type, I = D.I, eng = PHYS.coilEngineering(S.coils, S.turns, I, S.R), lv = overLevels();
    let title, text, real;
    if (t === 'coil') {
      title = 'Coil burnout';
      text = `The coils carried ${pl(I, 4)} A, producing about ${si(eng.power, 'W')} of heat, far more than the cooling could remove. The copper overheated, the circuit failed and the magnetic field collapsed. With nothing to bend it, the particle flew straight into the chamber wall.`;
      real = 'In real machines, hollow water-cooled conductors carry the heat away, and temperature interlocks switch the power off long before anything melts. The smoke, sparks and explosion here are exaggerated, illustrative effects.';
    } else if (t === 'quench') {
      const Eb = lv.B * lv.B / (2 * C.mu0) * Math.PI * eng.rCoil * eng.rCoil * D.gap;
      title = 'Magnet quench';
      text = `At ${pl(lv.B, 3)} T the coils were pushed beyond what superconductors can carry. Part of a coil stopped superconducting (a quench): the field's stored energy, about ${si(Eb, 'J')} in this model, turned into heat in a moment and the field collapsed. The particle flew straight into the wall.`;
      real = 'Real example: on 19 September 2008 a faulty electrical connection between two LHC magnets caused an electrical arc that punctured the helium enclosure. About six tonnes of liquid helium escaped, magnets were damaged and their anchors in the concrete floor broke. The LHC was shut down for over a year of repairs. It was not a nuclear explosion: the danger is stored energy.';
    } else {
      title = 'RF spark-over';
      text = `${pl(S.Vkv, 4)} kV across the gap gave an electric field of about ${e(S.Vkv * 1e3 / GAP_NOMINAL, 2)} V/m. Sparks jumped between the dees, the RF system tripped and the gap stopped pushing. The magnetic field still works, so the particle now coasts round the same circle forever.`;
      real = 'Real cyclotrons condition their dees slowly and run with tens to a few hundred kilovolts. Protective interlocks switch the RF off when a spark is detected. The lightning here is an illustrative effect.';
    }
    $('#downTitle').textContent = title; $('#downText').textContent = text; $('#downReal').textContent = real;
    $('#labDown').hidden = false;
    $('#btnRepair').focus({ preventScroll: true });
  }
  function repair() {
    const type = fail ? fail.type : null;
    fail = null; $('#labDown').hidden = true; $('#labAlarm').classList.remove('is-on'); stress = 0; hotSpot = null;
    let msg = 'Machine repaired.';
    if (type === 'rf') { S.Vkv = Math.min(S.Vkv, 200); msg = `Machine repaired: the dee voltage was reduced to ${pl(S.Vkv, 3)} kV.`; }
    else if (type) {
      if (S.fieldInput === 'current') S.current = Math.min(S.current, 50);
      else S.targetB = Math.min(S.targetB, 1.0);
      msg = `Machine repaired: the ${S.fieldInput === 'current' ? 'coil current was reduced to ' + pl(S.current, 3) + ' A' : 'field was reduced to ' + pl(S.targetB, 3) + ' T'}.`;
    }
    markCustom();
    buildRun(); syncControls(); setPlaying(false);
    showToast(`<b>${msg}</b><br>Push the settings up again to test the limits, or switch overload mode off.`, '', 7000);
  }

  /* ------------------------------------------------------------------
     Replay (0.1×)
     ------------------------------------------------------------------ */
  function startReplay() {
    if (!runEnded() || fail) return;
    const segs = run.segs;
    let nArc = 0, tStart = 0;
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i].type === 'arc' && segs[i].t1 > segs[i].t0) { nArc++; if (nArc >= 4) { tStart = segs[i].t0; break; } }
    }
    replay = { tStart, endAt: 0 };
    playT = tStart; lastKi = kickIndexAt(playT); floaters = [];
    wallFx = extFx = targetFx = false; hotSpot = null;
    trailDirty = true;
    $('#labLetterbox').classList.add('is-on');
    setText('lbInfo', 'final orbits');
    hideToast();
    setPlaying(true);
    audio.whoosh();
  }
  function endReplay(quiet) {
    if (!replay && !quiet) return;
    replay = null;
    const lb = $('#labLetterbox'); if (lb) lb.classList.remove('is-on');
  }

  /* ------------------------------------------------------------------
     Chaos actions
     ------------------------------------------------------------------ */
  function pushLiveField() {
    if (!isLiveRunning()) return false;
    const B0 = Math.abs(run.P.B);
    run.mult = S.chaosMult * (B0 > 0 ? D.Bmag / B0 : 0);
    run.flip = chaosFlip * (Math.sign(D.Bz) === Math.sign(run.P.B) ? 1 : -1);
    run.restart();
    run.tLimit = Math.max(run.tLimit, run.t + 300 * run.T0);
    staticDirty = true; uiDirty = true;
    return true;
  }
  function flipField() {
    if (!S.chaos) return;
    if (!isLiveRunning()) buildRun();
    if (!isLiveRunning()) { showToast('<b>Chaos needs a magnetic field.</b> Give the coils some current first.', 'warn', 5000); return; }
    chaosFlip *= -1; stats.flips++;
    pushLiveField();
    const st = stateAt(playT);
    fx.flash(0.35, '170,150,255'); fx.ring(X(st.x), Y(st.y), { speed: 260, life: 0.6, color: '200,180,255' });
    audio.zap(); shake.kick(4, 0.3);
    floaters.push({ x: st.x, y: st.y, born: performance.now(), life: 1.6, text: 'B flipped!', bg: 'rgba(169,155,255,0.95)', fg: '#0d0630', big: true });
    if (!playing) setPlaying(true);
  }
  function nudge() {
    if (!S.chaos) return;
    if (!isLiveRunning()) buildRun();
    if (!isLiveRunning()) return;
    run.nudge(12); stats.nudges++;
    run.tLimit = Math.max(run.tLimit, run.t + 300 * run.T0);
    const st = stateAt(playT);
    fx.burst(X(st.x), Y(st.y), 18, { speed: 160, life: 0.5, color: '255,120,200' });
    audio.beep(880, 0.08);
    floaters.push({ x: st.x, y: st.y, born: performance.now(), life: 1.2, text: 'nudged 12°', bg: 'rgba(255,79,163,0.95)', fg: '#1a0010' });
    uiDirty = true;
    if (!playing) setPlaying(true);
  }

  /* ------------------------------------------------------------------
     Controls
     ------------------------------------------------------------------ */
  const limitsFor = key => { const c = SL[key]; return [c.min, S.over && c.over ? c.over : c.max]; };
  const tl = v => String(+v.toPrecision(4)).replace('-', '−');
  function setTicks(key) { const [lo, hi] = limitsFor(key); ctls[key].ticks.innerHTML = `<span>${tl(lo)}</span><span>${tl(hi)}</span>`; }
  function bindSliders() {
    for (const [key, cfg] of Object.entries(SL)) {
      const r = $('#r-' + key), n = $('#n-' + key);
      if (!r) continue;
      const u = n && n.parentElement.querySelector('.ctl-unit'); if (u) u.textContent = cfg.unit;
      const ticks = document.createElement('div'); ticks.className = 'ctl-ticks'; r.after(ticks);
      const c = bindRange({ range: r, num: n, min: cfg.min, max: cfg.max, step: cfg.step, int: cfg.int, log: cfg.log, get: () => S[key], set: v => setParam(key, v) });
      c.ticks = ticks;
      ctls[key] = c;
      setTicks(key);
    }
  }
  function applyLimits() {
    for (const key of Object.keys(SL)) {
      const [lo, hi] = limitsFor(key);
      if (S[key] > hi) S[key] = hi;
      if (S[key] < lo) S[key] = lo;
      ctls[key].setLimits(lo, hi);
      setTicks(key);
    }
  }
  function markCustom() { if (S.preset !== 'custom') { S.preset = 'custom'; syncPreset(); } }
  function setParam(key, v) {
    const [lo, hi] = limitsFor(key);
    v = clamp(v, lo, hi); if (SL[key] && SL[key].int) v = Math.round(v);
    if (S[key] === v) return;
    S[key] = v;
    if (key === 'chaosMult' || key === 'chaosFlicker') {
      if (isLiveRunning()) {
        if (key === 'chaosMult') { stats.changes++; pushLiveField(); }
        else run.setFlicker(S.chaosFlicker / 100);
        refreshStaticUI(); syncControls();
      } else if (S.chaos) afterChange();
      return;
    }
    markCustom();
    if (isLiveRunning() && LIVE_KEYS.includes(key)) {
      D = derived(); pred = PHYS.predictions(D.P);
      if (key === 'Vkv') run.setVoltage(S.Vkv * 1e3);
      else { stats.changes++; pushLiveField(); }
      refreshStaticUI(); syncControls(); checkMissionsNow();
      return;
    }
    afterChange();
  }
  function afterChange() {
    const wasPlaying = playing;
    if (fail) { fail = null; $('#labDown').hidden = true; $('#labAlarm').classList.remove('is-on'); }
    buildRun();
    if (wasPlaying) setPlaying(true);
    syncControls();
    checkMissionsNow();
  }
  function checkMissionsNow() { if (!run) return; const fresh = checkMissions(stateAt(playT)); if (fresh.length) showToast(`<b>Mission complete: ${fresh.map(m => m.title).join(', ')}</b>`, '', 6000); }

  function setSeg(id, value) { for (const b of $$('#' + id + ' button')) b.setAttribute('aria-checked', String(b.dataset.value === value)); }
  function syncPreset() {
    const sel = $('#labPreset');
    if (sel.value !== S.preset) sel.value = S.preset;
    $('#presetNote').textContent = (PRESETS[S.preset] || {}).note || '';
  }
  function syncControls() {
    for (const key of Object.keys(ctls)) ctls[key].sync();
    setSeg('fieldInput', S.fieldInput);
    $('#ctl-current').hidden = S.fieldInput !== 'current';
    $('#ctl-targetB').hidden = S.fieldInput !== 'field';
    $('#dirCW').setAttribute('aria-checked', String(S.dir === 'cw'));
    $('#dirCCW').setAttribute('aria-checked', String(S.dir === 'ccw'));
    setSeg('rfMode', S.rfMode);
    setSeg('trailMode', S.trail);
    setSeg('trailPal', S.pal);
    $('#relToggle').checked = S.rel;
    for (const b of $$('#particleGrid button')) b.setAttribute('aria-checked', String(b.dataset.key === S.particle));
    $('#customBox').hidden = S.particle !== 'custom';
    const cm = $('#n-customMassU'), cz = $('#n-customZ');
    if (document.activeElement !== cm) cm.value = S.customMassU;
    if (document.activeElement !== cz) cz.value = S.customZ;
    for (const c of $$('#showChecks input')) c.checked = !!S.show[c.dataset.show];
    for (const r of $$('input[name="speed"]')) r.checked = r.value === S.speed;
    $('#selA').value = S.graphA; $('#selB').value = S.graphB;
    for (const b of $$('#screen-lab .tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === S.tab));
    $('#workingToggle').checked = S.working;
    $('#screen-lab .data').classList.toggle('no-working', !S.working);
    $('#dataBody').hidden = S.tab === 'notebook';
    $('#notebook').hidden = S.tab !== 'notebook';
    $('#chaosToggle').checked = S.chaos; $('#chaosBox').hidden = !S.chaos;
    $('#chaosAutoRF').checked = S.chaosAutoRF;
    $('#overToggle').checked = S.over; $('#overBox').hidden = !S.over;
    const pillTxt = S.chaos && S.over ? 'chaos + overload' : S.chaos ? 'chaos' : S.over ? 'overload' : 'off';
    setText('accExpPill', pillTxt);
    $('#accExpPill').classList.toggle('acc-pill-hot', S.chaos || S.over);
    $('#toolTape').checked = tools.tape; $('#toolWatch').checked = tools.watch; $('#toolProbe').checked = tools.probe;
    $('#stopwatch').hidden = !tools.watch;
    syncPreset();
  }

  function refreshStaticUI() {
    const realism = PHYS.fieldRealism(D.Bmag);
    $('#moLabel').textContent = S.fieldInput === 'current' ? 'Field in the gap' : 'Current needed';
    $('#moVal').textContent = S.fieldInput === 'current' ? pl(D.Bmag, 4) + ' T' : pl(D.I, 4) + ' A';
    const chip = $('#realismChip');
    chip.textContent = realism.label; chip.className = 'chip ' + realism.level; chip.title = realism.text;
    $('#moFormula').textContent = S.fieldInput === 'current'
      ? `B = μ₀NI/g = (4π×10⁻⁷)(${D.N})(${pl(D.I, 4)} A)/(${pl(D.gap, 3)} m) = ${pl(D.Bmag, 4)} T`
      : `I = Bg/(μ₀N) = (${pl(D.Bmag, 4)} T)(${pl(D.gap, 3)} m)/((4π×10⁻⁷)(${D.N})) = ${pl(D.I, 4)} A`;
    $('#accB').textContent = pl(D.Bmag, 3) + ' T';
    $('#accAcc').textContent = `R ${pl(S.R, 3)} m, ${pl(S.Vkv, 3)} kV`;
    $('#accPart').textContent = D.part.symbol;
    $('#particleNote').textContent = D.part.note;
    $('#legSym').textContent = D.Bmag < 1e-9 ? '·' : D.Bz < 0 ? '⊗' : '⊙';
    $('#legField').textContent = D.Bmag < 1e-9 ? 'B = 0 (no current)' : `B = ${pl(D.Bmag, 3)} T ${D.Bz < 0 ? 'into' : 'out of'} the screen`;
    refreshLegend();
    drawSideView($('#sideView'));
    if (S.over) updateMeters();
    dataCache.ids = '';
    CL.bus.emit('lab-changed');
  }
  function refreshLegend() {
    const box = $('#legend .leg-scale');
    box.hidden = S.trail === 'plain' || !S.show.trail;
    if (box.hidden) return;
    $('#legBar').style.background = palette(S.pal).css;
    let max, u, title;
    if (S.trail === 'speed') { u = powUnit(vref, 'm/s'); max = vref; title = 'Trail colour = speed v (' + u.u + ')'; }
    else { u = energyUnit(Kref); max = Kref; title = 'Trail colour = kinetic energy K (' + u.u + ')'; }
    $('#legTitle').textContent = title;
    const top = max / u.f;
    const ticks = niceTicks(0, top, 4).filter(v => v <= top * 0.999);
    const parts = ticks.map(v => `<span style="left:${(v / top * 100).toFixed(2)}%">${tickLabel(v)}</span>`);
    if (!ticks.length || ticks[ticks.length - 1] < top * 0.86) parts.push(`<span style="left:100%"><b>${pl(top, 3)}</b></span>`);
    $('#legTicks').innerHTML = parts.join('');
  }

  function buildParticleGrid() {
    const keys = ['proton', 'deuteron', 'alpha', 'carbon', 'electron', 'positron', 'custom'];
    const grid = $('#particleGrid');
    grid.innerHTML = keys.map(k => {
      const p = k === 'custom' ? { symbol: 'X', name: 'Custom', color: '#66d9e8' } : PHYS.PARTICLES[k];
      const nm = k === 'alpha' ? 'Alpha' : k === 'carbon' ? 'Carbon ion' : p.name;
      return `<button type="button" class="pbtn-part" role="radio" data-key="${k}"><span class="dot" style="background:${p.color};color:${p.color}"></span><span class="sym">${p.symbol}</span><span class="nm">${nm}</span></button>`;
    }).join('');
    grid.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-key]'); if (!b) return;
      S.particle = b.dataset.key; markCustom(); afterChange();
    });
  }
  function buildPresets() {
    const sel = $('#labPreset');
    sel.innerHTML = Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
    sel.addEventListener('change', () => loadPreset(sel.value));
  }
  function loadPreset(key) {
    const pr = PRESETS[key];
    if (!pr || key === 'custom') { syncPreset(); return; }
    for (const k of PHYS_KEYS) S[k] = DEFAULTS[k];
    S.over = !!pr.over; S.chaos = false;
    applyLimits();
    Object.assign(S, pr.set);
    S.preset = key;
    view.zoom = 1; view.panX = view.panY = 0; view.autoZoom = false; view.follow = false; syncZoomKey();
    fail = null; $('#labDown').hidden = true;
    applyLimits();
    buildRun(); syncControls();
    tape = { a: { x: 0, y: 0 }, b: { x: S.R, y: 0 } };
    setPlaying(!reduceMotion);
    audio.beep(520, 0.08);
  }

  function setPlaying(on) {
    playing = !!(on && run && !fail && (isLiveRunning() || playT < run.tEnd));
    const b = $('#btnPlay');
    b.classList.toggle('is-playing', playing);
    b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    uiDirty = true;
    if (!playing && alarmOn) { alarmOn = false; $('#labAlarm').classList.remove('is-on'); audio.alarm(false); }
  }
  function togglePlay() {
    audio.unlock();
    if (fail) return;
    if (replay && !playing && playT >= run.tEnd - 1e-18) endReplay();
    if (!playing && !isLiveRunning() && playT >= run.tEnd - 1e-18) {
      if (live) { buildRun(); setPlaying(true); return; }
      playT = 0; endShown = false; hideToast(); lastKi = kickIndexAt(0); hotSpot = null;
    }
    setPlaying(!playing);
  }
  function restart() {
    audio.unlock();
    if (fail) { repair(); return; }
    endReplay();
    if (live) { buildRun(); setPlaying(true); return; }
    playT = 0; endShown = false; hideToast(); trailDirty = true; lastKi = kickIndexAt(0); hotSpot = null; wallFx = extFx = targetFx = false;
    setPlaying(true);
  }
  function step() {
    if (fail) return;
    endReplay(); setPlaying(false);
    const before = kickIndexAt(playT);
    advance(1 / 12);
    if (kickIndexAt(playT) !== before) lastKi = before;
    uiDirty = true;
  }
  function skipToEnd() {
    if (fail) return;
    endReplay();
    if (isLiveRunning()) { skipping = true; setPlaying(true); return; }
    setPlaying(false); playT = run.tEnd; uiDirty = true;
  }

  /* notebook */
  const NB_COLS = ['#', 'Particle', 'B (T)', 'R (m)', 'V (kV)', 'RF', 'Relativity', 'Mode', 'Result', 'K (MeV)', 'v / c', 'Revolutions', 'Time'];
  function recordRun() {
    const st = stateAt(playT), ended = runEnded();
    const K = ended ? (run.status === 'lost' ? run.Kpeak : run.Kfinal) : st.K;
    const v = PHYS.kin(K, D.m, S.rel).v;
    const row = [
      notebook.length + 1, D.part.symbol, pl(D.Bmag, 4), pl(S.R, 3), pl(S.Vkv, 4),
      S.rfMode === 'fm' ? 'follows particle' : 'fixed' + (S.detunePct ? ` ${S.detunePct > 0 ? '+' : '−'}${pl(Math.abs(S.detunePct), 3)} %` : ''),
      S.rel ? 'on' : 'off', live ? 'chaos' : 'normal',
      ended ? ({ extracted: 'extracted', lost: 'lost step (peak)', wall: 'hit wall', limit: 'stopped', nofield: 'no field' }[run.status] || run.status) : 'still running',
      pl(K / C.MeV, 4), pl(v / C.c, 4), pl(ended ? run.revs : st.revs, 4), si(ended ? run.tStop : playT, 's', 4),
    ];
    notebook.push(row); store.set('cl-notebook', notebook);
    renderNotebook();
    showToast(`<b>Run ${row[0]} recorded</b> in the Notebook tab: ${row[1]}, ${row[8]}, ${row[9]} MeV.`, '', 5000);
    audio.beep(760, 0.08);
  }
  function renderNotebook() {
    const tb = $('#nbTable');
    if (!notebook.length) { tb.innerHTML = '<tbody><tr><td>No runs recorded yet.</td></tr></tbody>'; return; }
    tb.innerHTML = '<thead><tr>' + NB_COLS.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
      notebook.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody>';
  }
  function copyNotebook() {
    const tsv = [NB_COLS.join('\t'), ...notebook.map(r => r.join('\t'))].join('\n');
    const done = ok => { $('#nbMsg').textContent = ok ? `Copied ${notebook.length} row${notebook.length === 1 ? '' : 's'}: paste into a spreadsheet.` : 'Copy was blocked: select the table and press Ctrl+C.'; setTimeout(() => { $('#nbMsg').textContent = ''; }, 4000); };
    const fallback = () => {
      try {
        const ta = document.createElement('textarea'); ta.value = tsv; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); done(ok);
      } catch (_) { done(false); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).then(() => done(true), fallback);
    else fallback();
  }

  /* tools */
  function drawTape(ctx) {
    const ax = X(tape.a.x), ay = Y(tape.a.y), bx = X(tape.b.x), by = Y(tape.b.y);
    const L = Math.hypot(bx - ax, by - ay);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    if (L > 4) {
      const ux = (bx - ax) / L, uy = (by - ay) / L, step = clamp(L / 20, 4, 14);
      ctx.strokeStyle = '#7a5600'; ctx.lineWidth = 1;
      for (let d = step; d < L; d += step) { const x = ax + ux * d, y = ay + uy * d; ctx.beginPath(); ctx.moveTo(x - uy * 3, y + ux * 3); ctx.lineTo(x + uy * 3, y - ux * 3); ctx.stroke(); }
    }
    for (const [x, y] of [[ax, ay], [bx, by]]) {
      ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = '#3d2b00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
    }
    const dist = Math.hypot(tape.b.x - tape.a.x, tape.b.y - tape.a.y);
    pill(ctx, len(dist, 4), (ax + bx) / 2, (ay + by) / 2 - 16, '#ffd43b', '#231a00', '700 13.5px "Barlow Condensed", "Arial Narrow", sans-serif');
    ctx.restore();
  }
  function bindPointer() {
    let drag = null, pinch = null;
    const pts = new Map();
    const local = ev => { const r = viewCv.getBoundingClientRect(); return { sx: ev.clientX - r.left, sy: ev.clientY - r.top }; };
    const pinchInfo = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), mx: (a.sx + b.sx) / 2, my: (a.sy + b.sy) / 2 }; };
    // mouse wheel / trackpad pinch (ctrl + wheel) zooms about the cursor
    viewCv.addEventListener('wheel', ev => {
      if (pov.on) return;
      const st = $('#stage'), docScrolls = document.scrollingElement && document.scrollingElement.scrollHeight > window.innerHeight + 4;
      const stageScrolls = st.scrollHeight > st.clientHeight + 4;
      if (!(ev.ctrlKey || ev.metaKey) && (docScrolls || stageScrolls)) return;   // let the page scroll
      ev.preventDefault();
      const { sx, sy } = local(ev);
      const k = ev.deltaMode === 1 ? 0.05 : ev.deltaMode === 2 ? 1 : 0.0016 * (ev.ctrlKey ? 5 : 1);
      view.follow = false; zoomAt(view.zoom * Math.exp(-clamp(ev.deltaY, -300, 300) * k), sx, sy);
    }, { passive: false });
    viewCv.addEventListener('pointerdown', ev => {
      audio.unlock();
      const { sx, sy } = local(ev);
      pts.set(ev.pointerId, { sx, sy });
      try { viewCv.setPointerCapture(ev.pointerId); } catch (_) { /* ignore */ }
      if (pts.size === 2) { tapeDrag = null; drag = null; viewCv.classList.remove('is-dragging'); const p = pinchInfo(); pinch = { d0: Math.max(p.d, 1), z0: view.zoom }; return; }
      if (pts.size > 2) return;
      if (pov.on) { pov.drag = { x: ev.clientX, y: ev.clientY, yaw0: pov.yaw, pitch0: pov.pitch }; viewCv.classList.add('is-dragging'); return; }
      if (tools.tape && tape) {
        for (const end of ['a', 'b']) {
          if (Math.hypot(sx - X(tape[end].x), sy - Y(tape[end].y)) < 14) { tapeDrag = end; viewCv.setPointerCapture(ev.pointerId); return; }
        }
      }
      if (pts.size === 1 && rimHit(sx, sy)) { rim = { id: ev.pointerId }; rimLock = true; viewCv.setPointerCapture(ev.pointerId); viewCv.classList.add('is-rim'); return; }
      if (view.zoom <= 1) return;
      view.follow = false;
      drag = { x: ev.clientX, y: ev.clientY, px: view.panX, py: view.panY };
      viewCv.setPointerCapture(ev.pointerId); viewCv.classList.add('is-dragging');
    });
    viewCv.addEventListener('pointermove', ev => {
      const { sx, sy } = local(ev);
      if (pts.has(ev.pointerId)) pts.set(ev.pointerId, { sx, sy });
      if (pov.on) { if (pov.drag) { pov.yaw = clamp(pov.drag.yaw0 - (ev.clientX - pov.drag.x) * 0.006, -2.6, 2.6); pov.pitch = clamp(pov.drag.pitch0 - (ev.clientY - pov.drag.y) * 0.004, -0.9, 0.7); } return; }
      if (pinch && pts.size >= 2) { const p = pinchInfo(); view.follow = false; zoomAt(pinch.z0 * p.d / pinch.d0, p.mx, p.my); return; }
      if (tapeDrag) { const p = toPhys(sx, sy); tape[tapeDrag] = p; return; }
      if (rim) { rimMove(sx, sy); return; }
      if (!drag && !pinch) { const near = rimHit(sx, sy); if (near !== rimHover) { rimHover = near; viewCv.classList.toggle('is-rim', near); } }
      if (drag) {
        view.panX = drag.px - (ev.clientX - drag.x) / sc(); view.panY = drag.py + (ev.clientY - drag.y) / sc();
        staticDirty = trailDirty = true;
      }
      if (tools.tape && tape) {
        const near = ['a', 'b'].some(end => Math.hypot(sx - X(tape[end].x), sy - Y(tape[end].y)) < 14);
        viewCv.classList.toggle('is-tape', near);
      }
      if (tools.probe) { probePos = { sx, sy }; updateProbe(); }
    });
    const end = ev => { pts.delete(ev.pointerId); if (pts.size < 2) pinch = null; drag = null; tapeDrag = null; pov.drag = null; viewCv.classList.remove('is-dragging'); if (rim) rimEnd(); };
    viewCv.addEventListener('pointerup', end); viewCv.addEventListener('pointercancel', end);
    viewCv.addEventListener('pointerleave', () => { probePos = null; $('#probe').hidden = true; if (rimHover && !rim) { rimHover = false; viewCv.classList.remove('is-rim'); } });
  }
  // drag the edge of the dees to change the dee radius R
  function rimHit(sx, sy) { if (tools.tape || fail || pov.on || (v3 && v3.on)) return false; const d = Math.hypot(sx - X(0), sy - Y(0)); return Math.abs(d - S.R * sc()) < 12; }
  function rimBadge(final) {
    const p = PHYS.predictions(D.P);
    CL.sizeBadge($('#stageWrap'), `R = ${len(S.R, 3)}`, `top energy ${en(p.Kmax, 3)}${final ? '' : ', release to keep'}`, final ? 1600 : 0);
  }
  function rimMove(sx, sy) {
    const [lo, hi] = limitsFor('R');
    rimPending = clamp(Math.round(Math.hypot(sx - X(0), sy - Y(0)) / sc() / 0.005) * 0.005, lo, hi);
    if (rim.raf) return;
    rim.raf = requestAnimationFrame(() => { if (!rim) return; rim.raf = 0; if (rimPending !== null && rimPending !== S.R) { setParam('R', rimPending); staticDirty = trailDirty = true; } rimBadge(false); });
  }
  function rimEnd() {
    if (rim && rim.raf) cancelAnimationFrame(rim.raf);
    if (rimPending !== null && rimPending !== S.R) setParam('R', rimPending);
    rim = null; rimPending = null; rimLock = false; viewCv.classList.remove('is-rim');
    setupView(); staticDirty = trailDirty = true; uiDirty = true; rimBadge(true);
    if (CL.missions) CL.bus.emit('lab-changed');
  }
  function updateProbe() {
    const el = $('#probe');
    if (!tools.probe || !probePos) { el.hidden = true; return; }
    const p = toPhys(probePos.sx, probePos.sy), r = Math.hypot(p.x, p.y);
    const gapHalf = (geom.w / 2) / sc();
    const st = stateAt(playT);
    const Bnow = live ? Math.abs(st.s.Bz || 0) : D.Bmag, Bsign = live ? Math.sign(st.s.Bz || 0) : Math.sign(D.Bz);
    let region, Btxt, Etxt;
    const coilDead = fail && fail.type !== 'rf';
    if (r > S.R * 1.06) { region = r > S.R * 1.1 && r < S.R * 1.26 ? 'Copper coils' : 'Outside the chamber (iron yoke)'; Btxt = 'B: inside the iron, not in the beam region'; Etxt = ''; }
    else {
      region = Math.abs(p.x) < gapHalf ? 'Accelerating gap' : p.x > 0 ? 'Inside Dee 1 (right)' : 'Inside Dee 2 (left)';
      Btxt = coilDead ? 'B = 0 T (field lost)' : `B = ${pl(Bnow, 4)} T ${Bsign < 0 ? '⊗ into' : Bsign > 0 ? '⊙ out of' : ''} the screen`;
      if (Math.abs(p.x) < gapHalf) {
        const ph = rfPhase(playT), Vn = fail && fail.type === 'rf' ? 0 : S.Vkv * 1e3 * Math.cos(PHYS.wrap(ph + (D.q < 0 ? Math.PI : 0)));
        Etxt = `E ≈ ${e(Math.abs(Vn) / GAP_NOMINAL, 3)} V/m ${Vn >= 0 ? '→' : '←'} (now)`;
      } else Etxt = 'E = 0 (no electric field inside a dee)';
    }
    el.innerHTML = `<b>${region}</b><br>x = ${len(p.x, 3)}, y = ${len(p.y, 3)}<br>distance from centre ${len(r, 3)}<br>${Btxt}${Etxt ? '<br>' + Etxt : ''}`;
    el.hidden = false;
    const W = view.size, bw = el.offsetWidth || 200, bh = el.offsetHeight || 80;
    el.style.left = clamp(probePos.sx + 16, 4, W - bw - 4) + 'px';
    el.style.top = clamp(probePos.sy + 16, 4, W - bh - 4) + 'px';
  }
  function bindStopwatch() {
    const box = $('#stopwatch'), head = $('#swHead');
    let d = null;
    head.addEventListener('pointerdown', ev => { d = { x: ev.clientX, y: ev.clientY, l: box.offsetLeft, t: box.offsetTop }; head.setPointerCapture(ev.pointerId); });
    head.addEventListener('pointermove', ev => {
      if (!d) return;
      box.style.left = clamp(d.l + ev.clientX - d.x, 0, view.size - box.offsetWidth) + 'px';
      box.style.top = clamp(d.t + ev.clientY - d.y, 0, view.size - box.offsetHeight) + 'px';
    });
    head.addEventListener('pointerup', () => { d = null; });
    $('#swStart').addEventListener('click', () => {
      if (sw.running) { sw.acc += Math.max(0, playT - sw.t0); sw.running = false; }
      else { sw.t0 = playT; sw.running = true; }
      $('#swStart').textContent = sw.running ? 'Stop' : 'Start';
      audio.beep(sw.running ? 990 : 660, 0.06);
    });
    $('#swReset').addEventListener('click', () => { sw.acc = 0; sw.t0 = playT; $('#swTime').textContent = '0 s'; });
  }
  function updateStopwatch() {
    if (!tools.watch) return;
    const t = sw.acc + (sw.running ? Math.max(0, playT - sw.t0) : 0);
    setText('swTime', si(t, 's', 4));
  }

  function bindControls() {
    bindSliders();
    $('#fieldInput').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b || b.dataset.value === S.fieldInput) return;
      if (b.dataset.value === 'field') S.targetB = +clamp(D.Bmag, 0, limitsFor('targetB')[1]).toFixed(3);
      else S.current = +clamp(D.I, 0, limitsFor('current')[1]).toFixed(2);
      S.fieldInput = b.dataset.value; afterChange();
    });
    const setDir = d => {
      if (S.dir === d) return;
      S.dir = d; markCustom();
      if (isLiveRunning()) { D = derived(); pred = PHYS.predictions(D.P); stats.flips++; pushLiveField(); refreshStaticUI(); syncControls(); return; }
      afterChange();
    };
    $('#dirCW').addEventListener('click', () => setDir('cw'));
    $('#dirCCW').addEventListener('click', () => setDir('ccw'));
    $('#rfMode').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; S.rfMode = b.dataset.value; markCustom(); afterChange(); });
    $('#relToggle').addEventListener('change', ev => { S.rel = ev.target.checked; markCustom(); afterChange(); });
    $('#n-customMassU').addEventListener('change', ev => { const v = parseFloat(ev.target.value); S.customMassU = isFinite(v) ? clamp(v, 0.0005, 300) : S.customMassU; markCustom(); afterChange(); });
    $('#n-customZ').addEventListener('change', ev => { let v = Math.round(parseFloat(ev.target.value)); if (!isFinite(v) || v === 0) v = 1; S.customZ = clamp(v, -10, 10); markCustom(); afterChange(); });
    for (const c of $$('#showChecks input')) c.addEventListener('change', () => { S.show[c.dataset.show] = c.checked; staticDirty = true; trailDirty = true; refreshLegend(); });
    $('#trailMode').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; S.trail = b.dataset.value; trailDirty = true; refreshLegend(); syncControls(); });
    $('#trailPal').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; S.pal = b.dataset.value; trailDirty = true; refreshLegend(); syncControls(); });

    $('#btnPlay').addEventListener('click', togglePlay);
    $('#btnRide').addEventListener('click', () => { audio.unlock(); setRide(!pov.on); });
    $('#btnRestart').addEventListener('click', restart);
    $('#btnStep').addEventListener('click', step);
    $('#btnSkip').addEventListener('click', skipToEnd);
    $('#btnReplay').addEventListener('click', startReplay);
    $('#btnRecord').addEventListener('click', recordRun);
    for (const r of $$('input[name="speed"]')) r.addEventListener('change', () => { if (r.checked) { S.speed = r.value; endReplay(); uiDirty = true; } });
    $('#scrub').addEventListener('input', ev => {
      if (isLiveRunning() || fail) return;
      endReplay(); setPlaying(false); playT = run.tEnd * (+ev.target.value) / 1000; lastKi = kickIndexAt(playT); uiDirty = true;
    });

    $('#zoomIn').addEventListener('click', () => zoomKey(CL.zoom.step(view.zoom, 1, 1, 128)));
    $('#zoomOut').addEventListener('click', () => zoomKey(CL.zoom.step(view.zoom, -1, 1, 128)));
    $('#zoomFit').addEventListener('click', () => zoomKey(CL.zoom.cycle(view.zoom)));
    syncZoomKey();
    bindPointer();
    v3 = CL.V3.attach($('#stageWrap'), { home: { yaw: -1.05, pitch: 0.7, dist: 1, target: [0, 0, 0], fov: 44, minDist: 0.01 }, storeKey: 'cl-3d-lab',
      full: { bar: () => $('#screen-lab .timebar'), onChange: () => layout() },
      onToggle: on => { if (on) { lid = 0; if (pov.on) setRide(false); } else { staticDirty = trailDirty = true; setTimeout(syncZoomKey, 0); } uiDirty = true; if (v3 && v3.full) layout(); } });
    // drag the corner of the view, or the divider next to it, to resize the machine view
    const resizer = axis => ({
      axis,
      get: () => view.size,
      set: (v, dragging) => {
        userSize = Math.round(v); layout(); userSize = view.size;
        if (!dragging) store.set('cl-stage-size', userSize);
        CL.sizeBadge($('#stageWrap'), `${view.size} × ${view.size} px`, dragging ? 'release to keep this size' : 'double-click to go back to automatic size', dragging ? 0 : 1400);
      },
      reset: () => { userSize = 0; store.set('cl-stage-size', 0); layout(); CL.sizeBadge($('#stageWrap'), `${view.size} × ${view.size} px`, 'automatic size (fits the screen)'); },
    });
    CL.grip($('#stageGrip'), resizer('xy'));
    CL.grip($('#labSplit'), resizer('x'));

    for (const [id, key] of [['selA', 'graphA'], ['selB', 'graphB']]) {
      const sel = $('#' + id);
      sel.innerHTML = GRAPH_OPTS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
      sel.addEventListener('change', () => { S[key] = sel.value; });
    }
    $('#btnPin').addEventListener('click', () => {
      ghost = { run, D, label: `Dashed grey: ${D.part.symbol}, B = ${pl(D.Bmag, 3)} T, R = ${pl(S.R, 3)} m, V = ${pl(S.Vkv, 3)} kV${S.rfMode === 'fm' ? ', RF follows' : ''}${live ? ', chaos' : ''}` };
      $('#btnUnpin').hidden = false; $('#ghostLabel').textContent = ghost.label + '. Now change a setting.'; staticDirty = true;
    });
    $('#btnUnpin').addEventListener('click', () => { ghost = null; $('#btnUnpin').hidden = true; $('#ghostLabel').textContent = ''; staticDirty = true; });
    for (const b of $$('#screen-lab .tabs button')) b.addEventListener('click', () => { S.tab = b.dataset.tab; syncControls(); uiDirty = true; if (S.tab === 'notebook') renderNotebook(); });
    $('#workingToggle').addEventListener('change', ev => { S.working = ev.target.checked; syncControls(); });
    $('#labToast .toast-close').addEventListener('click', hideToast);
    $('#btnResetAll').addEventListener('click', () => {
      const keepSkinPrefs = { trail: S.trail, pal: S.pal };
      S = clone(DEFAULTS); Object.assign(S, keepSkinPrefs);
      ghost = null; $('#btnUnpin').hidden = true; $('#ghostLabel').textContent = '';
      view.zoom = 1; view.panX = view.panY = 0; view.autoZoom = false; view.follow = false; syncZoomKey();
      fail = null; $('#labDown').hidden = true; $('#labAlarm').classList.remove('is-on');
      applyLimits(); buildRun(); syncControls(); setPlaying(false);
      tape = { a: { x: 0, y: 0 }, b: { x: S.R, y: 0 } };
    });

    // experiments
    $('#chaosToggle').addEventListener('change', ev => {
      S.chaos = ev.target.checked;
      if (S.chaos && D.Bmag < 1e-9) showToast('<b>Chaos needs a magnetic field.</b> Give the coils some current first.', 'warn', 6000);
      afterChange(); setPlaying(true);
      if (S.chaos) $('#accExp').open = true;
    });
    $('#btnFlip').addEventListener('click', flipField);
    $('#btnNudge').addEventListener('click', nudge);
    $('#chaosAutoRF').addEventListener('change', ev => { S.chaosAutoRF = ev.target.checked; if (isLiveRunning()) run.setAutoRF(S.chaosAutoRF || S.rfMode === 'fm'); uiDirty = true; });
    $('#overToggle').addEventListener('change', ev => {
      S.over = ev.target.checked;
      if (!S.over && fail) repair();
      applyLimits(); markCustom();
      if (!S.over) { stress = 0; alarmOn = false; $('#labAlarm').classList.remove('is-on'); audio.alarm(false); afterChange(); }
      else { syncControls(); updateMeters(); showToast('<b>Overload mode on.</b> The limits now go far beyond a real machine. Push the current, the field or the voltage up and press play. Explosions are illustrative.', 'hot', 8000); }
      dataCache.ids = '';
    });
    $('#btnRepair').addEventListener('click', repair);

    // tools
    $('#toolTape').addEventListener('change', ev => { tools.tape = ev.target.checked; if (!tape) tape = { a: { x: 0, y: 0 }, b: { x: S.R, y: 0 } }; });
    $('#toolWatch').addEventListener('change', ev => { tools.watch = ev.target.checked; $('#stopwatch').hidden = !tools.watch; });
    $('#toolProbe').addEventListener('change', ev => { tools.probe = ev.target.checked; if (!tools.probe) $('#probe').hidden = true; });
    bindStopwatch();
    $('#nbCopy').addEventListener('click', copyNotebook);
    $('#nbClear').addEventListener('click', () => { notebook = []; store.set('cl-notebook', notebook); renderNotebook(); });

    document.addEventListener('keydown', ev => {
      if (!active) return;
      const t = ev.target, tag = t.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      if (ev.key === ' ' && tag !== 'BUTTON' && tag !== 'SUMMARY') { ev.preventDefault(); togglePlay(); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); step(); }
      else if ((ev.key === 'v' || ev.key === 'V') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); audio.unlock(); setRide(!pov.on); }
    });
    CL.bus.on('mission', () => renderMissions());
    CL.bus.on('skin', () => { staticDirty = trailDirty = true; drawSideView($('#sideView')); });
  }

  function bindGraphs() {
    for (const [cid, key] of [['graphA', 'graphA'], ['graphB', 'graphB']]) {
      const cv = $('#' + cid);
      const G = { cv, ctx: cv.getContext('2d'), key, w: 0, h: 0, hover: null };
      cv.addEventListener('pointermove', ev => { const r = cv.getBoundingClientRect(); G.hover = ev.clientX - r.left; });
      cv.addEventListener('pointerleave', () => { G.hover = null; });
      graphs.push(G);
    }
  }

  /* ------------------------------------------------------------------
     Main loop hooks
     ------------------------------------------------------------------ */
  function frame(now, dt) {
    if (!run || !active) return;
    if (playing && !fail) {
      if (skipping) fastForward(); else advance(dt * speedRevs());
    }
    if (fail) updateFailure(now, dt);
    if (replay && playT >= run.tEnd - 1e-18) { if (!replay.endAt) replay.endAt = now; else if (now - replay.endAt > 1600) endReplay(); }
    detectEvents(now);
    if (S.over) updateOverload(now, dt);
    fx.update(dt); shake.update(now); shakeAll.update(now);
    const st = drawFrame(dt, now);
    for (const G of graphs) drawGraph(G, st);
    if (replay) setText('lbEnergy', `K = ${en(st.K, 4)} · v = ${e(st.v, 3)} m/s (${pct(st.v / C.c, 3)} of c) · F = ${e(D.absq * st.v * st.B, 3)} N`);
    updateStopwatch();
    if (tools.probe && probePos && !pov.on && !(v3 && v3.on)) updateProbe();
    if (uiDirty || now - lastUI > 110) {
      updateLive(st); renderData(st); lastUI = now; uiDirty = false;
      if (!endShown && runEnded() && !fail) onRunEnd();
      else if (playing || playT > 0) { const fresh = checkMissions(st); if (fresh.length) { showToast(`<b>Mission complete: ${fresh.map(m => m.title).join(', ')}</b>`, '', 6000); audio.fanfare(); } }
    }
  }

  function init() {
    viewCv = $('#view'); viewCtx = viewCv.getContext('2d');
    staticCv = document.createElement('canvas'); staticCtx = staticCv.getContext('2d');
    trailCv = document.createElement('canvas'); trailCtx = trailCv.getContext('2d');
    shake = shaker($('#stageWrap')); shakeAll = shaker($('#screen-lab .lab'));
    buildParticleGrid();
    buildPresets();
    bindControls();
    bindGraphs();
    renderMissions();
    renderNotebook();
    D = derived(); pred = PHYS.predictions(D.P); run = PHYS.computeRun(D.P);
    buildRun();
    syncControls();
  }
  function show() {
    active = true;
    requestAnimationFrame(() => {
      layout(); uiDirty = true;
      if (!started) {
        started = true;
        advance(Math.min(6, (run.revs || 0) * 0.32));
        lastKi = kickIndexAt(playT);
        setPlaying(!reduceMotion);
      }
    });
  }
  function hide() {
    active = false;
    if (alarmOn) { alarmOn = false; audio.alarm(false); $('#labAlarm').classList.remove('is-on'); }
  }

  CL.screens.lab = { init, show, hide, frame, resize: () => { if (active) layout(); } };
  CL.lab = {
    get S() { return S; }, get D() { return D; }, get pred() { return pred; }, get run() { return run; },
    ride(on = true) { audio.unlock(); setRide(on); }, get riding() { return pov.on; },
    drawSideView,
    beam() {   // the beam this cyclotron delivers (or would deliver) — used by the other screens
      const K = run && run.status === 'extracted' ? run.Kfinal : pred.Kmax;
      return { key: D.part.key, K: K / C.MeV, symbol: D.part.symbol, extracted: !!(run && run.status === 'extracted') };
    },
    snapshot: () => clone(S),
    restore(data) {
      try { S = Object.assign(clone(DEFAULTS), data); S.show = Object.assign(clone(DEFAULTS.show), data.show || {}); } catch (_) { S = clone(DEFAULTS); }
      applyLimits(); buildRun(); syncControls();
    },
  };
})();
