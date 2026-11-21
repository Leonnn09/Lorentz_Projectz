/* =====================================================================
   Project Lorentz — Particle Race screen (CL.screens.race)
   Magnetic sprint (a mass spectrometer) and the Cyclotron Grand Prix.
   ===================================================================== */
(() => {
  'use strict';
  const { PHYS, C, $, $$, clamp, TAU, e, pl, en, len, si, pct, audio, FX, shaker, arrow, haloText, pill, hexA, fitCanvas, bindRange, segInit, toast, missions, reduceMotion } = CL;

  const CHOICES = ['proton', 'deuteron', 'alpha', 'carbon', 'electron', 'positron'];
  const NAMES = { proton: 'Proton', deuteron: 'Deuteron', alpha: 'Alpha particle', carbon: 'Carbon-12 ion', electron: 'Electron', positron: 'Positron' };
  const GEO = { gate: 0.05, Lx: 1.0, Hy: 0.4 };
  const MODES = {
    voltage: { label: 'Gate voltage', unit: 'kV', min: 0.1, max: 1000, toSI: v => v * 1e3 },
    energy: { label: 'Kinetic energy', unit: 'keV', min: 0.1, max: 100000, toSI: v => v * 1e3 * C.e },
    speed: { label: 'Launch speed', unit: '% of c', min: 0.01, max: 99, toSI: v => v / 100 * C.c },
  };
  const S = { type: 'sprint', racers: ['proton', 'alpha', 'electron', ''], mode: 'voltage', vals: { voltage: 20, energy: 20, speed: 1 }, B: 0.15, gpB: 1.0, gpR: 0.5, gpV: 100, gpRf: 'fm', rel: true, slow: false };

  missions.add({ id: 'race-photo', screen: 'race', title: 'Photo finish', goal: 'In a magnetic sprint, have two racers finish within 0.1 % of each other. (Hint: which particles have almost the same q/m?)' });
  missions.add({ id: 'race-tie', screen: 'race', title: 'Dead heat', goal: 'In the Cyclotron Grand Prix, have the top two finish within 1 % of each other, even though they have different masses.' });
  missions.add({ id: 'race-dnf', screen: 'race', title: 'Did not finish', goal: 'Make a racer drop out of the Grand Prix because it falls out of step with the RF. Which physics is to blame?' });

  let race = null, active = false, cv, ctx, W = 600, H = 400, shake, replay = null, ctlVal = null;
  let userH = +CL.store.get('cl-h-race', 0) || 0;            // 0 = automatic height
  let trailCv = null, trailCtx = null, dpr = 1;
  const fx = new FX();

  /* ------------------------------------------------------------------
     Setting up a race
     ------------------------------------------------------------------ */
  function racersList() { return S.racers.filter(Boolean).slice(0, 4); }
  function buildRace() {
    const keys = racersList();
    const racers = keys.map((key, i) => {
      const part = PHYS.particle(key);
      const o = { key, part, lane: i, color: part.color, finished: false, place: 0 };
      if (S.type === 'sprint') {
        o.res = PHYS.sprint(part, S.mode, MODES[S.mode].toSI(S.vals[S.mode]), -S.B, { ...GEO, rel: S.rel });
        o.tEnd = o.res.tFin; o.dnf = o.res.finish === 'wall';
      } else {
        o.run = PHYS.computeRun({ mass: part.mass, charge: part.z * C.e, B: -S.gpB, R: S.gpR, V: S.gpV * 1e3, rfMode: S.gpRf, detune: 0, relativistic: S.rel, injPhase: 0, maxRevs: 10000 });
        o.pred = PHYS.predictions(o.run.P);
        o.tEnd = o.run.tStop; o.dnf = o.run.status !== 'extracted';
        o.segIdx = 0; o.drawn = 0;
      }
      return o;
    });
    const Tmax = Math.max(...racers.map(r => r.tEnd), 1e-18);
    const order = racers.slice().sort((a, b) => (a.dnf - b.dnf) || (a.tEnd - b.tEnd));
    order.forEach((r, i) => { r.place = i + 1; });
    for (const o of racers) if (o.run) { let ext = 0; for (const s of o.run.segs) if (s.type === 'arc') ext = Math.max(ext, Math.hypot(s.cx, s.cy) + s.r); o.ext = ext; }
    race = { type: S.type, racers, order, Tmax, clock: 0, state: 'idle', countT: 0, done: false, finishedN: 0 };
    replay = null; $('#raceLetterbox').classList.remove('is-on');
    resetTrail();
    renderBoard(); renderResults(null);
    $('#raceReplay').disabled = true;
    setStatus(S.type === 'sprint' ? 'Ready: press Start race' : 'Grand Prix ready: press Start race');
  }
  const duration = () => (S.slow ? 10 : 1) * (race.type === 'sprint' ? 6 : 8);   // real seconds for the whole race

  function startRace() {
    audio.unlock();
    buildRace();
    if (reduceMotion) { race.state = 'run'; audio.whoosh(); return; }
    race.state = 'count'; race.countT = 3.0;
    showCount('3'); audio.beep(520, 0.15);
  }
  function showCount(t) { const el = $('#raceCount'); el.hidden = false; el.textContent = t; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }

  /* ------------------------------------------------------------------
     Positions
     ------------------------------------------------------------------ */
  function segAt(o, t) {
    const segs = o.run.segs, last = segs.length - 1;
    let i = clamp(o.segIdx, 0, last);
    if (!(segs[i].t0 <= t && (t < segs[i].t1 || i === last))) {
      let lo = 0, hi = last;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid].t0 <= t) lo = mid; else hi = mid - 1; }
      i = lo;
    }
    o.segIdx = i; return i;
  }
  function gpState(o, t) {
    const tt = Math.min(t, o.run.tEnd);
    const i = segAt(o, tt), s = o.run.segs[i];
    const p = PHYS.posAt(s, clamp(tt, s.t0, Math.max(s.t0, s.t1)));
    return { i, s, x: p.x, y: p.y, K: s.K, v: s.v };
  }
  function sprintState(o, t) {
    const p = o.res.posAt(Math.min(t, o.res.tFin));
    let K;
    if (t <= 0) K = 0;
    else if (t < o.res.tAcc) { const pp = o.res.F * t, mc2 = o.part.mass * C.c * C.c; K = S.rel ? Math.sqrt((pp * C.c) ** 2 + mc2 * mc2) - mc2 : 0.5 * pp * pp / o.part.mass; }
    else K = o.res.K;
    return { x: p.x, y: p.y, v: t >= o.res.tFin ? o.res.v : p.v, K };
  }

  /* ------------------------------------------------------------------
     Drawing: shared transform
     ------------------------------------------------------------------ */
  let T = { s: 1, ox: 0, oy: 0 };
  function sprintView() {
    const x0 = -GEO.gate - 0.1, x1 = GEO.Lx + 0.04, y0 = -GEO.Hy - 0.05, y1 = GEO.Hy + 0.05;
    const s = Math.min(W / (x1 - x0), H / (y1 - y0));
    T = { s, ox: (W - (x1 - x0) * s) / 2 - x0 * s, oy: H / 2 };
    if (replay && replay.zoom) {          // photo-finish camera: detector plate at 25 % of the width
      const z = replay.zoom;
      T = { s: s * z.k, ox: W * 0.25, oy: H / 2 + z.y * s * z.k };
    }
  }
  const SX = x => T.ox + x * T.s, SY = y => T.oy - y * T.s;
  const laneY = o => (race && S.B === 0 && race.type === 'sprint') ? (o.lane - (race.racers.length - 1) / 2) * 0.12 : 0;

  function resetTrail() {
    if (!trailCv) return;
    trailCtx.setTransform(1, 0, 0, 1, 0, 0); trailCtx.clearRect(0, 0, trailCv.width, trailCv.height);
    if (race) for (const o of race.racers) o.drawn = 0;
  }

  function drawSprint(t, now) {
    sprintView();
    const B = S.B, s = T.s;
    // field region
    const fx0 = SX(0), fx1 = SX(GEO.Lx), fy0 = SY(GEO.Hy), fy1 = SY(-GEO.Hy);
    ctx.fillStyle = Math.abs(B) > 0 ? 'rgba(179,166,255,0.06)' : 'rgba(255,255,255,0.02)';
    ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    ctx.strokeStyle = 'rgba(179,166,255,0.32)'; ctx.lineWidth = 1; ctx.setLineDash([6, 5]);
    ctx.strokeRect(fx0 + 0.5, fy0 + 0.5, fx1 - fx0 - 1, fy1 - fy0 - 1); ctx.setLineDash([]);
    if (Math.abs(B) > 1e-9) {
      const sp = clamp(46 / Math.sqrt(Math.abs(B) + 0.05), 26, 70) * Math.min(1.6, Math.max(0.6, s / 500));
      ctx.strokeStyle = 'rgba(179,166,255,0.3)'; ctx.fillStyle = 'rgba(179,166,255,0.4)'; ctx.lineWidth = 1.1;
      for (let x = fx0 + sp / 2; x < fx1; x += sp) for (let y = fy0 + sp / 2; y < fy1; y += sp) {
        ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.stroke();
        if (B > 0) { ctx.beginPath(); ctx.moveTo(x - 2.5, y - 2.5); ctx.lineTo(x + 2.5, y + 2.5); ctx.moveTo(x + 2.5, y - 2.5); ctx.lineTo(x - 2.5, y + 2.5); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill(); }
      }
    } else {
      // finish line for the drag race
      const fl = SX(GEO.Lx) - 8;
      for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#eef2ec' : '#111'; ctx.fillRect(fl, fy0 + (fy1 - fy0) * i / 16, 8, (fy1 - fy0) / 16); }
    }
    // gate (accelerating gap) and detector plate
    const gx0 = SX(-GEO.gate), gx1 = SX(0), gh = 0.06 * s;
    ctx.fillStyle = 'rgba(229,72,63,0.6)'; ctx.fillRect(gx0 - 4, SY(0) - gh, 4, 2 * gh);
    ctx.fillStyle = 'rgba(62,126,230,0.6)'; ctx.fillRect(gx1, SY(0) - gh, 4, 2 * gh);
    if (race && race.state === 'run' && t < Math.max(...race.racers.map(o => o.res ? o.res.tAcc : 0))) {
      for (let i = 0; i < 5; i++) arrow(ctx, gx0 + 2, SY(0) - gh * 0.8 + i * gh * 0.4, gx1 - 2, SY(0) - gh * 0.8 + i * gh * 0.4, 5, 'rgba(255,166,70,0.8)', 1.6);
    }
    if (Math.abs(B) > 1e-9) {
      ctx.strokeStyle = '#b9c3bc'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(gx1 + 2, fy0); ctx.lineTo(gx1 + 2, SY(0) - 7); ctx.moveTo(gx1 + 2, SY(0) + 7); ctx.lineTo(gx1 + 2, fy1); ctx.stroke();
      // ruler along the plate
      ctx.fillStyle = '#93a197'; ctx.font = '11.5px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const step = T.s > 1400 ? 0.01 : T.s > 500 ? 0.05 : 0.1;
      for (let y = step; y <= GEO.Hy + 1e-9; y += step) for (const sg of [1, -1]) {
        const yy = SY(sg * y); if (yy < 0 || yy > H) continue;
        ctx.fillRect(gx1 - 4, yy - 0.5, 6, 1);
        if (Math.abs(y / step - Math.round(y / step)) < 1e-6 && Math.round(y / step) % (step < 0.05 ? 5 : 1) === 0) ctx.fillText(len(y, 2), gx1 - 7, yy);
      }
    }
    if (!replay) {
      haloText(ctx, 'gate', (gx0 + gx1) / 2, SY(0) - gh - 10, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#ffd8a0' });
      if (Math.abs(B) > 1e-9) haloText(ctx, 'detector plate', gx1 + 8, fy0 + 12, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#d3dcd5', align: 'left' });
      haloText(ctx, Math.abs(B) > 1e-9 ? `B = ${pl(Math.abs(B), 3)} T ${B > 0 ? '⊗ into' : '⊙ out of'} the screen` : 'B = 0: drag race to the finish line', fx1 - 8, fy1 - 12, { font: '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#b9adff', align: 'right' });
    }
    if (!race) return;
    // paths and racers
    for (const o of race.racers) {
      const st = sprintState(o, t), oy = laneY(o);
      ctx.strokeStyle = hexA(o.color, 0.9); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(SX(-GEO.gate), SY(oy));
      const tA = o.res.tAcc;
      if (t > 0) ctx.lineTo(SX(t < tA ? st.x : 0), SY(oy));
      if (t > tA) {
        if (o.res.mode === 'line') ctx.lineTo(SX(st.x), SY(oy));
        else {
          const th = o.res.w * (Math.min(t, o.res.tFin) - tA), r = o.res.r, rot = o.res.rot;
          const n = Math.max(8, Math.ceil(th / (replay && replay.zoom ? 0.0015 : 0.04)));
          for (let k = 1; k <= n; k++) { const a = th * k / n; ctx.lineTo(SX(r * Math.sin(a)), SY(rot * r * (1 - Math.cos(a)))); }
        }
      }
      ctx.stroke();
      const px = SX(st.x), py = SY(st.y + oy);
      const gl = ctx.createRadialGradient(px, py, 0, px, py, 15);
      gl.addColorStop(0, hexA(o.color, 0.95)); gl.addColorStop(1, hexA(o.color, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, 15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = o.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
      if (replay && replay.zoom) haloText(ctx, o.part.symbol + (o.finished ? ' ✓' : ''), px + 12, py - 14 - 16 * (o.lane % 2), { font: '700 14.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: o.color, align: 'left' });
      if (o.finished && !replay) {
        const tx = o.res.finish === 'plate' ? `${o.part.symbol} lands at ${len(Math.abs(o.res.yEnd), 3)} · ${si(o.res.tFin, 's', 4)}` : o.res.finish === 'line' ? `${o.part.symbol} ${si(o.res.tFin, 's', 4)}` : `${o.part.symbol} hit the wall`;
        pill(ctx, tx, clamp(px + (o.res.finish === 'plate' ? 90 : -70), 90, W - 90), clamp(py + (o.lane % 2 ? 16 : -16), 14, H - 14), hexA(o.color, 0.92), '#0b0f0c');
      }
    }
    // magnifier for tiny orbits
    if (!replay && Math.abs(B) > 1e-9) {
      const tiny = race.racers.filter(o => o.res.mode === 'arc' && 2 * o.res.r * T.s < 26);
      if (tiny.length) drawLens(tiny, t);
    }
  }
  function drawLens(list, t) {
    const rMax = Math.max(...list.map(o => o.res.r));
    const Rl = Math.min(80, H * 0.2), cxL = SX(0) + Rl + 40, cyL = H - Rl - 18;
    const k = (Rl * 0.8) / (2.4 * rMax);           // px per metre in the lens
    ctx.save();
    ctx.beginPath(); ctx.arc(cxL, cyL, Rl, 0, TAU); ctx.fillStyle = 'rgba(6,9,7,0.94)'; ctx.fill();
    ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 2; ctx.stroke();
    ctx.clip();
    const LX = x => cxL - Rl * 0.55 + x * k, LY = y => cyL - y * k;
    ctx.strokeStyle = '#b9c3bc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(LX(0), cyL - Rl); ctx.lineTo(LX(0), cyL + Rl); ctx.stroke();
    for (const o of list) {
      const st = sprintState(o, t), tA = o.res.tAcc;
      ctx.strokeStyle = o.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(LX(-rMax * 1.2), LY(0)); ctx.lineTo(LX(0), LY(0));
      if (t > tA) { const th = o.res.w * (Math.min(t, o.res.tFin) - tA); const n = Math.ceil(th / 0.05) + 2; for (let i = 1; i <= n; i++) { const a = th * i / n; ctx.lineTo(LX(o.res.r * Math.sin(a)), LY(o.res.rot * o.res.r * (1 - Math.cos(a)))); } }
      ctx.stroke();
      const px = t > tA ? LX(st.x) : LX(Math.max(-rMax * 1.2, st.x * (rMax * 1.2 / GEO.gate))), py = LY(t > tA ? st.y : 0);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = o.color; ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    const mag = k / T.s;
    haloText(ctx, `magnified ×${mag >= 100 ? Math.round(mag).toLocaleString('en-US') : pl(mag, 2)}`, cxL, cyL - Rl - 9, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#ffc278' });
    haloText(ctx, list.map(o => `${o.part.symbol}: 2r = ${len(2 * o.res.r, 3)}`).join('  '), cxL, cyL + Rl + 9, { font: '600 12px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#d3dcd5' });
  }

  /* Grand Prix: one small cyclotron per racer */
  function gpLayout() {
    const n = race ? race.racers.length : 3;
    const cell = W / n, rad = Math.min(cell * 0.42, H * 0.38);
    return { n, cell, rad, cy: H * 0.47 };
  }
  function drawGP(t, now) {
    const L = gpLayout();
    if (!race) return;
    // trails (incremental, offscreen)
    trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    trailCtx.lineWidth = 1.6; trailCtx.lineCap = 'round';
    race.racers.forEach((o, i) => {
      const cx = L.cell * (i + 0.5), cy = L.cy, k = L.rad / S.gpR;
      const st = gpState(o, t);
      if (st.i > o.drawn) {
        trailCtx.strokeStyle = hexA(o.color, 0.75); trailCtx.beginPath();
        for (let j = o.drawn; j < st.i; j++) {
          const s = o.run.segs[j];
          if (s.type === 'arc' && s.span > 0) { trailCtx.moveTo(cx + (s.cx + s.r * Math.cos(s.th0)) * k, cy - (s.cy + s.r * Math.sin(s.th0)) * k); trailCtx.arc(cx + s.cx * k, cy - s.cy * k, s.r * k, -s.th0, -(s.th0 + s.rot * s.span), s.rot > 0); }
          else if (s.type !== 'arc') { const Ls = s.v * (s.t1 - s.t0); trailCtx.moveTo(cx + s.x0 * k, cy - s.y0 * k); trailCtx.lineTo(cx + (s.x0 + s.ux * Ls) * k, cy - (s.y0 + s.uy * Ls) * k); }
        }
        trailCtx.stroke(); o.drawn = st.i;
      }
    });
    race.racers.forEach((o, i) => {
      const cx = L.cell * (i + 0.5), cy = L.cy, k = L.rad / S.gpR, Rp = L.rad;
      ctx.fillStyle = '#3a433e'; ctx.beginPath(); ctx.arc(cx, cy, Rp * 1.08, 0, TAU); ctx.fill();
      const gv = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rp * 1.05);
      gv.addColorStop(0, '#16201b'); gv.addColorStop(1, '#050807');
      ctx.fillStyle = gv; ctx.beginPath(); ctx.arc(cx, cy, Rp * 1.05, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(201,128,63,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(230,166,104,0.85)'; ctx.lineWidth = 1.3;
      const w = Math.max(4, Rp * 0.06);
      ctx.beginPath(); ctx.arc(cx, cy, Rp, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Rp, Math.PI / 2 + 0.05, 3 * Math.PI / 2 - 0.05); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,190,110,0.08)'; ctx.fillRect(cx - w / 2, cy - Rp, w, 2 * Rp);
    });
    ctx.drawImage(trailCv, 0, 0, W, H);
    race.racers.forEach((o, i) => {
      const cx = L.cell * (i + 0.5), cy = L.cy, k = L.rad / S.gpR, Rp = L.rad;
      const st = gpState(o, t);
      const s = st.s;
      // current partial arc
      ctx.strokeStyle = o.color; ctx.lineWidth = 2; ctx.beginPath();
      if (s.type === 'arc') { const a = s.w * (clamp(t, s.t0, s.t1) - s.t0); if (a > 0) { ctx.moveTo(cx + (s.cx + s.r * Math.cos(s.th0)) * k, cy - (s.cy + s.r * Math.sin(s.th0)) * k); ctx.arc(cx + s.cx * k, cy - s.cy * k, s.r * k, -s.th0, -(s.th0 + s.rot * a), s.rot > 0); } }
      else { ctx.moveTo(cx + s.x0 * k, cy - s.y0 * k); ctx.lineTo(cx + st.x * k, cy - st.y * k); }
      ctx.stroke();
      const px = cx + st.x * k, py = cy - st.y * k;
      const gl = ctx.createRadialGradient(px, py, 0, px, py, 14);
      gl.addColorStop(0, hexA(o.color, 0.95)); gl.addColorStop(1, hexA(o.color, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, TAU); ctx.fill();
      haloText(ctx, `${o.part.symbol}  ${NAMES[o.key]}`, cx, cy - Rp * 1.08 - 14, { font: '700 14.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: o.color });
      haloText(ctx, `K = ${en(st.K, 3)}`, cx, cy + Rp * 1.08 + 14, { font: '600 13.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#eef2ec' });
      haloText(ctx, `f = ${si(o.pred.fc, 'Hz', 3)}`, cx, cy + Rp * 1.08 + 30, { font: '500 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#93a197' });
      if (o.ext * k < 6) haloText(ctx, L.cell > 260 ? `orbits too small to see: r ≤ ${len(o.ext, 2)}` : `tiny orbits: r ≤ ${len(o.ext, 2)}`, cx, cy + Rp * 0.5, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: o.color });
      if (o.finished) pill(ctx, o.dnf ? 'did not finish' : 'extracted: ' + ['1st', '2nd', '3rd', '4th'][o.place - 1], cx, cy, o.dnf ? 'rgba(255,84,104,0.92)' : 'rgba(255,212,59,0.95)', '#140b00', '700 13.5px "Barlow Condensed", "Arial Narrow", sans-serif');
    });
    haloText(ctx, W > 640 ? `Identical machines: B = ${pl(S.gpB, 3)} T, R = ${pl(S.gpR, 3)} m, V = ${pl(S.gpV, 3)} kV · RF ${S.gpRf === 'fm' ? 'follows each particle' : 'fixed, tuned to each particle'}` : `B ${pl(S.gpB, 3)} T · R ${pl(S.gpR, 3)} m · V ${pl(S.gpV, 3)} kV · RF ${S.gpRf === 'fm' ? 'follows' : 'fixed'}`, W / 2, H - 12, { font: '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#b9adff' });
  }

  function draw(now) {
    const { ctx: c } = fitCanvas(cv, W, H); ctx = c;
    ctx.clearRect(0, 0, W, H);
    // arena backdrop
    CL.screenBg(ctx, W, H, { grid: 40, ticks: false });
    const t = race ? race.clock : 0;
    if (S.type === 'sprint') drawSprint(t, now); else drawGP(t, now);
    fx.draw(ctx, W, H);
  }

  /* ------------------------------------------------------------------
     Board, results, missions
     ------------------------------------------------------------------ */
  function renderBoard() {
    const el = $('#raceBoard');
    if (!race) { el.innerHTML = ''; return; }
    el.innerHTML = race.racers.map(o => `<div class="lane" data-lane="${o.lane}"><div class="lane-pos">–</div><div class="lane-name"><i style="background:${o.color};color:${o.color}"></i><div>${o.part.symbol} ${NAMES[o.key]}<small>q/m = ${e(Math.abs(o.part.z) * C.e / o.part.mass, 3)} C/kg</small></div></div><div class="lane-gauge"><div class="lane-bar"><i style="background:${o.color}"></i></div><div class="lane-meta"><span class="lm-v"></span><span class="lm-k"></span></div></div><div class="lane-time"><span class="lt">waiting</span><small class="ls"></small></div></div>`).join('');
  }
  function updateBoard(t) {
    if (!race) return;
    for (const o of race.racers) {
      const lane = $(`#raceBoard .lane[data-lane="${o.lane}"]`); if (!lane) continue;
      let v, K, frac;
      if (race.type === 'sprint') { const st = sprintState(o, t); v = st.v; K = st.K; frac = clamp(t / o.res.tFin, 0, 1); }
      else { const st = gpState(o, t); v = st.v; K = st.K; frac = clamp(K / o.pred.Kmax, 0, 1); }
      lane.querySelector('.lane-bar i').style.width = (frac * 100).toFixed(1) + '%';
      lane.querySelector('.lm-v').textContent = `v = ${e(v, 3)} m/s (${pct(v / C.c, 3)} c)`;
      lane.querySelector('.lm-k').textContent = `K = ${en(K, 3)}`;
      const lt = lane.querySelector('.lt'), ls = lane.querySelector('.ls'), pos = lane.querySelector('.lane-pos');
      if (o.finished) {
        lt.textContent = si(o.tEnd, 's', 4);
        ls.textContent = o.dnf ? (race.type === 'sprint' ? 'hit the wall' : 'did not finish') : race.type === 'sprint' ? (o.res.finish === 'plate' ? `landed ${len(Math.abs(o.res.yEnd), 3)} away` : 'crossed the line') : `extracted at ${en(o.run.Kfinal, 3)}`;
        pos.textContent = o.dnf ? 'DNF' : String(o.place);
        pos.classList.toggle('is-dnf', o.dnf);
        lane.classList.toggle('is-first', o.place === 1 && !o.dnf);
      } else if (race.state === 'run') { lt.textContent = si(Math.min(t, o.tEnd), 's', 3); ls.textContent = 'racing…'; pos.textContent = '–'; }
      else { lt.textContent = 'waiting'; ls.textContent = ''; pos.textContent = '–'; pos.classList.remove('is-dnf'); lane.classList.remove('is-first'); }
    }
  }
  function narrateRace(done) {
    const el = $('#raceNarrateX'); if (!el) return;
    let h;
    if (!done) h = S.type === 'sprint'
      ? 'Every racer gets the same push through the gate, then the magnetic field bends it round in a <b>half circle</b> back to the finish plate. Guess the winner, then press <b>Start race</b>.'
      : 'Each racer gets its <b>own identical cyclotron</b>. Who reaches full speed first? Most people guess the lightest particle. Press <b>Start race</b> and see.';
    else {
      const fin = race.order.filter(o => !o.dnf), w = fin[0];
      if (!w) h = 'Nobody finished: every racer hit the wall. Try a weaker push or a stronger field.';
      else if (race.type === 'sprint' && S.B !== 0) h = `<b>${w.part.name}</b> won. In a magnetic field, the time for half a circle depends only on how much charge a particle has for its mass, not on its speed: a faster racer simply runs a <b>wider circle</b>.${w.part.key === 'electron' || w.part.key === 'positron' ? ' The electron is about 1836 times lighter than a proton, so it is in a league of its own.' : ''}`;
      else if (race.type === 'sprint') h = `<b>${w.part.name}</b> won the straight race. Without a field, nothing bends the racers, so the fastest one simply arrives first.`;
      else h = `<b>${w.part.name}</b> won, but look at the times: it is almost a <b>dead heat</b>. In identical cyclotrons a heavier particle gains energy just as fast per lap, and every lap takes a time that grows with its mass, so it all cancels out.`;
    }
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  function renderResults(done) {
    const box = $('#raceResults');
    narrateRace(done);
    if (!done) { box.innerHTML = '<div class="panel-title">Results</div><p class="hint">Run a race to see the podium and the physics behind the result.</p>'; return; }
    const ord = race.order;
    const fin = ord.filter(o => !o.dnf);
    let why;
    if (race.type === 'sprint') {
      if (S.B === 0) {
        why = `With B = 0 it is a straight race: the gate time plus ${pl(GEO.Lx, 3)} m at constant speed. ${S.mode === 'voltage' ? 'The same voltage gives each racer K = |q|V, so the light, highly charged racers are fastest.' : S.mode === 'energy' ? 'The same energy means v = √(2K/m): the lightest racer is fastest.' : 'Same speed: everyone takes nearly the same time; only the push through the gate differs.'}`;
      } else {
        why = 'Half a circle in a magnetic field takes t = πγm/(|q|B). The starting speed cancels out: a faster racer just runs a bigger circle (landing distance 2r = 2p/(|q|B)). So the racer with the biggest charge-to-mass ratio q/m wins.';
        if (fin.length >= 2) {
          const a = fin[0], b = fin[1], ratio = b.tEnd / a.tEnd;
          why += ` ${a.part.symbol} beat ${b.part.symbol} by a factor of ${pl(ratio, ratio < 1.01 ? 6 : 3)}.`;
          if (ratio < 1.001) why += ' That is a photo finish: their q/m differ only by the tiny mass defect of nuclear binding energy (E = mc²).';
        }
        const walls = ord.filter(o => o.dnf);
        if (walls.length) why += ` ${walls.map(o => o.part.symbol).join(', ')} hit the arena wall: its circle (r = ${len(walls[0].res.r, 3)}) was too big for the field region.`;
      }
    } else {
      why = 'In identical cyclotrons the time to reach the edge is t ≈ πBR²/(2V), with no mass and no charge in it, so the race is nearly a dead heat. What is left comes from relativity (γ makes each turn take longer) and from how the last energy step lands.';
      const dnf = ord.filter(o => o.dnf);
      if (dnf.length) why += ` ${dnf.map(o => o.part.symbol).join(', ')} dropped out: ${S.gpRf === 'fixed' ? 'with a fixed RF frequency, relativity made each turn slower and slower until the pushes came at the wrong time.' : 'it fell out of step with the RF.'}`;
      if (fin.length >= 2) why += ` Gap between first and second: ${pl((fin[1].tEnd / fin[0].tEnd - 1) * 100, 3)} %.`;
    }
    box.innerHTML = '<div class="panel-title">Results</div><ol>' + ord.map(o => `<li><b style="color:${o.color}">${o.part.symbol} ${NAMES[o.key]}</b>: ${o.dnf ? 'DNF' : si(o.tEnd, 's', 5)}${race.type === 'gp' && !o.dnf ? `, ${en(o.run.Kfinal, 3)}` : ''}</li>`).join('') + `</ol><p class="why">${why}</p>`;
  }
  function checkMissions() {
    const fresh = [];
    const fin = race.order.filter(o => !o.dnf);
    if (race.type === 'sprint' && S.B !== 0) {
      for (let i = 0; i + 1 < fin.length; i++) if (fin[i + 1].tEnd / fin[i].tEnd - 1 < 1e-3) { const m = missions.complete('race-photo'); if (m) fresh.push(m); break; }
    }
    if (race.type === 'gp') {
      if (fin.length >= 2 && fin[1].tEnd / fin[0].tEnd - 1 < 0.01 && fin[0].key !== fin[1].key && Math.abs(fin[0].part.mass - fin[1].part.mass) > 1e-30) { const m = missions.complete('race-tie'); if (m) fresh.push(m); }
      if (race.order.some(o => o.dnf)) { const m = missions.complete('race-dnf'); if (m) fresh.push(m); }
    }
    if (fresh.length) toast($('#raceToast'), `<b>Mission complete: ${fresh.map(m => m.title).join(', ')}</b>`, '', 6000);
  }
  function renderMissions() {
    missions.render($('#raceMissions'), 'race');
    const [d, n] = missions.count('race'); $('#raceMissionCount').textContent = `${d} / ${n}`;
  }
  const setStatus = (txt, cls = '') => { const h = $('#raceStatus'); h.textContent = txt; h.className = 'hud hud-status ' + cls; };

  /* ------------------------------------------------------------------
     Replay
     ------------------------------------------------------------------ */
  function startReplay() {
    if (!race || !race.done) return;
    const fin = race.order.filter(o => !o.dnf);
    let pair = null;
    for (let i = 0; i + 1 < fin.length; i++) { const g = fin[i + 1].tEnd / fin[i].tEnd - 1; if (!pair || g < pair.g) pair = { a: fin[i], b: fin[i + 1], g }; }
    resetTrail();
    if (race.type === 'sprint' && pair && pair.g < 0.05 && S.B !== 0) {
      const a = pair.a, b = pair.b, dt = b.tEnd - a.tEnd, tc = (a.tEnd + b.tEnd) / 2, w = Math.max(dt * 2.5, a.tEnd * 2e-4);
      const travel = Math.max(a.res.v, b.res.v) * 2 * w;           // distance covered during the replay window
      const zy = (a.res.yEnd + b.res.yEnd) / 2;
      const k = clamp((GEO.Lx + GEO.gate + 0.14) / Math.max(5 * travel, 1e-9), 1, 4000);
      replay = { t0: tc - w, t1: tc + w, real: 7, zoom: { y: zy, k }, start: performance.now() };
      $('#raceLbSpeed').textContent = '×' + e((2 * w / 7) / (race.Tmax / duration()), 2);
      $('#raceLbInfo').textContent = `${a.part.symbol} vs ${b.part.symbol}: ${pl(pair.g * 100, 3)} % apart  ·  ` + race.order.filter(o => !o.dnf).slice(0, 4).map(o => `${o.part.symbol} ${si(o.tEnd, 's', 6)}`).join('  ');
    } else {
      replay = { t0: 0, t1: race.Tmax, real: duration() * 10, zoom: null, start: performance.now() };
      $('#raceLbSpeed').textContent = '0.1×';
      $('#raceLbInfo').textContent = 'whole race in slow motion';
    }
    race.clock = replay.t0;
    for (const o of race.racers) { o.finished = o.tEnd <= race.clock; o.drawn = 0; o.segIdx = 0; }
    $('#raceLetterbox').classList.add('is-on');
    audio.whoosh();
  }
  function endReplay() {
    replay = null; $('#raceLetterbox').classList.remove('is-on');
    if (race) { race.clock = race.Tmax; for (const o of race.racers) o.finished = true; resetTrail(); }
  }

  /* ------------------------------------------------------------------
     Loop
     ------------------------------------------------------------------ */
  function frame(now, dt) {
    if (!active) return;
    if (race) {
      if (race.state === 'count') {
        const before = Math.ceil(race.countT);
        race.countT -= dt;
        const after = Math.ceil(race.countT);
        if (race.countT <= 0) { race.state = 'run'; showCount('GO!'); setTimeout(() => { $('#raceCount').hidden = true; }, 600); audio.beep(1040, 0.25); audio.whoosh(); setStatus('Racing…', 'is-run'); }
        else if (after !== before) { showCount(String(after)); audio.beep(520, 0.15); }
      } else if (race.state === 'run' && !replay) {
        race.clock = Math.min(race.Tmax, race.clock + dt * race.Tmax / duration());
        for (const o of race.racers) {
          if (!o.finished && race.clock >= o.tEnd) {
            o.finished = true; race.finishedN++;
            const p = finishPoint(o);
            if (o.dnf) { fx.burst(p.x, p.y, 40, { speed: 220, life: 0.7, colors: ['255,120,90', '255,200,140'] }); audio.crunch(); }
            else { fx.burst(p.x, p.y, 34, { speed: 200, life: 0.7, colors: [CL.hexRGB(o.color), '255,255,255'] }); fx.ring(p.x, p.y, { speed: 160, life: 0.6, color: CL.hexRGB(o.color) }); if (o.place === 1) { audio.ding(); shake.kick(3, 0.3); } else audio.tick(0.4); }
          }
        }
        if (race.clock >= race.Tmax && !race.done) {
          race.done = true; race.state = 'done';
          const w = race.order[0];
          setStatus(w.dnf ? 'Nobody finished' : `${w.part.symbol} ${NAMES[w.key]} wins in ${si(w.tEnd, 's', 4)}!`, w.dnf ? 'is-bad' : 'is-good');
          renderResults(true); $('#raceReplay').disabled = false; audio.fanfare();
          checkMissions();
        }
      } else if (replay) {
        const f = clamp((now - replay.start) / 1000 / replay.real, 0, 1);
        race.clock = replay.t0 + (replay.t1 - replay.t0) * f;
        for (const o of race.racers) if (!o.finished && race.clock >= o.tEnd) { o.finished = true; const p = finishPoint(o); fx.ring(p.x, p.y, { speed: 120, life: 0.7, color: CL.hexRGB(o.color) }); audio.tick(0.6); }
        if (f >= 1 && !replay.endAt) replay.endAt = now;
        if (replay.endAt && now - replay.endAt > 1500) endReplay();
      }
    }
    fx.update(dt); shake.update(now);
    draw(now);
    updateBoard(race ? race.clock : 0);
    $('#raceTime').textContent = `t = ${si(race ? race.clock : 0, 's', 4)}` + (race ? ` · slowed down ≈ ${e((replay ? (replay.real / (replay.t1 - replay.t0)) : duration() / race.Tmax), 2)}×` : '');
  }
  function finishPoint(o) {
    if (race.type === 'sprint') { sprintView(); const st = sprintState(o, o.tEnd); return { x: SX(st.x), y: SY(st.y + laneY(o)) }; }
    const L = gpLayout(), i = race.racers.indexOf(o), k = L.rad / S.gpR, st = gpState(o, o.tEnd);
    return { x: L.cell * (i + 0.5) + st.x * k, y: L.cy - st.y * k };
  }

  /* ------------------------------------------------------------------
     Controls
     ------------------------------------------------------------------ */
  function buildRacers() {
    const box = $('#racers');
    box.innerHTML = [0, 1, 2, 3].map(i => `<div class="racer-row"><i id="racerDot${i}"></i><select id="racerSel${i}" aria-label="Racer ${i + 1}">${i > 0 ? '<option value="">— no racer —</option>' : ''}${CHOICES.map(k => `<option value="${k}">${PHYS.PARTICLES[k].symbol} ${NAMES[k]}</option>`).join('')}</select></div>`).join('');
    [0, 1, 2, 3].forEach(i => {
      const sel = $('#racerSel' + i);
      sel.value = S.racers[i] || '';
      sel.addEventListener('change', () => { S.racers[i] = sel.value; syncRacers(); buildRace(); });
    });
    syncRacers();
  }
  function syncRacers() {
    [0, 1, 2, 3].forEach(i => { const k = S.racers[i]; const dot = $('#racerDot' + i); dot.style.background = k ? PHYS.PARTICLES[k].color : 'transparent'; dot.style.border = k ? '0' : '1px dashed var(--ink-3)'; });
  }
  function syncType() {
    $('#sprintPanel').hidden = S.type !== 'sprint';
    $('#gpPanel').hidden = S.type !== 'gp';
    $('#raceTypeNote').textContent = S.type === 'sprint'
      ? 'Each racer is pushed through the same gate, then a magnetic field bends it into a half circle back onto a detector plate, like a mass spectrometer. First to land wins.'
      : 'Each racer gets its own identical cyclotron with the RF tuned to it. First to be extracted at the edge wins.';
  }
  function bindModeSlider() {
    const md = MODES[S.mode];
    $('#raceValLabel').textContent = md.label; $('#raceValUnit').textContent = md.unit;
    if (!ctlVal) ctlVal = bindRange({ range: $('#r-raceVal'), num: $('#n-raceVal'), min: md.min, max: md.max, log: true, get: () => S.vals[S.mode], set: v => { S.vals[S.mode] = v; buildRace(); } });
    else ctlVal.setLimits(md.min, md.max);
    ctlVal.sync();
  }
  function bindControls() {
    segInit($('#raceType'), () => S.type, v => { S.type = v; syncType(); resize(); buildRace(); });
    segInit($('#raceStartMode'), () => S.mode, v => { S.mode = v; bindModeSlider(); buildRace(); });
    segInit($('#gpRf'), () => S.gpRf, v => { S.gpRf = v; buildRace(); });
    bindModeSlider();
    bindRange({ range: $('#r-raceB'), num: $('#n-raceB'), min: -2, max: 2, step: 0.005, get: () => S.B, set: v => { S.B = Math.abs(v) < 0.0025 ? 0 : v; buildRace(); } });
    bindRange({ range: $('#r-gpB'), num: $('#n-gpB'), min: 0.1, max: 3, step: 0.01, get: () => S.gpB, set: v => { S.gpB = v; buildRace(); } });
    bindRange({ range: $('#r-gpR'), num: $('#n-gpR'), min: 0.1, max: 1, step: 0.01, get: () => S.gpR, set: v => { S.gpR = v; buildRace(); } });
    bindRange({ range: $('#r-gpV'), num: $('#n-gpV'), min: 5, max: 500, log: true, get: () => S.gpV, set: v => { S.gpV = v; buildRace(); } });
    $('#raceRel').addEventListener('change', ev => { S.rel = ev.target.checked; buildRace(); });
    $('#raceSlow').addEventListener('change', ev => { S.slow = ev.target.checked; });
    $('#raceStart').addEventListener('click', startRace);
    $('#raceReset').addEventListener('click', () => { buildRace(); $('#raceCount').hidden = true; });
    $('#raceReplay').addEventListener('click', startReplay);
    $('#raceToast .toast-close').addEventListener('click', () => { $('#raceToast').hidden = true; });
    CL.bus.on('mission', renderMissions);
    document.addEventListener('keydown', ev => {
      if (!active) return;
      const tg = ev.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      if (ev.key === ' ' && tg !== 'BUTTON' && tg !== 'SUMMARY') { ev.preventDefault(); startRace(); }
    });
  }

  function resize() {
    if (!active) return;
    const wrap = $('#raceWrap');
    const w = wrap.clientWidth;
    const h = userH ? Math.round(clamp(userH, 220, 1600)) : Math.round(clamp(S.type === 'gp' ? w * 0.5 : w * 0.66, 280, Math.max(300, window.innerHeight * 0.62)));
    wrap.style.setProperty('--arena-h', h + 'px');
    W = w; H = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!trailCv) { trailCv = document.createElement('canvas'); trailCtx = trailCv.getContext('2d'); }
    trailCv.width = Math.round(W * dpr); trailCv.height = Math.round(H * dpr);
    resetTrail();
    if (race) for (const o of race.racers) o.drawn = 0;
  }

  function init() {
    cv = $('#raceCanvas');
    shake = shaker($('#raceWrap'));
    buildRacers(); syncType(); bindControls(); renderMissions();
    CL.grip($('#raceGrip'), {
      axis: 'y', get: () => H,
      set: (v, dragging) => { userH = Math.round(v); resize(); userH = H; if (!dragging) CL.store.set('cl-h-race', userH); CL.sizeBadge($('#raceWrap'), `${W} × ${H} px`, dragging ? 'release to keep this height' : 'double-click the corner for automatic height', dragging ? 0 : 1400); },
      reset: () => { userH = 0; CL.store.set('cl-h-race', 0); resize(); CL.sizeBadge($('#raceWrap'), `${W} × ${H} px`, 'automatic height'); },
    });
    buildRace();
  }
  CL.screens.race = { init, show() { active = true; requestAnimationFrame(() => { resize(); }); }, hide() { active = false; }, frame, resize };
})();
