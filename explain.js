/* =====================================================================
   Project Lorentz — "How it works" (CL.explain).
   A short animated explainer, one step at a time, that pops up the first
   time a station or a real-life example is opened: the Cyclotron, the
   Gauss gun, PET medicine and the maglev train. Each step has one
   handwritten sentence, one plain line under it, and an animation that
   keeps looping until the reader moves on, so nobody is rushed.
   Space, Enter or → goes to the next step; ← goes back; Esc closes.
   The "How it works" keys in the stations open it again.
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, TAU, audio, fitCanvas, bus } = CL;
  const FONT = (n, w = 600) => `${w} ${Math.round(n)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const lerp = (a, b, u) => a + (b - a) * u;

  /* ---------------- drawing helpers ---------------- */
  function text(c, s, x, y, o = {}) {
    CL.haloText(c, s, x, y, { font: FONT(o.size || 15, o.w || 600), align: o.align || 'center', base: o.base || 'middle', color: o.color || '#eef2ec', halo: o.halo || 4 });
  }
  function glow(c, x, y, r, rgb, a = 1) {
    if (!(r > 0.5) || a <= 0) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.35, `rgba(${rgb},${0.45 * a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function arrow(c, x0, y0, x1, y1, col, w = 2.5) {
    const a = Math.atan2(y1 - y0, x1 - x0), hl = Math.max(9, w * 4);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 - Math.cos(a) * hl * 0.6, y1 - Math.sin(a) * hl * 0.6); c.stroke();
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - Math.cos(a - 0.42) * hl, y1 - Math.sin(a - 0.42) * hl); c.lineTo(x1 - Math.cos(a + 0.42) * hl, y1 - Math.sin(a + 0.42) * hl); c.closePath(); c.fill();
  }
  function proton(c, x, y, s, a = 1) {
    glow(c, x, y, Math.max(16, s * 0.09), '255,170,90', 0.9 * a);
    c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.arc(x, y, Math.max(3, s * 0.013), 0, TAU); c.fill();
  }
  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const fz = b => clamp(Math.min(b.w, b.h * 1.8) / 40, 14, 22);      // label size for this scene box

  /* ======================================================================
     THE CYCLOTRON
     B points into the screen, so a proton (+) goes round anticlockwise.
     Every half-turn takes the same time; the radius grows as √(pushes).
     ====================================================================== */
  const CY = { HALF: 10, HT: 0.9 };             // half-turns of the spiral, and the time for each (the same for all)
  function cyGeom(b, room = 0) {          // room: space kept free under the machine (for the row of beat dots)
    const R = Math.max(60, Math.min((b.h - room) * 0.41, b.w * 0.3)), cx = b.x + b.w / 2, cy = b.y + (b.h - room) / 2 + 4;
    const Rs = R * 0.92, sp = [];
    let y = 0;
    for (let k = 0; k < CY.HALF; k++) {
      const up = k % 2 === 0, r = Rs * Math.sqrt((k + 1) / CY.HALF), c = up ? y - r : y + r;
      sp.push({ r, cy: c, a0: up ? Math.PI / 2 : -Math.PI / 2 });
      y = up ? c - r : c + r;
    }
    const shift = (sp[CY.HALF - 1].cy + sp[CY.HALF - 2].cy) / 2;
    for (const s of sp) s.cy -= shift;
    return { R, cx, cy, sp };
  }
  const cyPos = (g, k, f) => { const s = g.sp[k], a = s.a0 - Math.PI * f; return [g.cx + Math.cos(a) * s.r, g.cy + s.cy + Math.sin(a) * s.r]; };
  function cyMachine(c, g, o) {
    const { R, cx, cy } = g, mag = o.mag || 0;
    const halo = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.45); halo.addColorStop(0, `rgba(201,128,63,${0.12 * mag})`); halo.addColorStop(1, 'rgba(201,128,63,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, R * 1.45, 0, TAU); c.fill();
    c.save(); c.globalAlpha = 0.3 + 0.7 * mag;
    const cg = c.createRadialGradient(cx, cy, R * 1.08, cx, cy, R * 1.2); cg.addColorStop(0, '#5a2c0e'); cg.addColorStop(0.5, '#d7975f'); cg.addColorStop(1, '#6b3412');
    c.fillStyle = cg; c.beginPath(); c.arc(cx, cy, R * 1.2, 0, TAU); c.arc(cx, cy, R * 1.08, 0, TAU, true); c.fill();
    c.restore();
    c.fillStyle = 'rgba(6,10,8,0.92)'; c.beginPath(); c.arc(cx, cy, R * 1.04, 0, TAU); c.fill();
    if (o.field > 0) {                                   // ⊗: the field points into the screen
      const fs = Math.max(20, R * 0.17), q = Math.min(3, fs * 0.13);
      c.strokeStyle = 'rgb(179,166,255)'; c.lineWidth = 1;
      for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) {
        const px = cx + (i + 0.5) * fs, py = cy + (j + 0.5) * fs, d = Math.hypot(px - cx, py - cy);
        if (d > R * 0.96 || Math.abs(px - cx) < R * 0.06) continue;
        const a = clamp(o.field * 2.2 - d / R, 0, 1) * 0.3; if (a <= 0.01) continue;
        c.globalAlpha = a; c.beginPath(); c.moveTo(px + q * 1.5, py); c.arc(px, py, q * 1.5, 0, TAU);
        c.moveTo(px - q, py - q); c.lineTo(px + q, py + q); c.moveTo(px + q, py - q); c.lineTo(px - q, py + q); c.stroke();
      }
      c.globalAlpha = 1;
    }
    if (o.dees > 0) {                                    // the two D's; + red, − blue, flipping every half-turn
      c.save(); c.globalAlpha = o.dees;
      const w = R * 0.06, h = Math.sqrt(R * R - w * w / 4), th = Math.acos(w / 2 / R), pol = o.pol || 0;
      const dR = new Path2D(); dR.moveTo(cx + w / 2, cy - h); dR.arc(cx, cy, R, -th, th, false); dR.closePath();
      const dL = new Path2D(); dL.moveTo(cx - w / 2, cy + h); dL.arc(cx, cy, R, Math.PI - th, Math.PI + th, false); dL.closePath();
      const a = Math.abs(pol) * 0.24;
      c.fillStyle = pol > 0 ? `rgba(229,72,63,${a})` : `rgba(62,126,230,${a})`; c.fill(dL);
      c.fillStyle = pol > 0 ? `rgba(62,126,230,${a})` : `rgba(229,72,63,${a})`; c.fill(dR);
      c.shadowColor = 'rgba(255,140,60,0.6)'; c.shadowBlur = 14; c.strokeStyle = 'rgba(232,168,106,0.95)'; c.lineWidth = 2; c.stroke(dL); c.stroke(dR); c.shadowBlur = 0;
      if (o.signs && pol) {
        const sa = 0.25 + Math.abs(pol) * 0.5, sz = R * 0.22;
        text(c, pol > 0 ? '+' : '−', cx - R * 0.6, cy, { size: sz, w: 700, color: pol > 0 ? `rgba(255,140,130,${sa})` : `rgba(140,180,255,${sa})`, halo: 0.1 });
        text(c, pol > 0 ? '−' : '+', cx + R * 0.6, cy, { size: sz, w: 700, color: pol > 0 ? `rgba(140,180,255,${sa})` : `rgba(255,140,130,${sa})`, halo: 0.1 });
      }
      c.restore();
    }
  }
  // the spiral up to half-turn k (fraction f of it), drawn as a rainbow trail
  function cyTrail(c, g, k, f, a = 1) {
    const pal = CL.palette('rainbow');
    c.lineCap = 'round'; c.lineWidth = Math.max(2, g.R * 0.013);
    for (let i = 0; i <= Math.min(k, CY.HALF - 1); i++) {
      const s = g.sp[i], ff = i < k ? 1 : f; if (ff <= 0) continue;
      c.strokeStyle = pal[Math.round(i / (CY.HALF - 1) * (pal.length - 1))]; c.globalAlpha = a * 0.95;
      c.beginPath(); c.arc(g.cx, g.cy + s.cy, s.r, s.a0, s.a0 - Math.PI * ff, true); c.stroke();
    }
    c.globalAlpha = 1;
  }
  function topLabel(c, g, b, s, col) { text(c, s, g.cx, Math.max(b.y + 14, g.cy - g.R * 1.2 - 18), { size: fz(b), color: col }); }
  // a little bar beside the machine: the proton's speed, growing with every push (v ∝ r, since every half-turn takes the same time)
  function speedBar(c, g, b, frac, label = 'speed') {
    const x = Math.min(b.x + b.w - 40, g.cx + g.R * 1.45), y0 = g.cy + g.R * 0.7, hgt = g.R * 1.3;
    if (x - g.cx < g.R * 1.3) return;
    c.fillStyle = 'rgba(255,255,255,0.08)'; rrect(c, x - 9, y0 - hgt, 18, hgt, 6); c.fill();
    const hh = hgt * clamp(frac, 0, 1), gr = c.createLinearGradient(0, y0, 0, y0 - hgt); gr.addColorStop(0, '#7b5cff'); gr.addColorStop(1, '#ff7a45');
    c.fillStyle = gr; rrect(c, x - 9, y0 - hh, 18, hh, 6); c.fill();
    text(c, label, x, y0 + 16, { size: fz(b) * 0.9, color: '#ffd9a8' });
  }

  const cyclotron = {
    kicker: 'How it works', title: 'The cyclotron', done: 'Start the cyclotron',
    steps: [
      { main: 'This is a proton.', sub: 'A tiny particle with a + charge, flying in a straight line.', eq: 'charge q = +1.6 × 10⁻¹⁹ C   ·   mass m = 1.67 × 10⁻²⁷ kg',
        draw(c, t, b) {
          const g = cyGeom(b), r0 = g.sp[0].r, yb = g.cy + g.sp[0].cy + r0;
          cyMachine(c, g, { mag: 0 });
          const v = Math.max(120, b.w / 4.5), span = b.w + 160, x = b.x - 60 + (t * v) % span;
          const lg = c.createLinearGradient(x - 220, 0, x, 0); lg.addColorStop(0, 'rgba(255,200,150,0)'); lg.addColorStop(1, 'rgba(255,200,150,0.8)');
          c.strokeStyle = lg; c.lineWidth = Math.max(2, g.R * 0.013); c.beginPath(); c.moveTo(x - 220, yb); c.lineTo(x, yb); c.stroke();
          proton(c, x, yb, g.R);
          text(c, 'proton (+)', x, yb - Math.max(26, g.R * 0.12), { size: fz(b), color: '#ffe7c4' });
          text(c, 'the magnet (switched off)', g.cx, g.cy - g.R * 1.2 - 18, { size: fz(b) * 0.9, color: 'rgba(215,151,95,0.8)' });
        } },
      { main: 'The magnet is made of coils of copper wire.', sub: 'Current in the coils makes a magnetic field across the gap between two iron poles. More coils, more turns or more current: a stronger field.',
        eq: 'B = μ₀NI / g   (N turns in all, current I, gap g)',
        draw(c, t, b) {
          const P = 5, u = t % P, I = ease(clamp(u / 2.2, 0, 1)) * clamp((P - u) / 0.5, 0, 1);
          const cx = b.x + b.w / 2, cy = b.y + b.h / 2, w = Math.min(b.w * 0.5, b.h * 1.25), gap = Math.max(36, b.h * 0.16), ph = Math.max(28, b.h * 0.16);
          // the iron: two poles joined by a yoke at the back
          c.fillStyle = '#4a545c'; c.fillRect(cx - w / 2, cy - gap / 2 - ph, w, ph); c.fillRect(cx - w / 2, cy + gap / 2, w, ph);
          c.fillStyle = '#39424a'; c.fillRect(cx + w / 2, cy - gap / 2 - ph, ph * 0.8, gap + 2 * ph);
          // the coils round each pole, with the current shown going into (⊗) and out of (⊙) the page
          for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
            const x = cx + sx * (w / 2 + 14) - (sx > 0 ? 0 : 0), y = cy + sy * (gap / 2 + ph / 2), cw = Math.max(26, w * 0.09), ch = ph * 0.95;
            const gr = c.createLinearGradient(0, y - ch / 2, 0, y + ch / 2); gr.addColorStop(0, '#8a5124'); gr.addColorStop(0.5, I > 0.1 ? '#ffd29a' : '#c8803f'); gr.addColorStop(1, '#6d3a17');
            c.fillStyle = gr; c.fillRect(x - cw / 2 - (sx > 0 ? -ph * 0.8 : 0), y - ch / 2, cw, ch);
            const xx = x - (sx > 0 ? -ph * 0.8 : 0);
            if (I > 0.05) text(c, sx < 0 ? '⊙' : '⊗', xx, y, { size: fz(b) * 1.1, color: `rgba(255,240,210,${I})` });
          }
          // the field in the gap: arrows down through the gap, getting stronger with the current
          const n = 9;
          for (let i = 0; i < n; i++) {
            const x = cx - w * 0.42 + i * w * 0.84 / (n - 1), a = I;
            if (a > 0.02) arrow(c, x, cy - gap / 2 + 4, x, cy + gap / 2 - 4, `rgba(179,166,255,${0.25 + 0.75 * a})`, 1.5 + 2 * a);
          }
          text(c, 'iron pole', cx - w * 0.3, cy - gap / 2 - ph / 2, { size: fz(b) * 0.9, color: '#dfe8ee' });
          text(c, 'copper coils', cx - w / 2 - 14, cy - gap / 2 - ph - fz(b), { size: fz(b) * 0.9, color: '#e0a46a' });
          text(c, 'gap g: the dees sit here', cx + w * 0.18, cy + gap / 2 + ph + fz(b) * 1.1, { size: fz(b) * 0.9, color: '#dfe8ee' });
          text(c, `current I: ${Math.round(I * 100)} %`, b.x + b.w * 0.14, b.y + b.h * 0.2, { size: fz(b) * 1.2, color: '#ffcf8a' });
          text(c, `field B: ${(I * 1.0).toFixed(2)} T`, b.x + b.w * 0.86, b.y + b.h * 0.2, { size: fz(b) * 1.2, color: '#cfc7ff' });
        } },
      { main: 'Switch on the magnet: the path bends into a circle.', sub: 'The magnet’s force always points to the centre, so it turns the proton without speeding it up.', eq: 'F = qvB, always at 90° to the velocity: it turns the proton but does no work',
        draw(c, t, b) {
          const g = cyGeom(b), s0 = g.sp[0], r0 = s0.r, yc = g.cy + s0.cy, om = Math.PI / CY.HT, v = om * r0, T1 = 1.1;
          cyMachine(c, g, { mag: ease(t / 0.6), field: clamp(t / 1.2, 0, 1) });
          topLabel(c, g, b, '⊗  magnetic field, into the screen', '#cfc7ff');
          let px, py, ang = null;
          c.lineWidth = Math.max(2, g.R * 0.013);
          if (t < T1) { px = g.cx - v * (T1 - t); py = yc + r0; c.strokeStyle = 'rgba(255,200,150,0.6)'; c.beginPath(); c.moveTo(g.cx - v * T1, py); c.lineTo(px, py); c.stroke(); }
          else {
            ang = Math.PI / 2 - om * (t - T1); px = g.cx + Math.cos(ang) * r0; py = yc + Math.sin(ang) * r0;
            c.strokeStyle = CL.palette('rainbow')[0]; c.beginPath(); c.arc(g.cx, yc, r0, Math.PI / 2, Math.PI / 2 - Math.min(TAU, om * (t - T1)), true); c.stroke();
          }
          proton(c, px, py, g.R);
          if (ang !== null) {
            const ux = Math.sin(ang), uy = -Math.cos(ang), fx = -Math.cos(ang), fy = -Math.sin(ang), Lv = Math.max(38, g.R * 0.32), Lf = Math.min(r0 * 0.8, Math.max(28, g.R * 0.24));
            arrow(c, px, py, px + ux * Lv, py + uy * Lv, '#7ee2a0', 2.5);
            arrow(c, px, py, px + fx * Lf, py + fy * Lf, '#ff8fc8', 2.5);
            text(c, 'velocity', px + ux * (Lv + 18), py + uy * (Lv + 18), { size: fz(b) * 0.9, color: '#a8f0c0' });
            text(c, 'force', px + fx * (Lf + 15), py + fy * (Lf + 15), { size: fz(b) * 0.9, color: '#ffb0e0' });
          }
        } },
      { main: 'Each time it crosses the gap, it gets a push.', sub: 'The two metal D’s flip between + and −. Faster means a bigger circle.', eq: 'energy gained at each crossing: ΔK = qV (200 kV gives 200 keV)',
        draw(c, t, b, S) { cySpiralScene(c, t, b, S, false); } },
      { main: 'A faster proton makes a bigger circle.', sub: 'Twice the speed, twice the radius: the magnet’s pull has a harder job turning it. Watch both protons: they still go round together.',
        eq: 'r = mv / qB',
        draw(c, t, b) {
          const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r1 = Math.min(b.h * 0.2, b.w * 0.12), r2 = r1 * 2, om = Math.PI / CY.HT, a = Math.PI / 2 - om * t;
          cyMachine(c, { R: r2 * 1.12, cx, cy }, { mag: 1, field: 1 });
          c.lineWidth = 2.2;
          c.strokeStyle = '#7b5cff'; c.beginPath(); c.arc(cx, cy, r1, 0, TAU); c.stroke();
          c.strokeStyle = '#ff9a4a'; c.beginPath(); c.arc(cx, cy, r2, 0, TAU); c.stroke();
          for (const [r, lab, col, L] of [[r1, 'speed v, radius r', '#c9bbff', 34], [r2, 'speed 2v, radius 2r', '#ffd9a8', 60]]) {
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, ux = Math.sin(a), uy = -Math.cos(a);
            proton(c, x, y, r2 * 2.4);
            arrow(c, x, y, x + ux * L, y + uy * L, '#7ee2a0', 2.4);
          }
          if (b.w >= 700) {
            text(c, 'slow proton: small circle', cx - r2 * 1.6, cy - r1 * 0.2, { size: fz(b), color: '#c9bbff', align: 'right' });
            text(c, 'fast proton: big circle', cx + r2 * 1.6, cy + r1 * 0.2, { size: fz(b), color: '#ffd9a8', align: 'left' });
          } else {
            text(c, 'purple: slow, small circle', cx, cy + r2 * 1.4 + fz(b) * 0.8, { size: fz(b) * 0.9, color: '#c9bbff' });
            text(c, 'orange: fast, big circle', cx, cy + r2 * 1.4 + fz(b) * 2, { size: fz(b) * 0.9, color: '#ffd9a8' });
          }
          text(c, 'both finish a lap at the same moment', cx, cy - r2 * 1.4 - fz(b) * 0.9, { size: fz(b), color: '#eef2ec' });
        } },
      { main: 'Every lap still takes the same time.', sub: 'The circle is bigger, but the proton is faster too, so the pushes keep a steady beat.', eq: 'T = 2πm / qB: the speed is not in it  ·  f = qB / 2πm ≈ 15 MHz at 1 T',
        draw(c, t, b, S) { cySpiralScene(c, t, b, S, true); } },
      { main: 'At the edge, a − plate pulls it out.', sub: 'Out comes a fast beam. That is a cyclotron. Now build your own!', eq: 'top energy K = q²B²R² / 2m ≈ 7.7 MeV for B = 1 T and R = 0.4 m',
        draw(c, t, b, S) {
          const g = cyGeom(b), K = CY.HALF - 1, om = Math.PI / CY.HT, P = CY.HT + 3.2, u = t % P;
          const [ex, ey] = cyPos(g, K, 1);
          cyMachine(c, g, { mag: 1, field: 1, dees: 1, pol: u < CY.HT ? -Math.cos(Math.PI * u / CY.HT) : 0.25 });
          const fade = clamp((P - u) / 0.4, 0, 1);
          c.globalAlpha = fade; cyTrail(c, g, K, u < CY.HT ? u / CY.HT : 1, fade);
          // the deflector: a − plate just outside the last circle. Its pull on the + proton cancels the magnet's inward force
          const gy = ey + Math.max(8, g.R * 0.04), xa = g.cx + g.R * 0.06, xb = g.cx + g.R * 0.42;
          c.save(); c.shadowColor = 'rgba(90,140,255,0.9)'; c.shadowBlur = 12; c.strokeStyle = '#8fb4ff'; c.lineWidth = Math.max(3, g.R * 0.016); c.lineCap = 'round';
          c.beginPath(); c.moveTo(xa, gy); c.lineTo(xb, gy); c.stroke(); c.restore();
          text(c, '−  deflector', (xa + xb) / 2, gy + fz(b) + 2, { size: fz(b) * 0.95, color: '#bcd2ff' });
          let px, py;
          if (u < CY.HT) [px, py] = cyPos(g, K, u / CY.HT);
          else {
            const vOut = om * g.sp[K].r, x = ex + vOut * (u - CY.HT);
            px = Math.min(x, b.x + b.w + 40); py = ey;
            c.save(); c.globalCompositeOperation = 'lighter';
            c.strokeStyle = `rgba(255,120,40,${0.3 * fade})`; c.lineWidth = 12; c.beginPath(); c.moveTo(ex, ey); c.lineTo(px, ey); c.stroke();
            c.strokeStyle = `rgba(255,220,160,${0.85 * fade})`; c.lineWidth = 2.6; c.beginPath(); c.moveTo(ex, ey); c.lineTo(px, ey); c.stroke();
            c.restore();
            if (u > CY.HT + 0.8) text(c, 'a fast beam, out', Math.min(b.x + b.w - 70, g.cx + g.R * 1.55), ey - 22, { size: fz(b), color: `rgba(255,217,168,${fade})` });
          }
          c.globalAlpha = 1;
          if (px < b.x + b.w + 20) proton(c, px, py, g.R, fade);
        } },
    ],
  };
  // steps 3 and 4: the spiral, with a push at each crossing. Step 4 adds the beat: one dot per push, equally spaced in time
  function cySpiralScene(c, t, b, S, beat) {
    const g = cyGeom(b, beat ? Math.max(46, fz(b) * 3) : 0), T0 = 0.6, N = CY.HALF, P = T0 + N * CY.HT + 1.3, u = t % P, loop = Math.floor(t / P);
    const kNow = u < T0 ? -1 : Math.min(N, Math.floor((u - T0) / CY.HT)), frac = u < T0 ? 0 : clamp((u - T0) / CY.HT - kNow, 0, 1);
    const fade = clamp((P - u) / 0.45, 0, 1) * clamp(u / 0.3, 0, 1);
    const pol = kNow < 0 || kNow >= N ? 0.3 : (kNow % 2 ? -1 : 1) * Math.cos(Math.PI * frac);
    cyMachine(c, g, { mag: 1, field: 1, dees: beat ? 1 : ease(t / 0.6), pol, signs: true });
    topLabel(c, g, b, beat ? 'the same time for every half-turn' : 'the gap: a push every time it crosses', '#ffd9a8');
    if (!beat) { c.strokeStyle = 'rgba(255,217,168,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(g.cx, g.cy - g.R * 1.2 - 8); c.lineTo(g.cx, g.cy - g.R); c.stroke(); }
    c.globalAlpha = fade;
    const s0 = g.sp[0], yc = g.cy + s0.cy, om = Math.PI / CY.HT;
    let px, py;
    if (u < T0) {                                         // still on the first circle, coming round to the gap at the bottom
      const a = Math.PI / 2 + om * (T0 - u); px = g.cx + Math.cos(a) * s0.r; py = yc + Math.sin(a) * s0.r;
      c.strokeStyle = CL.palette('rainbow')[0]; c.lineWidth = Math.max(2, g.R * 0.013); c.beginPath(); c.arc(g.cx, yc, s0.r, 0, TAU); c.stroke();
    } else {
      cyTrail(c, g, Math.min(kNow, N - 1), kNow >= N ? 1 : frac, fade);
      [px, py] = kNow >= N ? cyPos(g, N - 1, 1) : cyPos(g, kNow, frac);
    }
    // a push at each crossing (k ≥ 1): sparks, a sound, and "+ push"
    S.k = S.k ?? -1; S.loop = S.loop ?? loop; S.pushes = S.pushes || [];
    if (loop !== S.loop) { S.loop = loop; S.k = -1; S.pushes = []; }
    if (kNow > S.k && kNow >= 1 && kNow < N) { S.k = kNow; S.pushes.push({ x: g.cx, y: py, t }); if (beat) audio.metro(); else audio.thunk(kNow / N); }
    if (kNow > S.k) S.k = kNow;
    for (const q of S.pushes) {
      const f = (t - q.t) / 0.9; if (f > 1) continue;
      glow(c, q.x, q.y, 22 * (1 - f), '255,214,150', 1 - f);
      if (!beat) text(c, '+ push', q.x + 14, q.y - 16 - f * 22, { size: fz(b), align: 'left', color: `rgba(255,224,160,${1 - f})` });
    }
    proton(c, px, py, g.R, fade);
    c.globalAlpha = 1;
    const pushes = Math.max(0, Math.min(N - 1, kNow));
    speedBar(c, g, b, Math.sqrt((pushes + 1) / N), 'speed');
    if (beat) {                                           // the beat: one dot per push, always the same distance apart
      const n = N - 1, gap = clamp(b.w / 28, 16, 30), wid = (n - 1) * gap, x0 = g.cx - wid / 2, y0 = Math.min(b.y + b.h - fz(b) * 1.8, g.cy + g.R * 1.2 + 22);
      for (let i = 0; i < n; i++) {
        const lit = kNow >= i + 1, fresh = lit && kNow === i + 1 ? 1 - frac : 0, x = x0 + i * gap;
        if (fresh > 0) glow(c, x, y0, 14, '255,200,120', 0.6 * fresh);
        c.beginPath(); c.arc(x, y0, 5, 0, TAU);
        if (lit) { c.fillStyle = '#ffcf8a'; c.fill(); } else { c.strokeStyle = 'rgba(255,207,138,0.45)'; c.lineWidth = 1.3; c.stroke(); }
      }
      text(c, `one dot per push: every ${CY.HT.toFixed(1)} s, from the first lap to the last`, g.cx, y0 + fz(b) * 1.2, { size: fz(b) * 0.9, color: 'rgba(255,217,168,0.85)' });
    }
  }

  /* ======================================================================
     THE GAUSS GUN
     A coil carrying current is an electromagnet; it pulls an iron slug
     towards its middle from either side. Switched off at the middle, it
     never pulls backwards, so each coil only adds a push.
     ====================================================================== */
  function ggGeom(b, n = 4) {
    const x0 = b.x + b.w * 0.06, x1 = b.x + b.w * 0.7, y = b.y + b.h * 0.52, th = clamp(b.h * 0.075, 14, 30);
    const cw = Math.min(b.w * 0.075, 90), coils = [];
    for (let i = 0; i < n; i++) coils.push(x0 + (x1 - x0) * (0.27 + 0.62 * (n === 1 ? 0 : i / (n - 1))));
    return { x0, x1, y, th, cw, coils, sl: Math.max(34, b.w * 0.05), start: x0 + Math.max(34, b.w * 0.05) * 0.5 + 10 };
  }
  function ggTube(c, g) {
    c.fillStyle = 'rgba(200,220,230,0.08)'; c.strokeStyle = 'rgba(200,220,230,0.35)'; c.lineWidth = 1.2;
    rrect(c, g.x0, g.y - g.th / 2, g.x1 - g.x0, g.th, 4); c.fill(); c.stroke();
  }
  function ggCoil(c, g, x, on, b, label) {
    const h = g.th * 1.15, w = g.cw;
    if (on > 0) {                                        // the field of the coil: loops through it and round the outside
      c.save(); c.strokeStyle = `rgba(179,166,255,${0.45 * on})`; c.lineWidth = 1.2;
      for (let k = 1; k <= 3; k++) { c.beginPath(); c.ellipse(x, g.y, w * (0.55 + 0.45 * k), g.th * (0.9 + 0.8 * k), 0, 0, TAU); c.stroke(); }
      c.restore();
      glow(c, x, g.y, w * 1.3, '255,160,60', 0.35 * on);
    }
    for (const sy of [-1, 1]) {
      const y = sy < 0 ? g.y - g.th / 2 - h : g.y + g.th / 2;
      const gr = c.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, on > 0.5 ? '#ffb45a' : '#8a5124'); gr.addColorStop(0.5, on > 0.5 ? '#ffd9a0' : '#c27a3e'); gr.addColorStop(1, on > 0.5 ? '#e0822e' : '#6d3a17');
      c.fillStyle = gr; rrect(c, x - w / 2, y, w, h, 3); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
      for (let i = 1; i < 6; i++) { const xx = x - w / 2 + w * i / 6; c.beginPath(); c.moveTo(xx, y + 2); c.lineTo(xx, y + h - 2); c.stroke(); }
    }
    if (label) text(c, label, x, g.y + g.th / 2 + h + fz(b) * 0.9, { size: fz(b) * 0.85, color: on > 0.5 ? '#ffd9a0' : 'rgba(215,160,110,0.85)' });
  }
  function ggSlug(c, g, x) {
    const w = g.sl, h = g.th * 0.62, gr = c.createLinearGradient(0, g.y - h / 2, 0, g.y + h / 2);
    gr.addColorStop(0, '#e9eef2'); gr.addColorStop(0.5, '#9aa4ad'); gr.addColorStop(1, '#5d666e');
    c.fillStyle = gr; rrect(c, x - w / 2, g.y - h / 2, w, h, 3); c.fill();
  }
  // the slug's motion through n coils: each coil adds the same energy, so the speed after coil k is v1·√k
  function ggRun(g, n, v1, tt) {
    const pts = [g.start, ...g.coils.slice(0, n)];
    let t = 0;
    for (let k = 1; k <= n; k++) {
      const va = k === 1 ? 0 : v1 * Math.sqrt(k - 1), vb = v1 * Math.sqrt(k), d = pts[k] - pts[k - 1], T = 2 * d / (va + vb), a = (vb - va) / T;
      if (tt < t + T) { const s = tt - t; return { x: pts[k - 1] + va * s + 0.5 * a * s * s, v: va + a * s, coil: k - 1, after: false }; }
      t += T;
    }
    const vEnd = v1 * Math.sqrt(n);
    return { x: pts[n] + vEnd * (tt - t), v: vEnd, coil: -1, after: true, tEnd: t };
  }
  const gauss = {
    kicker: 'How it works', title: 'The Gauss gun', done: 'Start the Gauss gun',
    steps: [
      { main: 'This is an iron slug in a tube.', sub: 'Around the tube are coils of copper wire, switched off for now.', eq: 'iron is easy to magnetise; copper, plastic and aluminium hardly are',
        draw(c, t, b) {
          const g = ggGeom(b); ggTube(c, g);
          g.coils.forEach((x, i) => ggCoil(c, g, x, 0, b, `coil ${i + 1}`));
          ggSlug(c, g, g.start); glow(c, g.start, g.y, g.sl * (0.8 + 0.1 * Math.sin(t * 3)), '200,220,255', 0.18);
          text(c, 'iron slug', g.start, g.y - g.th * 2.1, { size: fz(b), color: '#dfe8ee' });
          text(c, 'copper coils (off)', (g.coils[0] + g.coils[3]) / 2, g.y - g.th * 2.6, { size: fz(b), color: '#e0a46a' });
          text(c, 'plastic tube', g.x1 - 40, g.y + g.th * 0.05, { size: fz(b) * 0.8, color: 'rgba(220,235,240,0.6)' });
        } },
      { main: 'Current makes a coil a magnet.', sub: 'It pulls the iron slug towards its middle, from either side.', eq: 'pull ∝ how fast the field changes along the slug: strongest just outside the coil’s end',
        draw(c, t, b) {
          const g = ggGeom(b), P = 6.5, u = t % P, xc = g.coils[0], A = xc - g.start;
          ggTube(c, g); g.coils.forEach((x, i) => ggCoil(c, g, x, i === 0 ? ease(u / 0.3) : 0, b, ''));
          text(c, 'ON: now it is a magnet', xc, g.y + g.th * 2.1 + fz(b), { size: fz(b), color: '#ffd9a0' });
          // a pull towards the middle, with some friction: the slug overshoots, is pulled back, and settles in the middle
          const w = 2.1, x = xc - A * Math.cos(w * u) * Math.exp(-0.42 * u);
          ggSlug(c, g, x);
          c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,190,90,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(xc, g.y - g.th * 4.2); c.lineTo(xc, g.y + g.th * 1.8); c.stroke(); c.setLineDash([]);
          text(c, 'middle', xc, g.y - g.th * 4.2 - fz(b) * 0.7, { size: fz(b), color: '#ffcf8a' });
          const dir = Math.sign(xc - x), ay = g.y - g.th * 2.6;
          if (Math.abs(xc - x) > 6) { arrow(c, x, ay, x + dir * Math.min(60, Math.abs(xc - x) + 20), ay, '#ff8fc8', 3); text(c, 'pull', x + dir * 26, ay - fz(b) * 0.9, { size: fz(b), color: '#ffb0e0' }); }
        } },
      { main: 'The coil turns the iron into a magnet too.', sub: 'The slug’s own N and S line up with the coil’s, so the near ends are opposite and they attract. Reverse the current and both flip: it still pulls.',
        eq: 'iron is attracted to either pole: N pulls S, S pulls N',
        draw(c, t, b) {
          const g = ggGeom(b, 1), P = 4, u = t % P, flip = u >= P / 2 ? -1 : 1, xc = g.coils[0], x = g.start + (xc - g.start) * 0.35 + Math.sin(t * 2) * 3;
          ggTube(c, g); ggCoil(c, g, xc, 1, b, flip > 0 ? 'current one way' : 'current reversed');
          ggSlug(c, g, x);
          const cl = xc - g.cw * 0.75, cr = xc + g.cw * 0.75, sl = x - g.sl / 2 + 8, sr = x + g.sl / 2 - 8;
          const N = '#e5483f', Sc = '#3e7ee6', yL = g.y - g.th * 2.5;
          text(c, flip > 0 ? 'N' : 'S', cl, yL, { size: fz(b) * 1.4, w: 700, color: flip > 0 ? N : Sc });
          text(c, flip > 0 ? 'S' : 'N', cr, yL, { size: fz(b) * 1.4, w: 700, color: flip > 0 ? Sc : N });
          text(c, flip > 0 ? 'N' : 'S', sl, yL, { size: fz(b) * 1.4, w: 700, color: flip > 0 ? N : Sc });
          text(c, flip > 0 ? 'S' : 'N', sr, yL, { size: fz(b) * 1.4, w: 700, color: flip > 0 ? Sc : N });
          arrow(c, sr + 10, g.y + g.th * 2.4, cl - 10, g.y + g.th * 2.4, '#ff8fc8', 3);
          text(c, 'opposite ends face each other: attract', (sr + cl) / 2, g.y + g.th * 2.4 + fz(b) * 1.2, { size: fz(b), color: '#ffb0e0' });
          text(c, 'the coil is a magnet', xc, g.y - g.th * 3.6, { size: fz(b) * 0.95, color: '#ffd9a0' });
          text(c, 'so the slug becomes a magnet too', x, g.y - g.th * 3.6 - fz(b) * 1.4, { size: fz(b) * 0.95, color: '#dfe8ee' });
        } },
      { main: 'Switch the coil off at the middle.', sub: 'If it stayed on, it would pull the slug back. Off, the slug keeps sliding.', eq: 'on too long: the pull points backwards and slows the slug (suck-back)',
        draw(c, t, b) {
          const g = ggGeom(b, 1), P = 4.2, u = t % P, v1 = (g.coils[0] - g.start) * 1.3;
          const r = ggRun(g, 1, v1, u), on = r.after ? 0 : 1;
          ggTube(c, g); ggCoil(c, g, g.coils[0], on, b, on ? 'ON' : 'OFF');
          c.fillStyle = '#ffb02e'; c.beginPath(); c.moveTo(g.coils[0], g.y - g.th * 2.05); c.lineTo(g.coils[0] - 8, g.y - g.th * 2.05 - 12); c.lineTo(g.coils[0] + 8, g.y - g.th * 2.05 - 12); c.closePath(); c.fill();
          text(c, 'switch off here', g.coils[0], g.y - g.th * 2.05 - 26, { size: fz(b), color: '#ffcf8a' });
          const x = Math.min(r.x, b.x + b.w + 60); ggSlug(c, g, x);
          if (r.after && x < b.x + b.w) text(c, 'keeps sliding', x, g.y + g.th * 1.6, { size: fz(b) * 0.9, color: '#dfe8ee' });
        } },
      { main: 'Then the next coil takes over.', sub: 'Each coil adds one push, so the slug goes faster and faster.', eq: 'each coil adds about the same energy, so speed ∝ √(number of coils)',
        draw(c, t, b, S) {
          const g = ggGeom(b), P = 5.2, u = t % P, v1 = (g.coils[0] - g.start) * 1.4, r = ggRun(g, 4, v1, u), loop = Math.floor(t / P);
          ggTube(c, g);
          g.coils.forEach((x, i) => ggCoil(c, g, x, r.coil === i ? 1 : 0, b, `coil ${i + 1}`));
          ggSlug(c, g, Math.min(r.x, b.x + b.w + 60));
          // the speed after each coil: one bar per push, each a little taller (v ∝ √pushes: the same energy each time)
          if (S.loop !== loop) { S.loop = loop; S.last = -1; }
          const passed = r.after ? 4 : r.coil;
          if (passed > S.last && passed > 0) { S.last = passed; audio.thunk(passed / 4); }
          const narrow = b.w < 700, bw = 16, bh = Math.min(b.h * (narrow ? 0.22 : 0.32), 130);
          const bx = narrow ? b.x + b.w / 2 + 1.5 * (bw + 8) : Math.min(b.x + b.w - 30, g.x1 + b.w * 0.12), by = narrow ? g.y + g.th * 3.4 + bh + fz(b) * 2 : g.y + g.th * 2.6;
          for (let k = 1; k <= 4; k++) {
            const hh = bh * Math.sqrt(k / 4), x = bx - (4 - k) * (bw + 8), lit = passed >= k;
            c.fillStyle = lit ? '#ffb45a' : 'rgba(255,180,90,0.15)'; rrect(c, x - bw / 2, by - hh, bw, hh, 3); c.fill();
            text(c, String(k), x, by + 12, { size: fz(b) * 0.8, color: 'rgba(255,217,168,0.8)' });
          }
          text(c, 'speed after each coil', bx - 1.5 * (bw + 8), by - bh - 16, { size: fz(b) * 0.9, color: '#ffd9a8' });
        } },
      { main: 'Out it flies!', sub: 'That is a Gauss gun (a coil gun). Now build your own!', eq: 'K = ½mv²: 33 m/s here; only about 9 % of the electrical energy reaches the slug, the rest heats the copper',
        draw(c, t, b, S) {
          const g = ggGeom(b), P = 4.4, u = t % P, v1 = (g.coils[0] - g.start) * 1.5, r = ggRun(g, 4, v1, u), loop = Math.floor(t / P);
          ggTube(c, g); g.coils.forEach((x, i) => ggCoil(c, g, x, r.coil === i ? 1 : 0, b, ''));
          const tx = b.x + b.w * 0.9, gate1 = g.x1 + b.w * 0.05, gate2 = g.x1 + b.w * 0.12;
          for (const gx of [gate1, gate2]) { c.fillStyle = '#39424a'; c.fillRect(gx - 3, g.y - g.th * 1.6, 6, g.th * 3.2); c.fillStyle = 'rgba(255,60,60,0.5)'; c.fillRect(gx - 1, g.y - g.th * 1.3, 2, g.th * 2.6); }
          text(c, 'speed meter', (gate1 + gate2) / 2, g.y - g.th * 2.2, { size: fz(b) * 0.9, color: '#dfe8ee' });
          if (S.loop !== loop) { S.loop = loop; S.hit = false; }
          const x = r.x, hitAt = tx - 14;
          // the target: a can that is knocked over when the slug reaches it
          const ch = g.th * 3, cw2 = g.th * 1.6;
          if (x >= hitAt && !S.hit) { S.hit = true; S.ht = t; audio.clack(1); }
          const ft = S.hit ? clamp((t - S.ht) / 0.5, 0, 1) : 0;
          c.save(); c.translate(tx + cw2 / 2, g.y + ch / 2); c.rotate(ft * 1.35); c.translate(ft * 30, 0);
          const cg = c.createLinearGradient(-cw2, 0, 0, 0); cg.addColorStop(0, '#8d9aa4'); cg.addColorStop(0.5, '#e6edf1'); cg.addColorStop(1, '#7c8890');
          c.fillStyle = cg; rrect(c, -cw2, -ch, cw2, ch, 4); c.fill(); c.fillStyle = '#d9483b'; c.fillRect(-cw2, -ch * 0.7, cw2, ch * 0.34);
          c.restore();
          if (!S.hit) ggSlug(c, g, x);
          if (x > gate2) text(c, 'fast!', (gate1 + gate2) / 2, g.y + g.th * 2.2, { size: fz(b) * 1.1, color: '#ffcf8a' });
        } },
    ],
  };

  /* ======================================================================
     PET MEDICINE
     Fluorine-18: made by ¹⁸O(p,n)¹⁸F in a hospital cyclotron, half-life
     109.77 min. In the body each one gives off a positron, which meets an
     electron: two 511 keV gamma rays fly apart back to back.
     ====================================================================== */
  const HALF_LIFE = 110;      // minutes (109.77, rounded as the captions say it)
  function body(c, cx, cy, s, a = 1) {                   // a simple person, front view
    c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(120,150,170,0.18)'; c.strokeStyle = 'rgba(170,200,220,0.55)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy - s * 0.78, s * 0.17, 0, TAU); c.fill(); c.stroke();
    rrect(c, cx - s * 0.3, cy - s * 0.58, s * 0.6, s * 0.95, s * 0.16); c.fill(); c.stroke();
    for (const sd of [-1, 1]) { rrect(c, cx + sd * s * 0.36 - s * 0.06, cy - s * 0.54, s * 0.12, s * 0.72, s * 0.06); c.fill(); c.stroke(); rrect(c, cx + sd * s * 0.13 - s * 0.085, cy + s * 0.34, s * 0.17, s * 0.62, s * 0.07); c.fill(); c.stroke(); }
    c.restore();
  }
  function vial(c, x, y, w, h, frac, label, b) {
    c.strokeStyle = 'rgba(200,230,255,0.7)'; c.lineWidth = 1.6; rrect(c, x - w / 2, y - h, w, h, 6); c.stroke();
    c.fillStyle = 'rgba(200,230,255,0.15)'; c.fillRect(x - w * 0.3, y - h - 8, w * 0.6, 8);
    const hh = (h - 6) * clamp(frac, 0, 1), gr = c.createLinearGradient(0, y, 0, y - h); gr.addColorStop(0, 'rgba(110,255,170,0.85)'); gr.addColorStop(1, 'rgba(110,255,170,0.45)');
    c.fillStyle = gr; rrect(c, x - w / 2 + 3, y - 3 - hh, w - 6, hh, 4); c.fill();
    if (label) text(c, label, x, y + fz(b), { size: fz(b) * 0.9, color: '#bff5d0' });
  }
  const DOTS = (() => { const r = rng(18), out = []; for (let i = 0; i < 90; i++) out.push({ x: r(), y: r(), life: -HALF_LIFE * Math.log(1 - r()) / Math.LN2 }); return out; })();
  const pet = {
    kicker: 'Real life', title: 'PET medicine: why a hospital needs a cyclotron', done: 'Run a hospital day',
    steps: [
      { main: 'Cancer cells eat a lot of sugar.', sub: 'So doctors give a sugar that carries a tiny marker: fluorine-18.', eq: 'the sugar is FDG: glucose with one fluorine-18 atom in it',
        draw(c, t, b) {
          const s = Math.min(b.h * 0.5, b.w * 0.3), cx = b.x + b.w / 2, cy = b.y + b.h / 2 - s * 0.02, tx = cx - s * 0.1, ty = cy - s * 0.28;
          body(c, cx, cy, s);
          const r = rng(5), n = 60;
          let inT = 0;
          for (let i = 0; i < n; i++) {
            const t0 = r() * 4, toT = r() < 0.45, ex = toT ? tx + (r() - 0.5) * s * 0.06 : cx + (r() - 0.5) * s * 0.5, ey = toT ? ty + (r() - 0.5) * s * 0.06 : cy + (r() - 0.6) * s * 0.85;
            const u = clamp(((t % 6) - t0) / 1.4, 0, 1); if (u <= 0) continue;
            const sx = cx + (r() - 0.5) * s * 0.1, sy = cy + s * 0.9;
            const x = lerp(sx, ex, ease(u)), y = lerp(sy, ey, ease(u));
            glow(c, x, y, 6, '120,255,170', 0.8); if (toT && u >= 1) inT++;
          }
          glow(c, tx, ty, s * (0.05 + 0.004 * inT), '255,110,90', 0.5 + 0.02 * inT);
          text(c, 'cancer cells', tx - s * 0.32, ty - s * 0.06, { size: fz(b), color: '#ffb0a0', align: 'right' });
          c.strokeStyle = 'rgba(255,176,160,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(tx - s * 0.3, ty - s * 0.05); c.lineTo(tx - s * 0.04, ty); c.stroke();
          text(c, 'sugar with fluorine-18', cx + s * 0.5, cy + s * 0.5, { size: fz(b), color: '#a8f5c0', align: 'left' });
        } },
      { main: 'A cyclotron makes the fluorine-18.', sub: 'Its fast protons hit water made with oxygen-18 and turn some of those oxygen atoms into fluorine-18.', eq: '¹⁸O + p → ¹⁸F + n   (needs protons above about 2.6 MeV)',
        draw(c, t, b) {
          const R = Math.min(b.h * 0.26, b.w * 0.14), cx = b.x + b.w * 0.24, cy = b.y + b.h * 0.48;
          const k0 = (t / 0.25) % CY.HALF;
          cyMachine(c, { R, cx, cy }, { mag: 1, field: 0 });
          const pal = CL.palette('rainbow'); c.lineWidth = 2;
          for (let i = 0; i < CY.HALF; i++) { const r = R * 0.9 * Math.sqrt((i + 1) / CY.HALF); c.strokeStyle = pal[Math.round(i / (CY.HALF - 1) * (pal.length - 1))]; c.globalAlpha = 0.25 + 0.6 * (Math.floor(k0) === i ? 1 : 0); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke(); }
          c.globalAlpha = 1;
          text(c, 'hospital cyclotron', cx, cy - R * 1.2 - 18, { size: fz(b), color: '#ffd9a8' });
          const ex = cx + R * 1.25, tx = b.x + b.w * 0.66, ty = cy;
          c.strokeStyle = 'rgba(255,200,140,0.35)'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx + R * 0.9, cy); c.lineTo(tx - 30, ty); c.stroke();
          for (let i = 0; i < 6; i++) { const u = ((t * 1.4 + i / 6) % 1); proton(c, lerp(cx + R * 0.9, tx - 30, u), ty, R * 2.2, 0.9); }
          text(c, 'protons, about 11 MeV', (ex + tx) / 2 - 10, ty - 30, { size: fz(b) * 0.95, color: '#ffe7c4' });
          // the target: a drop of water made with oxygen-18
          c.fillStyle = 'rgba(90,170,255,0.35)'; c.strokeStyle = 'rgba(150,210,255,0.8)'; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(tx, ty - 44); c.bezierCurveTo(tx + 34, ty - 2, tx + 30, ty + 34, tx, ty + 34); c.bezierCurveTo(tx - 30, ty + 34, tx - 34, ty - 2, tx, ty - 44); c.fill(); c.stroke();
          glow(c, tx - 26, ty, 22 * (0.6 + 0.4 * Math.sin(t * 9)), '255,220,160', 0.6);
          text(c, 'water with oxygen-18', tx, ty + 54, { size: fz(b) * 0.9, color: '#bcdcff' });
          // fluorine-18 drips into a vial below
          const vx = b.x + b.w * 0.86, vy = b.y + b.h * 0.78;
          for (let i = 0; i < 5; i++) { const u = ((t * 0.7 + i / 5) % 1); glow(c, lerp(tx + 30, vx, u), lerp(ty, vy - 60, u) - Math.sin(u * Math.PI) * 30, 7, '120,255,170', 0.9); }
          vial(c, vx, vy, 46, 80, 0.35 + 0.5 * ((t * 0.12) % 1), 'fluorine-18', b);
        } },
      { main: 'But half of it is gone every 110 minutes.', sub: 'It cannot be stored, so it is made fresh every morning.', eq: 'amount left = (½)^(time ÷ 110 min)',
        draw(c, t, b) {
          const P = 7.5, u = t % P, mins = clamp((u - 0.5) * 60, 0, 330);
          const w = Math.min(b.w * 0.42, 420), h = Math.min(b.h * 0.6, 260), x0 = b.x + b.w * 0.3 - w / 2, y0 = b.y + b.h * 0.5 - h / 2;
          c.strokeStyle = 'rgba(200,230,255,0.7)'; c.lineWidth = 2; rrect(c, x0, y0, w, h, 14); c.stroke();
          let left = 0;
          for (const d of DOTS) {
            const x = x0 + 14 + d.x * (w - 28), y = y0 + 14 + d.y * (h - 28);
            if (mins < d.life) { left++; glow(c, x, y, 7, '120,255,170', 0.9); }
            else if (mins - d.life < 12) glow(c, x, y, 12 * (1 - (mins - d.life) / 12), '255,255,255', 0.7);
          }
          const frac = Math.pow(0.5, mins / HALF_LIFE);
          const cxr = b.x + b.w * 0.74, top = b.y + b.h * 0.22;
          text(c, `${Math.round(mins)} min`, cxr, top, { size: fz(b) * 2.1, w: 600, color: '#eef2ec' });
          text(c, `${Math.round(frac * 100)} % left`, cxr, top + fz(b) * 2.2, { size: fz(b) * 1.5, color: '#9df5b8' });
          // the time line: 0, 110 and 220 minutes
          const lx0 = cxr - Math.min(b.w * 0.2, 200), lx1 = cxr + Math.min(b.w * 0.2, 200), ly = top + fz(b) * 5;
          c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(lx0, ly); c.lineTo(lx1, ly); c.stroke();
          for (const [m, lab] of [[0, 'all'], [110, 'half'], [220, 'a quarter'], [330, 'an eighth']]) {
            const x = lerp(lx0, lx1, m / 330); c.fillStyle = mins >= m ? '#9df5b8' : 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(x, ly, 5, 0, TAU); c.fill();
            text(c, `${m}`, x, ly - 16, { size: fz(b) * 0.8, color: 'rgba(238,242,236,0.7)' });
            text(c, lab, x, ly + 18, { size: fz(b) * 0.85, color: mins >= m ? '#9df5b8' : 'rgba(238,242,236,0.45)' });
          }
          c.fillStyle = '#ffcf8a'; c.beginPath(); c.arc(lerp(lx0, lx1, mins / 330), ly, 4, 0, TAU); c.fill();
          text(c, 'minutes', lx1 + 26, ly - 16, { size: fz(b) * 0.8, color: 'rgba(238,242,236,0.6)', align: 'left' });
        } },
      { main: 'So the cyclotron must be close to the hospital.', sub: 'After 30 minutes on the road 83 % is left. After 5 hours, only 15 %.', eq: '(½)^(30/110) = 0.83   ·   (½)^(300/110) = 0.15',
        draw(c, t, b) {
          const P = 8, u = t % P, mins = clamp((u - 0.4) * 60, 0, 300);
          const x0 = b.x + b.w * 0.1, x1 = b.x + b.w * 0.8;
          const lanes = [{ y: b.y + b.h * 0.3, T: 30, name: 'cyclotron next door: 30 minutes away', col: '#9df5b8' }, { y: b.y + b.h * 0.72, T: 300, name: 'cyclotron in another city: 5 hours away', col: '#ffb0a0' }];
          for (const L of lanes) {
            const road = L.T === 30 ? lerp(x0, x1, 0.22) : x1;
            c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x0, L.y - 16, road - x0, 32);
            c.setLineDash([10, 10]); c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, L.y); c.lineTo(road, L.y); c.stroke(); c.setLineDash([]);
            text(c, L.name, x0, L.y - 46, { size: fz(b), color: L.col, align: 'left' });
            // the hospital at the end of the road
            c.fillStyle = '#dfe8ee'; c.fillRect(road + 8, L.y - 22, 34, 40); c.fillStyle = '#d9483b'; c.fillRect(road + 21, L.y - 14, 8, 22); c.fillRect(road + 14, L.y - 7, 22, 8);
            const done = Math.min(mins, L.T), vx = lerp(x0 + 30, road - 40, done / L.T), frac = Math.pow(0.5, done / HALF_LIFE);
            c.fillStyle = '#e9eef2'; rrect(c, vx - 26, L.y - 13, 44, 22, 4); c.fill(); c.fillStyle = '#ffcf3a'; c.beginPath(); c.arc(vx - 6, L.y - 2, 6, 0, TAU); c.fill();
            c.fillStyle = '#2b3136'; c.beginPath(); c.arc(vx - 16, L.y + 10, 4, 0, TAU); c.arc(vx + 8, L.y + 10, 4, 0, TAU); c.fill();
            vial(c, vx + 32, L.y + 13, 16, 32, frac, '', b);
            text(c, `${Math.round(frac * 100)} % left`, vx + 4, L.y + 32, { size: fz(b), color: L.col });
          }
          text(c, `${Math.floor(mins / 60)} h ${String(Math.round(mins % 60)).padStart(2, '0')} min on the road`, b.x + b.w * 0.5, b.y + b.h * 0.5, { size: fz(b) * 1.1, color: 'rgba(238,242,236,0.75)' });
        } },
      { main: 'Each fluorine-18 gives off a positron.', sub: 'A positron is the electron’s antimatter twin. Within about a millimetre it meets an electron, and both vanish into two gamma rays flying apart in opposite directions.',
        eq: 'E = mc²: each gamma ray carries 511 keV, the energy of one electron’s mass',
        draw(c, t, b) {
          const P = 4.2, u = t % P, cx = b.x + b.w * 0.36, cy = b.y + b.h * 0.5, s = Math.min(b.h * 1.5, b.w * 0.75);
          // the fluorine-18 nucleus: 9 protons, 9 neutrons
          const r = rng(3);
          for (let i = 0; i < 18; i++) { const a = r() * TAU, d = r() * s * 0.045; glow(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * 0.028, i % 2 ? '255,120,100' : '170,190,210', 0.9); }
          text(c, '9 protons + 9 neutrons', cx, cy + s * 0.1, { size: fz(b) * 0.85, color: 'rgba(223,232,238,0.75)' });
          text(c, 'fluorine-18', cx, cy - s * 0.13, { size: fz(b), color: '#dfe8ee' });
          const mx = cx + s * 0.32, my = cy + s * 0.04;
          if (u < 1.4) {                                     // the positron zig-zags out, slowing down
            const f = u / 1.4, x = lerp(cx + s * 0.05, mx, f) , y = cy + Math.sin(f * 18) * s * 0.03 * (1 - f) + (my - cy) * f;
            glow(c, x, y, 10, '255,140,200', 1); text(c, 'e⁺', x, y - 18, { size: fz(b), color: '#ffb0e0' });
            const ex = mx + s * 0.06 * (1 - f * 0.2), ey = my - s * 0.02;
            glow(c, ex, ey, 9, '120,170,255', 1); text(c, 'e⁻', ex, ey - 18, { size: fz(b), color: '#a8c8ff' });
            text(c, 'positron (antimatter)', cx + s * 0.16, cy + s * 0.16, { size: fz(b) * 0.9, color: '#ffb0e0' });
            text(c, 'an electron in the body', mx + s * 0.1, my - s * 0.12, { size: fz(b) * 0.9, color: '#a8c8ff', align: 'left' });
          } else {
            const f = clamp((u - 1.4) / 1.4, 0, 1), L = f * Math.min(b.w * 0.34, s * 0.5), a = -0.35;
            glow(c, mx, my, 40 * (1 - f) + 6, '255,255,230', 1 - f * 0.7);
            for (const sg of [1, -1]) {
              c.strokeStyle = '#fff09a'; c.lineWidth = 2; c.beginPath();
              for (let k = 0; k <= 40; k++) { const q = k / 40 * L, wv = Math.sin(q * 0.25) * 5; c.lineTo(mx + sg * (Math.cos(a) * q - Math.sin(a) * wv), my + sg * (Math.sin(a) * q + Math.cos(a) * wv)); }
              c.stroke();
              if (L > 90) text(c, 'gamma ray, 511 keV', mx + sg * Math.cos(a) * L * 0.75, my + sg * Math.sin(a) * L * 0.75 - 24, { size: fz(b) * 0.95, color: '#fff09a' });
            }
          }
        } },
      { main: 'In the scanner, the marker lights up the cancer.', sub: 'Each one ends as two gamma rays flying apart in opposite directions. The ring catches both and draws a line between them.', eq: 'where many lines cross, there is a lot of sugar: the cancer',
        draw(c, t, b, S) {
          const R = Math.min(b.h * 0.42, b.w * 0.3), cx = b.x + b.w / 2, cy = b.y + b.h / 2, n = 56;
          if (!S.lines || t < S.t0) { S.lines = []; S.hits = new Float32Array(n); S.t0 = t; S.r = rng(7); S.next = 0; S.count = 0; }
          if (t - S.t0 > 9) { S.lines = []; S.hits.fill(0); S.t0 = t; S.count = 0; }
          const tx = cx - R * 0.22, ty = cy - R * 0.12;
          c.fillStyle = 'rgba(140,170,190,0.12)'; c.strokeStyle = 'rgba(170,200,220,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(cx, cy, R * 0.55, R * 0.38, 0, 0, TAU); c.fill(); c.stroke();
          // new pairs: half of them from the cancer, which took up the most sugar
          while (S.next <= t) {
            S.next += 0.09; const r = S.r, fromT = r() < 0.5;
            const ox = fromT ? tx + (r() - 0.5) * R * 0.05 : cx + (r() - 0.5) * R * 0.95, oy = fromT ? ty + (r() - 0.5) * R * 0.05 : cy + (r() - 0.5) * R * 0.6, a = r() * Math.PI;
            const dx = Math.cos(a), dy = Math.sin(a), bq = dx * (ox - cx) + dy * (oy - cy), cq = (ox - cx) ** 2 + (oy - cy) ** 2 - R * R, s1 = -bq + Math.sqrt(bq * bq - cq), s2 = -bq - Math.sqrt(bq * bq - cq);
            const p1 = [ox + dx * s1, oy + dy * s1], p2 = [ox + dx * s2, oy + dy * s2];
            S.lines.push({ p1, p2, o: [ox, oy], t }); S.count++;
            for (const p of [p1, p2]) { const i = Math.round(((Math.atan2(p[1] - cy, p[0] - cx) + TAU) % TAU) / TAU * n) % n; S.hits[i] = 1; }
            if (S.lines.length > 220) S.lines.shift();
          }
          for (const L of S.lines) {
            const age = t - L.t, a = age < 0.35 ? 0.9 : Math.max(0.05, 0.25 - age * 0.03);
            c.strokeStyle = age < 0.35 ? `rgba(255,240,150,${a})` : `rgba(255,214,120,${a})`; c.lineWidth = age < 0.35 ? 1.6 : 0.8;
            if (age < 0.35) {                                 // the two gamma rays flying out from where the pair met
              const f = age / 0.35;
              c.beginPath(); c.moveTo(L.o[0], L.o[1]); c.lineTo(lerp(L.o[0], L.p1[0], f), lerp(L.o[1], L.p1[1], f)); c.moveTo(L.o[0], L.o[1]); c.lineTo(lerp(L.o[0], L.p2[0], f), lerp(L.o[1], L.p2[1], f)); c.stroke();
            } else { c.beginPath(); c.moveTo(L.p1[0], L.p1[1]); c.lineTo(L.p2[0], L.p2[1]); c.stroke(); }
          }
          for (let i = 0; i < n; i++) {                       // the ring of detectors
            const a = i / n * TAU, x = cx + Math.cos(a) * R * 1.06, y = cy + Math.sin(a) * R * 1.06, h = S.hits[i];
            c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = h > 0.05 ? `rgba(255,${200 + 55 * h},${120 + 100 * h},1)` : '#3a434a'; c.fillRect(-6, -R * 0.05, 12, R * 0.1); c.restore();
            S.hits[i] *= 0.9;
          }
          glow(c, tx, ty, R * (0.08 + Math.min(0.12, S.count * 0.0006)), '255,120,80', Math.min(0.95, 0.2 + S.count * 0.004));
          text(c, 'the cancer lights up', tx - R * 0.15, ty - R * 0.3, { size: fz(b), color: '#ffb0a0' });
          text(c, 'ring of detectors', cx, cy + R * 1.06 + 24, { size: fz(b), color: '#dfe8ee' });
        } },
    ],
  };

  /* ======================================================================
     THE MAGLEV TRAIN (the Shanghai airport line)
     Coils in the guideway make a field pattern that travels at v = 2τf
     (τ = 0.26 m between poles); the train's magnets ride with it.
     ====================================================================== */
  // o.scroll: how far the camera has moved along the track (px); o.shift: how far the coils' N/S pattern has moved (px)
  function mgScene(c, b, o) {
    const yG = b.y + b.h * 0.62, gh = clamp(b.h * 0.07, 16, 30), sc = o.scroll || 0;
    c.fillStyle = '#4a545c';
    const pw = Math.max(26, b.w * 0.03), gap = Math.max(180, b.w * 0.22);
    for (let x = b.x - ((sc % gap) + gap) % gap; x < b.x + b.w + gap; x += gap) c.fillRect(x, yG + gh, pw, b.y + b.h - yG - gh);
    const gg = c.createLinearGradient(0, yG, 0, yG + gh); gg.addColorStop(0, '#c9d1d6'); gg.addColorStop(1, '#7d878e');
    c.fillStyle = gg; c.fillRect(b.x, yG, b.w, gh);
    // the coils along the guideway, each N (red) or S (blue) as the pattern travels along; τ (pole to pole) = 3 coils here
    const wN = 22, i0 = Math.floor(sc / wN) - 1, i1 = i0 + Math.ceil(b.w / wN) + 2, on = o.shift !== undefined;
    for (let i = i0; i <= i1; i++) {
      const X = i * wN, x = b.x + X - sc, ph = on ? Math.sin((X - o.shift) / (wN * 3) * Math.PI) : 0, a = Math.abs(ph);
      c.fillStyle = on ? (ph > 0 ? `rgba(229,72,63,${0.2 + 0.8 * a})` : `rgba(62,126,230,${0.2 + 0.8 * a})`) : '#6a3c1c';
      c.fillRect(x + 2, yG + gh - 10, wN - 4, 9);
    }
    return { yG, gh };
  }
  function mgTrain(c, b, x, yG, o = {}) {
    const L = Math.min(b.w * 0.55, 620), H = clamp(b.h * 0.2, 40, 90), gap = o.gap ?? 10, y = yG - gap - H;
    c.save();
    const gr = c.createLinearGradient(0, y, 0, y + H); gr.addColorStop(0, '#f1f4f6'); gr.addColorStop(1, '#aeb8bf');
    c.fillStyle = gr; c.beginPath(); c.moveTo(x - L / 2, y + H); c.lineTo(x - L / 2, y + 8); c.quadraticCurveTo(x - L / 2, y, x - L / 2 + 10, y);
    c.lineTo(x + L / 2 - H * 1.1, y); c.quadraticCurveTo(x + L / 2, y + H * 0.15, x + L / 2, y + H); c.closePath(); c.fill();
    c.fillStyle = '#26323b'; c.fillRect(x - L / 2 + 16, y + H * 0.25, L - H * 1.4, H * 0.22);
    c.fillStyle = '#e2b13c'; c.fillRect(x - L / 2, y + H * 0.66, L - H * 0.2, 4);
    // the train's magnets, wrapped under the guideway's edge, pulling up towards it
    const m = 8;
    for (let i = 0; i < m; i++) { const mx = x - L / 2 + 20 + i * (L - 60) / (m - 1); c.fillStyle = i % 2 ? '#3e7ee6' : '#e5483f'; c.fillRect(mx - 9, yG + (o.gh || 20) + 2, 18, 7); c.fillStyle = '#5f6a72'; c.fillRect(mx - 3, y + H, 6, yG + (o.gh || 20) + 2 - y - H); }
    c.restore();
    return { L, H, y };
  }
  const maglev = {
    kicker: 'Real life', title: 'Maglev: a Gauss gun 30 km long', done: 'Drive the train',
    steps: [
      { main: 'A maglev train has no wheels.', sub: 'Magnets hold it about 10 mm from the track, so nothing rubs.', eq: 'electronics adjust the magnets’ current many times a second to keep the gap at 10 mm',
        draw(c, t, b) {
          const s = mgScene(c, b, {}), x = b.x + b.w / 2, bob = Math.sin(t * 2.2) * 1.5;
          const tr = mgTrain(c, b, x, s.yG + bob, { gap: clamp(b.h * 0.05, 14, 26), gh: s.gh });
          for (const dx of [-0.3, 0, 0.3]) arrow(c, x + dx * tr.L, s.yG + bob - 2, x + dx * tr.L, s.yG + bob - clamp(b.h * 0.05, 14, 26) + 2, '#7ee2a0', 2);
          if (b.w < 700) text(c, 'gap: 10 mm (drawn bigger)', x, s.yG + s.gh + 34 + fz(b) * 1.4, { size: fz(b), color: '#a8f0c0' });
          else text(c, 'gap: 10 mm (drawn bigger)', x + tr.L * 0.42, s.yG - 14 + bob, { size: fz(b), color: '#a8f0c0', align: 'left' });
          text(c, 'no wheels', x - tr.L * 0.25, tr.y - 20 + bob, { size: fz(b) * 1.1, color: '#eef2ec' });
          text(c, 'magnets pull it up towards the track', x, s.yG + s.gh + 34, { size: fz(b) * 0.95, color: '#ffd9a8' });
        } },
      { main: 'The track is full of coils, like a very long Gauss gun.', sub: 'They are switched on one after another, so the magnetic pull moves along the track.', eq: 'the coils are fed in sections: only the part under the train is switched on',
        draw(c, t, b) {
          const sh = t * 90, s = mgScene(c, b, { shift: sh });
          const lead = b.x + 40 + (sh % (b.w - 80));
          arrow(c, lead - 60, s.yG - 26, lead + 20, s.yG - 26, '#ffcf8a', 3);
          text(c, 'the pull moves along', lead - 20, s.yG - 48, { size: fz(b), color: '#ffcf8a' });
          text(c, 'coils in the track (red N, blue S)', b.x + b.w / 2, s.yG + s.gh + 34, { size: fz(b), color: '#dfe8ee' });
        } },
      { main: 'The train’s magnets ride with the moving pull.', sub: 'Like the slug chasing the next coil, the train is always pulled forward.', eq: 'the motor is a long Gauss gun laid flat: a linear motor',
        draw(c, t, b) {
          const span = b.w * 1.7, d = (t * b.w * 0.16) % span, x = b.x - b.w * 0.35 + d;
          const s = mgScene(c, b, { shift: d + 30 });          // the pull runs just ahead of the train's magnets, at the train's speed
          mgTrain(c, b, x, s.yG, { gh: s.gh });
          arrow(c, x + Math.min(b.w * 0.3, 330), s.yG - 40, x + Math.min(b.w * 0.3, 330) + 70, s.yG - 40, '#ff8fc8', 3);
          text(c, 'pull', x + Math.min(b.w * 0.3, 330) + 35, s.yG - 62, { size: fz(b), color: '#ffb0e0' });
        } },
      { main: 'Switch the coils faster, and the train goes faster.', sub: 'At 230 times a second (230 Hz) the pull moves at 2 × 0.26 m × 230 = 120 m/s: that is 431 km/h.', eq: 'speed v = 2τf, τ = 0.26 m (from one pole to the next)',
        draw(c, t, b, S) {
          const P = 8, u = t % P, f = 230 * ease(clamp(u / 5.5, 0, 1)), v = 2 * 0.26 * f, kmh = v * 3.6;
          S.sc = (S.sc || 0) + v * 0.9 * (S.dt || 0.016);
          const s = mgScene(c, b, { scroll: S.sc, shift: S.sc + 30 });   // the camera rides with the train, so the pull stays under it
          mgTrain(c, b, b.x + b.w / 2, s.yG, { gh: s.gh });
          const y = b.y + b.h * 0.13;
          text(c, `${Math.round(f)} Hz`, b.x + b.w * 0.3, y, { size: fz(b) * 2.2, color: '#ffcf8a' });
          text(c, 'how fast the coils switch', b.x + b.w * 0.3, y + fz(b) * 1.7, { size: fz(b) * 0.9, color: 'rgba(255,217,168,0.8)' });
          text(c, `${Math.round(kmh)} km/h`, b.x + b.w * 0.7, y, { size: fz(b) * 2.2, color: '#9df5b8' });
          text(c, 'speed of the train', b.x + b.w * 0.7, y + fz(b) * 1.7, { size: fz(b) * 0.9, color: 'rgba(157,245,184,0.8)' });
        } },
      { main: 'To stop, the same coils work backwards.', sub: 'The pull is moved behind the train’s magnets, so it slows the train down, and the motor gives energy back to the power grid. Nothing rubs, so nothing wears out.',
        eq: 'braking as a generator: the train’s kinetic energy ½mv² goes back into the grid',
        draw(c, t, b, S) {
          const P = 6, u = t % P, v = Math.max(0, 1 - u / 4.5);
          S.sc = (u < 0.05 ? 0 : (S.sc || 0)) + v * 260 * (S.dt || 0.016);
          const s = mgScene(c, b, { scroll: S.sc, shift: S.sc - 40 });     // the pull sits behind the magnets: it holds the train back
          const tr = mgTrain(c, b, b.x + b.w / 2, s.yG, { gh: s.gh });
          const L = tr.L, xB = b.x + b.w / 2 - L / 2 - 20, ay = tr.y - 22;
          if (v > 0.02) { arrow(c, b.x + b.w / 2 + L * 0.3, ay, b.x + b.w / 2 - L * 0.1, ay, '#ff8fc8', 3); text(c, 'brake: the pull is behind', b.x + b.w / 2 + L * 0.1, ay - fz(b) * 1.1, { size: fz(b), color: '#ffb0e0' }); }
          // energy back to the grid
          const gx = Math.max(b.x + 50, xB - 40), gy = b.y + b.h * 0.18;
          c.fillStyle = '#39424a'; c.fillRect(gx - 34, gy - 20, 68, 40); text(c, 'power grid', gx, gy, { size: fz(b) * 0.85, color: '#dfe8ee' });
          if (v > 0.02) for (let i = 0; i < 4; i++) { const f = ((t * 1.2 + i / 4) % 1); glow(c, lerp(b.x + b.w / 2 - L * 0.3, gx, f), lerp(s.yG, gy + 20, f), 7, '255,220,120', 0.9 * v); }
          text(c, `${Math.round(v * 300)} km/h`, b.x + b.w * 0.82, b.y + b.h * 0.18, { size: fz(b) * 2, color: '#9df5b8' });
        } },
      { main: '30 km to the airport in about 8 minutes.', sub: 'By car through the city it takes about an hour. Now drive the train yourself!', eq: 'top speed 431 km/h until 2021, 300 km/h today',
        draw(c, t, b) {
          const P = 8, u = t % P, mins = clamp((u - 0.4) * 1.7, 0, 9.5);
          const x0 = b.x + b.w * 0.12, x1 = b.x + b.w * 0.88, y = b.y + b.h * 0.5;
          c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
          for (const [x, lab] of [[x0, 'city (Longyang Road)'], [x1, 'Pudong Airport']]) { c.fillStyle = '#eef2ec'; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill(); text(c, lab, x, y + 26, { size: fz(b), color: '#dfe8ee' }); }
          const train = clamp(mins / 8, 0, 1), car = clamp(mins / 61, 0, 1);
          const tx = lerp(x0, x1, train), cxp = lerp(x0, x1, car);
          glow(c, tx, y - 22, 16, '157,245,184', 0.8); c.fillStyle = '#f1f4f6'; rrect(c, tx - 22, y - 30, 44, 14, 6); c.fill();
          text(c, `maglev: ${Math.min(8, Math.round(mins))} min`, tx, y - 50, { size: fz(b), color: '#9df5b8' });
          c.fillStyle = '#ffb0a0'; rrect(c, cxp - 12, y + 44, 24, 12, 4); c.fill();
          text(c, `car: ${Math.round(mins)} min, still in traffic`, cxp + 22, y + 50, { size: fz(b) * 0.95, color: '#ffb0a0', align: 'left' });
        } },
    ],
  };

  const SETS = { lab: cyclotron, gauss, pet, maglev };

  /* ---------------- the overlay ---------------- */
  const st = { el: null, cv: null, set: null, id: '', i: 0, t: 0, prevI: -1, prevT: 0, fadeT: 1, raf: 0, last: 0, S: {}, PS: {}, opener: null, onDone: null, seen: new Set() };
  function build() {
    const el = document.createElement('div');
    el.className = 'xp'; el.id = 'xp'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'xpTitle');
    el.innerHTML = `
      <div class="xp-top"><div class="xp-head"><p class="xp-kicker" id="xpKicker"></p><h2 class="xp-title" id="xpTitle"></h2></div>
        <button type="button" class="xp-skip" id="xpSkip">Skip <kbd>Esc</kbd></button></div>
      <canvas class="xp-cv" id="xpCv" aria-hidden="true"></canvas>
      <div class="xp-panel">
        <div class="xp-cap" aria-live="polite"><p class="xp-main" id="xpMain"><span class="xp-n" id="xpN">1</span><span class="xp-text" id="xpText"></span></p><p class="xp-sub" id="xpSub"></p><p class="xp-eq" id="xpEq"></p></div>
        <div class="xp-nav"><button type="button" class="xp-back" id="xpBack">Back</button><div class="xp-dots" id="xpDots" aria-hidden="true"></div>
          <button type="button" class="xp-next" id="xpNext"><span id="xpNextT">Next</span> <kbd>Space</kbd></button></div>
      </div>`;
    document.body.appendChild(el);
    st.el = el; st.cv = $('#xpCv');
    $('#xpNext').addEventListener('click', next);
    $('#xpBack').addEventListener('click', back);
    $('#xpSkip').addEventListener('click', () => close(true));
    // keys go to the explainer while it is open, not to the station behind it (Space would fire the Gauss gun)
    window.addEventListener('keydown', ev => {
      if (!st.set) return;
      if ([' ', 'Enter', 'ArrowRight', 'PageDown'].includes(ev.key)) { if (ev.key === 'Enter' && ev.target.closest && ev.target.closest('.xp-back, .xp-skip')) return; ev.preventDefault(); ev.stopPropagation(); next(); }
      else if (['ArrowLeft', 'Backspace', 'PageUp'].includes(ev.key)) { ev.preventDefault(); ev.stopPropagation(); back(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(true); }
      else if (ev.key !== 'Tab') ev.stopPropagation();
    }, true);
    window.addEventListener('resize', () => { if (st.set) draw(0); });
  }
  function render() {
    const set = st.set, s = set.steps[st.i], n = set.steps.length;
    $('#xpKicker').textContent = set.kicker; $('#xpTitle').textContent = set.title;
    $('#xpN').textContent = String(st.i + 1);
    const main = $('#xpMain'); main.classList.remove('is-in'); void main.offsetWidth; main.classList.add('is-in');
    const sub = $('#xpSub'); sub.classList.remove('is-in'); void sub.offsetWidth; sub.classList.add('is-in');
    $('#xpText').textContent = s.main; sub.textContent = s.sub;
    const eq = $('#xpEq'); eq.textContent = s.eq || ''; eq.hidden = !s.eq; eq.classList.remove('is-in'); void eq.offsetWidth; eq.classList.add('is-in');
    $('#xpDots').innerHTML = set.steps.map((_, k) => `<i class="${k === st.i ? 'is-on' : k < st.i ? 'is-past' : ''}"></i>`).join('');
    $('#xpBack').disabled = st.i === 0;
    $('#xpNextT').textContent = st.i === n - 1 ? set.done : 'Next';
    $('#xpNext').classList.toggle('is-last', st.i === n - 1);
    st.el.style.setProperty('--xp-step', String(st.i));
  }
  function go(i) {
    if (i === st.i) return;
    st.prevI = st.i; st.prevT = st.t; st.PS = st.S; st.fadeT = 0;
    st.i = i; st.t = 0; st.S = {};
    render(); audio.scribble(0.4);
  }
  function next() { if (!st.set) return; if (st.i >= st.set.steps.length - 1) close(false); else go(st.i + 1); }
  function back() { if (!st.set || st.i === 0) return; go(st.i - 1); }
  function box() {
    const W = innerWidth, H = innerHeight, top = st.el.querySelector('.xp-top').getBoundingClientRect().bottom, pan = st.el.querySelector('.xp-panel').getBoundingClientRect().top;
    return { W, H, b: { x: 16, y: top + 6, w: W - 32, h: Math.max(140, pan - top - 16) } };
  }
  function draw(dt) {
    const { W, H, b } = box(), { ctx } = fitCanvas(st.cv, W, H);
    ctx.clearRect(0, 0, W, H);
    const steps = st.set.steps;
    st.S.dt = dt;
    if (st.fadeT < 1 && st.prevI >= 0) {                 // the old step fades out while the new one fades in
      ctx.save(); ctx.globalAlpha = 1 - ease(st.fadeT); try { steps[st.prevI].draw(ctx, st.prevT, b, st.PS); } catch (e) { console.error(e); } ctx.restore();
      ctx.save(); ctx.globalAlpha = ease(st.fadeT); try { steps[st.i].draw(ctx, st.t, b, st.S); } catch (e) { console.error(e); } ctx.restore();
    } else { try { steps[st.i].draw(ctx, st.t, b, st.S); } catch (e) { console.error(e); } }
    ctx.globalAlpha = 1;
  }
  function loop(now) {
    if (!st.set) return;
    const dt = Math.min(0.05, (now - st.last) / 1000 || 0.016); st.last = now;
    st.t += dt; st.prevT += dt; st.fadeT = Math.min(1, st.fadeT + dt / 0.45);
    draw(dt);
    st.raf = requestAnimationFrame(loop);
  }
  function show(id, o = {}) {
    const set = SETS[id]; if (!set) return;
    if (!st.el) build();
    if (st.set) cancelAnimationFrame(st.raf);
    st.set = set; st.id = id; st.i = 0; st.t = 0; st.prevI = -1; st.fadeT = 1; st.S = {}; st.onDone = o.onDone || null;
    st.seen.add(id);
    st.opener = document.activeElement;
    st.el.hidden = false; st.el.dataset.set = id;
    document.body.classList.add('has-xp');
    render(); audio.scribble(0.4);
    requestAnimationFrame(() => $('#xpNext').focus({ preventScroll: true }));
    st.last = performance.now(); st.raf = requestAnimationFrame(loop);
    bus.emit('explain', id, true);
  }
  function close(skipped) {
    if (!st.set) return;
    const id = st.id, cb = st.onDone;
    cancelAnimationFrame(st.raf); st.set = null; st.el.hidden = true;
    document.body.classList.remove('has-xp');
    if (st.opener && st.opener.focus && document.contains(st.opener)) st.opener.focus({ preventScroll: true });
    bus.emit('explain', id, false);
    if (cb) cb(skipped);
  }
  // the first time a station or an example is opened (on this visit), its explainer pops up
  function auto(id) {
    if (!SETS[id] || st.seen.has(id) || st.set) return;
    if (/[?&]noexplain/.test(location.search)) return;
    if (CL.intro && CL.intro.on) return;
    show(id);
  }
  // "How it works" keys: in the Cyclotron's and the Gauss gun's views, next to Ride
  function ensureKeys() {
    for (const [wrap, id] of [['#stageWrap', 'lab'], ['#ggWrap', 'gauss']]) {
      const w = $(wrap); if (!w || w.querySelector('.xp-open')) continue;
      const top = w.querySelector('.hud-top'); if (!top) continue;
      const k = document.createElement('button'); k.type = 'button'; k.className = 'xp-open'; k.dataset.xp = id; k.textContent = 'How it works';
      k.title = 'Watch how it works, step by step (Space for the next step)';
      const ride = top.querySelector('.ride-btn'); if (ride) ride.after(k); else top.prepend(k);
    }
  }
  document.addEventListener('click', ev => { const k = ev.target.closest && ev.target.closest('[data-xp]'); if (k && k.dataset.xp) { ev.preventDefault(); show(k.dataset.xp); } });
  bus.on('screen', () => ensureKeys());
  bus.on('screen', name => { if (name === 'lab' || name === 'gauss') setTimeout(() => { if (CL.active === name && !(CL.realsim && CL.realsim.host)) auto(name); }, 350); });
  CL.explain = { show, close, auto, get on() { return !!st.set; }, get step() { return st.i; }, get id() { return st.id; }, SETS };
})();
