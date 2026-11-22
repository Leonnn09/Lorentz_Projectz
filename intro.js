/* =====================================================================
   Project Lorentz — the title sequence (CL.intro).
   How a cyclotron works, told in five short steps a beginner can follow:
     1. a proton (a tiny particle with a + charge) flies in on a straight line;
     2. the magnet is switched on: its force always points to the centre, so the path bends into a circle;
     3. two metal D's push it every time it crosses the gap between them: faster means a bigger circle;
     4. every lap still takes the same time, so the pushes can keep a steady beat;
     5. at the edge it shoots out, and the beam writes the name, F = q(E + v × B): E pushes, B bends.
   Then the project plate stamps down and the four builders sign it.
   It plays when the app opens on Home; "Play the intro" replays it.
   Any key or click skips to the end, and then starts the app.
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, TAU, audio, reduceMotion, fitCanvas } = CL;

  // timeline, in seconds
  const HALF = 12, HALF_T = 0.36;                       // half-turns of the spiral, and the (constant) time for each one
  const T_IN = 0.15, T_FIELD = 1.95;                    // the proton flies in straight; the magnet comes on
  const LAPS = 3, T0 = T_FIELD + LAPS * 2 * HALF_T;     // whole circles with the magnet alone, then the pushes begin
  const T_DEES = T0 - 0.45, T_BEAT = T0 + 6 * HALF_T;   // the D's appear; "every lap takes the same time"
  const T_EXIT = T0 + HALF * HALF_T;                    // the proton reaches the edge and leaves
  const T_BURN0 = T_EXIT + 0.32, T_BURN = 1.45;         // the beam writes the name
  const T_QUENCH = T_BURN0 + T_BURN + 0.18;             // the hot letters cool to steel
  const T_STAMP = T_QUENCH + 0.42, T_EQ = T_STAMP + 0.32, T_PLATE = T_EQ + 0.4, T_SIGN = T_PLATE + 0.3, T_READY = T_SIGN + 1.0;
  const STEPS = [[T_IN, 1], [T_FIELD, 2], [T_DEES, 3], [T_BEAT, 4], [T_EXIT, 5]];

  const st = { on: false, t: 0, last: 0, raf: 0, cv: null, ctx: null, W: 0, H: 0, k: -1, sparks: [], embers: [], pushes: [], flash: 0, flashCol: '255,255,255',
    phase: '', hot: 0, crackle: 0, el: null, burn: null, name: null, back: null, emberT: 0, story: null, step: 0 };

  function geom() {
    const r = st.name.getBoundingClientRect(), o = st.el.getBoundingClientRect();
    const cx = r.left - o.left + r.width / 2, cy = r.top - o.top + r.height / 2;
    const R = Math.max(70, Math.min(st.H * 0.34, st.W * 0.3));
    return { cx, cy, R, tl: r.left - o.left, tt: r.top - o.top, tw: r.width, th: r.height };
  }
  // alternating half circles whose radius grows as √(number of pushes). A proton with B into the screen goes round
  // anticlockwise: even half-turns run up through the right dee (bottom crossing to top), odd ones down through the left dee.
  // Each half-turn starts just after a gap crossing, while the dee it came from is + and the one it enters is −.
  function spiral(R) {
    const Rs = R * 0.93;
    const radii = Array.from({ length: HALF }, (_, k) => Rs * Math.sqrt((k + 1) / HALF)), out = [];
    let y = 0;
    for (let k = 0; k < HALF; k++) {
      const up = k % 2 === 0, r = radii[k], c = up ? y - r : y + r;
      out.push({ r, cy: c, a0: up ? Math.PI / 2 : -Math.PI / 2 });
      y = up ? c - r : c + r;
    }
    const shift = (out[HALF - 1].cy + out[HALF - 2].cy) / 2;   // the last orbit is centred on the machine
    for (const s of out) s.cy -= shift;
    return out;
  }
  const posOn = (g, s, f) => { const a = s.a0 - Math.PI * f; return [g.cx + Math.cos(a) * s.r, g.cy + s.cy + Math.sin(a) * s.r]; };

  function sparkBurst(x, y, n, speed, up = 0) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.35 + Math.random());
      st.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up * (0.5 + Math.random()), life: 0.25 + Math.random() * 0.5, age: 0 });
    }
  }
  function setPhase(cls, on = true) { st.el.classList.toggle(cls, on); }
  // the captions: one step at a time, in the same place; beside the machine when there is room, under it otherwise
  function showStep(n) {
    st.step = n;
    for (const c of $$('.cap', st.story)) { const k = +c.dataset.n; c.classList.toggle('is-on', k === n); c.classList.toggle('is-past', k < n); }
  }
  function layoutStory() {
    if (!st.story || !st.name) return;
    const g = geom(), left = clamp(st.W * 0.04, 18, 64), free = g.cx - 1.22 * g.R - 36 - left;
    const side = free >= 250 && st.W >= st.H * 1.2;
    st.story.classList.toggle('is-side', side);
    st.story.style.setProperty('--sl', `${left}px`); st.story.style.setProperty('--sw', `${Math.min(380, free)}px`);
  }
  function text(ctx, s, x, y, o = {}) {
    ctx.font = `${o.w || 600} ${o.size || 14}px ${o.font || '"Barlow Condensed", "Arial Narrow", sans-serif'}`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(4,7,6,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y);
    ctx.fillStyle = o.color || '#e8eee9'; ctx.fillText(s, x, y);
  }
  function arrow(ctx, x0, y0, x1, y1, col, w) {
    const a = Math.atan2(y1 - y0, x1 - x0), hl = Math.max(8, w * 4);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * hl * 0.6, y1 - Math.sin(a) * hl * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.42) * hl, y1 - Math.sin(a - 0.42) * hl); ctx.lineTo(x1 - Math.cos(a + 0.42) * hl, y1 - Math.sin(a + 0.42) * hl); ctx.closePath(); ctx.fill();
  }

  // ---- one frame ----
  function draw(dt) {
    const W = st.W, H = st.H; if (!W) return;
    const { ctx } = fitCanvas(st.cv, W, H);
    ctx.clearRect(0, 0, W, H);
    const g = geom(), t = st.t, sp = spiral(g.R), pal = CL.palette('rainbow');
    const R = g.R, cx = g.cx, cy = g.cy, s0 = sp[0], r0 = s0.r, P = 2 * HALF_T, v = Math.PI * r0 / HALF_T;
    const kNow = Math.floor((t - T0) / HALF_T), frac = clamp((t - T0) / HALF_T - kNow, 0, 1);
    const pol = t < T0 ? 0 : (kNow % 2 ? -1 : 1) * Math.cos(Math.PI * frac) * (t < T_EXIT ? 1 : 0.35);
    const aMag = clamp((t - T_FIELD) / 0.5, 0, 1), aDee = clamp((t - T_DEES) / 0.5, 0, 1);
    const dim = t < T_EXIT ? 1 : clamp(1 - (t - T_EXIT) / 0.9, 0.26, 1);
    ctx.save(); ctx.globalAlpha = dim;
    // ---- the magnet: a copper coil round the vacuum chamber, dark until it is switched on
    const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.45); halo.addColorStop(0, `rgba(201,128,63,${0.1 * aMag})`); halo.addColorStop(1, 'rgba(201,128,63,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.45, 0, TAU); ctx.fill();
    ctx.globalAlpha = dim * (0.3 + 0.7 * aMag);
    const cg = ctx.createRadialGradient(cx, cy, R * 1.08, cx, cy, R * 1.2); cg.addColorStop(0, '#5a2c0e'); cg.addColorStop(0.5, '#d7975f'); cg.addColorStop(1, '#6b3412');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, TAU); ctx.arc(cx, cy, R * 1.08, 0, TAU, true); ctx.fill();
    ctx.globalAlpha = dim;
    ctx.fillStyle = 'rgba(6,10,8,0.92)'; ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, TAU); ctx.fill();
    // field symbols (B into the screen): they spread out from the centre when the magnet comes on, bright at first
    if (aMag > 0) {
      const fs = Math.max(20, R * 0.17), q = Math.min(3, fs * 0.13), glowB = 0.16 + 0.24 * clamp(1 - (t - T_FIELD - 0.8) / 1.4, 0, 1);
      ctx.strokeStyle = 'rgb(179,166,255)'; ctx.lineWidth = 1;
      for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) {
        const px = cx + (i + 0.5) * fs, py = cy + (j + 0.5) * fs, d = Math.hypot(px - cx, py - cy);
        if (d > R * 0.96 || Math.abs(px - cx) < R * 0.06) continue;
        const a = clamp((t - T_FIELD) * 2.6 - d / R, 0, 1) * glowB; if (a <= 0.005) continue;
        ctx.globalAlpha = dim * a; ctx.beginPath();
        ctx.moveTo(px + q * 1.5, py); ctx.arc(px, py, q * 1.5, 0, TAU); ctx.moveTo(px - q, py - q); ctx.lineTo(px + q, py + q); ctx.moveTo(px + q, py - q); ctx.lineTo(px - q, py + q);
        ctx.stroke();
      }
      ctx.globalAlpha = dim;
    }
    // ---- the two D's: they appear when the pushes start; the voltage flips each half-turn, + red and − blue
    if (aDee > 0) {
      ctx.save(); ctx.globalAlpha = dim * aDee;
      const w = R * 0.06, h = Math.sqrt(R * R - w * w / 4), th = Math.acos(w / 2 / R);
      const deeR = new Path2D(); deeR.moveTo(cx + w / 2, cy - h); deeR.arc(cx, cy, R, -th, th, false); deeR.closePath();
      const deeL = new Path2D(); deeL.moveTo(cx - w / 2, cy + h); deeL.arc(cx, cy, R, Math.PI - th, Math.PI + th, false); deeL.closePath();
      const a = Math.abs(pol) * 0.22;
      ctx.fillStyle = pol > 0 ? `rgba(229,72,63,${a})` : `rgba(62,126,230,${a})`; ctx.fill(deeL);
      ctx.fillStyle = pol > 0 ? `rgba(62,126,230,${a})` : `rgba(229,72,63,${a})`; ctx.fill(deeR);
      ctx.shadowColor = 'rgba(255,140,60,0.6)'; ctx.shadowBlur = 14; ctx.strokeStyle = 'rgba(232,168,106,0.95)'; ctx.lineWidth = 2; ctx.stroke(deeL); ctx.stroke(deeR); ctx.shadowBlur = 0;
      if (t >= T0 && t < T_EXIT) {                         // which D is + and which is − right now
        const sa = Math.abs(pol) * 0.5, sz = Math.round(R * 0.2);
        text(ctx, pol > 0 ? '+' : '−', cx - R * 0.6, cy, { size: sz, w: 700, color: pol > 0 ? `rgba(255,140,130,${sa})` : `rgba(140,180,255,${sa})` });
        text(ctx, pol > 0 ? '−' : '+', cx + R * 0.6, cy, { size: sz, w: 700, color: pol > 0 ? `rgba(140,180,255,${sa})` : `rgba(255,140,130,${sa})` });
      }
      ctx.restore();
    }
    // ---- labels on the machine, one at a time above the coil
    const yTop = cy - R * 1.2 - 16;
    const aField = aMag * clamp(1 - (t - T_DEES) / 0.4, 0, 1), aGap = clamp((t - T_DEES - 0.3) / 0.4, 0, 1) * clamp(1 - (t - T_EXIT) / 0.4, 0, 1);
    if (aField > 0) { ctx.globalAlpha = dim * aField; text(ctx, '⊗  magnetic field, into the screen', cx, yTop, { size: 15, color: '#cfc7ff' }); }
    if (aGap > 0) { ctx.globalAlpha = dim * aGap; text(ctx, 'the gap: a push every time it crosses', cx, yTop, { size: 15, color: '#ffd9a8' }); ctx.strokeStyle = 'rgba(255,217,168,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, yTop + 10); ctx.lineTo(cx, cy - R * 1.0); ctx.stroke(); }
    ctx.globalAlpha = dim;
    // ---- the path so far, and where the proton is now
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, R * 0.012);
    const yb = cy + s0.cy + r0, xIn = cx - v * (T_FIELD - T_IN);
    let px = null, py = null, ang = null;
    if (t >= T_IN) {                                       // the straight line it came in on, fading once it circles
      const xe = t < T_FIELD ? cx - v * (T_FIELD - t) : cx, a = t < T_FIELD ? 0.8 : 0.8 * clamp(1 - (t - T_FIELD) / 1.2, 0, 1);
      if (a > 0) { const lg = ctx.createLinearGradient(xIn, yb, xe, yb); lg.addColorStop(0, 'rgba(255,200,150,0)'); lg.addColorStop(1, `rgba(255,200,150,${a})`); ctx.strokeStyle = lg; ctx.beginPath(); ctx.moveTo(Math.max(xIn, -20), yb); ctx.lineTo(xe, yb); ctx.stroke(); }
    }
    if (t >= T_FIELD) {                                    // the first circle, with the magnet alone
      const sweep = Math.min(TAU, TAU * (t - T_FIELD) / P), a = t < T0 ? 0.9 : 0.9 * clamp(1 - (t - T0) / 0.8, 0.45, 1);
      ctx.strokeStyle = pal[0]; ctx.globalAlpha = dim * a;
      ctx.beginPath(); ctx.arc(cx, cy + s0.cy, r0, Math.PI / 2, Math.PI / 2 - sweep, true); ctx.stroke(); ctx.globalAlpha = dim;
    }
    if (t >= T_IN && t < T_FIELD) { px = cx - v * (T_FIELD - t); py = yb; ang = null; }
    else if (t >= T_FIELD && t < T0) { ang = Math.PI / 2 - TAU * (t - T_FIELD) / P; px = cx + Math.cos(ang) * r0; py = cy + s0.cy + Math.sin(ang) * r0; }
    if (t >= T0) {
      const nDone = Math.min(HALF, kNow), trailA = t < T_EXIT ? 1 : clamp(1 - (t - T_EXIT) / 0.7, 0, 1);
      if (trailA > 0) for (let i = 0; i <= Math.min(nDone, HALF - 1); i++) {
        const s = sp[i], f = i < nDone ? 1 : frac;
        ctx.strokeStyle = pal[Math.round(i / (HALF - 1) * 63)]; ctx.globalAlpha = dim * trailA * 0.95;
        ctx.beginPath(); ctx.arc(cx, cy + s.cy, s.r, s.a0, s.a0 - Math.PI * f, true); ctx.stroke();
      }
      ctx.globalAlpha = dim;
      if (kNow < HALF) {
        [px, py] = posOn(g, sp[kNow], frac); ang = sp[kNow].a0 - Math.PI * frac;
        if (kNow !== st.k) {                            // crossing the gap: a push, a spark and a thump
          st.k = kNow;
          if (kNow > 0) { sparkBurst(cx, py, 10, 160); audio.thunk(kNow / HALF); if (kNow <= 5) st.pushes.push({ x: cx, y: py, t0: t }); }
        }
      } else if (st.k < HALF) {
        st.k = HALF; const [ex, ey] = posOn(g, sp[HALF - 1], 1);
        sparkBurst(ex, ey, 40, 360); st.flash = 0.26; st.flashCol = '255,214,150'; audio.zap();
      }
    }
    // "+ push" rises from the gap at the first few pushes
    for (const q of st.pushes) { const f = (t - q.t0) / 0.8; if (f >= 1) continue; ctx.globalAlpha = dim * (1 - f); text(ctx, '+ push', q.x + 12, q.y - 14 - f * 22, { size: 14, align: 'left', color: '#ffe0a0' }); }
    st.pushes = st.pushes.filter(q => t - q.t0 < 0.8); ctx.globalAlpha = dim;
    // velocity and force while the magnet alone bends it: the force always points to the centre
    const aArr = t < T_FIELD ? 0 : clamp((t - T_FIELD) / 0.3, 0, 1) * clamp(1 - (t - T0) / 0.35, 0, 1);
    if (aArr > 0 && px !== null && ang !== null) {
      const ux = Math.sin(ang), uy = -Math.cos(ang), fx = -Math.cos(ang), fy = -Math.sin(ang), Lv = Math.max(34, R * 0.3), Lf = Math.max(28, R * 0.22);
      ctx.globalAlpha = dim * aArr;
      arrow(ctx, px, py, px + ux * Lv, py + uy * Lv, '#7fe0a0', 2.4); arrow(ctx, px, py, px + fx * Lf, py + fy * Lf, '#ff8fd0', 2.4);
      text(ctx, 'velocity', px + ux * (Lv + 16), py + uy * (Lv + 16), { size: 13, color: '#a8f0c0' });
      text(ctx, 'force', px + fx * (Lf + 14), py + fy * (Lf + 14), { size: 13, color: '#ffb0e0' });
      ctx.globalAlpha = dim;
    }
    // the proton's name tag while it flies in
    const aTag = t < T_IN ? 0 : clamp((t - T_IN) / 0.3, 0, 1) * clamp(1 - (t - T_FIELD - 0.2) / 0.4, 0, 1);
    if (aTag > 0 && px !== null) { ctx.globalAlpha = dim * aTag; text(ctx, 'proton (+)', px, py - Math.max(22, R * 0.1), { size: 14, color: '#ffe7c4' }); ctx.globalAlpha = dim; }
    ctx.restore();
    // "every lap takes the same time": a dot for each push, evenly spaced in time, under the caption
    const cap4 = st.story && st.story.querySelector('.cap[data-n="4"]');
    const aBeat = clamp((t - T_BEAT) / 0.3, 0, 1) * clamp(1 - (t - T_EXIT - 0.2) / 0.4, 0, 1);
    if (aBeat > 0 && cap4) {
      const r = cap4.getBoundingClientRect(), o = st.el.getBoundingClientRect(), side = st.story.classList.contains('is-side');
      const gapX = 18, n = HALF - 1, wid = (n - 1) * gapX, x0 = side ? r.left - o.left + 6 : r.left - o.left + r.width / 2 - wid / 2, y0 = r.bottom - o.top + 16;
      ctx.save(); ctx.globalAlpha = aBeat;
      for (let k = 1; k <= n; k++) {
        const x = x0 + (k - 1) * gapX, lit = k <= kNow, fresh = lit && k === kNow ? 1 - frac : 0;
        if (fresh > 0) { ctx.fillStyle = `rgba(255,200,120,${0.35 * fresh})`; ctx.beginPath(); ctx.arc(x, y0, 9, 0, TAU); ctx.fill(); }
        ctx.beginPath(); ctx.arc(x, y0, 4.2, 0, TAU);
        if (lit) { ctx.fillStyle = '#ffc878'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(255,200,120,0.5)'; ctx.lineWidth = 1.2; ctx.stroke(); }
      }
      text(ctx, 'one dot per push: always the same time apart', side ? x0 - 2 : x0 + wid / 2, y0 + 20, { size: 13, align: side ? 'left' : 'center', color: 'rgba(214,224,218,0.8)' });
      ctx.restore();
    }
    // ---- the extracted beam, steered onto the name: a CRT writing with a particle beam
    const [ex, ey] = posOn(g, sp[HALF - 1], 1);
    const u = clamp((t - T_BURN0) / T_BURN, 0, 1), ue = u < 1 ? 1 - Math.pow(1 - u, 1.6) * (1 - u * 0.15) : 1;
    const x0 = g.tl - g.th * 0.04, x1 = g.tl + g.tw + g.th * 0.06;
    st.hot = x0 + (x1 - x0) * ue;
    if (t >= T_EXIT && t < T_QUENCH) {
      const hx = t < T_BURN0 ? x0 : st.hot, hy = g.cy + g.th * 0.04;
      const reach = t < T_BURN0 ? clamp((t - T_EXIT) / (T_BURN0 - T_EXIT), 0, 1) : 1;
      const bx = ex + (hx - ex) * reach, by = ey + (hy - ey) * reach;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fl = 0.85 + 0.15 * Math.sin(t * 90);
      ctx.strokeStyle = `rgba(255,120,40,${0.28 * fl})`; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = `rgba(255,214,150,${0.8 * fl})`; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(bx, by); ctx.stroke();
      const gl = ctx.createRadialGradient(bx, by, 0, bx, by, g.th * 0.45); gl.addColorStop(0, 'rgba(255,255,240,1)'); gl.addColorStop(0.2, 'rgba(255,190,90,0.75)'); gl.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(bx, by, g.th * 0.45, 0, TAU); ctx.fill();
      ctx.restore();
      if (t >= T_BURN0 && u < 1 && !reduceMotion) {
        for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, vv = 180 + Math.random() * 420; st.sparks.push({ x: hx, y: hy + (Math.random() - 0.5) * g.th * 0.5, vx: Math.cos(an) * vv - 60, vy: Math.sin(an) * vv, life: 0.3 + Math.random() * 0.5, age: 0 }); }
        st.crackle += dt; if (st.crackle > 0.07) { st.crackle = 0; audio.spark(); }
      }
    } else if (px !== null) {
      const gl = ctx.createRadialGradient(px, py, 0, px, py, Math.max(16, R * 0.08)); gl.addColorStop(0, 'rgba(255,245,220,1)'); gl.addColorStop(0.3, 'rgba(255,170,90,0.75)'); gl.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, Math.max(16, R * 0.08), 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, Math.max(2.5, R * 0.012), 0, TAU); ctx.fill();
    }
    // embers drift up from the freshly cut letters
    if (!reduceMotion) {
      const burnEnd = t < T_QUENCH ? st.hot : g.tl + g.tw;
      const rate = t < T_BURN0 ? 0 : t < T_QUENCH + 0.6 ? 70 : 6;
      st.emberT += dt * rate;
      while (st.emberT >= 1) {
        st.emberT -= 1;
        const xs = g.tl + Math.random() * Math.max(1, burnEnd - g.tl);
        st.embers.push({ x: xs, y: g.tt + g.th * (0.15 + Math.random() * 0.8), vx: (Math.random() - 0.5) * 24, vy: -(18 + Math.random() * 46), life: 1.1 + Math.random() * 1.6, age: 0, r: 0.8 + Math.random() * 1.7, s: Math.random() * 10 });
      }
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const e of st.embers) {
      e.age += dt; e.x += e.vx * dt + Math.sin(e.age * 3 + e.s) * 8 * dt; e.y += e.vy * dt;
      const f = 1 - e.age / e.life, fl = 0.55 + 0.45 * Math.sin(e.age * 23 + e.s * 7);
      ctx.fillStyle = `rgba(255,${Math.round(120 + 90 * f)},40,${Math.max(0, f * fl)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
    }
    st.embers = st.embers.filter(e => e.age < e.life);
    ctx.lineCap = 'round';
    for (const s of st.sparks) {
      s.age += dt; s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const f = Math.max(0, 1 - s.age / s.life);
      ctx.strokeStyle = `rgba(255,${Math.round(150 + 100 * f)},${Math.round(60 + 140 * f)},${f})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.022, s.y - s.vy * 0.022); ctx.stroke();
    }
    st.sparks = st.sparks.filter(s => s.age < s.life);
    ctx.restore();
    if (st.flash > 0.01) { ctx.fillStyle = `rgba(${st.flashCol},${st.flash})`; ctx.fillRect(0, 0, W, H); st.flash *= Math.exp(-dt * 6); }
    // the name as the beam leaves it: white-hot at the cut, cooling behind
    st.burn.style.setProperty('--hot', (st.hot - g.tl).toFixed(1) + 'px');
  }

  // ---- the beats of the timeline (CSS does the type, the canvas does the light) ----
  function beats(prevT, t) {
    const hit = T => prevT < T && t >= T;
    for (const [T, n] of STEPS) if (hit(T)) { showStep(n); audio.scribble(0.55); }
    if (hit(T_QUENCH - 0.5)) setPhase('is-story-out');
    if (hit(T_BURN0)) setPhase('is-burning');
    if (hit(T_QUENCH)) { setPhase('is-quenched'); st.flash = 0.2; st.flashCol = '255,236,206'; audio.whoosh(); }
    if (hit(T_STAMP)) { setPhase('is-stamped'); setPhase('is-shake'); audio.crunch(); setTimeout(() => setPhase('is-shake', false), 360); }
    if (hit(T_EQ)) setPhase('is-eq');
    if (hit(T_PLATE)) { setPhase('is-plate'); audio.clack(0.8); }
    if (hit(T_SIGN)) { setPhase('is-signed'); audio.scribble(1); }
    if (hit(T_READY)) { setPhase('is-ready'); audio.ding(); }
  }
  function loop(now) {
    if (!st.on) return;
    const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0; st.last = now;
    const prev = st.t; st.t += dt; beats(prev, st.t);
    try { draw(dt); } catch (err) { console.error(err); finish(); }
    st.raf = requestAnimationFrame(loop);
  }
  function size() { if (!st.el) return; st.W = st.el.clientWidth; st.H = st.el.clientHeight; layoutStory(); }

  // jump to the final title card
  function finish() {
    if (st.t >= T_READY) return;
    const prev = st.t; st.t = T_READY + 0.01; st.sparks = []; st.k = HALF;
    showStep(5); st.pushes = [];
    for (const c of ['is-story-out', 'is-burning', 'is-quenched', 'is-stamped', 'is-eq', 'is-plate', 'is-signed', 'is-ready']) setPhase(c);
    setPhase('is-instant'); requestAnimationFrame(() => requestAnimationFrame(() => setPhase('is-instant', false)));
    st.flash = 0; if (prev < T_READY) { /* silent jump */ }
  }
  function close() {
    if (!st.on) return;
    st.on = false; cancelAnimationFrame(st.raf);
    st.el.classList.add('is-leaving');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => {
      st.el.hidden = true; st.el.className = 'intro';
      const back = st.back && document.contains(st.back) ? st.back : $('#screen-home .btn-go');
      if (back && back.offsetParent) back.focus({ preventScroll: true });
      CL.bus.emit('intro', false);
    }, reduceMotion ? 0 : 520);
  }
  function advance() { if (st.t < T_READY) finish(); else close(); }
  function onKey(ev) {
    if (!st.on) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(ev.key)) return;
    if (ev.target && ev.target.id === 'introSkip' && (ev.key === 'Enter' || ev.key === ' ')) return;
    ev.preventDefault(); ev.stopPropagation();
    if (ev.key === 'Escape') close(); else advance();
  }

  function play(auto) {
    st.el = $('#intro'); if (!st.el) return;
    st.cv = $('#introCv'); st.burn = $('#introBurn'); st.name = $('#introName'); st.story = $('#introStory');
    st.back = auto ? null : document.activeElement;
    st.el.className = 'intro'; st.el.hidden = false;
    st.t = 0; st.last = 0; st.k = -1; st.sparks = []; st.embers = []; st.pushes = []; st.flash = 0; st.emberT = 0; showStep(0);
    st.on = true; size();
    document.addEventListener('keydown', onKey, true);
    st.el.focus({ preventScroll: true });
    CL.bus.emit('intro', true);
    if (reduceMotion) { finish(); draw(0); return; }
    // wait (briefly) for the stencil face so the name is cut in the right letters
    const go = () => { if (st.on) { st.last = 0; st.raf = requestAnimationFrame(loop); } };
    if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('800 100px "Big Shoulders Stencil"'), new Promise(r => setTimeout(r, 900))]).then(go, go);
    else go();
  }

  function init() {
    const el = $('#intro'); if (!el) return;
    el.addEventListener('click', ev => { if (ev.target.closest('#introSkip')) { close(); return; } advance(); });
    window.addEventListener('resize', () => { if (st.on) { size(); if (st.t >= T_READY) draw(0); } });
    const b = $('#homeIntro'); if (b) b.addEventListener('click', () => { audio.unlock(); play(false); });
  }
  CL.intro = { init, play, close, get on() { return st.on; } };
})();
