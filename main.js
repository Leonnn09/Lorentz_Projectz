/* =====================================================================
   Project Lorentz — navigation, home screen, tour, sound/skin/fullscreen,
   and the single animation loop that drives the active screen.
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, TAU, store, skin, audio, missions, fitCanvas, reduceMotion, hexA } = CL;
  const NAMES = ['home', 'lab', 'gauss', 'physics'];
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
    if (CL.reallife) CL.reallife.close();
    CL.bus.emit('screen', name);
    const sw = $('#sweep');
    if (sw && !reduceMotion && name !== 'home') { sw.classList.remove('is-on'); void sw.offsetWidth; sw.classList.add('is-on'); }
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
    const st = $('#homeStage');
    if (st) { const r = st.getBoundingClientRect(); home.stage = { x: r.left - sr.left, y: r.top - sr.top + scr.scrollTop, w: r.width, h: r.height }; }
    home.statKey = '';
    for (const ic of home.icons) { const r = ic.cv.getBoundingClientRect(); ic.w = r.width; ic.h = r.height; }
  }
  const HALF = 16, HALF_T = 0.42, EXIT_T = 1.4;          // half-turns per run, seconds per half-turn, extraction time
  // Two machines, side by side and the same size: the cyclotron on the left half of the stage, the Gauss gun on the right.
  // On narrow screens both are drawn faintly behind the title.
  function heroGeom() {
    const W = home.W, H = home.H, st = home.stage, wide = W >= 980 && st && st.w > 420 && st.h > 240;
    if (!wide) {
      const R0 = Math.min(W * 0.24, H * 0.15);
      const cy = H * 0.19;
      return { W, H, wide, R0, cx: W * 0.74, cy, bottom: H, gun: { x0: W * 0.12, x1: W * 0.97, y: cy + R0 * 1.85, th: 16 } };
    }
    const half = st.w / 2, capH = 70;
    const R0 = Math.max(60, Math.min((half - 24) / 2.85, (st.h - capH) / 2.84));
    const cx = st.x + half / 2, cy = st.y + (st.h - capH) / 2;
    return { W, H, wide, R0, cx, cy, half, bottom: st.y + st.h, capY: cy + R0 * 1.42 + 26,
      gun: { x0: st.x + half + 22, x1: st.x + st.w - 6, y: cy, th: clamp(R0 * 0.24, 16, 30) } };
  }
  /* the team's handwriting under each machine */
  const CAPS = [
    ['the cyclotron', 'B bends the proton, the gap pushes it'],
    ['the Gauss gun', 'each coil pulls the slug, then switches off'],
  ];
  function drawNotes(ctx, g) {
    if (!g.wide) return;
    const ink = '#efe6cf', t = home.noteT, fs = clamp(g.R0 * 0.12, 15, 19);   // the notes sit on the dark glass in every scheme
    ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    CAPS.forEach((cap, i) => {
      const p = reduceMotion ? 1 : clamp((t - 0.4 - i * 0.5) / 0.9, 0, 1); if (p <= 0) return;
      const x = i === 0 ? g.cx : g.cx + g.half;
      ctx.save(); ctx.beginPath(); ctx.rect(x - g.half / 2, g.capY - fs * 1.4, g.half * p, fs * 3.2); ctx.clip();
      ctx.fillStyle = ink; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
      ctx.font = `700 ${fs * 1.12}px Kalam, "Segoe Print", "Comic Sans MS", cursive`; ctx.fillText(cap[0], x, g.capY);
      ctx.font = `400 ${fs}px Kalam, "Segoe Print", "Comic Sans MS", cursive`; ctx.fillText(cap[1], x, g.capY + fs * 1.35);
      ctx.restore();
    });
    ctx.restore();
  }
  // the Gauss gun: four coils switch on one after another; each pulls the iron slug to its middle and switches off there,
  // so every coil adds the same energy (the speed after coil n grows as √n). Then the slug flies out and knocks a can over.
  function drawGun(ctx, g, dt, alpha) {
    const G = g.gun, L = (G.x1 - G.x0) * 0.74, x0 = G.x0, y = G.y, th = G.th, P = 3.6, u = home.t % P;
    const coils = [0.27, 0.44, 0.61, 0.78].map(f => x0 + L * f), cw = Math.max(16, L * 0.085), ch = th * 1.15, sl = Math.max(20, L * 0.08);
    const start = x0 + sl / 2 + 6, T1 = 0.7, v1 = (coils[0] - start) * 2.2;
    // where the slug is: idle, then pulled through the coils, then out
    let x = start, on = -1;
    if (u >= T1) {
      let tt = u - T1, prev = start, va = 0, done = false;
      for (let k = 0; k < 4; k++) {
        const vb = v1 * Math.sqrt(k + 1), d = coils[k] - prev, T = 2 * d / (va + vb), a = (vb - va) / T;
        if (tt < T) { x = prev + va * tt + 0.5 * a * tt * tt; on = k; done = true; break; }
        tt -= T; prev = coils[k]; va = vb;
      }
      if (!done) x = coils[3] + va * tt;
    }
    ctx.save(); ctx.globalAlpha = alpha;
    // the bench it is clamped to, and the capacitor bank that powers the coils
    const by = y + th / 2 + ch + 10;
    ctx.fillStyle = 'rgba(60,46,32,0.9)'; ctx.fillRect(x0 - 16, by, G.x1 - x0 + 16, 10); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x0 - 16, by, G.x1 - x0 + 16, 2);
    for (let k = 0; k < 2; k++) {
      const bx = x0 + L * 0.03 + k * th * 1.15, bh = ch + 4, cg2 = ctx.createLinearGradient(bx, 0, bx + th, 0);
      cg2.addColorStop(0, '#203a5a'); cg2.addColorStop(0.5, '#4f7fb3'); cg2.addColorStop(1, '#1b3150');
      ctx.fillStyle = cg2; ctx.fillRect(bx, by - bh, th, bh); ctx.fillStyle = '#c9d1d6'; ctx.fillRect(bx, by - bh - 3, th, 3);
    }
    // barrel
    ctx.fillStyle = 'rgba(200,220,230,0.07)'; ctx.strokeStyle = 'rgba(200,220,230,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y - th / 2, L, th, 4); else ctx.rect(x0, y - th / 2, L, th); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b3337'; ctx.fillRect(x0 - 8, y - th * 0.8, 8, th * 1.6);
    coils.forEach((cx, k) => {
      const lit = k === on;
      if (lit) {
        const gl = ctx.createRadialGradient(cx, y, 0, cx, y, cw * 1.9); gl.addColorStop(0, 'rgba(255,170,70,0.5)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, y, cw * 1.9, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(179,166,255,0.4)'; ctx.lineWidth = 1;
        for (let r = 1; r <= 2; r++) { ctx.beginPath(); ctx.ellipse(cx, y, cw * (0.7 + 0.5 * r), th * (1.2 + 0.9 * r), 0, 0, TAU); ctx.stroke(); }
      }
      for (const sy of [-1, 1]) {
        const yy = sy < 0 ? y - th / 2 - ch : y + th / 2, gr = ctx.createLinearGradient(0, yy, 0, yy + ch);
        gr.addColorStop(0, lit ? '#ffb45a' : '#8a5124'); gr.addColorStop(0.5, lit ? '#ffe0a8' : '#c8803f'); gr.addColorStop(1, lit ? '#e0822e' : '#6d3a17');
        ctx.fillStyle = gr; ctx.fillRect(cx - cw / 2, yy, cw, ch);
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
        for (let i = 1; i < 6; i++) { const xx = cx - cw / 2 + cw * i / 6; ctx.beginPath(); ctx.moveTo(xx, yy + 2); ctx.lineTo(xx, yy + ch - 2); ctx.stroke(); }
      }
      if (lit && !home.gunLit) { home.gunLit = true; }
    });
    // the can at the end of the range
    const canX = G.x1 - 18, canH = th * 2.6, canW = th * 1.5, hit = x >= canX - canW / 2 - sl / 2;
    if (hit && !home.canT) home.canT = home.t;
    if (u < T1) home.canT = 0;
    const f = home.canT ? clamp((home.t - home.canT) / 0.45, 0, 1) : 0;
    ctx.save(); ctx.translate(canX + canW / 2, y + th / 2 + ch); ctx.rotate(f * 1.3); ctx.translate(f * 18, 0);
    const cg = ctx.createLinearGradient(-canW, 0, 0, 0); cg.addColorStop(0, '#8d9aa4'); cg.addColorStop(0.5, '#e6edf1'); cg.addColorStop(1, '#7c8890');
    ctx.fillStyle = cg; ctx.fillRect(-canW, -canH, canW, canH); ctx.fillStyle = '#d9483b'; ctx.fillRect(-canW, -canH * 0.68, canW, canH * 0.32);
    ctx.restore();
    // the slug, with a little streak once it is fast
    if (!hit) {
      const sg = ctx.createLinearGradient(0, y - th * 0.32, 0, y + th * 0.32); sg.addColorStop(0, '#eef2f5'); sg.addColorStop(0.5, '#a3adb5'); sg.addColorStop(1, '#5d666e');
      ctx.fillStyle = sg; ctx.fillRect(x - sl / 2, y - th * 0.32, sl, th * 0.64);
      if (u > T1 + 0.3) { const lg = ctx.createLinearGradient(x - sl * 2.5, 0, x - sl / 2, 0); lg.addColorStop(0, 'rgba(255,220,170,0)'); lg.addColorStop(1, 'rgba(255,220,170,0.4)'); ctx.fillStyle = lg; ctx.fillRect(x - sl * 2.5, y - th * 0.15, sl * 2, th * 0.3); }
    }
    ctx.restore();
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
  // alternating half circles whose radius grows as √(number of pushes). A proton with B into the screen goes round
  // anticlockwise: even half-turns run up through the right dee (bottom crossing to top), odd ones down through the left dee.
  // Each half-turn starts just after a gap crossing, while the dee it came from is + and the one it enters is −.
  function spiral(g) {
    const Rs = g.R0 * 0.95;
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
  /* the bench as a cloud chamber: now and then a faint trail of droplets appears where a particle from
     the sky went through (a short thick alpha track, a long thin muon, or an electron curling in a field) and fades */
  function drawTracks(ctx, dt, W, H) {
    const T = home.tracks || (home.tracks = []);
    home.trackT = (home.trackT || 0) - dt;
    if (home.trackT <= 0 && T.length < 6) {
      home.trackT = 0.7 + Math.random() * 1.1;
      const kind = Math.random(), x = Math.random() * W, y = Math.random() * H, a = Math.random() * TAU, pts = [];
      if (kind < 0.35) { const L = 30 + Math.random() * 40; for (let s = 0; s < L; s += 1.6) pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s, 1.5]); }
      else if (kind < 0.75) { const L = 300 + Math.random() * 500; for (let s = 0; s < L; s += 4.5) pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s, 0.8]); }
      else { let r = 26 + Math.random() * 20, th = a, px = x, py = y; const turn = Math.random() < 0.5 ? 1 : -1; for (let i = 0; i < 160 && r > 3; i++) { th += turn * 2.6 / r; px += Math.cos(th) * 2.6; py += Math.sin(th) * 2.6; r *= 0.988; pts.push([px, py, 0.9]); } }
      for (const q of pts) { q[0] += (Math.random() - 0.5) * 1.6; q[1] += (Math.random() - 0.5) * 1.6; }
      T.push({ pts, age: 0, life: 1.6 + Math.random() * 1.4 });
    }
    const ink = skin.c('--note-ink');
    for (const tr of T) {
      tr.age += dt;
      const k = tr.age < 0.12 ? tr.age / 0.12 : Math.max(0, 1 - (tr.age - 0.12) / tr.life);
      if (k <= 0) continue;
      ctx.fillStyle = hexA(ink, 0.16 * k);
      const spread = 1 + tr.age * 1.2;                 // droplets drift apart as the trail fades
      for (const [x, y, r] of tr.pts) { ctx.beginPath(); ctx.arc(x, y, r * spread, 0, TAU); ctx.fill(); }
    }
    home.tracks = T.filter(tr => tr.age < tr.life + 0.12);
  }
  function drawHome(dt) {
    const W = home.W, H = home.H; if (!W) return;
    const { ctx } = fitCanvas(home.cv, W, H);
    ctx.clearRect(0, 0, W, H);
    home.t += dt * (reduceMotion ? 0.25 : 1);
    if (!reduceMotion) drawTracks(ctx, dt, W, H);
    const g = heroGeom(), st = heroStatic(g), cx = g.cx, cy = g.cy;
    if (g.wide) {                                            // the two machines sit behind one big pane of dark glass, in a bezel
      const S = home.stage, x = S.x - 10, y = S.y - 10, w = S.w + 20, h = S.h + 20, r = 18;
      const rr = (xx, yy, ww, hh, rad) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(xx, yy, ww, hh, rad); else ctx.rect(xx, yy, ww, hh); };
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
      rr(x - 6, y - 6, w + 12, h + 12, r + 5); ctx.fillStyle = '#0c1012'; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; rr(x - 5.5, y - 5.5, w + 11, h + 11, r + 4.5); ctx.stroke();
      const gl = ctx.createRadialGradient(x + w * 0.5, y + h * 0.42, 0, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.75);
      gl.addColorStop(0, '#111a1d'); gl.addColorStop(0.6, '#0a1013'); gl.addColorStop(1, '#05080a');
      rr(x, y, w, h, r); ctx.fillStyle = gl; ctx.fill();
      ctx.save(); rr(x, y, w, h, r); ctx.clip();
      ctx.fillStyle = 'rgba(214,228,234,0.045)';                       // a faint graticule, like a scope screen
      for (let gx = x + 24; gx < x + w; gx += 24) for (let gy = y + 24; gy < y + h; gy += 24) ctx.fillRect(gx, gy, 1, 1);
      ctx.strokeStyle = 'rgba(214,228,234,0.07)'; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(S.x + S.w / 2, y + 22); ctx.lineTo(S.x + S.w / 2, y + h - 22); ctx.stroke(); ctx.setLineDash([]);
      const ref = ctx.createLinearGradient(x, y, x + w * 0.45, y + h * 0.7); ref.addColorStop(0, 'rgba(255,255,255,0.05)'); ref.addColorStop(0.35, 'rgba(255,255,255,0.012)'); ref.addColorStop(0.36, 'rgba(255,255,255,0)');
      ctx.fillStyle = ref; ctx.fillRect(x, y, w, h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 1.5; rr(x, y, w, h, r); ctx.stroke();
      ctx.restore();
    }
    if (g.wide) {                                            // a pool of light under each machine, so they stand on the bench
      const pools = [[cx, cy, g.R0 * 2.0], [(g.gun.x0 + g.gun.x1) / 2, g.gun.y, g.R0 * 1.8]];
      for (const [x, y, r] of pools) {
        const gl = ctx.createRadialGradient(x, y - r * 0.15, 0, x, y, r); gl.addColorStop(0, 'rgba(255,224,176,0.085)'); gl.addColorStop(0.55, 'rgba(255,214,160,0.03)'); gl.addColorStop(1, 'rgba(255,214,160,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
      const fy = cy + g.R0 * 1.42;
      const sh = ctx.createRadialGradient(cx, fy, 0, cx, fy, g.R0 * 1.25); sh.addColorStop(0, 'rgba(0,0,0,0.42)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.translate(cx, fy); ctx.scale(1, 0.12); ctx.translate(-cx, -fy); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, fy, g.R0 * 1.25, 0, TAU); ctx.fill(); ctx.restore();
    }
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
    const nDone = Math.min(HALF, k), pos = (s, f) => { const an = s.a0 - Math.PI * f; return [cx + Math.cos(an) * s.r, cy + s.cy + Math.sin(an) * s.r]; };
    for (let i = 0; i <= Math.min(nDone, HALF - 1); i++) {
      const s = sp[i], f = i < nDone ? 1 : frac;
      ctx.strokeStyle = pal[Math.round(i / (HALF - 1) * 63)]; ctx.lineWidth = 2.2; ctx.globalAlpha = (g.wide ? 1 : 0.42) * 0.9;
      ctx.beginPath(); ctx.arc(cx, cy + s.cy, s.r, s.a0, s.a0 - Math.PI * f, true); ctx.stroke();
    }
    ctx.globalAlpha = g.wide ? 1 : 0.42;
    let px, py;
    if (k < HALF) { [px, py] = pos(sp[k], frac); if (frac < 0.06 && k > 0 && !reduceMotion) for (let i = 0; i < 2; i++) home.sparks.push({ x: cx, y: py, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90, life: 0.35 }); }
    else {
      const s = sp[HALF - 1], [ex, ey] = pos(s, 1), te = tc - HALF * HALF_T, L = Math.min(1, te / EXIT_T) * ((g.wide ? g.cx + g.half / 2 - 8 : W + 40) - ex);
      const dx = (HALF - 1) % 2 ? 1 : -1, gr = ctx.createLinearGradient(ex, ey, ex + dx * L, ey);   // leaves along the tangent: rightwards at the bottom
      gr.addColorStop(0, 'rgba(255,90,60,0.9)'); gr.addColorStop(1, 'rgba(255,210,140,0.9)');
      ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + dx * L, ey); ctx.stroke();
      px = ex + dx * L; py = ey;
      for (let i = 0; i < HALF; i++) { const s2 = sp[i]; ctx.strokeStyle = pal[Math.round(i / (HALF - 1) * 63)]; ctx.lineWidth = 2.2; ctx.globalAlpha = (g.wide ? 1 : 0.42) * Math.max(0, 1 - te / (EXIT_T + 0.6)); ctx.beginPath(); ctx.arc(cx, cy + s2.cy, s2.r, s2.a0, s2.a0 - Math.PI, true); ctx.stroke(); }
      ctx.globalAlpha = g.wide ? 1 : 0.42;
    }
    if (px > -20 && px < W + 20 && (!g.wide || px < g.cx + g.half / 2 - 4)) {
      const gl = ctx.createRadialGradient(px, py, 0, px, py, 22); gl.addColorStop(0, 'rgba(255,240,210,1)'); gl.addColorStop(0.3, 'rgba(255,170,90,0.7)'); gl.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 3.2, 0, TAU); ctx.fill();
    }
    for (const s of home.sparks) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; ctx.strokeStyle = `rgba(255,210,140,${Math.max(0, s.life / 0.35)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.04, s.y - s.vy * 0.04); ctx.stroke(); }
    home.sparks = home.sparks.filter(s => s.life > 0);
    ctx.globalAlpha = 1;
    if (!(CL.intro && CL.intro.on)) home.noteT = (home.noteT || 0) + dt;   // the notes are written once the title sequence is over
    drawNotes(ctx, g);
    ctx.restore();
    drawGun(ctx, g, dt, g.wide ? 1 : 0.42);
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
      ctx.save(); ctx.translate(2 * cx, 0); ctx.scale(-1, 1);        // mirrored: anticlockwise, like a proton with B into the screen
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
      ctx.restore();
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
    } else {
      ctx.font = `300 ${Math.round(s * 0.24)}px "Barlow Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ['F = qv × B', 'r = p / qB', 'f = qB / 2πm'].forEach((l, i) => { ctx.save(); ctx.shadowColor = 'rgba(255,110,20,0.9)'; ctx.shadowBlur = 8; ctx.fillStyle = `rgba(255,207,158,${0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 2))})`; ctx.fillText(l, cx, H * (0.25 + 0.25 * i)); ctx.restore(); });
    }
  }
  function updateHomeMissions() { const [d, n] = missions.count(); const el = $('#homeMissions'); if (el) el.textContent = `${d} / ${n}`; }

  /* ---------- guided tour ---------- */
  const TOURS = {};
  TOURS.lab = [
    { sel: null, title: 'Welcome to Project Lorentz', text: 'The name comes from the Lorentz force, F = q(E + v × B). A cyclotron uses both parts of it: the electric field gives the particle a push each time it crosses the gap, and the magnetic field bends it round in a circle so it comes back for the next push. This tour shows you around the Cyclotron screen in under a minute.' },
    { sel: '#stageWrap', title: 'The machine from above', text: 'The particle starts in the middle and spirals outwards between the two copper dees. Red and blue show which dee is positive. Drag the edge of the dees to make the machine bigger or smaller, drag the striped corner to resize the view, and scroll or pinch to zoom. The 3D key at the top right shows the whole electromagnet in 3D, and the key under it fills the screen; every other screen has both, plus a Ride button.' },
    { sel: '#btnRide', title: 'Ride the particle', text: 'Fly along with the particle, seen from just behind it. With sound on, you hear a thump at every push across the gap and a tick at every peak of the voltage. When the two stay together the beat is steady: that is the cyclotron resonance. Press V to switch views.' },
    { sel: '#accMagnet', title: 'Build the electromagnet', text: 'Choose the number of coils, the turns per coil and the current: more turns and more current make a stronger field, B = μ₀NI/g. Intermediate also lets you change the pole gap g. Or load a real machine from the menu above it.' },
    { sel: '#screen-lab .timebar', title: 'Play, replay and record', text: 'Play, step, change speed or drag the timeline. After a run, Replay 0.1× shows the final orbits in slow motion with every push labelled. Record saves the run to your notebook.' },
    { sel: '#screen-lab .tiles', title: 'Live readouts', text: 'Speed, kinetic energy, orbit radius and laps, glowing like the nixie tubes on old lab instruments.' },
    { sel: '#screen-lab .data', title: 'Every number explained', text: 'The notebook explains each quantity in words. Show working puts your own numbers into each formula, step by step.' },
    { sel: '.lvl', title: 'Beginner or Intermediate', text: 'Beginner keeps only the main controls and adds plain-language notes and ? buttons. Intermediate adds the extra controls (pole gap, RF mode, relativity, experiments, display tools) and every step of the working.' },
    { sel: '#btnReal', title: 'Where is this used in real life?', text: 'This key shows where the physics is used outside class: a hospital cyclotron that makes the medicine for cancer scans, and a maglev train pulled by coils in the track. You can run both yourself.' },
    { sel: '.nav-screens', title: 'More to explore', text: 'Fire a Gauss gun and test yourself in the physics quiz. The Gauss gun has its own tour: open it and press the ? key at the top right. Each station has a real machine to run: PET medicine in the Cyclotron, the maglev train in the Gauss gun.' },
  ];
  // The Gauss gun's own tour: what everything on its screen is, left to right
  TOURS.gauss = [
    { sel: null, title: 'Welcome to the Gauss gun', text: 'A Gauss gun (a coil gun) fires an iron slug with magnetism. There is no gunpowder: each copper coil becomes an electromagnet for a moment, pulls the slug towards its middle, and switches off just as the slug gets there, so the slug keeps going. This tour shows you around in under a minute.' },
    { sel: '#ggWrap', title: 'The gun, from the side', text: 'The slug sits at the left in a plastic barrel. The copper blocks are the coils. Each amber marker shows where that coil switches off, and each thin red line is a light gate that switches the next coil on. At the end, the chronograph measures the speed, and then the slug hits the target. Drag to move, scroll or pinch to zoom; the keys at the top right show it in 3D and full screen.' },
    { sel: '#ggWrap .ride-btn', title: 'Ride the slug', text: 'Fly along with the slug and feel each coil pull it. With sound on, every coil gives a thump as it switches on.' },
    { sel: '#ggWrap .xp-open', title: 'How it works', text: 'A slow, step-by-step explanation: why a coil pulls iron, why it must switch off at the middle, and which knob makes the gun faster, with the formulas and numbers. Press Space for each next step.' },
    { sel: '#screen-gauss .arena-bar', title: 'Fire!', text: 'Press Fire, or the space bar. The capacitors charge, then the coils switch on one after another. Slow motion and Bullet time let you watch each coil pull. Replay shows the last shot again.' },
    { sel: '#ggCoilPanels', title: 'Build your coils (on the right)', text: 'Number of coils: more coils give more pushes. Turns per coil and Current: both make each coil a stronger magnet, B = μ₀NI/ℓ. All three make the slug faster. Each ? button explains its control. Intermediate adds the switch-off point: switch off late and the coil pulls the slug back.' },
    { sel: '#ggTarget', title: 'Choose a target', text: 'Pendulum: the slug hits a 100 g block hanging on strings, and how high it swings tells you the speed. Tin cans: knock them over. Sand box: it just stops the slug.' },
    { sel: '#screen-gauss .rsim-entry', title: 'Real life: the maglev train', text: 'A maglev train is a Gauss gun 30 km long: coils in the track switch on one after another and pull the train along. Open it to drive the Shanghai maglev to the airport, and to see why it can go faster than a train on wheels.' },
    { sel: '#ggNarrate', title: 'What is happening', text: 'This note explains each shot in plain words while it happens: which coil is pulling, and why the slug speeds up.' },
    { sel: '#screen-gauss .gg-readouts', title: 'The readouts', text: 'Exit speed: how fast the slug leaves the barrel, measured by the chronograph. Kinetic energy: its energy of motion, ½mv². Intermediate adds Efficiency (how much of the electrical energy became motion; most of it heats the copper wire instead) and Strongest pull (the biggest force on the slug).' },
    { sel: '#screen-gauss .gg-graphs', title: 'The graphs', text: 'The speed along the barrel jumps up at each coil. In Intermediate a second graph shows the pull: forwards before each coil’s middle, backwards after it if the coil is still on.' },
    { sel: '#ggData', title: 'Every number explained', text: 'The notebook shows each result with its formula. Show working puts your own numbers into each formula, step by step.' },
    { sel: '.lvl', title: 'Beginner or Intermediate', text: 'Beginner keeps the main controls and the plain-language notes. Intermediate adds the switch-off point, the slug and its material, experiments, missions, the second graph and the notebook.' },
  ];
  let tourI = -1, tourId = 'lab';
  const TOUR_STORE = { lab: 'cl-toured', gauss: 'cl-toured-gauss' };
  const visible = el => !!el && !!(el.offsetParent || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  // keep only the steps whose part is on screen at this level
  let TOUR = TOURS.lab;
  function tourStart(which) {
    tourId = which === 'gauss' ? 'gauss' : 'lab';
    showScreen(tourId, true);
    tourI = 0; $('#tour').hidden = false;
    setTimeout(() => { TOUR = TOURS[tourId].filter(st => !st.sel || visible($(st.sel))); tourStep(); }, 250);
  }
  function tourEnd() { tourI = -1; $('#tour').hidden = true; store.set(TOUR_STORE[tourId], true); }
  CL.tour = { start: tourStart };
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
    themeMenu();
    if (CL.reallife) CL.reallife.init();
    if (CL.realsim) { try { CL.realsim.init(); } catch (err) { console.error('realsim', err); } }
    const scale = $('.scale');
    if (scale && 'IntersectionObserver' in window && !reduceMotion) {
      $$('.scale-svg .sc-mach, .scale-svg .sc-m, .scale-svg .sc-person', scale).forEach((el, i) => el.style.setProperty('--i', i));
      scale.classList.add('will-reveal');
      const ob = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { scale.classList.add('is-in'); ob.disconnect(); } }, { threshold: 0.35 });
      ob.observe(scale);
    }
    $('#btnFull').addEventListener('click', () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
      } catch (_) { /* not allowed in this frame */ }
    });
    $('#btnTour').addEventListener('click', () => tourStart(current === 'gauss' ? 'gauss' : 'lab'));   // the ? key tours the screen you are on
    $('#homeTour').addEventListener('click', () => tourStart('lab'));

    const hr = $('#homeRide'); if (hr) hr.addEventListener('click', () => { audio.unlock(); showScreen('lab', true); if (CL.lab) CL.lab.ride(true); });
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

  /* ---------- colour scheme menu ---------- */
  function themeMenu() {
    const btn = $('#btnSkin'), menu = $('#themeMenu');
    menu.innerHTML = skin.list.map(k => `<button type="button" role="menuitemradio" data-skin="${k.id}"><span class="tm-sw" aria-hidden="true">${k.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span><span class="tm-t">${k.label}<small>${k.note}</small></span></button>`).join('');
    const sync = () => { for (const b of $$('button', menu)) b.setAttribute('aria-checked', String(b.dataset.skin === skin.name)); };
    const open = on => { menu.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on) { sync(); const cur = menu.querySelector('[aria-checked="true"]'); (cur || menu.firstElementChild).focus(); } };
    btn.addEventListener('click', ev => { ev.stopPropagation(); open(menu.hidden); });
    menu.addEventListener('click', ev => { const b = ev.target.closest('button[data-skin]'); if (!b) return; skin.apply(b.dataset.skin); sync(); open(false); btn.focus(); });
    menu.addEventListener('keydown', ev => {
      const items = $$('button', menu), i = items.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); items[(i + (ev.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
      else if (ev.key === 'Home' || ev.key === 'End') { ev.preventDefault(); items[ev.key === 'Home' ? 0 : items.length - 1].focus(); }
      else if (ev.key === 'Tab') open(false);
      else if (ev.key === 'Escape') { ev.preventDefault(); open(false); btn.focus(); }
    });
    document.addEventListener('pointerdown', ev => { if (!menu.hidden && !ev.target.closest('.theme-pick')) open(false); });
    CL.bus.on('skin', sync);
  }

  /* ---------- the loop ---------- */
  let last = 0;
  function loop(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    try {
      if (current === 'home') { drawHome(dt); for (const ic of home.icons) drawIcon(ic, now / 1000); }
      else if (CL.realsim && CL.realsim.host === current) CL.realsim.frame(now, dt);          // a real-life simulation is open inside this station
      else if (CL.screens[current] && CL.screens[current].frame) CL.screens[current].frame(now, dt);
    } catch (err) { if (!loop.warned) { loop.warned = true; console.error(err); } }
    requestAnimationFrame(loop);
  }

  function start(data) {
    missions.init();
    // colour scheme: Rad Lab unless one was picked (an old light-skin choice is kept)
    skin.apply(store.get('cl-scheme', store.get('cl-skin', '') === 'classroom' ? 'classroom' : 'radlab'));
    syncSound();
    home.cv = $('#homeBg');
    home.icons = $$('.hicon').map(cv => ({ cv, kind: cv.dataset.icon, w: 0, h: 0 }));
    for (const k of ['lab', 'gauss', 'physics']) { try { CL.screens[k].init(); } catch (err) { console.error('init ' + k, err); } }
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
    // Home's one orchestrated entrance: after the title sequence, or at once without it
    const enter = () => { if (current !== 'home' || reduceMotion) return; document.body.classList.add('is-entering'); setTimeout(() => document.body.classList.remove('is-entering'), 1600); };
    if (CL.intro && CL.intro.on) { const off = CL.bus.on('intro', on => { if (!on) { enter(); if (typeof off === 'function') off(); } }); } else enter();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { skin.read(); CL.bus.emit("skin", skin.name); sizeHome(); const s = CL.screens[current]; if (s && s.resize) s.resize(); });
    requestAnimationFrame(loop);
    cornerGuard();
    // screens that are laid out to fit the window never scroll; if the browser scrolls one anyway
    // (to show a focused element), put it back, so the view can't slide away and leave a blank screen
    for (const el of $$('.screen')) {
      if (el.id === 'screen-home' || el.id === 'screen-physics') continue;
      el.addEventListener('scroll', () => { if (getComputedStyle(el).position === 'absolute' && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0; } });
    }
  }

  /* ---------- keep our controls clear of a host's corner badge ----------
     Some free hosts add a small fixed badge in the bottom-right corner (for example "Powered by Netlify").
     We never touch it; we only notice it and leave that corner empty, so no key or panel hides underneath. */
  function cornerGuard() {
    const ours = new Set(document.body.children), root = document.documentElement;
    let w = 0, h = 0, timer = 0;
    const scan = () => {
      const W = innerWidth, H = innerHeight;
      let seen = false, box = null;
      for (const top of [...document.body.children, ...root.children]) {
        if (top === document.body || top === document.head) continue;
        if (ours.has(top) || /^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(top.tagName)) continue;
        for (const el of [top, ...top.querySelectorAll('*')].slice(0, 80)) {
          const cs = getComputedStyle(el);
          if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8 || r.right < W - 90 || r.bottom < H - 160) continue;
          seen = true;
          if (r.width <= 380 && r.height <= 130) { box = r; break; }
        }
        if (box) break;
      }
      if (!seen) set(0, 0);                       // gone (or hidden by the visitor): give the corner back
      else if (box) set(Math.ceil(W - box.left + 10), Math.ceil(H - box.top + 10));
      // a foreign element that is bigger than a badge (its pop-up card) leaves the layout as it is
    };
    const set = (nw, nh) => {
      if (Math.abs(nw - w) < 4 && Math.abs(nh - h) < 4) return;
      w = nw; h = nh;
      document.body.classList.toggle('has-badge', w > 0);
      root.style.setProperty('--badge-w', w + 'px'); root.style.setProperty('--badge-h', h + 'px');
      sizeHome(); const s = CL.screens[current]; if (s && s.resize) s.resize(); if (CL.realsim && CL.realsim.host) CL.realsim.resize();
    };
    const soon = () => { clearTimeout(timer); timer = setTimeout(scan, 120); };
    for (const el of [document.body, root]) new MutationObserver(soon).observe(el, { childList: true });
    window.addEventListener('resize', soon);
    for (const t of [300, 1500, 4000, 9000]) setTimeout(scan, t);
  }

  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ lab: CL.lab ? CL.lab.snapshot() : null }));
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
