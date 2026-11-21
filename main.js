/* =====================================================================
   Project Lorentz — navigation, home screen, tour, sound/skin/fullscreen,
   and the single animation loop that drives the active screen.
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, TAU, store, skin, audio, missions, fitCanvas, reduceMotion, hexA } = CL;
  const NAMES = ['home', 'lab', 'gauss', 'race', 'collide', 'targets', 'physics'];
  let current = null;

  /* ---------- screens ---------- */
  function showScreen(name, push) {
    if (!NAMES.includes(name)) name = 'home';
    if (name === current) return;
    if (current && CL.screens[current] && CL.screens[current].hide) CL.screens[current].hide();
    current = name; CL.active = name;
    for (const n of NAMES) { const el = $('#screen-' + n); if (el) el.hidden = n !== name; }
    for (const b of $$('.nav-btn')) b.classList.toggle('is-active', b.dataset.go === name);
    if (push && location.hash !== '#' + name) { try { history.replaceState(null, '', '#' + name); } catch (_) { /* sandboxed */ } }
    if (CL.screens[name] && CL.screens[name].show) CL.screens[name].show();
    if (name === 'home') { updateHomeMissions(); requestAnimationFrame(sizeHome); setTimeout(sizeHome, 300); }
    const scr = $('#screen-' + name); if (scr) scr.scrollTop = 0;
  }
  CL.go = n => showScreen(n, true);

  /* ---------- home: a live cyclotron as the hero, and the station icons ---------- */
  const home = { cv: null, t: 0, icons: [], stat: null, statKey: '', sparks: [] };
  function sizeHome() {
    if (!home.cv) return;
    const scr = $('#screen-home'), sr = scr.getBoundingClientRect();
    home.W = sr.width || window.innerWidth; home.H = sr.height || window.innerHeight;
    const cards = $('.home-cards'), hero = $('.home-hero'), inner = $('.home-inner');
    if (cards && hero && inner) {
      home.cardsTop = cards.getBoundingClientRect().top - sr.top + scr.scrollTop;
      home.heroRight = hero.getBoundingClientRect().right - sr.left;
      home.innerRight = inner.getBoundingClientRect().right - sr.left - 28;
    }
    home.statKey = '';
    for (const ic of home.icons) { const r = ic.cv.getBoundingClientRect(); ic.w = r.width; ic.h = r.height; }
  }
  const HALF = 16, HALF_T = 0.42, EXIT_T = 1.4;          // half-turns per run, seconds per half-turn, extraction time
  function heroGeom() {
    const W = home.W, H = home.H, wide = W >= 980 && home.cardsTop > 200;
    if (!wide) { const R0 = Math.min(W * 0.4, H * 0.28); return { W, H, wide, R0, cx: W * 0.62, cy: H * 0.3, bottom: H }; }
    const top = 14, bottom = home.cardsTop - 12;
    const R0 = Math.max(80, Math.min((bottom - top) / 2.76, (home.innerRight - home.heroRight - 24) / 2.76));
    return { W, H, wide, R0, cx: (home.heroRight + home.innerRight) / 2 + 12, cy: (top + bottom) / 2, bottom };
  }
  function heroStatic(g) {                                // iron yoke, coil ring and vacuum chamber, drawn once per size
    const key = `${g.W}x${g.H}`; if (home.statKey === key && home.stat) return home.stat;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), pad = g.R0 * 1.5, size = Math.ceil(pad * 2);
    const c = document.createElement('canvas'); c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const cx = pad, cy = pad, R = g.R0;
    const sh = x.createRadialGradient(cx, cy + R * 0.1, R * 1.2, cx, cy + R * 0.1, R * 1.5); sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = sh; x.beginPath(); x.arc(cx, cy + R * 0.1, R * 1.5, 0, TAU); x.fill();
    const yk = x.createRadialGradient(cx - R * 0.3, cy - R * 0.45, R * 0.2, cx, cy, R * 1.36);
    yk.addColorStop(0, '#3a423d'); yk.addColorStop(0.6, '#232a26'); yk.addColorStop(1, '#141916');
    x.fillStyle = yk; x.beginPath(); x.arc(cx, cy, R * 1.36, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, R * 1.355, Math.PI * 1.05, Math.PI * 1.75); x.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i + 0.5) / 24 * TAU, bx = cx + Math.cos(a) * R * 1.3, by = cy + Math.sin(a) * R * 1.3, br = Math.max(2.5, R * 0.018);
      x.fillStyle = '#171c19'; x.beginPath(); x.arc(bx, by + 1, br, 0, TAU); x.fill();
      const bg = x.createRadialGradient(bx - br * 0.3, by - br * 0.3, 0, bx, by, br); bg.addColorStop(0, '#9aa39d'); bg.addColorStop(1, '#3c443f');
      x.fillStyle = bg; x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill();
    }
    const r0 = R * 1.1, r1 = R * 1.25;
    const cg = x.createRadialGradient(cx, cy, r0, cx, cy, r1); cg.addColorStop(0, '#6b3412'); cg.addColorStop(0.45, '#e2a066'); cg.addColorStop(1, '#7d3f15');
    x.fillStyle = cg; x.beginPath(); x.arc(cx, cy, r1, 0, TAU); x.arc(cx, cy, r0, 0, TAU, true); x.fill();
    x.strokeStyle = 'rgba(70,30,8,0.45)'; x.lineWidth = 0.8;
    for (let j = 1; j < 9; j++) { x.beginPath(); x.arc(cx, cy, r0 + (r1 - r0) * j / 9, 0, TAU); x.stroke(); }
    x.fillStyle = '#3b4540'; x.beginPath(); x.arc(cx, cy, R * 1.075, 0, TAU); x.fill();
    const vg = x.createRadialGradient(cx, cy, 0, cx, cy, R * 1.06); vg.addColorStop(0, '#15201b'); vg.addColorStop(0.75, '#0b110e'); vg.addColorStop(1, '#050807');
    x.fillStyle = vg; x.beginPath(); x.arc(cx, cy, R * 1.06, 0, TAU); x.fill();
    // field symbols, B into the screen
    x.strokeStyle = 'rgba(179,166,255,0.22)'; x.lineWidth = 1;
    const sp = Math.max(18, R * 0.16);
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
      const px = cx + (i + 0.5) * sp, py = cy + (j + 0.5) * sp;
      if (Math.hypot(px - cx, py - cy) > R * 0.98 || Math.abs(px - cx) < R * 0.07) continue;
      const q = 2.6; x.beginPath(); x.arc(px, py, 4, 0, TAU); x.moveTo(px - q, py - q); x.lineTo(px + q, py + q); x.moveTo(px + q, py - q); x.lineTo(px - q, py + q); x.stroke();
    }
    // the dees: hollow copper boxes
    const w = R * 0.07, h = Math.sqrt(R * R - w * w / 4), th = Math.acos(w / 2 / R);
    const dees = [new Path2D(), new Path2D()];
    dees[0].moveTo(cx + w / 2, cy - h); dees[0].arc(cx, cy, R, -th, th, false); dees[0].closePath();
    dees[1].moveTo(cx - w / 2, cy + h); dees[1].arc(cx, cy, R, Math.PI - th, Math.PI + th, false); dees[1].closePath();
    const dg = x.createRadialGradient(cx, cy, R * 0.1, cx, cy, R); dg.addColorStop(0, 'rgba(201,128,63,0.05)'); dg.addColorStop(0.85, 'rgba(201,128,63,0.13)'); dg.addColorStop(1, 'rgba(236,170,108,0.26)');
    x.fillStyle = dg; x.fill(dees[0]); x.fill(dees[1]);
    x.save(); x.shadowColor = 'rgba(255,140,60,0.5)'; x.shadowBlur = 12; x.strokeStyle = 'rgba(232,168,106,0.95)'; x.lineWidth = 1.8; x.stroke(dees[0]); x.stroke(dees[1]); x.restore();
    home.stat = { c, pad, size, dees, w, h }; home.statKey = key;
    return home.stat;
  }
  function spiral(g) {                                   // alternating half circles, radius grows as √(number of pushes)
    const R = g.R0 * 0.95, out = []; let y = 0, dir = 1;
    const radii = Array.from({ length: HALF }, (_, k) => R * Math.sqrt((k + 1) / HALF));
    const centres = []; for (let k = 0; k < HALF; k++) { const c = y - dir * radii[k]; centres.push(c); y = c - dir * radii[k]; dir = -dir; }
    const shift = (centres[HALF - 1] + centres[HALF - 2]) / 2;
    dir = 1;
    for (let k = 0; k < HALF; k++) { out.push({ r: radii[k], cy: centres[k] - shift, a0: dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir }); dir = -dir; }
    return out;
  }
  function drawHome(dt) {
    const W = home.W, H = home.H; if (!W) return;
    const { ctx } = fitCanvas(home.cv, W, H);
    ctx.clearRect(0, 0, W, H);
    home.t += dt * (reduceMotion ? 0.25 : 1);
    const g = heroGeom(), st = heroStatic(g), cx = g.cx, cy = g.cy;
    ctx.save();
    if (!g.wide) ctx.globalAlpha = 0.42;
    ctx.drawImage(st.c, cx - st.pad, cy - st.pad, st.size, st.size);
    const cycle = HALF * HALF_T + EXIT_T + 0.6, tc = home.t % cycle, k = Math.floor(tc / HALF_T), frac = (tc % HALF_T) / HALF_T;
    const sp = spiral(g), pal = CL.palette('rainbow');
    // RF polarity: flips every half-turn
    const pol = (k % 2 ? -1 : 1) * Math.cos(Math.PI * frac);
    ctx.save(); ctx.translate(cx - st.pad, cy - st.pad);
    const a = Math.abs(pol) * 0.2;
    ctx.fillStyle = pol > 0 ? `rgba(229,72,63,${a})` : `rgba(62,126,230,${a})`; ctx.fill(st.dees[1]);
    ctx.fillStyle = pol > 0 ? `rgba(62,126,230,${a})` : `rgba(229,72,63,${a})`; ctx.fill(st.dees[0]);
    ctx.restore();
    // trail of the spiral so far
    ctx.lineCap = 'round';
    const nDone = Math.min(HALF, k), pos = (s, f) => { const an = s.a0 + s.dir * Math.PI * f; return [cx + Math.cos(an) * s.r, cy + s.cy + Math.sin(an) * s.r]; };
    for (let i = 0; i <= Math.min(nDone, HALF - 1); i++) {
      const s = sp[i], f = i < nDone ? 1 : frac;
      ctx.strokeStyle = pal[Math.round(i / (HALF - 1) * 63)]; ctx.lineWidth = 2.2; ctx.globalAlpha = (g.wide ? 1 : 0.42) * 0.9;
      ctx.beginPath(); ctx.arc(cx, cy + s.cy, s.r, s.a0, s.a0 + s.dir * Math.PI * f, s.dir < 0); ctx.stroke();
    }
    ctx.globalAlpha = g.wide ? 1 : 0.42;
    let px, py;
    if (k < HALF) { [px, py] = pos(sp[k], frac); if (frac < 0.06 && k > 0 && !reduceMotion) for (let i = 0; i < 2; i++) home.sparks.push({ x: cx, y: py, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90, life: 0.35 }); }
    else {
      const s = sp[HALF - 1], [ex, ey] = pos(s, 1), te = tc - HALF * HALF_T, L = Math.min(1, te / EXIT_T) * (W - ex + 40);
      const dx = -s.dir, gr = ctx.createLinearGradient(ex, ey, ex + dx * L, ey);
      gr.addColorStop(0, 'rgba(255,90,60,0.9)'); gr.addColorStop(1, 'rgba(255,210,140,0.9)');
      ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + dx * L, ey); ctx.stroke();
      px = ex + dx * L; py = ey;
      for (let i = 0; i < HALF; i++) { const s2 = sp[i]; ctx.strokeStyle = pal[Math.round(i / (HALF - 1) * 63)]; ctx.lineWidth = 2.2; ctx.globalAlpha = (g.wide ? 1 : 0.42) * Math.max(0, 1 - te / (EXIT_T + 0.6)); ctx.beginPath(); ctx.arc(cx, cy + s2.cy, s2.r, s2.a0, s2.a0 + s2.dir * Math.PI, s2.dir < 0); ctx.stroke(); }
      ctx.globalAlpha = g.wide ? 1 : 0.42;
    }
    if (px > -20 && px < W + 20) {
      const gl = ctx.createRadialGradient(px, py, 0, px, py, 22); gl.addColorStop(0, 'rgba(255,240,210,1)'); gl.addColorStop(0.3, 'rgba(255,170,90,0.7)'); gl.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 3.2, 0, TAU); ctx.fill();
    }
    for (const s of home.sparks) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; ctx.strokeStyle = `rgba(255,210,140,${Math.max(0, s.life / 0.35)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.04, s.y - s.vy * 0.04); ctx.stroke(); }
    home.sparks = home.sparks.filter(s => s.life > 0);
    if (g.wide && cy + g.R0 * 1.36 + 30 < g.bottom + 10) {
      ctx.font = '600 15px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(214,224,216,0.55)';
      ctx.fillText('the same time for every lap: f = qB / 2πm', cx, cy + g.R0 * 1.36 + 22);
    }
    ctx.restore();
  }
  function iconBg(ctx, W, H) { const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7); g.addColorStop(0, '#131c17'); g.addColorStop(1, '#070a08'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  function drawIcon(ic, t) {
    if (!ic.w) return;
    const { ctx } = fitCanvas(ic.cv, ic.w, ic.h), W = ic.w, H = ic.h;
    ctx.clearRect(0, 0, W, H); iconBg(ctx, W, H);
    const cx = W / 2, cy = H / 2, s = Math.min(W, H);
    ctx.lineCap = 'round';
    if (ic.kind === 'lab') {
      ctx.fillStyle = 'rgba(201,128,63,0.12)'; ctx.strokeStyle = 'rgba(232,168,106,0.85)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, -Math.PI / 2 + 0.06, Math.PI / 2 - 0.06); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, Math.PI / 2 + 0.06, 3 * Math.PI / 2 - 0.06); ctx.closePath(); ctx.fill(); ctx.stroke();
      const n = 9, prog = (t * 0.35) % 1, total = n * prog, pal = CL.palette('rainbow');
      let y = 0, dir = 1;
      for (let k = 0; k < n && k < total; k++) {
        const r = s * 0.42 * Math.sqrt((k + 1) / n), c = y - dir * r, frac = Math.min(1, total - k);
        ctx.strokeStyle = pal[Math.round(k / (n - 1) * 63)]; ctx.lineWidth = 2;
        ctx.beginPath(); const a0 = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        ctx.arc(cx, cy + c, r, a0, a0 + Math.PI * frac, false); ctx.stroke();
        if (frac < 1 || k === n - 1) { const a = a0 + Math.PI * frac, hx = cx + Math.cos(a) * r, hy = cy + c + Math.sin(a) * r; const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, 8); gl.addColorStop(0, '#fff'); gl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx, hy, 8, 0, TAU); ctx.fill(); }
        y = c - dir * r; dir = -dir;
      }
    } else if (ic.kind === 'gauss') {
      const y = H * 0.55, n = 4, x0 = W * 0.08, x1 = W * 0.72, cw = W * 0.09, ph = (t * 0.55) % 1.6;
      ctx.strokeStyle = 'rgba(220,235,240,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y - 4); ctx.lineTo(x1, y - 4); ctx.moveTo(x0, y + 4); ctx.lineTo(x1, y + 4); ctx.stroke();
      const xs = i => x0 + (i + 0.6) * (x1 - x0) / (n + 0.4);
      const sx = ph < 1 ? x0 + 6 + (W * 1.05 - x0) * Math.pow(ph, 1.6) : -50;
      for (let i = 0; i < n; i++) {
        const xc = xs(i), on = sx > xc - cw * 1.3 && sx < xc + 2;
        ctx.fillStyle = on ? '#ffb24d' : '#a8662f'; ctx.fillRect(xc - cw / 2, y - 16, cw, 10); ctx.fillRect(xc - cw / 2, y + 6, cw, 10);
        if (on) { ctx.fillStyle = 'rgba(255,160,60,0.35)'; ctx.beginPath(); ctx.arc(xc, y, cw * 1.1, 0, TAU); ctx.fill(); }
      }
      if (sx > 0) { ctx.fillStyle = '#c4cbd2'; ctx.fillRect(sx - 9, y - 3, 18, 6); if (ph > 0.55) { const gr = ctx.createLinearGradient(sx - 40, 0, sx - 9, 0); gr.addColorStop(0, 'rgba(255,220,170,0)'); gr.addColorStop(1, 'rgba(255,220,170,0.6)'); ctx.fillStyle = gr; ctx.fillRect(sx - 40, y - 2, 31, 4); } }
    } else if (ic.kind === 'race') {
      const cols = ['#ff6b6b', '#ffd43b', '#4dabf7'], spd = [1, 0.5, 3.2];
      ctx.strokeStyle = 'rgba(200,214,204,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.2, H * 0.12); ctx.lineTo(W * 0.2, H * 0.88); ctx.stroke();
      cols.forEach((c, i) => {
        const r = H * (0.12 + 0.12 * i), ph = Math.min(1, ((t * 0.45 * spd[i]) % 1.6));
        ctx.strokeStyle = hexA(c, 0.85); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W * 0.2, H * 0.5 - r, r, Math.PI / 2, Math.PI / 2 - Math.PI * ph, true); ctx.stroke();
        const a = Math.PI / 2 - Math.PI * ph, x = W * 0.2 + Math.cos(a) * r, y = H * 0.5 - r + Math.sin(a) * r;
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
      });
    } else if (ic.kind === 'collide') {
      const ph = (t * 0.6) % 1.4;
      if (ph < 0.5) {
        const d = (0.5 - ph) / 0.5 * W * 0.42;
        for (const [x, c] of [[cx - d, '#4dc3ff'], [cx + d, '#ff6a9a']]) { const gl = ctx.createRadialGradient(x, cy, 0, x, cy, 10); gl.addColorStop(0, c); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, cy, 10, 0, TAU); ctx.fill(); }
      } else {
        const f = (ph - 0.5) / 0.9;
        ctx.strokeStyle = `rgba(255,230,180,${1 - f})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, f * s * 0.5, 0, TAU); ctx.stroke();
        ['#ffd43b', '#ff922b', '#63e6be', '#da77f2', '#4dabf7', '#ff6b6b'].forEach((c, i, arr) => {
          const a = i / arr.length * TAU + 0.4, r = f * s * 0.48, curl = (i % 2 ? 1 : -1) * 0.9;
          ctx.strokeStyle = hexA(c, 1 - f * 0.6); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx, cy);
          for (let k = 1; k <= 12; k++) { const rr = r * k / 12, aa = a + curl * (k / 12) * f; ctx.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr); }
          ctx.stroke();
        });
        if (f < 0.15) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - f / 0.15)})`; ctx.fillRect(0, 0, W, H); }
      }
    } else if (ic.kind === 'targets') {
      ['#3d8bfd', '#e64980', '#3d8bfd'].forEach((c, i) => { ctx.fillStyle = hexA(c, 0.55); ctx.fillRect(W * (0.38 + i * 0.16), H * 0.2, W * 0.15, H * 0.6); });
      const ph = (t * 0.7) % 1.2, x = W * 0.05 + Math.min(1, ph) * W * 0.6;
      ctx.strokeStyle = 'rgba(255,107,107,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(x, cy); ctx.stroke();
      if (ph >= 1) { const f = (ph - 1) / 0.2; const gl = ctx.createRadialGradient(W * 0.65, cy, 0, W * 0.65, cy, 22 * (1 - f) + 6); gl.addColorStop(0, 'rgba(255,230,140,1)'); gl.addColorStop(1, 'rgba(255,120,60,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(W * 0.65, cy, 26, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, cy, 3.5, 0, TAU); ctx.fill(); }
    } else {
      ctx.font = `300 ${Math.round(s * 0.24)}px "Barlow Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ['F = qv × B', 'r = p / qB', 'f = qB / 2πm'].forEach((l, i) => { ctx.save(); ctx.shadowColor = 'rgba(255,110,20,0.9)'; ctx.shadowBlur = 8; ctx.fillStyle = `rgba(255,207,158,${0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 2))})`; ctx.fillText(l, cx, H * (0.25 + 0.25 * i)); ctx.restore(); });
    }
  }
  function updateHomeMissions() { const [d, n] = missions.count(); const el = $('#homeMissions'); if (el) el.textContent = `${d} / ${n}`; }

  /* ---------- guided tour ---------- */
  const TOUR = [
    { sel: null, title: 'Welcome to Project Lorentz', text: 'The name comes from the Lorentz force, F = q(E + v × B). A cyclotron uses both parts of it: the electric field gives the particle a push each time it crosses the gap, and the magnetic field bends it round in a circle so it comes back for the next push. This tour shows you around the Cyclotron screen in under a minute.' },
    { sel: '#stageWrap', title: 'The machine from above', text: 'The particle starts in the middle and spirals outwards between the two copper dees. Red and blue show which dee is positive. Drag the edge of the dees to make the machine bigger or smaller, drag the striped corner to resize the view, and scroll or pinch to zoom.' },
    { sel: '#btnRide', title: 'Ride the particle', text: 'Fly along with the particle, seen from just behind it. With sound on, you hear a thump at every push across the gap and a tick at every peak of the voltage. When the two stay together the beat is steady: that is the cyclotron resonance. Press V to switch views.' },
    { sel: '#accMagnet', title: 'Build the electromagnet', text: 'Choose the coils, turns per coil, current and pole gap: B = μ₀NI/g. Or load a real machine from the menu above it.' },
    { sel: '#screen-lab .timebar', title: 'Play, replay and record', text: 'Play, step, change speed or drag the timeline. After a run, Replay 0.1× shows the final orbits in slow motion with every push labelled. Record saves the run to your notebook.' },
    { sel: '#screen-lab .tiles', title: 'Live readouts', text: 'Speed, kinetic energy, orbit radius and laps, glowing like the nixie tubes on old lab instruments.' },
    { sel: '#screen-lab .data', title: 'Every number explained', text: 'The notebook explains each quantity in words. Show working puts your own numbers into each formula, step by step.' },
    { sel: '.lvl', title: 'Simple or full detail', text: 'Simple hides the expert controls and adds plain-language notes and ? buttons. Full detail shows all the theory and every control.' },
    { sel: '.nav-screens', title: 'More to explore', text: 'Fire a Gauss gun, race particles, smash them together in the collider, fire them into targets, and test yourself in the physics quiz. Each screen has missions.' },
  ];
  let tourI = -1;
  function tourStart() { showScreen('lab', true); tourI = 0; $('#tour').hidden = false; setTimeout(tourStep, 250); }
  function tourEnd() { tourI = -1; $('#tour').hidden = true; store.set('cl-toured', true); }
  function tourStep() {
    if (tourI < 0) return;
    const st = TOUR[tourI];
    $('#tourStep').textContent = `${tourI + 1} / ${TOUR.length}`;
    $('#tourTitle').textContent = st.title; $('#tourText').textContent = st.text;
    $('#tourBack').disabled = tourI === 0;
    $('#tourNext').textContent = tourI === TOUR.length - 1 ? 'Finish' : 'Next';
    const hole = $('#tourHole'), card = $('#tourCard');
    const el = st.sel ? $(st.sel) : null;
    if (el && el.tagName === 'DETAILS') el.open = true;
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2 - 1, top: innerHeight / 2 - 1, width: 2, height: 2 };
    const pad = el ? 6 : 0;
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px' });
    const cw = Math.min(360, innerWidth - 24), ch = card.offsetHeight || 180;
    let left = r.left + r.width + 16, top = r.top;
    if (left + cw > innerWidth - 12) left = r.left - cw - 16;
    if (left < 12) { left = clamp(r.left + r.width / 2 - cw / 2, 12, innerWidth - cw - 12); top = r.top + r.height + 14; if (top + ch > innerHeight - 12) top = r.top - ch - 14; }
    if (!el) { left = innerWidth / 2 - cw / 2; top = innerHeight / 2 - ch / 2; }
    card.style.left = clamp(left, 12, innerWidth - cw - 12) + 'px';
    card.style.top = clamp(top, 12, innerHeight - ch - 12) + 'px';
    $('#tourNext').focus({ preventScroll: true });
  }

  /* ---------- buttons in the nav bar ---------- */
  function syncSound() { const b = $('#btnSound'); b.setAttribute('aria-pressed', String(!audio.muted)); b.title = audio.muted ? 'Sound is off' : 'Sound is on'; }
  function bindNav() {
    for (const b of $$('[data-go]')) b.addEventListener('click', () => { audio.unlock(); showScreen(b.dataset.go, true); });
    $('#btnSound').addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); syncSound(); if (!audio.muted) audio.beep(660, 0.08); });
    $('#btnSkin').addEventListener('click', () => { skin.apply(skin.name === 'control' ? 'classroom' : 'control'); });
    $('#btnFull').addEventListener('click', () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
      } catch (_) { /* not allowed in this frame */ }
    });
    $('#btnTour').addEventListener('click', tourStart);
    $('#homeTour').addEventListener('click', tourStart);
    $('#homeRide').addEventListener('click', () => { audio.unlock(); showScreen('lab', true); if (CL.lab) CL.lab.ride(true); });
    $('#tourNext').addEventListener('click', () => { if (tourI >= TOUR.length - 1) tourEnd(); else { tourI++; tourStep(); } });
    $('#tourBack').addEventListener('click', () => { if (tourI > 0) { tourI--; tourStep(); } });
    $('#tourSkip').addEventListener('click', tourEnd);
    document.addEventListener('keydown', ev => { if (tourI >= 0 && ev.key === 'Escape') tourEnd(); });
    window.addEventListener('hashchange', () => showScreen(location.hash.slice(1)));
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    let rT = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(() => { sizeHome(); const s = CL.screens[current]; if (s && s.resize) s.resize(); if (tourI >= 0) tourStep(); }, 60);
    });
    CL.bus.on('mission', m => { updateHomeMissions(); });
    CL.bus.on('muted', syncSound);
  }

  /* ---------- the loop ---------- */
  let last = 0;
  function loop(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    try {
      if (current === 'home') { drawHome(dt); for (const ic of home.icons) drawIcon(ic, now / 1000); }
      else if (CL.screens[current] && CL.screens[current].frame) CL.screens[current].frame(now, dt);
    } catch (err) { if (!loop.warned) { loop.warned = true; console.error(err); } }
    requestAnimationFrame(loop);
  }

  function start(data) {
    missions.init();
    skin.apply(store.get('cl-skin', 'control'));
    syncSound();
    home.cv = $('#homeBg');
    home.icons = $$('.hicon').map(cv => ({ cv, kind: cv.dataset.icon, w: 0, h: 0 }));
    for (const k of ['lab', 'gauss', 'race', 'collide', 'targets', 'physics']) { try { CL.screens[k].init(); } catch (err) { console.error('init ' + k, err); } }
    try { CL.guide.init(); } catch (err) { console.error('guide', err); }
    try { CL.intro.init(); } catch (err) { console.error('intro', err); }
    if (data && data.lab && CL.lab) CL.lab.restore(data.lab);
    bindNav();
    updateHomeMissions();
    const h = location.hash.slice(1);
    showScreen(NAMES.includes(h) ? h : 'home', false);
    sizeHome();
    // the title sequence plays when the app opens on Home (add ?nointro to the address to skip it)
    if (current === 'home' && !/[?&]nointro\b/.test(location.search)) { try { CL.intro.play(true); } catch (err) { console.error('intro', err); } }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { skin.read(); CL.bus.emit("skin", skin.name); sizeHome(); const s = CL.screens[current]; if (s && s.resize) s.resize(); });
    requestAnimationFrame(loop);
  }

  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ lab: CL.lab ? CL.lab.snapshot() : null }));
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
