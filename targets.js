/* =====================================================================
   Project Lorentz — Target Range screen (CL.screens.targets)
   Fire beams into stacks of materials: Bethe stopping power, Bragg peak,
   energy deposited per slab, beam heating (illustrative) and damage.
   ===================================================================== */
(() => {
  'use strict';
  const { PHYS, C, $, $$, clamp, TAU, e, pl, si, audio, FX, shaker, haloText, pill, hexA, hexRGB, fitCanvas, plot, bindRange, toast, missions, skin, reduceMotion } = CL;
  const MAT = PHYS.MATERIALS;
  const PARTS = ['proton', 'deuteron', 'alpha', 'carbon', 'electron', 'positron'];
  const METALS = ['aluminium', 'steel', 'copper', 'lead', 'gold', 'tungsten'];
  const T_ROOM = 20, KAPPA = 0.1;             // °C, cooling W/K of the heated 1 cm² patch (illustrative)
  const MAX_SLABS = 6;

  const PRESETS = [
    { id: 'therapy', label: 'Proton therapy', part: 'proton', K: 100, I: 0.01, slabs: [['water', 5], ['tumour', 3], ['water', 5]],
      note: 'Healthy tissue (water), a tumour, then more tissue. Adjust the energy so the Bragg peak lands inside the tumour: that is how proton therapy spares healthy tissue.' },
    { id: 'paper', label: 'Paper vs alpha', part: 'alpha', K: 5, I: 0.01, slabs: [['paper', 0.01], ['aluminium', 0.1]],
      note: 'A sheet of paper (0.1 mm) against 5 MeV alpha particles, the energy of a typical alpha from radioactive decay.' },
    { id: 'electron', label: 'Electrons in metal', part: 'electron', K: 2, I: 0.1, slabs: [['plastic', 0.5], ['aluminium', 0.5], ['lead', 0.2]],
      note: 'Electrons are light: they scatter a lot and have no sharp Bragg peak. A few millimetres of aluminium stop 2 MeV electrons.' },
    { id: 'dump', label: 'Beam dump (graphite)', part: 'proton', K: 230, I: 1, slabs: [['graphite', 30], ['steel', 5]],
      note: 'Accelerators stop unwanted beams in blocks of graphite: light atoms, a very high temperature limit. The LHC dumps each 362 MJ beam into graphite.' },
    { id: 'melt', label: 'Melt the target', part: 'proton', K: 20, I: 10, slabs: [['copper', 0.1], ['lead', 1]],
      note: 'A strong, low-energy beam deposits all its energy in a thin layer. Switch the beam on and watch the temperature (heating and damage are illustrative).' },
    { id: 'shield', label: 'Shielding', part: 'proton', K: 70, I: 0.1, slabs: [['plastic', 2], ['lead', 1], ['water', 5]],
      note: 'Which material stops protons best per centimetre? Dense materials have more electrons per cm³, so they stop particles in a shorter distance.' },
  ];
  missions.add({ id: 'tgt-tumour', screen: 'targets', title: 'Hit the tumour', goal: 'Proton therapy: make protons stop inside the tumour slab, depositing more energy there than in the tissue in front.' });
  missions.add({ id: 'tgt-melt', screen: 'targets', title: 'Meltdown', goal: 'Heat a metal slab past its melting point with the beam (an illustrative effect).' });
  missions.add({ id: 'tgt-paper', screen: 'targets', title: 'Stopped by paper', goal: 'Stop alpha particles with a sheet of paper no thicker than 0.1 mm.' });

  const S = { part: 'proton', K: 100, I: 0.01, preset: 'therapy' };
  let slabs = [];
  let tr = null, active = false, cv, ctx, W = 800, H = 300, shake, beamOn = false, beamAcc = 0, ctlK = null, ctlI = null, v3 = null, lastShotT = -1e9;
  let shots = [], floaters = [], lastTableT = 0, totalHits = 0;
  let userH = +CL.store.get('cl-h-tgt', 0) || 0;
  const fx = new FX();

  const makeSlab = (mat, thick) => ({ mat, thick, T: T_ROOM, E: 0, hits: 0, destroyed: false });
  function loadPreset(id) {
    const p = PRESETS.find(x => x.id === id) || PRESETS[0];
    S.part = p.part; S.K = p.K; S.I = p.I; S.preset = p.id;
    slabs = p.slabs.map(([m, t]) => makeSlab(m, t));
    beamOn = false; syncBeamBtn(); shots = []; floaters = []; totalHits = 0;
    $('#tgtPresetNote').textContent = p.note;
    for (const b of $$('#tgtPresets button')) b.classList.toggle('is-on', b.dataset.id === id);
    renderSlabs(); recompute(); syncControls();
  }
  const part = () => PHYS.particle(S.part);
  function recompute() {
    tr = PHYS.traverse(part(), S.K, slabs);
    drawGraph(); renderTable(); updateStatus();
  }
  function updateStatus() {
    const p = part(), h = $('#tgtStatus');
    let t;
    if (tr.stopX != null) {
      const i = tr.per.findIndex(q => q.stopped);
      t = `${p.symbol} at ${mev(S.K)} stops at ${len(tr.stopX)} depth, in slab ${i + 1} (${MAT[slabs[i].mat].short})`;
    } else t = `${p.symbol} at ${mev(S.K)} passes through everything and leaves with ${mev(tr.Texit)}`;
    h.textContent = beamOn ? 'Beam on: ' + t : t;
    h.className = 'hud hud-status ' + (beamOn ? 'is-run' : '');
    const el = $('#tgtNarrateX');
    if (el) {
      let x;
      if (tr.stopX != null) {
        const i = tr.per.findIndex(q => q.stopped), light = PHYS.isLight(p);
        x = `The beam goes <b>${len(tr.stopX)}</b> deep and stops in slab ${i + 1} (${MAT[slabs[i].mat].name.toLowerCase()}). ${light ? 'Electrons are so light that they zig-zag and slow down gradually.' : 'Look at the graph: the particle drops <b>most of its energy right at the end</b> of its path, the tall Bragg peak. Slow particles lose energy fastest. That is why proton therapy can hit a tumour while sparing the tissue in front of it.'}`;
      } else x = `The beam goes <b>straight through</b> everything and comes out the other side with ${mev(tr.Texit)}. Add a thicker or denser slab, or lower the energy, to stop it.`;
      if (el.innerHTML !== x) el.innerHTML = x;
    }
  }
  const mev = x => { const a = Math.abs(x); return a >= 1000 ? pl(x / 1000, 4) + ' GeV' : a >= 1 ? pl(x, 4) + ' MeV' : a >= 1e-3 ? pl(x * 1000, 4) + ' keV' : pl(x * 1e6, 3) + ' eV'; };
  const len = cm => cm >= 100 ? pl(cm / 100, 3) + ' m' : cm >= 1 ? pl(cm, 3) + ' cm' : cm >= 0.1 ? pl(cm * 10, 3) + ' mm' : pl(cm * 1e4, 3) + ' μm';

  /* ------------------------------------------------------------------
     Display geometry: slabs side by side (thin slabs widened, not to scale)
     ------------------------------------------------------------------ */
  let boxes = [], scaleNote = false, x0px = 70, xEndPx = 700;
  function layoutBoxes() {
    x0px = 70; const avail = W - x0px - 90;
    const total = slabs.reduce((a, s) => a + (s.destroyed ? 0 : s.thick), 0) || 1;
    const minW = 16;
    let k = avail / total;
    let widths = slabs.map(s => s.destroyed ? 12 : Math.max(minW, s.thick * k));
    const sum = widths.reduce((a, b) => a + b, 0);
    if (sum > avail) { const f = avail / sum; widths = widths.map(w => Math.max(w * f, 8)); }
    scaleNote = slabs.some((s, i) => !s.destroyed && Math.abs(widths[i] - s.thick * k) > 1.5);
    let x = x0px;
    boxes = slabs.map((s, i) => { const b = { x0: x, x1: x + widths[i], s, i }; x += widths[i]; return b; });
    xEndPx = x;
  }
  function physToPx(xcm) {
    if (!tr) return x0px;
    for (let i = 0; i < boxes.length; i++) {
      const pp = tr.per[i], b = boxes[i];
      if (xcm <= pp.xout + 1e-12) {
        const th = pp.xout - pp.xin;
        return th > 0 ? b.x0 + (xcm - pp.xin) / th * (b.x1 - b.x0) : b.x0;
      }
    }
    return xEndPx + (xcm - (tr.per.length ? tr.per[tr.per.length - 1].xout : 0)) * 20;
  }

  /* ------------------------------------------------------------------
     Drawing
     ------------------------------------------------------------------ */
  function heatColor(T, limit) {
    const f = clamp((T - T_ROOM) / Math.max(limit - T_ROOM, 1), 0, 1);
    if (f < 0.05) return null;
    const r = 255, g = Math.round(60 + 195 * Math.max(0, f - 0.4) / 0.6), b = Math.round(40 + 215 * Math.max(0, f - 0.8) / 0.2);
    return `rgba(${r},${g},${b},${0.15 + 0.6 * f})`;
  }
  function draw(now) {
    const { ctx: c } = fitCanvas(cv, W, H); ctx = c;
    ctx.clearRect(0, 0, W, H);
    if (v3 && v3.on) { draw3D(now); fx.draw(ctx, W, H); return; }
    CL.screenBg(ctx, W, H, { grid: 40, ticks: false });
    layoutBoxes();
    const cy = H * 0.5, bh = H * 0.56;
    // beam pipe
    ctx.fillStyle = 'rgba(215,228,218,0.08)'; ctx.fillRect(0, cy - 9, x0px, 18);
    ctx.strokeStyle = 'rgba(215,228,218,0.25)'; ctx.beginPath(); ctx.moveTo(0, cy - 9.5); ctx.lineTo(x0px - 6, cy - 9.5); ctx.moveTo(0, cy + 9.5); ctx.lineTo(x0px - 6, cy + 9.5); ctx.stroke();
    haloText(ctx, part().symbol + ' beam', 34, cy - 22, { font: '700 13.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: part().color });
    if (beamOn) {
      const gr = ctx.createLinearGradient(0, 0, x0px, 0);
      gr.addColorStop(0, hexA(part().color, 0)); gr.addColorStop(1, hexA(part().color, 0.55 + 0.25 * Math.sin(now / 60)));
      ctx.fillStyle = gr; ctx.fillRect(0, cy - 3, x0px, 6);
    }
    // slabs
    for (const b of boxes) {
      const s = b.s, m = MAT[s.mat], w = b.x1 - b.x0, y0 = cy - bh / 2;
      if (s.destroyed) {
        ctx.fillStyle = 'rgba(80,90,110,0.5)';
        for (let k = 0; k < 9; k++) { const yy = y0 + bh * (0.55 + 0.45 * ((k * 37) % 10) / 10); ctx.beginPath(); ctx.arc(b.x0 + w * ((k * 53) % 10) / 10, yy, 2 + (k % 3), 0, TAU); ctx.fill(); }
        haloText(ctx, m.limitWord === 'melts' ? 'melted' : m.limitWord === 'boils' ? 'boiled' : m.limitWord === 'chars' ? 'burnt' : 'gone', b.x0 + w / 2, y0 - 10 - (b.i % 2) * 14, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#ff8a7a' });
        continue;
      }
      const grd = ctx.createLinearGradient(b.x0, 0, b.x1, 0);
      grd.addColorStop(0, hexA(m.color, 0.55)); grd.addColorStop(0.5, hexA(m.color, 0.85)); grd.addColorStop(1, hexA(m.color, 0.55));
      ctx.fillStyle = grd; ctx.fillRect(b.x0, y0, w, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(b.x0 + 0.5, y0 + 0.5, w - 1, bh - 1);
      const hc = heatColor(s.T, m.limit);
      if (hc) {
        const gl = ctx.createRadialGradient(b.x0 + w / 2, cy, 0, b.x0 + w / 2, cy, Math.max(w, 30) * 1.2);
        gl.addColorStop(0, hc); gl.addColorStop(1, 'rgba(255,80,40,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gl; ctx.fillRect(b.x0 - 30, y0 - 20, w + 60, bh + 40); ctx.restore();
      }
      const dmg = damage(s);
      if (dmg > 0.45) {   // illustrative cracks
        ctx.strokeStyle = `rgba(20,10,10,${0.3 + 0.6 * dmg})`; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) { let x = b.x0 + w * (0.2 + 0.2 * k), y = y0 + 4; ctx.moveTo(x, y); for (let j = 0; j < 5; j++) { x += ((k + j) % 2 ? 1 : -1) * w * 0.08; y += bh * 0.12 * dmg; ctx.lineTo(clamp(x, b.x0, b.x1), y); } }
        ctx.stroke();
      }
      if (w > 34) haloText(ctx, m.short, b.x0 + w / 2, y0 + bh + 14, { font: '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#dfe6de' });
      haloText(ctx, len(s.thick), b.x0 + w / 2, y0 - 10, { font: '500 12px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#a9b3ab' });
      if (s.T > T_ROOM + 1) haloText(ctx, pl(s.T, 3) + ' °C', b.x0 + w / 2, y0 + bh + 30, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#ffb547' });
    }
    // stopping point / exit
    if (tr) {
      if (tr.stopX != null) {
        const sx = physToPx(tr.stopX);
        ctx.strokeStyle = 'rgba(255,212,59,0.7)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(sx, cy - bh / 2 - 4); ctx.lineTo(sx, cy + bh / 2 + 4); ctx.stroke(); ctx.setLineDash([]);
        pill(ctx, 'stops at ' + len(tr.stopX), clamp(sx, 60, W - 60), cy - bh / 2 - 26, 'rgba(255,212,59,0.95)', '#1f1600');
      } else {
        haloText(ctx, 'exits with ' + mev(tr.Texit) + ' →', W - 8, cy - 18, { font: '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#ffd43b', align: 'right' });
      }
    }
    // shots
    for (const sh of shots) {
      const age = (now - sh.t0) / 1000;
      if (age < 0) continue;
      const u = clamp(age / sh.dur, 0, 1), ease = 1 - (1 - u) * (1 - u);
      const xphys = sh.end * ease, px = physToPx(xphys), py = cy + sh.dy;
      ctx.strokeStyle = hexA(part().color, sh.faint ? 0.35 : 0.8); ctx.lineWidth = sh.faint ? 1.2 : 2;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(px, py + sh.wob * ease); ctx.stroke();
      if (u < 1) {
        const gl = ctx.createRadialGradient(px, py + sh.wob * ease, 0, px, py + sh.wob * ease, 10);
        gl.addColorStop(0, hexA(part().color, 1)); gl.addColorStop(1, hexA(part().color, 0));
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py + sh.wob * ease, 10, 0, TAU); ctx.fill();
      } else if (!sh.done) shotDone(sh, px, py + sh.wob);
    }
    shots = shots.filter(sh => !(sh.done && (now - sh.t0) / 1000 > sh.dur + 1.2));
    // floating deposit labels
    floaters = floaters.filter(f => now - f.born < 1600);
    for (const f of floaters) {
      const a = 1 - (now - f.born) / 1600;
      ctx.globalAlpha = clamp(a * 1.4, 0, 1);
      pill(ctx, f.text, f.xs, f.y - 30 * (1 - a), 'rgba(255,190,90,0.95)', '#231300', '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif');
      ctx.globalAlpha = 1;
    }
    if (scaleNote) haloText(ctx, 'thin slabs widened (not to scale)', W - 8, H - 12, { font: '500 10.5px "Barlow", "Segoe UI", sans-serif', color: '#93a197', align: 'right' });
    fx.draw(ctx, W, H);
  }
  function shotDone(sh, x, y) {
    sh.done = true;
    if (sh.stopped) { fx.burst(x, y, sh.faint ? 6 : 26, { speed: sh.faint ? 90 : 170, life: 0.5, colors: ['255,220,140', '255,160,60', '255,255,255'] }); if (!sh.faint) { fx.ring(x, y, { speed: 110, life: 0.4, color: '255,210,120' }); audio.spark(); } }
    if (!sh.faint) depositLabels();
  }
  // where a depth (in screen px of the flat view) appears on screen: flat or 3-D
  function scrAt(px) {
    if (v3 && v3.on) { const q = v3.scene.project([X3(px), 0, ZB]); if (q) return [q.x, q.y]; }
    return [px, H * 0.5];
  }
  /* ------------------------------------------------------------------
     3-D view: the slabs as blocks on a bench, the beam coming out of a pipe,
     and the energy the beam leaves behind glowing along its path (the
     brightest glow is the Bragg peak). Thin slabs are widened as in the flat view.
     ------------------------------------------------------------------ */
  const ZB = 0.5;                       // beam height above the bench (world units)
  let K3 = 100;                         // flat-view px per 3-D unit
  const X3 = px => (px - x0px) / K3;
  function draw3D(now) {
    const s = v3.scene;
    layoutBoxes();
    K3 = Math.max(1, xEndPx - x0px) / 2.4;
    const Ls = X3(xEndPx), hz = 0.42, hy = 0.42, P = part(), prgb = hexRGB(P.color);
    s.begin(ctx, W, H, { target: [Ls / 2 - 0.3, 0, 0.42], dist: 4.4 });
    s.grid(0, -2.2, Ls + 1.8, -1.6, 1.6, 0.25);
    s.box([Ls / 2 - 0.2, 0, -0.03], [Ls / 2 + 1.3, 0.62, 0.03], { rgb: [34, 42, 38], layer: 'back' });
    // beam pipe with a flange
    s.cyl([-1.7, 0, ZB], [-0.14, 0, ZB], 0.055, { rgb: [150, 162, 156] }, 18);
    s.cyl([-0.2, 0, ZB], [-0.14, 0, ZB], 0.1, { rgb: [120, 130, 125] }, 18);
    s.box([-1.1, 0, 0.22], [0.05, 0.08, 0.22], { rgb: [70, 80, 75] });
    s.label([-1.3, 0, ZB + 0.17], P.symbol + ' beam', { color: P.color, font: '700 13.5px "Barlow Condensed", "Arial Narrow", sans-serif' });
    if (beamOn) { s.line([-0.14, 0, ZB], [0, 0, ZB], `rgba(${prgb},${0.6 + 0.25 * Math.sin(now / 60)})`, 4, { additive: true }); s.glow([-0.1, 0, ZB], 0.12, prgb, 0.7); }
    // slabs
    for (const b of boxes) {
      const sl = b.s, m = MAT[sl.mat], x0 = X3(b.x0), x1 = X3(b.x1), rgb = hexRGB(m.color).split(',').map(Number);
      if (sl.destroyed) {                                    // a heap of rubble where the slab was
        for (let k = 0; k < 7; k++) { const u = ((k * 37) % 10) / 10, v = ((k * 53) % 10) / 10; s.box([x0 + (x1 - x0) * u, (v - 0.5) * 0.6, 0.03 + 0.02 * (k % 3)], [0.03 + 0.02 * (k % 2), 0.04, 0.03], { rgb: [80, 86, 96] }); }
        s.label([(x0 + x1) / 2, 0, 0.3], m.limitWord === 'melts' ? 'melted' : m.limitWord === 'boils' ? 'boiled' : m.limitWord === 'chars' ? 'burnt' : 'gone', { color: '#ff8a7a' });
        continue;
      }
      const f = clamp((sl.T - T_ROOM) / Math.max(m.limit - T_ROOM, 1), 0, 1);
      s.box([(x0 + x1) / 2, 0, ZB], [Math.max(0.004, (x1 - x0) / 2 - 0.006), hy, hz], { rgb, a: 0.5, noCull: true, stroke: 'rgba(255,255,255,0.22)', emit: f > 0.05 ? '255,90,30' : null, emitA: f * 0.9 });
      if (f > 0.05) s.glow([(x0 + x1) / 2, 0, ZB], 0.3 + 0.4 * f, '255,110,40', 0.25 + 0.5 * f);
      const dmg = damage(sl);
      if (dmg > 0.45) for (let k = 0; k < 3; k++) { const xx = x0 + (x1 - x0) * (0.25 + 0.25 * k); s.path([[xx, -hy - 0.002, ZB + hz], [xx + 0.03, -hy - 0.002, ZB + hz * 0.4], [xx - 0.02, -hy - 0.002, ZB], [xx + 0.02, -hy - 0.002, ZB - hz * 0.5 * dmg]], `rgba(20,10,10,${0.3 + 0.6 * dmg})`, 1.4); }
      s.label([(x0 + x1) / 2, 0, ZB + hz + 0.1], m.short, { color: '#dfe6de' });
      s.label([(x0 + x1) / 2, 0, ZB + hz + 0.22], len(sl.thick), { color: '#a9b3ab', font: '500 12px "Barlow Condensed", "Arial Narrow", sans-serif' });
      if (sl.T > T_ROOM + 1) s.label([(x0 + x1) / 2, -hy, ZB - hz - 0.1], pl(sl.T, 3) + ' °C', { color: '#ffb547' });
    }
    // the energy left behind along the path: brightest at the Bragg peak
    const age = (performance.now() - lastShotT) / 1000, show = beamOn ? 1 : clamp(1.6 - age / 2.5, 0, 1);
    if (tr && tr.prof.length && show > 0) {
      const Smax = Math.max(...tr.prof.map(q => q.S)) || 1, step = Math.max(1, Math.floor(tr.prof.length / 220)), core = [];
      for (let i = 0; i < tr.prof.length; i += step) {
        const q = tr.prof[i], fS = q.S / Smax, x = X3(physToPx(q.x));
        s.glow([x, 0, ZB], 0.022 + 0.075 * fS, '255,166,60', show * (0.07 + 0.42 * fS * fS), { layer: 'front' });
        core.push([x, 0, ZB]);
      }
      if (core.length > 1) s.path(core, `rgba(255,214,150,${0.55 * show})`, 1.6, { layer: 'front', chunk: 400 });
    }
    // where the beam stops, or where it leaves
    if (tr) {
      if (tr.stopX != null) {
        const xs = X3(physToPx(tr.stopX));
        s.path([[xs, -hy - 0.05, ZB - hz - 0.05], [xs, hy + 0.05, ZB - hz - 0.05], [xs, hy + 0.05, ZB + hz + 0.05], [xs, -hy - 0.05, ZB + hz + 0.05], [xs, -hy - 0.05, ZB - hz - 0.05]], 'rgba(255,212,59,0.75)', 1.4, { dash: [5, 4] });
        s.label([xs, -hy - 0.05, ZB - hz - 0.05], 'stops at ' + len(tr.stopX), { pill: 'rgba(255,212,59,0.95)', fg: '#1f1600', dy: 14 });
      } else s.label([Ls + 0.5, 0, ZB + 0.15], 'exits with ' + mev(tr.Texit) + ' →', { color: '#ffd43b' });
    }
    // particles in flight
    for (const sh of shots) {
      const a = (now - sh.t0) / 1000; if (a < 0) continue;
      const u = clamp(a / sh.dur, 0, 1), ease = 1 - (1 - u) * (1 - u);
      const x = X3(physToPx(sh.end * ease)), y = sh.dy / K3 * 1.4, z = ZB + sh.wob / K3 * ease;
      s.line([-0.14, y * 0.2, ZB], [x, y, z], `rgba(${prgb},${sh.faint ? 0.35 : 0.85})`, sh.faint ? 1.2 : 2, { layer: 'front' });
      if (u < 1) s.glow([x, y, z], 0.08, prgb, 0.95, { layer: 'front' });
      else if (!sh.done) { const q = s.project([x, y, z]); if (q) shotDone(sh, q.x, q.y); else sh.done = true; }
    }
    s.end();
    for (const fl of floaters) {                 // deposit labels float up from the slabs
      const a = 1 - (now - fl.born) / 1600; if (a <= 0) continue;
      const q = s.project([X3(fl.x), 0, ZB + hz]); if (!q) continue;
      ctx.globalAlpha = clamp(a * 1.4, 0, 1);
      pill(ctx, fl.text, q.x, q.y - 34 - 30 * (1 - a) - 18 * (fl.i % 2), 'rgba(255,190,90,0.95)', '#231300', '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif');
      ctx.globalAlpha = 1;
    }
    floaters = floaters.filter(fl => now - fl.born < 1600);
    shots = shots.filter(sh => !(sh.done && (now - sh.t0) / 1000 > sh.dur + 1.2));
    if (scaleNote) haloText(ctx, 'thin slabs widened (not to scale)', W - 8, H - 12, { font: '500 10.5px "Barlow", "Segoe UI", sans-serif', color: '#93a197', align: 'right' });
  }
  function depositLabels() {
    const cy = H * 0.5, bh = H * 0.56;
    tr.per.forEach((p, i) => {
      if (p.dE <= 0 || slabs[i].destroyed) return;
      const b = boxes[i];
      floaters.push({ text: '+' + mev(p.dE), x: (b.x0 + b.x1) / 2, xs: clamp((b.x0 + b.x1) / 2, 50, W - 50), y: cy - bh / 2 + 18 + (i % 2) * 18, i, born: performance.now() });
    });
  }
  const damage = s => s.destroyed ? 1 : clamp((s.T - T_ROOM) / Math.max(MAT[s.mat].limit - T_ROOM, 1), 0, 1);

  function drawGraph() {
    const cvg = $('#tgtGraph');
    if (!tr || !cvg) return;
    const pts = tr.prof.map(p => [p.x, p.S]);
    const xmax = Math.max(tr.total || slabs.reduce((a, s) => a + s.thick, 0), tr.stopX || 0, 1e-4) * 1.02;
    const ymax = pts.length ? Math.max(...pts.map(p => p[1])) * 1.15 : 1;
    const bands = tr.per.map((p, i) => ({ x0: p.xin, x1: Math.max(p.xout, p.xin + 1e-9), color: hexA(MAT[slabs[i].mat].color, slabs[i].destroyed ? 0.03 : 0.13), label: slabs[i].destroyed ? '' : MAT[slabs[i].mat].short }));
    const peak = pts.length ? pts.reduce((a, b) => b[1] > a[1] ? b : a) : null;
    const xf = xmax < 0.1 ? 1e-4 : xmax < 1 ? 0.1 : 1;
    plot(cvg, {
      xmin: 0, xmax, ymin: 0, ymax, xf, yf: ymax > 2000 ? 1000 : 1,
      xlabel: `depth (${xf === 1e-4 ? 'μm' : xf === 0.1 ? 'mm' : 'cm'})`, ylabel: `energy lost per ${xf === 1 ? 'cm' : xf === 0.1 ? 'cm' : 'cm'}, −dE/dx (${ymax > 2000 ? 'GeV' : 'MeV'}/cm)`,
      bands, series: [{ pts, color: skin.c('--amber'), width: 2.2, fill: hexA('#ffb547', 0.15) }],
      vlines: tr.stopX != null && peak ? [{ x: peak[0], label: PHYS.isLight(part()) ? 'deepest point' : 'Bragg peak', color: skin.c('--hot') }] : [],
    });
    if (!pts.length) {
      const c2 = cvg.getContext('2d'), r = cvg.getBoundingClientRect();
      c2.fillStyle = skin.c('--plot-text'); c2.font = '600 13px "Barlow", "Segoe UI", sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
      c2.fillText('No material left in the beam: nothing is deposited. Press "Repair targets".', r.width / 2, r.height / 2);
    }
  }
  function renderTable() {
    const z = Math.abs(part().z), Iamp = S.I * 1e-6;
    const tot = tr.per.reduce((a, p) => a + p.dE, 0) || 1;
    const rows = slabs.map((s, i) => {
      const m = MAT[s.mat], p = tr.per[i], P = s.destroyed ? 0 : Iamp * p.dE * 1e6 / z, dmg = damage(s);
      const status = s.destroyed ? `<b style="color:var(--bad)">${m.limitWord === 'melts' ? 'melted' : m.limitWord === 'boils' ? 'boiled away' : m.limitWord === 'chars' ? 'burnt through' : 'sublimated'}</b>` : p.stopped ? '<b style="color:var(--amber)">particle stops here</b>' : p.dE > 0 ? 'passes through' : 'no beam reaches it';
      return `<tr><td><span class="swatch" style="background:${m.color}"></span>${i + 1}. ${m.short}</td><td>${len(s.thick)}</td><td>${mev(p.Tin)} → ${mev(p.Tout)}</td><td>${mev(p.dE)}</td><td>${pl(100 * p.dE / tot, 3)} %</td><td>${si(P, 'W')}</td><td>${si(s.E, 'J')} · ${s.hits < 1e6 ? Math.round(s.hits).toLocaleString('en-US') : e(s.hits, 3)} particle${s.hits === 1 ? '' : 's'}</td><td>${pl(s.T, 4)} °C <small>(${m.limitWord} at ${m.limit.toLocaleString('en-US')} °C)</small></td><td><span class="dmg"><i style="width:${(dmg * 100).toFixed(0)}%;background:${dmg >= 1 ? 'var(--bad)' : dmg > 0.5 ? 'var(--amber)' : 'var(--ok)'}"></i></span>${Math.round(dmg * 100)} %</td><td>${status}</td></tr>`;
    }).join('');
    const exitRow = tr.stopX == null ? `<tr><td colspan="10">Leaves the stack with ${mev(tr.Texit)} (${pl(100 * tr.Texit / S.K, 3)} % of its energy): the target is too thin to stop it.</td></tr>` : '';
    const rangeInfo = slabs.length ? `<tr><td colspan="10">Range of a ${mev(S.K)} ${part().name.toLowerCase()} in ${MAT[slabs[0].mat].name.replace(/ \(.*\)/, '').toLowerCase()} alone: ${len(PHYS.rangeIn(part(), S.K, MAT[slabs[0].mat]))}. Beam: ${pl(S.I, 3)} μA = ${e(Iamp / (z * C.e), 3)} particles per second, ${si(Iamp * S.K * 1e6 / z, 'W')} of beam power.</td></tr>` : '';
    $('#tgtTable').innerHTML = `<thead><tr><th>Slab</th><th>Thickness</th><th>Energy in → out</th><th>Deposited per particle</th><th>Share</th><th>Power (beam on)</th><th>Total deposited</th><th>Temperature</th><th>Damage (illustrative)</th><th>Status</th></tr></thead><tbody>${rows}${exitRow}${rangeInfo}</tbody>`;
  }

  /* ------------------------------------------------------------------
     Firing and heating
     ------------------------------------------------------------------ */
  function fireOne(delay = 0, faint = false) {
    audio.unlock();
    const end = tr.stopX != null ? tr.stopX : (tr.per.length ? tr.per[tr.per.length - 1].xout : 0) + 30;
    lastShotT = performance.now() + delay;
    shots.push({ t0: performance.now() + delay, dur: faint ? 0.45 : 0.85, end, stopped: tr.stopX != null, dy: faint ? (Math.random() - 0.5) * 12 : (Math.random() - 0.5) * 4, wob: (Math.random() - 0.5) * (PHYS.isLight(part()) ? 22 : 4), faint, done: false });
    if (!faint) {
      for (let i = 0; i < slabs.length; i++) { const p = tr.per[i]; if (p.dE > 0 && !slabs[i].destroyed) { slabs[i].hits++; slabs[i].E += p.dE * C.MeV; } }
      totalHits++;
      audio.tick(0.3);
      checkMissions();
    }
  }
  function heat(dt) {
    const z = Math.abs(part().z), Iamp = S.I * 1e-6;
    let changed = false;
    for (let i = 0; i < slabs.length; i++) {
      const s = slabs[i]; if (s.destroyed) continue;
      const m = MAT[s.mat], mass = m.rho * s.thick, Cth = Math.max(mass * m.cp, 1e-4);   // 1 cm² patch: grams × J/(g·K)
      const P = beamOn ? Iamp * tr.per[i].dE * 1e6 / z : 0;
      // exact relaxation towards the equilibrium temperature (stable for very thin slabs)
      const Teq = T_ROOM + P / KAPPA, Tn = Teq + (s.T - Teq) * Math.exp(-KAPPA * dt / Cth);
      if (Math.abs(Tn - s.T) > 1e-6) { s.T = Math.max(T_ROOM, Tn); changed = true; }
      if (beamOn) { s.E += P * dt; s.hits += Math.round(Iamp / (z * C.e) * dt); }
      if (s.T >= m.limit) destroy(i);
    }
    return changed;
  }
  function destroy(i) {
    const s = slabs[i], m = MAT[s.mat];
    s.destroyed = true; s.T = m.limit;
    const b = boxes[i] || { x0: W / 2, x1: W / 2 };
    const [x, y] = scrAt((b.x0 + b.x1) / 2);
    fx.flash(0.6, '255,200,150');
    fx.burst(x, y, 140, { speed: 420, life: 1.2, colors: ['255,240,200', '255,170,70', '255,90,50', hexRGB(m.color)] });
    fx.burst(x, y, 40, { speed: 260, life: 1.8, colors: [hexRGB(m.color), '90,90,100'], debris: true, gravity: 260, size: 3 });
    fx.ring(x, y, { speed: 400, life: 0.7, color: '255,200,140', width: 4 });
    fx.puff(x, y, 14, { shade: m.limitWord === 'boils' ? 210 : 80 });
    shake.kick(12, 0.9); audio.boom(1.1);
    toast($('#tgtToast'), `<b>${m.short} ${m.limitWord === 'melts' ? 'melted' : m.limitWord === 'boils' ? 'boiled' : m.limitWord === 'chars' ? 'charred' : 'sublimated'} at ${m.limit.toLocaleString('en-US')} °C!</b> The beam now goes through to the next slab. (Illustrative: real targets are water-cooled and protected by interlocks; beams are dumped into graphite or water-cooled blocks.)`, 'hot', 9000);
    recompute();
    checkMissions(i);
  }
  function checkMissions(destroyedIdx) {
    const fresh = [];
    if (destroyedIdx != null && METALS.includes(slabs[destroyedIdx].mat)) fresh.push(missions.complete('tgt-melt'));
    if (S.part === 'proton' && totalHits > 0) {
      const iStop = tr.per.findIndex(p => p.stopped);
      if (iStop >= 0 && slabs[iStop].mat === 'tumour') {
        const dT = tr.per[iStop].dE, front = tr.per.slice(0, iStop).filter((p, j) => slabs[j].mat !== 'tumour');
        if (front.every(p => dT > p.dE)) fresh.push(missions.complete('tgt-tumour'));
      }
    }
    if (S.part === 'alpha' && totalHits > 0) {
      const iStop = tr.per.findIndex(p => p.stopped);
      if (iStop >= 0 && slabs[iStop].mat === 'paper' && slabs[iStop].thick <= 0.01 + 1e-9) fresh.push(missions.complete('tgt-paper'));
    }
    const got = fresh.filter(Boolean);
    if (got.length) toast($('#tgtToast'), `<b>Mission complete: ${got.map(m => m.title).join(', ')}</b>`, '', 6000);
  }

  /* ------------------------------------------------------------------
     Loop
     ------------------------------------------------------------------ */
  function frame(now, dt) {
    if (!active) return;
    if (beamOn) {
      beamAcc += dt;
      while (beamAcc > 0.06) { beamAcc -= 0.06; fireOne(0, true); }
      if (tr.stopX != null && Math.random() < dt * 20) { const [sx, sy] = scrAt(physToPx(tr.stopX)); fx.burst(sx, sy, 3, { speed: 120, life: 0.4, colors: ['255,220,140', '255,140,60'] }); }
    }
    heat(dt);
    fx.update(dt); shake.update(now);
    draw(now);
    if (now - lastTableT > 250) { lastTableT = now; renderTable(); if (beamOn) updateStatus(); }
  }

  /* ------------------------------------------------------------------
     Controls
     ------------------------------------------------------------------ */
  function renderSlabs() {
    const box = $('#slabs');
    box.innerHTML = slabs.map((s, i) => `<div class="slab" data-i="${i}"><div class="slab-head"><span class="swatch" style="background:${MAT[s.mat].color}"></span><select aria-label="Material of slab ${i + 1}">${Object.entries(MAT).map(([k, m]) => `<option value="${k}"${k === s.mat ? ' selected' : ''}>${m.name}</option>`).join('')}</select><button type="button" class="slab-x" aria-label="Remove slab ${i + 1}" title="Remove">×</button></div>
      <div class="ctl"><div class="ctl-row"><label class="ctl-label" for="slabR${i}">Thickness</label><div class="ctl-num"><input id="slabN${i}" type="number" inputmode="decimal" aria-label="Thickness of slab ${i + 1} in cm"><span class="ctl-unit">cm</span></div></div><input id="slabR${i}" type="range"></div></div>`).join('');
    slabs.forEach((s, i) => {
      const el = box.querySelector(`.slab[data-i="${i}"]`);
      el.querySelector('select').addEventListener('change', ev => { s.mat = ev.target.value; s.T = T_ROOM; s.destroyed = false; el.querySelector('.swatch').style.background = MAT[s.mat].color; S.preset = ''; recompute(); });
      el.querySelector('.slab-x').addEventListener('click', () => { if (slabs.length <= 1) return; slabs.splice(i, 1); S.preset = ''; renderSlabs(); recompute(); });
      bindRange({ range: $('#slabR' + i), num: $('#slabN' + i), min: 0.001, max: 100, log: true, get: () => s.thick, set: v => { s.thick = v; S.preset = ''; recompute(); } });
    });
    $('#slabAdd').disabled = slabs.length >= MAX_SLABS;
  }
  function syncBeamBtn() { const b = $('#tgtBeam'); b.setAttribute('aria-pressed', String(beamOn)); b.textContent = beamOn ? 'Beam OFF' : 'Beam ON'; }
  function syncControls() {
    for (const b of $$('#tgtPart button')) b.setAttribute('aria-checked', String(b.dataset.key === S.part));
    if (ctlK) ctlK.sync(); if (ctlI) ctlI.sync();
  }
  function bindControls() {
    $('#tgtPresets').innerHTML = PRESETS.map(p => `<button type="button" class="chip-btn" data-id="${p.id}">${p.label}</button>`).join('');
    $('#tgtPresets').addEventListener('click', ev => { const b = ev.target.closest('button[data-id]'); if (b) loadPreset(b.dataset.id); });
    $('#tgtPart').innerHTML = PARTS.map(k => { const p = PHYS.PARTICLES[k]; return `<button type="button" class="pbtn-part" role="radio" data-key="${k}"><span class="dot" style="background:${p.color};color:${p.color}"></span><span class="sym">${p.symbol}</span><span class="nm">${k === 'alpha' ? 'Alpha' : k === 'carbon' ? 'Carbon ion' : p.name}</span></button>`; }).join('');
    $('#tgtPart').addEventListener('click', ev => { const b = ev.target.closest('button[data-key]'); if (!b) return; S.part = b.dataset.key; syncControls(); recompute(); });
    ctlK = bindRange({ range: $('#r-tgtK'), num: $('#n-tgtK'), min: 0.01, max: 1000, log: true, get: () => S.K, set: v => { S.K = v; recompute(); } });
    ctlI = bindRange({ range: $('#r-tgtI'), num: $('#n-tgtI'), min: 0.001, max: 100, log: true, get: () => S.I, set: v => { S.I = v; renderTable(); } });
    $('#tgtFire').addEventListener('click', () => fireOne());
    $('#tgtFire10').addEventListener('click', () => { for (let i = 0; i < 10; i++) fireOne(i * 80); });
    $('#tgtBeam').addEventListener('click', () => { audio.unlock(); beamOn = !beamOn; syncBeamBtn(); updateStatus(); if (beamOn) audio.whoosh(); });
    $('#tgtReset').addEventListener('click', () => { for (const s of slabs) { s.T = T_ROOM; s.E = 0; s.hits = 0; s.destroyed = false; } totalHits = 0; beamOn = false; syncBeamBtn(); recompute(); });
    $('#slabAdd').addEventListener('click', () => { if (slabs.length >= MAX_SLABS) return; slabs.push(makeSlab('water', 2)); S.preset = ''; renderSlabs(); recompute(); });
    $('#tgtFromLab').addEventListener('click', () => {
      const bm = CL.lab && CL.lab.beam(); if (!bm) return;
      if (!PARTS.includes(bm.key)) { toast($('#tgtToast'), '<b>Choose a standard particle in the cyclotron</b> (custom ions are not available here).', 'warn', 5000); return; }
      S.part = bm.key; S.K = clamp(+bm.K.toPrecision(4), 0.01, 1000); syncControls(); recompute();
      toast($('#tgtToast'), `<b>Beam loaded from the cyclotron:</b> ${PHYS.PARTICLES[bm.key].symbol} at ${mev(S.K)}${bm.extracted ? '' : ' (the energy the cyclotron would reach)'}.`, '', 5000);
    });
    $('#tgtToast .toast-close').addEventListener('click', () => { $('#tgtToast').hidden = true; });
    CL.bus.on('mission', renderMissions);
    CL.bus.on('skin', () => drawGraph());
    document.addEventListener('keydown', ev => {
      if (!active) return;
      const tg = ev.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      if (ev.key === ' ' && tg !== 'BUTTON' && tg !== 'SUMMARY') { ev.preventDefault(); fireOne(); }
    });
  }
  function renderMissions() { missions.render($('#tgtMissions'), 'targets'); const [d, n] = missions.count('targets'); $('#tgtMissionCount').textContent = `${d} / ${n}`; }
  function resize() {
    if (!active) return;
    const wrap = $('#tgtWrap'), w = wrap.clientWidth;
    const h = userH ? Math.round(clamp(userH, 200, 1400)) : Math.round(clamp(w * 0.42, 240, 380));
    wrap.style.setProperty('--arena-h', h + 'px');
    W = w; H = h;
    drawGraph();
  }
  function init() {
    cv = $('#tgtCanvas'); shake = shaker($('#tgtWrap'));
    v3 = CL.V3.attach($('#tgtWrap'), { home: { yaw: -1.2, pitch: 0.42, dist: 4.4, target: [1.2, 0, 0.45], fov: 44 }, storeKey: 'cl-3d-tgt' });
    bindControls(); loadPreset('therapy'); renderMissions();
    CL.grip($('#tgtGrip'), {
      axis: 'y', get: () => H,
      set: (v, dragging) => { userH = Math.round(v); resize(); userH = H; if (!dragging) CL.store.set('cl-h-tgt', userH); CL.sizeBadge($('#tgtWrap'), `${W} × ${H} px`, dragging ? 'release to keep this height' : 'double-click the corner for automatic height', dragging ? 0 : 1400); },
      reset: () => { userH = 0; CL.store.set('cl-h-tgt', 0); resize(); CL.sizeBadge($('#tgtWrap'), `${W} × ${H} px`, 'automatic height'); },
    });
  }
  CL.screens.targets = { init, show() { active = true; requestAnimationFrame(resize); }, hide() { active = false; beamOn = false; syncBeamBtn(); }, frame, resize };
})();
