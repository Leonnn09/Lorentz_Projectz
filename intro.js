/* =====================================================================
   Project Lorentz — the title sequence (CL.intro).
   A small cyclotron spins up in the dark (every half-turn takes the same
   time, as in the real machine), the extracted beam burns the name in,
   the project plate stamps down and the makers' plate slides in.
   It plays when the app opens on Home; "Play the intro" replays it.
   Any key or click skips to the end, and then starts the app.
   ===================================================================== */
(() => {
  'use strict';
  const { $, clamp, TAU, audio, reduceMotion, fitCanvas } = CL;

  // timeline, in seconds
  const HALF = 12, HALF_T = 0.2;                       // half-turns and the (constant) time for each one
  const T0 = 0.45, T_EXIT = T0 + HALF * HALF_T;        // spin-up, then extraction
  const T_BURN0 = T_EXIT + 0.32, T_BURN = 1.45;        // the beam writes the name
  const T_QUENCH = T_BURN0 + T_BURN + 0.18;            // the hot letters cool to steel
  const T_STAMP = T_QUENCH + 0.42, T_EQ = T_STAMP + 0.32, T_PLATE = T_EQ + 0.4, T_READY = T_PLATE + 0.75;

  const st = { on: false, t: 0, last: 0, raf: 0, cv: null, ctx: null, W: 0, H: 0, k: -1, sparks: [], embers: [], flash: 0, flashCol: '255,255,255',
    phase: '', hot: 0, crackle: 0, el: null, burn: null, name: null, back: null, emberT: 0 };

  function geom() {
    const r = st.name.getBoundingClientRect(), o = st.el.getBoundingClientRect();
    const cx = r.left - o.left + r.width / 2, cy = r.top - o.top + r.height / 2;
    const R = Math.max(70, Math.min(st.H * 0.42, st.W * 0.32));
    return { cx, cy, R, tl: r.left - o.left, tt: r.top - o.top, tw: r.width, th: r.height };
  }
  // alternating half circles whose radius grows as √(number of pushes): the same spiral as on Home
  function spiral(R) {
    const Rs = R * 0.93, out = []; let y = 0, dir = 1;
    const radii = Array.from({ length: HALF }, (_, k) => Rs * Math.sqrt((k + 1) / HALF));
    const centres = []; for (let k = 0; k < HALF; k++) { const c = y - dir * radii[k]; centres.push(c); y = c - dir * radii[k]; dir = -dir; }
    const shift = (centres[HALF - 1] + centres[HALF - 2]) / 2;
    dir = 1;
    for (let k = 0; k < HALF; k++) { out.push({ r: radii[k], cy: centres[k] - shift, a0: dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir }); dir = -dir; }
    return out;
  }
  const posOn = (g, s, f) => { const a = s.a0 + s.dir * Math.PI * f; return [g.cx + Math.cos(a) * s.r, g.cy + s.cy + Math.sin(a) * s.r]; };

  function sparkBurst(x, y, n, speed, up = 0) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.35 + Math.random());
      st.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up * (0.5 + Math.random()), life: 0.25 + Math.random() * 0.5, age: 0 });
    }
  }
  function setPhase(cls, on = true) { st.el.classList.toggle(cls, on); }

  // ---- one frame ----
  function draw(dt) {
    const W = st.W, H = st.H; if (!W) return;
    const { ctx } = fitCanvas(st.cv, W, H);
    ctx.clearRect(0, 0, W, H);
    const g = geom(), t = st.t, sp = spiral(g.R), pal = CL.palette('rainbow');
    // ---- the machine: coil ring, vacuum chamber and the two dees
    const dim = t < T_EXIT ? 1 : clamp(1 - (t - T_EXIT) / 0.9, 0.26, 1);
    ctx.save(); ctx.globalAlpha = dim;
    const R = g.R, cx = g.cx, cy = g.cy;
    const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.45); halo.addColorStop(0, 'rgba(201,128,63,0.10)'); halo.addColorStop(1, 'rgba(201,128,63,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.45, 0, TAU); ctx.fill();
    const cg = ctx.createRadialGradient(cx, cy, R * 1.08, cx, cy, R * 1.2); cg.addColorStop(0, '#5a2c0e'); cg.addColorStop(0.5, '#d7975f'); cg.addColorStop(1, '#6b3412');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, TAU); ctx.arc(cx, cy, R * 1.08, 0, TAU, true); ctx.fill();
    ctx.fillStyle = '#060a08'; ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, TAU); ctx.fill();
    // field symbols: B points into the screen
    ctx.strokeStyle = 'rgba(179,166,255,0.16)'; ctx.lineWidth = 1;
    const fs = Math.max(20, R * 0.17), q = Math.min(3, fs * 0.13);
    ctx.beginPath();
    for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) {
      const px = cx + (i + 0.5) * fs, py = cy + (j + 0.5) * fs;
      if (Math.hypot(px - cx, py - cy) > R * 0.96 || Math.abs(px - cx) < R * 0.06) continue;
      ctx.moveTo(px + q * 1.5, py); ctx.arc(px, py, q * 1.5, 0, TAU); ctx.moveTo(px - q, py - q); ctx.lineTo(px + q, py + q); ctx.moveTo(px + q, py - q); ctx.lineTo(px - q, py + q);
    }
    ctx.stroke();
    // the RF voltage flips each half-turn: the dees glow red (+) and blue (−)
    const kNow = Math.floor((t - T0) / HALF_T), frac = clamp((t - T0) / HALF_T - kNow, 0, 1);
    const pol = t < T0 ? 0 : (kNow % 2 ? -1 : 1) * Math.cos(Math.PI * frac) * (t < T_EXIT ? 1 : 0.35);
    const w = R * 0.06, h = Math.sqrt(R * R - w * w / 4), th = Math.acos(w / 2 / R);
    const deeR = new Path2D(); deeR.moveTo(cx + w / 2, cy - h); deeR.arc(cx, cy, R, -th, th, false); deeR.closePath();
    const deeL = new Path2D(); deeL.moveTo(cx - w / 2, cy + h); deeL.arc(cx, cy, R, Math.PI - th, Math.PI + th, false); deeL.closePath();
    const a = Math.abs(pol) * 0.22;
    ctx.fillStyle = pol > 0 ? `rgba(229,72,63,${a})` : `rgba(62,126,230,${a})`; ctx.fill(deeL);
    ctx.fillStyle = pol > 0 ? `rgba(62,126,230,${a})` : `rgba(229,72,63,${a})`; ctx.fill(deeR);
    ctx.save(); ctx.shadowColor = 'rgba(255,140,60,0.6)'; ctx.shadowBlur = 14; ctx.strokeStyle = 'rgba(232,168,106,0.95)'; ctx.lineWidth = 2; ctx.stroke(deeL); ctx.stroke(deeR); ctx.restore();
    // ---- the spiral and the particle
    let px = null, py = null;
    if (t >= T0) {
      const nDone = Math.min(HALF, kNow), trailA = t < T_EXIT ? 1 : clamp(1 - (t - T_EXIT) / 0.7, 0, 1);
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, R * 0.012);
      if (trailA > 0) for (let i = 0; i <= Math.min(nDone, HALF - 1); i++) {
        const s = sp[i], f = i < nDone ? 1 : frac;
        ctx.strokeStyle = pal[Math.round(i / (HALF - 1) * 63)]; ctx.globalAlpha = dim * trailA * 0.95;
        ctx.beginPath(); ctx.arc(cx, cy + s.cy, s.r, s.a0, s.a0 + s.dir * Math.PI * f, s.dir < 0); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (kNow < HALF) {
        [px, py] = posOn(g, sp[kNow], frac);
        if (kNow !== st.k) {                            // crossing the gap: a push, a spark and a thump
          st.k = kNow;
          if (kNow > 0) { sparkBurst(cx, py, 10, 160); audio.thunk(kNow / HALF); }
        }
      } else if (st.k < HALF) {
        st.k = HALF; const [ex, ey] = posOn(g, sp[HALF - 1], 1);
        sparkBurst(ex, ey, 40, 360); st.flash = 0.26; st.flashCol = '255,214,150'; audio.zap();
      }
    }
    ctx.restore();
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
        for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 180 + Math.random() * 420; st.sparks.push({ x: hx, y: hy + (Math.random() - 0.5) * g.th * 0.5, vx: Math.cos(an) * v - 60, vy: Math.sin(an) * v, life: 0.3 + Math.random() * 0.5, age: 0 }); }
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
    if (hit(T_BURN0)) setPhase('is-burning');
    if (hit(T_QUENCH)) { setPhase('is-quenched'); st.flash = 0.2; st.flashCol = '255,236,206'; audio.whoosh(); }
    if (hit(T_STAMP)) { setPhase('is-stamped'); setPhase('is-shake'); audio.crunch(); setTimeout(() => setPhase('is-shake', false), 360); }
    if (hit(T_EQ)) setPhase('is-eq');
    if (hit(T_PLATE)) { setPhase('is-plate'); audio.clack(0.8); }
    if (hit(T_READY)) { setPhase('is-ready'); audio.ding(); }
  }
  function loop(now) {
    if (!st.on) return;
    const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0; st.last = now;
    const prev = st.t; st.t += dt; beats(prev, st.t);
    try { draw(dt); } catch (err) { console.error(err); finish(); }
    st.raf = requestAnimationFrame(loop);
  }
  function size() { if (!st.el) return; st.W = st.el.clientWidth; st.H = st.el.clientHeight; }

  // jump to the final title card
  function finish() {
    if (st.t >= T_READY) return;
    const prev = st.t; st.t = T_READY + 0.01; st.sparks = []; st.k = HALF;
    for (const c of ['is-burning', 'is-quenched', 'is-stamped', 'is-eq', 'is-plate', 'is-ready']) setPhase(c);
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
    st.cv = $('#introCv'); st.burn = $('#introBurn'); st.name = $('#introName');
    st.back = auto ? null : document.activeElement;
    st.el.className = 'intro'; st.el.hidden = false;
    st.t = 0; st.last = 0; st.k = -1; st.sparks = []; st.embers = []; st.flash = 0; st.emberT = 0;
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
