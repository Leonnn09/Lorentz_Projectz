/* =====================================================================
   Project Lorentz — the title sequence (CL.intro). About 12 seconds, in three acts.
     0. "Two machines. Both run on electromagnetism."
     1. The cyclotron, centre stage: its magnet switches on (⊗: B into the screen), a spark at the centre, and a
        proton spirals out, kicked at every gap crossing and bent by B, every half-turn in the same time. A short
        caption says how, and the readouts count up its speed and energy. At the edge the RF is switched off, so
        the proton just keeps circling at top speed (no E field, only B: a circle of fixed size).
     — a whip pan —
     2. The Gauss gun, centre stage: its capacitors charge, the four coils switch on one after another, and the
        iron slug flies out and knocks a can over. The readouts show its speed after each coil (from the app's
        own coil-gun model: 14.8, 22.7, 28.4, 33.2 m/s).
     — a whip pan —
     3. Both machines beside the faint title fire together: the cyclotron's − plate pulls its proton out and the
        beam is steered onto the name, the Gauss gun's slug slams PROJECT into place at the same instant, and the
        beam burns LORENTZ. Then F = q(E + v × B), the plate, and the four builders sign it.
   The coils pull magnetised iron, never the proton (a magnetic field cannot speed up a charge), so the two
   machines stay apart. It plays when the app opens on Home; "Play the intro" replays it. Any key or click jumps
   to the title card, and then starts the app.
   ===================================================================== */
(() => {
  'use strict';
  const { $, clamp, TAU, audio, reduceMotion, fitCanvas } = CL;

  // ---- timeline (s) ----
  const HALF = 14, HT = 0.2;                                  // half-turns of the spiral, each in the same time
  const T_OPEN = 0.15, A1 = 1.05;                             // opening line; act 1 starts
  const T_SPARK = A1 + 0.55, T0 = A1 + 0.75, T_EDGE = T0 + HALF * HT;   // spark, first half-turn, top speed (4.6 s)
  const PAN1 = T_EDGE + 0.75, PAN = 0.55;                     // whip pan to act 2
  const T_CHARGE = PAN1 + PAN + 0.1, T_FIRE1 = T_CHARGE + 1.0, TB1 = 0.5;   // capacitors charge, then the shot
  const PAN2 = T_FIRE1 + 1.35;                                // whip pan to the title
  const T_HIT = PAN2 + PAN + 0.75, TB2 = 0.34;                // the slug hits PROJECT as the beam reaches LORENTZ
  const T_X = T_HIT - 0.5, T_STEER = T_HIT - 0.25, T_BURN = 1.15;
  const T_QUENCH = T_HIT + T_BURN + 0.1, T_EQ = T_QUENCH + 0.2, T_PLATE = T_EQ + 0.35, T_SIGN = T_PLATE + 0.3, T_READY = T_SIGN + 1.0;

  // ---- the numbers on screen ----
  const MP = 938.272, KMAX = 7.70;                            // proton rest energy; K = (qBR)²/2m for B ≈ 1.005 T, R = 0.4 m
  const cycRead = n => { const K = KMAX * n / HALF, g = 1 + K / MP; return { beta: Math.sqrt(1 - 1 / (g * g)), K }; };
  const VG = [0, 14.84, 22.67, 28.42, 33.18];                 // coil-gun model, default gun, after 0..4 coils (m/s)

  const st = { on: false, t: 0, last: 0, raf: 0, cv: null, ctx: null, W: 0, H: 0, k: -1, sparks: [], embers: [], rings: [], flash: 0, flashCol: '255,255,255',
    hot: 0, crackle: 0, el: null, stack: null, burn: null, name: null, proj: null, back: null, emberT: 0, coil1: -1, coil2: -1, can: null, pop1: 0, pop2: 0, stackOff: 0 };

  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const panP = (t, T) => ease(clamp((t - T) / PAN, 0, 1));
  const isNarrow = () => st.W < 720 || st.W < st.H * 1.05;
  const FONT_HAND = 'Kalam, "Segoe Print", "Comic Sans MS", cursive', FONT_COND = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif', FONT_STEN = '"Big Shoulders Stencil", "Barlow Condensed", "Arial Narrow", sans-serif';

  // ---- layouts ----
  function act1Layout() {
    const W = st.W, H = st.H;
    if (isNarrow()) { const R = Math.min(W * 0.33, H * 0.17); return { cx: W / 2, cy: Math.max(R * 1.3 + 40, H * 0.27), R, bx: 24, bw: W - 48, by: null, narrow: true }; }
    const R = Math.min(H * 0.3, W * 0.17);
    return { cx: W * 0.33, cy: H * 0.5, R, bx: W * 0.55, bw: Math.min(W * 0.36, 600), by: null, narrow: false };
  }
  function act2Layout() {
    const W = st.W, H = st.H;
    if (isNarrow()) { const th = clamp(W * 0.045, 12, 22), y = H * 0.27; return { G: { x0: W * 0.34, x1: W - 16, y, th, big: true }, canX: W * 0.15, bx: 24, bw: W - 48, by: null, narrow: true }; }
    const th = clamp(H * 0.05, 18, 50), y = H * 0.5;
    return { G: { x0: W * 0.6, x1: W * 0.95, y, th, big: true }, canX: W * 0.515, bx: W * 0.07, bw: Math.min(W * 0.35, 580), by: null, narrow: false };
  }
  // Act 3: the cyclotron to the left of the title (below it on narrow screens); the Gauss gun on the PROJECT line,
  // breech to the right, firing leftwards onto PROJECT.
  function geom() {
    const o = st.el.getBoundingClientRect(), r = st.name.getBoundingClientRect(), p = st.proj ? st.proj.getBoundingClientRect() : r;
    const tl = r.left - o.left - st.stackOff, tt = r.top - o.top, tw = r.width, th = r.height, pl = p.left - o.left - st.stackOff, pt = p.top - o.top, pw = p.width, ph = p.height;
    const W = st.W, H = st.H, right = tl + tw, below = H - (tt + th);
    const rSide = Math.min(H * 0.3, (tl - 24) / 2.5), rBelow = Math.min(W * 0.28, below / 3.1), side = tl >= 150 && rSide >= rBelow * 0.9;
    let cx, cy, R;
    if (side) { R = Math.max(60, Math.min(H * 0.3, (tl - 24) / 2.5)); cx = Math.max(R * 1.25 + 8, tl / 2); cy = tt + th / 2; }
    else { R = Math.max(50, Math.min(W * 0.28, below / 3.1)); cx = W / 2; cy = Math.min(H - R * 1.3, tt + th + R * 1.45); }
    const x1 = Math.min(W - 12, right + Math.max(40, (W - right) * 0.72)), x0 = Math.max(pl + pw + 26, x1 - 600);
    const G = { x0, x1, y: pt + ph / 2, th: clamp((x1 - x0) * 0.042, 10, 28), big: false, hit: pl + pw + 3 };
    return { cx, cy, R, tl, tt, tw, th, pl, pt, pw, ph, side, G };
  }

  // ---- the cyclotron ----
  // alternating half circles, radius ∝ √(pushes); anticlockwise for a proton with B into the screen
  function spiral(R) {
    const Rs = R * 0.93, out = [];
    let y = 0;
    for (let k = 0; k < HALF; k++) {
      const up = k % 2 === 0, r = Rs * Math.sqrt((k + 1) / HALF), c = up ? y - r : y + r;
      out.push({ r, cy: c, a0: up ? Math.PI / 2 : -Math.PI / 2 });
      y = up ? c - r : c + r;
    }
    const shift = (out[HALF - 1].cy + out[HALF - 2].cy) / 2;
    for (const s of out) s.cy -= shift;
    return out;
  }
  const posOn = (c, s, f) => { const a = s.a0 - Math.PI * f; return [c.cx + Math.cos(a) * s.r, c.cy + s.cy + Math.sin(a) * s.r]; };
  const OM = Math.PI / HT;
  // the last orbit, once the RF is off: θ = π/2 at the exit point (the bottom), decreasing (anticlockwise on screen)
  const ringPos = (c, sp, tRef, t) => { const s = sp[HALF - 1], a = Math.PI / 2 - OM * (t - tRef); return [c.cx + Math.cos(a) * s.r, c.cy + s.cy + Math.sin(a) * s.r]; };

  // o: alpha, mag (0..1), dee (0..1), pol (−1..1), nDone, frac, trailA, ring (0..1), defl (0..1)
  function drawCyc(ctx, c, sp, o, t) {
    const { cx, cy, R } = c, pal = CL.palette('rainbow');
    ctx.save(); ctx.globalAlpha = o.alpha;
    const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.55); halo.addColorStop(0, `rgba(201,128,63,${0.16 * o.mag})`); halo.addColorStop(1, 'rgba(201,128,63,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.55, 0, TAU); ctx.fill();
    ctx.globalAlpha = o.alpha * (0.3 + 0.7 * o.mag);
    const cg = ctx.createRadialGradient(cx, cy, R * 1.08, cx, cy, R * 1.2); cg.addColorStop(0, '#5a2c0e'); cg.addColorStop(0.5, '#d7975f'); cg.addColorStop(1, '#6b3412');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, TAU); ctx.arc(cx, cy, R * 1.08, 0, TAU, true); ctx.fill();
    // copper windings
    ctx.strokeStyle = 'rgba(70,30,8,0.55)'; ctx.lineWidth = 1;
    for (let i = 0; i < 72; i++) { const a = i / 72 * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 1.085, cy + Math.sin(a) * R * 1.085); ctx.lineTo(cx + Math.cos(a + 0.03) * R * 1.195, cy + Math.sin(a + 0.03) * R * 1.195); ctx.stroke(); }
    ctx.globalAlpha = o.alpha;
    ctx.fillStyle = 'rgba(6,10,8,0.92)'; ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, TAU); ctx.fill();
    if (o.mag > 0) {
      const fs = Math.max(20, R * 0.17), q = Math.min(3, fs * 0.13);
      ctx.strokeStyle = 'rgb(179,166,255)'; ctx.lineWidth = 1;
      for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) {
        const px = cx + (i + 0.5) * fs, py = cy + (j + 0.5) * fs, d = Math.hypot(px - cx, py - cy);
        if (d > R * 0.96 || Math.abs(px - cx) < R * 0.06) continue;
        const a = clamp(o.mag * 3 - d / R * 1.4, 0, 1) * 0.2; if (a <= 0.005) continue;
        ctx.globalAlpha = o.alpha * a; ctx.beginPath();
        ctx.moveTo(px + q * 1.5, py); ctx.arc(px, py, q * 1.5, 0, TAU); ctx.moveTo(px - q, py - q); ctx.lineTo(px + q, py + q); ctx.moveTo(px + q, py - q); ctx.lineTo(px - q, py + q);
        ctx.stroke();
      }
    }
    if (o.dee > 0) {
      ctx.save(); ctx.globalAlpha = o.alpha * o.dee;
      const w = R * 0.06, h = Math.sqrt(R * R - w * w / 4), th = Math.acos(w / 2 / R);
      const dR = new Path2D(); dR.moveTo(cx + w / 2, cy - h); dR.arc(cx, cy, R, -th, th, false); dR.closePath();
      const dL = new Path2D(); dL.moveTo(cx - w / 2, cy + h); dL.arc(cx, cy, R, Math.PI - th, Math.PI + th, false); dL.closePath();
      const a = Math.abs(o.pol) * 0.28;
      ctx.fillStyle = o.pol > 0 ? `rgba(229,72,63,${a})` : `rgba(62,126,230,${a})`; ctx.fill(dL);
      ctx.fillStyle = o.pol > 0 ? `rgba(62,126,230,${a})` : `rgba(229,72,63,${a})`; ctx.fill(dR);
      ctx.shadowColor = 'rgba(255,140,60,0.6)'; ctx.shadowBlur = 14; ctx.strokeStyle = 'rgba(232,168,106,0.95)'; ctx.lineWidth = 2; ctx.stroke(dL); ctx.stroke(dR); ctx.shadowBlur = 0;
      ctx.restore();
    }
    // the spiral so far
    if (o.trailA > 0) {
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, R * 0.012);
      for (let i = 0; i <= Math.min(o.nDone, HALF - 1); i++) {
        const s = sp[i], f = i < o.nDone ? 1 : o.frac;
        if (f <= 0) continue;
        ctx.strokeStyle = pal[Math.round(i / (HALF - 1) * 63)]; ctx.globalAlpha = o.alpha * o.trailA;
        ctx.beginPath(); ctx.arc(cx, cy + s.cy, s.r, s.a0, s.a0 - Math.PI * f, true); ctx.stroke();
      }
    }
    // the stored orbit: RF off, B alone keeps it on a circle of fixed size
    if (o.ring > 0) {
      const s = sp[HALF - 1];
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = o.alpha * o.ring;
      ctx.strokeStyle = 'rgba(255,120,60,0.35)'; ctx.lineWidth = Math.max(6, R * 0.04); ctx.beginPath(); ctx.arc(cx, cy + s.cy, s.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,160,0.75)'; ctx.lineWidth = Math.max(1.5, R * 0.008); ctx.beginPath(); ctx.arc(cx, cy + s.cy, s.r, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (o.defl > 0) {
      const [, ey] = posOn(c, sp[HALF - 1], 1), gy = ey + Math.max(7, R * 0.035);
      ctx.save(); ctx.globalAlpha = o.alpha * o.defl; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(90,140,255,0.9)'; ctx.shadowBlur = 12; ctx.strokeStyle = '#8fb4ff'; ctx.lineWidth = Math.max(2.5, R * 0.014);
      ctx.beginPath(); ctx.moveTo(cx + R * 0.06, gy); ctx.lineTo(cx + R * 0.42, gy); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  function drawProton(ctx, x, y, R, a = 1) {
    const gr = Math.max(14, R * 0.08);
    ctx.save(); ctx.globalAlpha = a;
    const gl = ctx.createRadialGradient(x, y, 0, x, y, gr); gl.addColorStop(0, 'rgba(255,245,220,1)'); gl.addColorStop(0.3, 'rgba(255,170,90,0.75)'); gl.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, gr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, R * 0.012), 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---- the Gauss gun: capacitors at the breech (right), a glass barrel, four coils, an iron slug ----
  function gunGeom(G) {
    const th = G.th, capW = th * 1.15, capGap = th * 0.35, caps = [G.x1 - capW / 2, G.x1 - capW * 1.5 - capGap];
    const b1 = G.x1 - capW * 2 - capGap - th * 0.7, b0 = G.x0, L = b1 - b0, sl = Math.max(14, th * 1.6);
    const coils = [0, 1, 2, 3].map(i => b1 - L * (0.2 + 0.2 * i));            // coil centres, breech to muzzle
    return { th, y: G.y, b0, b1, L, sl, caps, capW, coils, s0: sl / 2 + th * 0.3 };
  }
  // where the slug's centre is τ seconds after firing: it speeds up through the barrel (time tb), then flies straight
  function slugX(gg, tau, tb) {
    const run = gg.L - gg.s0, vOut = 2 * run / tb;
    if (tau <= tb) return gg.b1 - gg.s0 - run * (tau / tb) * (tau / tb);
    return gg.b0 - vOut * (tau - tb);
  }
  // o: alpha, charge (0..1), sx (slug centre or null), on (lit coil index or −1), streak (0..1)
  function drawGun(ctx, G, o) {
    const gg = gunGeom(G), { th, y, b0, b1, L } = gg;
    ctx.save(); ctx.globalAlpha = o.alpha;
    // wires from the capacitors to the coils
    ctx.strokeStyle = `rgba(150,160,170,${0.35 + 0.5 * o.charge})`; ctx.lineWidth = Math.max(1, th * 0.07);
    const wy = y - th * (G.big ? 1.9 : 1.55);
    ctx.beginPath(); ctx.moveTo(gg.caps[1], y - th * 1.1); ctx.lineTo(gg.caps[1], wy); ctx.lineTo(gg.coils[3], wy); ctx.stroke();
    for (const x of gg.coils) { ctx.beginPath(); ctx.moveTo(x, wy); ctx.lineTo(x, y - th * 1.05); ctx.stroke(); }
    // capacitor bank
    for (const bx of gg.caps) {
      const cw = gg.capW, ch = th * 2.2, top = y - ch / 2;
      const cg = ctx.createLinearGradient(bx - cw / 2, 0, bx + cw / 2, 0); cg.addColorStop(0, '#1d3554'); cg.addColorStop(0.5, '#4f7fb3'); cg.addColorStop(1, '#18304f');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(bx - cw / 2, top, cw, ch, cw * 0.18); ctx.fill();
      ctx.fillStyle = '#c9d1d6'; ctx.fillRect(bx - cw / 2, top - th * 0.12, cw, th * 0.12);
      const fh = (ch - th * 0.4) * o.charge;
      ctx.fillStyle = `rgba(140,215,255,${0.3 + 0.7 * o.charge})`; ctx.fillRect(bx - cw * 0.28, top + ch - th * 0.2 - fh, cw * 0.56, fh);
      if (o.charge > 0.05) { const gl = ctx.createRadialGradient(bx, y, 0, bx, y, ch); gl.addColorStop(0, `rgba(120,200,255,${0.22 * o.charge})`); gl.addColorStop(1, 'rgba(120,200,255,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(bx, y, ch, 0, TAU); ctx.fill(); }
    }
    // barrel (glass tube)
    const tg = ctx.createLinearGradient(0, y - th / 2, 0, y + th / 2); tg.addColorStop(0, 'rgba(220,235,240,0.22)'); tg.addColorStop(0.5, 'rgba(200,220,230,0.05)'); tg.addColorStop(1, 'rgba(220,235,240,0.16)');
    ctx.fillStyle = tg; ctx.fillRect(b0, y - th / 2, L, th);
    ctx.strokeStyle = 'rgba(200,220,230,0.45)'; ctx.lineWidth = 1.2; ctx.strokeRect(b0, y - th / 2, L, th);
    // the slug's streak and the slug
    if (o.sx !== null) {
      const sl = gg.sl, sx = o.sx;
      if (o.streak > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const tx = sx + sl * 0.5 + th * 6 * o.streak, lg = ctx.createLinearGradient(tx, 0, sx, 0); lg.addColorStop(0, 'rgba(255,220,170,0)'); lg.addColorStop(1, `rgba(255,220,170,${0.6 * o.streak})`);
        ctx.strokeStyle = lg; ctx.lineWidth = th * 0.45; ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(sx, y); ctx.stroke(); ctx.restore();
      }
      const sg = ctx.createLinearGradient(0, y - th * 0.32, 0, y + th * 0.32); sg.addColorStop(0, '#f2f5f7'); sg.addColorStop(0.55, '#9aa3aa'); sg.addColorStop(1, '#5d666d');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(sx - sl / 2, y - th * 0.32, sl, th * 0.64, th * 0.12); ctx.fill();
    }
    // coils: copper windings above and below the tube, lit while switched on
    const cw = Math.max(12, L * 0.11), ch = th * (G.big ? 1.25 : 0.85);
    gg.coils.forEach((qx, i) => {
      const on = o.on === i;
      if (on) { const gl = ctx.createRadialGradient(qx, y, 0, qx, y, cw * 1.6); gl.addColorStop(0, 'rgba(255,170,70,0.65)'); gl.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(qx, y, cw * 1.6, 0, TAU); ctx.fill(); }
      for (const top of [y - th / 2 - ch, y + th / 2]) {
        const cg = ctx.createLinearGradient(0, top, 0, top + ch); cg.addColorStop(0, on ? '#ffd9a0' : '#c27a3a'); cg.addColorStop(0.5, on ? '#ffb45e' : '#8f4f1f'); cg.addColorStop(1, on ? '#ffd9a0' : '#c27a3a');
        ctx.fillStyle = cg; ctx.fillRect(qx - cw / 2, top, cw, ch);
        ctx.strokeStyle = on ? 'rgba(120,50,0,0.5)' : 'rgba(40,16,4,0.55)'; ctx.lineWidth = 1;
        const n = Math.max(4, Math.round(cw / 4));
        for (let k = 1; k < n; k++) { const xx = qx - cw / 2 + cw * k / n; ctx.beginPath(); ctx.moveTo(xx, top + 1); ctx.lineTo(xx - 1.5, top + ch - 1); ctx.stroke(); }
      }
    });
    ctx.restore();
    return gg;
  }
  function drawCan(ctx, can, th) {
    const w = th * 1.3, h = th * 2.3;
    ctx.save(); ctx.globalAlpha = can.a; ctx.translate(can.x, can.y); ctx.rotate(can.rot);
    const cg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); cg.addColorStop(0, '#7d1d16'); cg.addColorStop(0.35, '#e0473a'); cg.addColorStop(0.6, '#ff8a7a'); cg.addColorStop(1, '#6e1610');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.14); ctx.fill();
    ctx.fillStyle = '#d6dadd'; ctx.fillRect(-w / 2, -h / 2, w, h * 0.08); ctx.fillRect(-w / 2, h / 2 - h * 0.08, w, h * 0.08);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-w / 2, -h * 0.06, w, h * 0.12);
    ctx.restore();
  }

  // ---- a caption block: a handwritten tag, a stencil title, one or two plain lines, and two live readouts ----
  function drawBlock(ctx, B, d, t, tIn, alpha) {
    const W = st.W, H = st.H, nar = B.narrow;
    const fTag = nar ? 17 : clamp(H * 0.026, 16, 27), fTitle = nar ? clamp(W * 0.1, 30, 44) : clamp(H * 0.085, 40, 92), fBody = nar ? 16 : clamp(H * 0.028, 16, 29), fNum = nar ? clamp(W * 0.09, 28, 40) : clamp(H * 0.072, 34, 78), fUnit = nar ? 13 : clamp(H * 0.019, 13, 20);
    ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = `500 ${fBody}px ${FONT_COND}`;
    const words = d.body.split(' '), lines = []; let ln = '';
    for (const w of words) { const tr = ln ? ln + ' ' + w : w; if (ctx.measureText(tr).width > B.bw && ln) { lines.push(ln); ln = w; } else ln = tr; }
    if (ln) lines.push(ln);
    const hTot = fTag * 1.5 + fTitle * 1.05 + lines.length * fBody * 1.32 + fBody * 0.9 + fNum + fUnit * 1.6;
    let y = B.by !== null ? B.by : st.H * 0.5 - hTot / 2;
    const x = B.bx, ap = i => alpha * clamp((t - tIn - i * 0.13) / 0.4, 0, 1), slide = i => (1 - clamp((t - tIn - i * 0.13) / 0.4, 0, 1)) * 14;
    y += fTag;
    ctx.globalAlpha = ap(0); ctx.fillStyle = '#e2a46b'; ctx.font = `400 ${fTag}px ${FONT_HAND}`; ctx.fillText(d.tag, x + slide(0), y);
    y += fTag * 0.5 + fTitle * 0.95;
    ctx.globalAlpha = ap(1); ctx.fillStyle = '#f3efe4'; ctx.font = `800 ${fTitle}px ${FONT_STEN}`; ctx.fillText(d.title, x + slide(1), y);
    y += fTitle * 0.1;
    ctx.font = `500 ${fBody}px ${FONT_COND}`; ctx.fillStyle = '#c9d2cb';
    lines.forEach(l => { y += fBody * 1.32; ctx.globalAlpha = ap(2); ctx.fillText(l, x + slide(2), y); });
    y += fBody * 0.9 + fNum;
    // readouts
    let rx = x;
    d.reads.forEach((r, i) => {
      ctx.globalAlpha = ap(3 + i);
      const s = 1 + 0.16 * r.pop;
      ctx.save(); ctx.translate(rx + slide(3 + i), y); ctx.scale(s, s);
      ctx.font = `700 ${fNum}px ${FONT_COND}`; ctx.fillStyle = r.pop > 0.05 ? `rgb(255,${Math.round(236 - 30 * r.pop)},${Math.round(180 - 80 * r.pop)})` : '#ffe3a8';
      ctx.shadowColor = 'rgba(255,170,60,0.45)'; ctx.shadowBlur = 10 + 14 * r.pop;
      ctx.fillText(r.v, 0, 0); const vw = ctx.measureText(r.v).width; ctx.shadowBlur = 0;
      ctx.font = `600 ${fUnit * 1.25}px ${FONT_COND}`; ctx.fillStyle = '#ffd27a'; ctx.fillText(r.u, vw + 6, 0);
      ctx.restore();
      ctx.font = `500 ${fUnit}px ${FONT_COND}`; ctx.fillStyle = '#9aa69e'; ctx.fillText(r.l, rx + slide(3 + i), y + fUnit * 1.45);
      ctx.font = `700 ${fNum}px ${FONT_COND}`; const w1 = ctx.measureText(r.v).width; ctx.font = `600 ${fUnit * 1.25}px ${FONT_COND}`;
      rx += Math.max(w1 + ctx.measureText(r.u).width + 6, 120) + (nar ? 26 : 48);
    });
    if (d.note) { ctx.globalAlpha = alpha * d.note.a; ctx.fillStyle = '#e2a46b'; ctx.font = `400 ${fTag}px ${FONT_HAND}`; ctx.fillText(d.note.text, x, y + fUnit * 1.45 + fTag * 1.5); }
    ctx.restore();
  }

  function sparkBurst(x, y, n, speed, up = 0) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.35 + Math.random());
      st.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up * (0.5 + Math.random()), life: 0.25 + Math.random() * 0.5, age: 0 });
    }
  }
  function setPhase(cls, on = true) { st.el.classList.toggle(cls, on); }

  // ---- act 1: the cyclotron ----
  function act1(ctx, t, dt, off) {
    if (off <= -st.W) return;
    const L = act1Layout(), c = { cx: L.cx + off, cy: L.cy, R: L.R }, sp = spiral(L.R);
    const kNow = Math.floor((t - T0) / HT), frac = clamp((t - T0) / HT - kNow, 0, 1), running = t >= T0 && t < T_EDGE;
    const pol = running ? (kNow % 2 ? -1 : 1) * Math.cos(Math.PI * frac) : 0;
    const appear = clamp((t - A1) / 0.5, 0, 1), mag = clamp((t - A1 - 0.1) / 0.6, 0, 1), dee = clamp((t - A1 - 0.3) / 0.4, 0, 1);
    const nDone = t < T0 ? -1 : Math.min(HALF, kNow);
    drawCyc(ctx, c, sp, { alpha: appear, mag, dee, pol, nDone, frac, trailA: t >= T0 ? 1 : 0, ring: clamp((t - T_EDGE) / 0.35, 0, 1), defl: 0 }, t);
    // the spark at the ion source
    const aSp = clamp(1 - Math.abs(t - T_SPARK) / 0.25, 0, 1);
    if (aSp > 0) { const gl = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, c.R * 0.35 * aSp); gl.addColorStop(0, `rgba(255,250,230,${aSp})`); gl.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(c.cx, c.cy, c.R * 0.35, 0, TAU); ctx.fill(); }
    let px = null, py = null;
    if (t >= T_SPARK && t < T0) { px = c.cx; py = c.cy + sp[0].cy + sp[0].r; }
    else if (running) {
      [px, py] = posOn(c, sp[kNow], frac);
      if (kNow !== st.k) { st.k = kNow; st.pop1 = 1; if (kNow > 0) { sparkBurst(c.cx, py, 6, 150); audio.thunk(kNow / HALF); } }
    } else if (t >= T_EDGE) {
      if (st.k < HALF) { st.k = HALF; st.pop1 = 1.6; sparkBurst(c.cx, posOn(c, sp[HALF - 1], 1)[1], 14, 200); audio.ding(); }
      [px, py] = ringPos(c, sp, T_EDGE, t);
    }
    if (px !== null) drawProton(ctx, px, py, c.R, appear);
    // the caption and the readouts
    const n = t < T0 ? 0 : Math.min(HALF, kNow + 1), rd = cycRead(n);
    st.pop1 *= Math.exp(-dt * 7);
    const B = { bx: L.bx + off, bw: L.bw, by: L.narrow ? L.cy + L.R * 1.35 : null, narrow: L.narrow };
    drawBlock(ctx, B, {
      tag: 'machine 1', title: 'The cyclotron',
      body: 'A magnet bends the proton into a circle. Every time it crosses the gap, a voltage kicks it faster, so the circle grows.',
      reads: [{ v: (rd.beta * 100).toFixed(1), u: '%', l: 'of the speed of light', pop: st.pop1 }, { v: rd.K.toFixed(1), u: 'MeV', l: 'energy of motion', pop: st.pop1 }],
      note: { text: 'top speed: now it just circles', a: clamp((t - T_EDGE - 0.15) / 0.4, 0, 1) }
    }, t, A1 + 0.2, 1);
  }

  // ---- act 2: the Gauss gun ----
  function act2(ctx, t, dt, off) {
    if (off >= st.W || off <= -st.W) return;
    const L = act2Layout(), G = { ...L.G, x0: L.G.x0 + off, x1: L.G.x1 + off }, gg = gunGeom(G);
    const tau = t - T_FIRE1, charge = t < T_FIRE1 ? clamp((t - T_CHARGE) / (T_FIRE1 - T_CHARGE), 0, 1) : Math.max(0, 1 - tau / 0.3);
    // the can stands on the bench, in line with the barrel
    const canW = G.th * 1.3, canH = G.th * 2.3, benchY = G.y + G.th * 1.15, canX = L.canX + off;
    const hitX = canX + canW / 2, gap = gg.b0 - hitX, vOut = 2 * (gg.L - gg.s0) / TB1, tHit = TB1 + (gap + gg.sl / 2) / vOut;
    let sx = gg.b1 - gg.s0, on = -1, streak = 0;
    if (tau >= 0) {
      sx = slugX(gg, Math.min(tau, tHit), TB1); streak = clamp(tau / TB1, 0, 1);
      if (tau < TB1) gg.coils.forEach((x, i) => { if (sx > x && sx < x + gg.L * 0.2) on = i; });
      const passed = gg.coils.filter(x => sx < x).length;
      if (passed > st.coil1) { st.coil1 = passed; st.pop2 = 1; if (passed > 0) audio.thunk(0.35 + 0.15 * passed); }
    }
    const slugShown = tau < tHit + 0.05;
    // bench
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(200,190,170,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(canX - canW * 2.5, benchY); ctx.lineTo(G.x1 + 6, benchY); ctx.stroke(); ctx.restore();
    drawGun(ctx, G, { alpha: 1, charge, sx: slugShown ? sx : null, on, streak: slugShown ? streak : 0 });
    // the can: standing, then knocked flying when the slug arrives
    if (tau >= tHit && !st.can) {
      st.can = { x: L.canX, y: benchY - canH / 2, vx: -vOut * 0.12, vy: -G.th * 11, rot: 0, w: -7, a: 1 };
      sparkBurst(hitX, G.y, 22, 320, 80); audio.crunch(); st.flash = 0.1; st.flashCol = '255,220,180'; st.pop2 = 1.6;
    }
    if (st.can) {
      const k = st.can; k.vy += G.th * 40 * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.w * dt; k.a = clamp(1 - (tau - tHit - 0.5) / 0.35, 0, 1);
      drawCan(ctx, { ...k, x: k.x + off }, G.th);
    } else drawCan(ctx, { x: canX, y: benchY - canH / 2, rot: 0, a: 1 }, G.th);
    // a little note at the capacitors while they charge
    const aCh = clamp((t - T_CHARGE) / 0.3, 0, 1) * clamp(1 - (t - T_FIRE1) / 0.25, 0, 1);
    if (aCh > 0) {
      ctx.save(); ctx.globalAlpha = aCh; ctx.fillStyle = '#9fd6ff'; ctx.textAlign = 'center'; ctx.font = `400 ${clamp(G.th * 0.75, 14, 22)}px ${FONT_HAND}`;
      const lbl = `charging ${Math.round(charge * 100)} %`, lw = ctx.measureText(lbl).width;
      ctx.fillText(lbl, Math.min((gg.caps[0] + gg.caps[1]) / 2, st.W + off - lw / 2 - 10), G.y + G.th * 2.2); ctx.restore();
    }
    st.pop2 *= Math.exp(-dt * 7);
    const n = Math.max(0, st.coil1), v = VG[clamp(n, 0, 4)];
    const B = { bx: L.bx + off, bw: L.bw, by: L.narrow ? G.y + G.th * 3.4 : null, narrow: L.narrow };
    drawBlock(ctx, B, {
      tag: 'machine 2', title: 'The Gauss gun',
      body: 'Capacitors dump their charge into the coils. Each coil switches on, pulls the iron slug in, and switches off before it can pull it back.',
      reads: [{ v: v.toFixed(0), u: 'm/s', l: n ? `after coil ${n} of 4` : 'speed of the slug', pop: st.pop2 }, { v: (v * 3.6).toFixed(0), u: 'km/h', l: 'the same speed', pop: st.pop2 }],
      note: { text: 'one shot, 3 joules', a: clamp((tau - tHit - 0.1) / 0.4, 0, 1) }
    }, t, PAN1 + PAN * 0.6, 1);
  }

  // ---- act 3: both machines write the title ----
  function act3(ctx, t, dt, off) {
    if (off >= st.W) return;
    const g = geom(), c = { cx: g.cx + off, cy: g.cy, R: g.R }, sp = spiral(g.R), R = g.R;
    const fade = clamp(1 - (t - T_QUENCH) / 0.7, 0, 1);
    const [ex, ey] = posOn(c, sp[HALF - 1], 1);
    drawCyc(ctx, c, sp, { alpha: fade, mag: 1, dee: 1, pol: 0, nDone: HALF, frac: 1, trailA: 0.3 * (t < T_STEER ? 1 : clamp(1 - (t - T_STEER) / 0.6, 0.15, 1)), ring: t < T_X ? 1 : clamp(1 - (t - T_X) / 0.3, 0, 1),
      defl: clamp((t - T_X + 0.3) / 0.15, 0, 1) * clamp(1 - (t - T_STEER) / 0.4, 0, 1) }, t);
    // the proton: circling until the − plate pulls it out, then straight, then the beam is steered onto the name
    const sx0 = g.side ? ex + Math.min(OM * sp[HALF - 1].r * (T_STEER - T_X), R * 1.6) : Math.min(ex + R * 1.35, st.W - 14 + off);
    const vOut = (sx0 - ex) / (T_STEER - T_X);
    if (t < T_X) { const [px, py] = ringPos(c, sp, T_X, t); drawProton(ctx, px, py, R, fade); }
    else if (t < T_STEER) {
      if (!st.xDone) { st.xDone = true; audio.zap(); sparkBurst(ex, ey, 16, 220, 100); }
      const px = ex + vOut * (t - T_X);
      beam(ctx, ex, ey, px, ey, 1, t); drawProton(ctx, px, ey, R, 1);
    }
    const hy = g.tt + g.th * 0.54, x0 = g.tl - g.th * 0.04 + off, x1 = g.tl + g.tw + g.th * 0.06 + off;
    const u = clamp((t - T_HIT) / T_BURN, 0, 1), ue = u < 1 ? 1 - Math.pow(1 - u, 1.6) * (1 - u * 0.15) : 1;
    st.hot = x0 + (x1 - x0) * ue;
    if (t >= T_STEER && t < T_QUENCH) {
      const hx = t < T_HIT ? x0 : st.hot, reach = t < T_HIT ? clamp((t - T_STEER) / (T_HIT - T_STEER), 0, 1) : 1;
      // the steered part: straight to the name beside the title; below it, up the side of the machine first
      const pts = [[sx0, ey]];
      if (!g.side) pts.push([sx0, Math.min(ey, g.tt + g.th * 1.12)]);
      pts.push([hx, hy]);
      const segs = []; let tot = 0;
      for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); segs.push(l); tot += l; }
      let left = tot * reach, bx = pts[0][0], by = pts[0][1];
      ctx.save(); ctx.globalAlpha = fade;
      beam(ctx, ex, ey, sx0, ey, 1, t);
      for (let k = 1; k < pts.length && left > 0; k++) {
        const f = Math.min(1, left / Math.max(1e-6, segs[k - 1])), [ax, ay] = pts[k - 1];
        bx = ax + (pts[k][0] - ax) * f; by = ay + (pts[k][1] - ay) * f; beam(ctx, ax, ay, bx, by, 1, t); left -= segs[k - 1];
      }
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(bx, by, 0, bx, by, g.th * 0.45); gl.addColorStop(0, 'rgba(255,255,240,1)'); gl.addColorStop(0.2, 'rgba(255,190,90,0.75)'); gl.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(bx, by, g.th * 0.45, 0, TAU); ctx.fill();
      ctx.restore();
      if (t >= T_HIT && u < 1 && !reduceMotion) {
        for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, vv = 180 + Math.random() * 420; st.sparks.push({ x: hx, y: hy + (Math.random() - 0.5) * g.th * 0.5, vx: Math.cos(an) * vv - 60, vy: Math.sin(an) * vv, life: 0.3 + Math.random() * 0.5, age: 0 }); }
        st.crackle += dt; if (st.crackle > 0.07) { st.crackle = 0; audio.spark(); }
      }
    }
    // the Gauss gun: fired so that its slug lands on PROJECT exactly when the beam reaches LORENTZ
    const G = { ...g.G, x0: g.G.x0 + off, x1: g.G.x1 + off, hit: g.G.hit + off }, gg = gunGeom(G);
    const vS = 2 * (gg.L - gg.s0) / TB2, tFly = TB2 + Math.max(0, gg.b0 - G.hit - gg.sl / 2) / vS, tFire = T_HIT - tFly, tau = t - tFire;
    const gA = clamp(1 - (t - T_HIT - 0.15) / 0.5, 0, 1);
    if (gA > 0) {
      let sx = gg.b1 - gg.s0, on = -1;
      if (tau >= 0) {
        sx = Math.max(G.hit + gg.sl / 2, slugX(gg, tau, TB2));
        if (tau < TB2) gg.coils.forEach((x, i) => { if (sx > x && sx < x + gg.L * 0.2) on = i; });
        const passed = gg.coils.filter(x => sx < x).length;
        if (passed > st.coil2) { st.coil2 = passed; if (passed > 0) audio.thunk(0.35 + 0.15 * passed); }
      }
      drawGun(ctx, G, { alpha: gA, charge: tau < 0 ? 1 : Math.max(0, 1 - tau / 0.25), sx: t < T_HIT ? sx : null, on, streak: tau > 0 && t < T_HIT ? clamp(tau / TB2, 0, 1) : 0 });
    }
    st.burn.style.setProperty('--hot', (st.hot - g.tl - off).toFixed(1) + 'px');
  }
  function beam(ctx, ax, ay, bx, by, k, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fl = (0.85 + 0.15 * Math.sin(t * 90)) * k;
    ctx.strokeStyle = `rgba(255,120,40,${0.28 * fl})`; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = `rgba(255,214,150,${0.8 * fl})`; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.restore();
  }

  // ---- one frame ----
  function draw(dt) {
    const W = st.W, H = st.H; if (!W) return;
    const { ctx } = fitCanvas(st.cv, W, H);
    ctx.clearRect(0, 0, W, H);
    const t = st.t, p1 = panP(t, PAN1), p2 = panP(t, PAN2);
    // the opening line
    const aO = clamp((t - T_OPEN) / 0.35, 0, 1) * clamp(1 - (t - A1 + 0.15) / 0.3, 0, 1);
    if (aO > 0) {
      ctx.save(); ctx.globalAlpha = aO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f2ead6';
      ctx.font = `400 ${clamp(Math.min(W * 0.05, H * 0.06), 20, 40)}px ${FONT_HAND}`;
      const y0 = H * 0.48 - (1 - aO) * 8;
      if (isNarrow()) { ctx.fillText('Two machines.', W / 2, y0 - H * 0.03); ctx.fillText('Both run on electromagnetism.', W / 2, y0 + H * 0.03); }
      else ctx.fillText('Two machines. Both run on electromagnetism.', W / 2, y0);
      ctx.restore();
    }
    if (t >= A1 - 0.1 && p1 < 1) act1(ctx, t, dt, -W * p1);
    if (p1 > 0 && p2 < 1) act2(ctx, t, dt, W * (1 - p1) - W * p2);
    if (p2 > 0) act3(ctx, t, dt, W * (1 - p2));
    // the title rides in with act 3
    const so = p2 > 0 && p2 < 1 ? W * (1 - p2) : 0;
    if (so !== st.stackOff) { st.stackOff = so; st.stack.style.transform = so ? `translateX(${so.toFixed(1)}px)` : ''; }
    // whip-pan streaks
    const pv = Math.max(Math.sin(Math.PI * clamp((t - PAN1) / PAN, 0, 1)), Math.sin(Math.PI * clamp((t - PAN2) / PAN, 0, 1)));
    if (pv > 0.02 && !reduceMotion) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) { const y = (Math.sin(i * 91.7) * 0.5 + 0.5) * H, x = ((i * 337.1 + t * 4000) % (W + 400)) - 200, l = 120 + (i % 5) * 70; ctx.strokeStyle = `rgba(255,236,206,${0.09 * pv})`; ctx.lineWidth = 1 + (i % 3); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y); ctx.stroke(); }
      ctx.restore();
    }
    // embers from the freshly cut letters, sparks, shock rings and flashes
    if (!reduceMotion && t >= T_HIT) {
      const g = geom(), burnEnd = t < T_QUENCH ? st.hot : g.tl + g.tw;
      const rate = t < T_QUENCH + 0.6 ? 70 : 6;
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
    for (const r of st.rings) {
      r.age += dt; const f = r.age / r.life; if (f >= 1) continue;
      ctx.strokeStyle = `rgba(${r.col},${0.55 * (1 - f)})`; ctx.lineWidth = r.w * (1 - f) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - f, 3)), 0, TAU); ctx.stroke();
    }
    st.rings = st.rings.filter(r => r.age < r.life);
    ctx.restore();
    if (st.flash > 0.01) { ctx.fillStyle = `rgba(${st.flashCol},${st.flash})`; ctx.fillRect(0, 0, W, H); st.flash *= Math.exp(-dt * 6); }
  }

  // ---- the beats of the timeline (CSS does the type, the canvas does the light) ----
  function beats(prevT, t) {
    const hit = T => prevT < T && t >= T;
    if (hit(A1)) audio.charge(0.6);
    if (hit(T_SPARK)) { st.flash = 0.1; st.flashCol = '255,240,210'; audio.zap(); }
    if (hit(PAN1) || hit(PAN2)) audio.whoosh();
    if (hit(T_CHARGE)) audio.charge(T_FIRE1 - T_CHARGE);
    if (hit(PAN2)) setPhase('is-ghost');
    if (hit(T_HIT)) {
      setPhase('is-burning'); setPhase('is-stamped'); setPhase('is-shake'); audio.crunch(); setTimeout(() => setPhase('is-shake', false), 360);
      const g = geom(); sparkBurst(g.pl + g.pw, g.pt + g.ph / 2, 30, 320, 120); st.flash = 0.16; st.flashCol = '255,226,190';
      st.rings.push({ x: g.pl + g.pw, y: g.pt + g.ph / 2, r0: 3, r1: Math.max(24, g.ph * 1.7), w: 3, life: 0.35, age: 0, col: '255,214,160' });
    }
    if (hit(T_QUENCH)) {
      setPhase('is-quenched'); st.flash = 0.22; st.flashCol = '255,236,206'; audio.whoosh(); audio.clack(1);
      const g = geom(); st.rings.push({ x: g.tl + g.tw / 2, y: g.tt + g.th / 2, r0: g.tw * 0.2, r1: Math.max(st.W, st.H) * 0.75, w: 10, life: 0.9, age: 0, col: '255,226,190' });
    }
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
  function size() { if (!st.el) return; st.W = st.el.clientWidth; st.H = st.el.clientHeight; }

  // jump to the final title card
  function finish() {
    if (st.t >= T_READY) return;
    st.t = T_READY + 0.01; st.sparks = []; st.rings = []; st.k = HALF; st.coil1 = st.coil2 = 9; st.xDone = true; st.can = st.can || { x: -999, y: 0, vx: 0, vy: 0, rot: 0, w: 0, a: 0 };
    st.stackOff = 0; if (st.stack) st.stack.style.transform = '';
    for (const c of ['is-ghost', 'is-burning', 'is-quenched', 'is-stamped', 'is-eq', 'is-plate', 'is-signed', 'is-ready']) setPhase(c);
    setPhase('is-instant'); requestAnimationFrame(() => requestAnimationFrame(() => setPhase('is-instant', false)));
    st.flash = 0;
  }
  function close() {
    if (!st.on) return;
    st.on = false; cancelAnimationFrame(st.raf);
    st.el.classList.add('is-leaving');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => {
      st.el.hidden = true; st.el.className = 'intro'; if (st.stack) st.stack.style.transform = '';
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
    st.cv = $('#introCv'); st.burn = $('#introBurn'); st.name = $('#introName'); st.proj = st.el.querySelector('.lk-project'); st.stack = $('#introStack');
    st.back = auto ? null : document.activeElement;
    st.el.className = 'intro'; st.el.hidden = false; st.stack.style.transform = ''; st.stackOff = 0;
    st.t = 0; st.last = 0; st.k = -1; st.coil1 = -1; st.coil2 = -1; st.can = null; st.xDone = false; st.pop1 = st.pop2 = 0;
    st.sparks = []; st.embers = []; st.rings = []; st.flash = 0; st.emberT = 0;
    st.on = true; size();
    document.addEventListener('keydown', onKey, true);
    st.el.focus({ preventScroll: true });
    CL.bus.emit('intro', true);
    if (reduceMotion) { finish(); draw(0); return; }
    // wait (briefly) for the fonts so the name and the captions are drawn in the right letters
    const go = () => { if (st.on) { st.last = 0; st.raf = requestAnimationFrame(loop); } };
    if (document.fonts && document.fonts.load) Promise.race([Promise.all(['800 100px "Big Shoulders Stencil"', '500 20px "Barlow Condensed"', '700 20px "Barlow Condensed"', '400 20px Kalam'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 900))]).then(go, go);
    else go();
  }

  function init() {
    const el = $('#intro'); if (!el) return;
    el.addEventListener('click', ev => { if (ev.target.closest('#introSkip')) { close(); return; } advance(); });
    window.addEventListener('resize', () => { if (st.on) { size(); if (st.t >= T_READY) draw(0); } });
    const b = $('#homeIntro'); if (b) b.addEventListener('click', () => { audio.unlock(); play(false); });
  }
  CL.intro = { init, play, close, get on() { return st.on; }, get t() { return st.t; },
    get timeline() { return { A1, T_SPARK, T0, T_EDGE, PAN1, T_CHARGE, T_FIRE1, PAN2, T_X, T_HIT, T_QUENCH, T_READY }; } };
})();
