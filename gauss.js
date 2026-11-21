/* =====================================================================
   Project Lorentz — Gauss gun screen (CL.screens.gauss)
   Two machines that throw things with magnetism:
     • a multi-stage reluctance coil gun (copper coils switched on one after
       another pull an iron slug down a barrel), and
     • the classic magnet-and-steel-ball "Gauss rifle".
   The physics is in physics.js (PHYS.coilgun, PHYS.gaussBalls); this file
   animates it, draws it, graphs it and explains it.
   ===================================================================== */
(() => {
  'use strict';
  const { PHYS, C, $, $$, clamp, TAU, pl, e, si, pct, store, audio, FX, shaker, haloText, pill, hexA, fitCanvas, plot, bindRange, segInit, toast, missions, reduceMotion, rnd } = CL;
  const { GG, SLUGS, BALLS } = PHYS;

  const DEF = { type: 'coil', stages: 4, turns: 200, current: 120, slugCm: 2.5, material: 'iron', cutoff: 0, real: false, target: 'pendulum', glitch: false, over: false, speed: 'slow', ball: 'b4', bstages: 4, behind: 2, v0: 0.1, tab: 'shot', working: true, gA: 'v-x', gB: 'F-x', gbA: 'v-stage', gbB: 'K-stage' };
  const S = Object.assign({}, DEF);
  (() => { const st = store.get('cl-gauss', null); if (st && typeof st === 'object') for (const k of Object.keys(DEF)) if (typeof st[k] === typeof DEF[k]) S[k] = st[k]; })();
  if (!SLUGS[S.material]) S.material = 'iron';
  if (!BALLS.find(b => b.key === S.ball)) S.ball = 'b4';
  S.over = false;                                  // overload always starts off
  const save = () => store.set('cl-gauss', S);

  const SPEEDS = { real: 1, slow: 1 / 40, bullet: 1 / 400 };
  const SPEED_LABEL = { real: 'real speed', slow: '1/40 speed', bullet: '1/400 speed' };
  const TARGET_DIST = 0.6, BALL_TARGET_DIST = 0.35;
  const PEND_L = 0.3, PEND_M = { coil: 0.1, balls: 0.01 };
  const CAN = { m: 0.015, w: 0.066, h: 0.12 };
  const E_TOPPLE = CAN.m * C.g * (Math.hypot(CAN.h / 2, CAN.w / 2) - CAN.h / 2);   // energy to tip one can over (J)
  const T_ROOM = 20, T_BURN = 180, T_COOL = 60;    // °C, °C (class-H enamel), s (cooling time constant, illustrative)
  const RB_IN = 0.00325, RB_OUT = 0.004;           // barrel tube radii (m)
  const BALL_GAP = 0.05;                           // gap between the last ball of one stage and the next magnet (m)

  missions.add({ id: 'gg-10', screen: 'gauss', title: 'Faster than a sprinter', goal: 'Fire the coil gun faster than 10 m/s (a top sprinter runs about 10 m/s).' });
  missions.add({ id: 'gg-suck', screen: 'gauss', title: 'Suck-back', goal: 'Switch the coils off late (switch-off point +25 % or later) so a coil pulls the slug backwards.' });
  missions.add({ id: 'gg-alu', screen: 'gauss', title: 'Wrong metal', goal: 'Try to fire an aluminium slug. What happens, and why?' });
  missions.add({ id: 'gg-pend', screen: 'gauss', title: 'Big swing', goal: 'Make the 100 g ballistic pendulum swing up more than 20 cm.' });
  missions.add({ id: 'gg-balls', screen: 'gauss', title: 'Steel-ball sniper', goal: 'With magnets and balls, launch the last ball faster than 5 m/s.' });
  missions.add({ id: 'gg-burn', screen: 'gauss', title: 'Too hot to handle', goal: 'In overload mode, keep firing until a coil overheats (an illustrative failure).' });

  let active = false, cv, ctx, W = 900, H = 420, userH = +store.get('cl-h-gauss', 0) || 0, shake, v3 = null;
  const fx = new FX();
  const coilT = new Array(12).fill(T_ROOM), burnt = new Array(12).fill(false);
  let shot = null, ghost = null, charging = null, rapidT = 0, lastPanel = 0, dataDirty = true, graphDirty = true;
  const cam = { x: 0.15, y: 0, k: 2000, zoom: 1, from: null, blend: 1, phase: '' };
  const ctl = {};
  const patCache = { k: 0, pat: null, burnt: null };
  let fieldLines = null;

  /* ------------------------------------------------------------------
     Shots
     ------------------------------------------------------------------ */
  const coilGeoNow = () => PHYS.coilGeometry(S.turns);
  function coilLayout(stages = S.stages) {
    const xc = Array.from({ length: stages }, (_, k) => GG.x0 + k * GG.spacing);
    const muzzle = xc[stages - 1] + GG.Lc / 2 + 0.03;
    return { xc, muzzle, xBreech: xc[0] - GG.Lc / 2 - 0.03, xT: muzzle + TARGET_DIST };
  }
  function ballLayout(n = S.bstages, k = S.behind, ballKey = S.ball) {
    const b = BALLS.find(x => x.key === ballKey) || BALLS[0], r = b.r;
    const mags = [], chain = [];
    let x = 0.09;
    for (let j = 0; j < n; j++) {
      mags.push(x);
      chain.push(Array.from({ length: k }, (_, i) => x + 2 * r + (2 * i + 1) * r));
      x = x + 2 * r + 2 * k * r + BALL_GAP;
    }
    const last = chain[n - 1][k - 1];
    const muzzle = last + r + 0.03;
    return { b, r, mags, chain, xStart: mags[0] - 0.035, xBreech: mags[0] - 0.06, muzzle, xT: muzzle + BALL_TARGET_DIST };
  }

  function makeCoilShot() {
    const glitch = S.glitch ? Array.from({ length: S.stages }, () => rnd(-0.7, 0.7)) : null;
    const r = PHYS.coilgun({ stages: S.stages, turns: S.turns, current: S.current, slugLen: S.slugCm / 100, material: S.material, cutoff: S.cutoff, real: S.real, glitch, dead: burnt.slice(0, S.stages) });
    const lay = coilLayout(S.stages);
    const sh = { kind: 'coil', r, lay, glitch, set: { ...S }, m: r.m, sim: 0, post: 0, evI: 0, done: false, hit: null, tgt: null, chrono: null };
    const dts = r.samples.length > 1 ? r.samples[1].t - r.samples[0].t : 2e-5;
    sh.dts = dts;
    const fired = r.status === 'fired' && r.vEnd > 0.05;
    sh.fired = fired;
    sh.v = fired ? r.vEnd : 0;
    sh.tEndBarrel = r.tEnd;
    sh.tHit = fired ? r.tEnd + (lay.xT - r.Ls / 2 - r.xEnd) / r.vEnd : null;
    // chronograph: two light gates 2 cm and 7 cm past the muzzle
    if (fired) { const g1 = lay.muzzle + 0.02, g2 = lay.muzzle + 0.07; sh.chrono = { g1, g2, t1: tAtFrontCoil(sh, g1), t2: tAtFrontCoil(sh, g2) }; }
    sh.posAt = t => posCoil(sh, t);
    return sh;
  }
  function tAtFrontCoil(sh, xf) {          // time at which the slug's front passes x (after the barrel)
    const r = sh.r; return r.tEnd + (xf - r.Ls / 2 - r.xEnd) / r.vEnd;
  }
  function posCoil(sh, t) {
    const r = sh.r, smp = r.samples;
    if (t <= r.tEnd || !sh.fired) {
      if (!smp.length) return { x: r.x0, v: 0, F: 0, M: 0, I: [] };
      const f = clamp(t / sh.dts, 0, smp.length - 1), i = Math.floor(f), u = f - i, a = smp[i], b = smp[Math.min(i + 1, smp.length - 1)];
      return { x: a.x + (b.x - a.x) * u, v: a.v + (b.v - a.v) * u, F: a.F, M: a.M, I: a.I };
    }
    const tt = sh.tHit !== null ? Math.min(t, sh.tHit) : t;
    return { x: r.xEnd + r.vEnd * (tt - r.tEnd), v: t >= sh.tHit ? 0 : r.vEnd, F: 0, M: 0, I: [] };
  }

  function makeBallShot() {
    const res = PHYS.gaussBalls({ ball: S.ball, stages: S.bstages, behind: S.behind, v0: S.v0 });
    const lay = ballLayout(S.bstages, S.behind, S.ball), b = lay.b, r = b.r, m = b.m;
    const segs = [];
    // segment 0: the first ball rolls in from the start; segment j: the ball launched by stage j−1
    const mk = (x0, x1, Kinf, prevFace, nextFace) => {
      const N = 400, pts = [];
      let t = 0;
      const Kat = x => { let K = Kinf; if (prevFace !== null) K += res.Uc * Math.pow(r / Math.max(x - prevFace, r), 4); if (nextFace !== null) K += res.Uc * Math.pow(r / Math.max(nextFace - x, r), 4); return K; };
      let vPrev = Math.sqrt(2 * Kat(x0) / m);
      pts.push({ x: x0, t: 0, v: vPrev });
      for (let i = 1; i <= N; i++) {
        const x = x0 + (x1 - x0) * i / N, v = Math.sqrt(2 * Kat(x) / m);
        t += (x1 - x0) / N * 2 / (v + vPrev); vPrev = v;
        pts.push({ x, t, v });
      }
      return { x0, x1, pts, dur: t };
    };
    segs.push(mk(lay.xStart, lay.mags[0] - r, 0.5 * m * S.v0 * S.v0, null, lay.mags[0]));
    let status = res.status, stopAt = null;
    for (let j = 0; j < res.stages.length; j++) {
      const st = res.stages[j];
      if (st.stuck) { stopAt = j; break; }
      const from = lay.chain[j][S.behind - 1], face = lay.mags[j] + 2 * r;
      const isLast = j === res.stages.length - 1 && j === S.bstages - 1;
      const to = isLast ? lay.xT - r : lay.mags[j + 1] - r;
      segs.push(mk(from, to, st.Kout, face, isLast ? null : lay.mags[j + 1]));
    }
    let t = 0; for (const s of segs) { s.t0 = t; t += s.dur; s.t1 = t; }
    const impacts = segs.slice(0, Math.min(segs.length, res.stages.length)).map((s, j) => ({ j, t: s.t1 }));
    if (stopAt !== null && !impacts.find(i => i.j === stopAt)) impacts.push({ j: stopAt, t: segs[segs.length - 1].t1 });
    const fired = status === 'fired';
    const lastSeg = segs[segs.length - 1];
    const sh = { kind: 'balls', res, lay, set: { ...S }, m, segs, impacts, sim: 0, post: 0, evI: 0, done: false, hit: null, tgt: null, fired, stopAt };
    sh.v = fired ? lastSeg.pts[lastSeg.pts.length - 1].v : 0;
    sh.tHit = fired ? lastSeg.t1 : null;
    sh.tEndBarrel = fired ? lastSeg.t0 + interpT(lastSeg, lay.muzzle) : (lastSeg ? lastSeg.t1 : 0);
    if (fired) { const g1 = lay.muzzle + 0.02, g2 = lay.muzzle + 0.07; sh.chrono = { g1, g2, t1: lastSeg.t0 + interpT(lastSeg, g1 - r), t2: lastSeg.t0 + interpT(lastSeg, g2 - r) }; }
    sh.posAt = tt => posBall(sh, tt);
    return sh;
  }
  function interpT(seg, x) {
    const p = seg.pts; if (x <= p[0].x) return 0; if (x >= p[p.length - 1].x) return seg.dur;
    let lo = 0, hi = p.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p[mid].x < x) lo = mid; else hi = mid; }
    const u = (x - p[lo].x) / (p[hi].x - p[lo].x); return p[lo].t + (p[hi].t - p[lo].t) * u;
  }
  function posBall(sh, t) {
    const segs = sh.segs;
    let i = segs.findIndex(s => t < s.t1); if (i < 0) i = segs.length - 1;
    const s = segs[i], tt = clamp(t - s.t0, 0, s.dur), p = s.pts;
    let lo = 0, hi = p.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p[mid].t < tt) lo = mid; else hi = mid; }
    const u = p[hi].t > p[lo].t ? (tt - p[lo].t) / (p[hi].t - p[lo].t) : 0;
    const done = t >= s.t1 && i === segs.length - 1;
    return { x: p[lo].x + (p[hi].x - p[lo].x) * u, v: done ? 0 : p[lo].v + (p[hi].v - p[lo].v) * u, seg: i };
  }

  /* ------------------------------------------------------------------
     Firing, charging, targets
     ------------------------------------------------------------------ */
  const busy = () => !!charging || (shot && !shot.done && shot.sim < (shot.tHit ?? shot.tEndBarrel) );
  function fire() {
    if (charging) return;
    if (shot && !shot.done && shot.hit === null && shot.sim < (shot.tHit ?? shot.tEndBarrel)) return;
    audio.unlock();
    if (S.type === 'coil') {
      if (S.current <= 0) { toast($('#ggToast'), '<b>The coils have no current.</b> Turn up the coil current first.', 'warn', 4000); return; }
      const dur = S.speed === 'real' ? 0.3 : 0.55;
      charging = { t: 0, dur };
      audio.charge(dur);
      $('#ggFire').classList.add('is-down');
    } else { audio.clack(0.4); startShot(); }
  }
  function startShot() {
    if (shot) { book(shot); ghost = shot; ghost.done = true; }
    shot = S.type === 'coil' ? makeCoilShot() : makeBallShot();
    heatCoils(shot);
    shot.tgt = makeTarget(shot);
    cam.from = { x: cam.x, y: cam.y, k: cam.k }; cam.blend = 0; cam.phase = 'start';
    $('#ggReplay').disabled = true;
    if (S.type === 'coil') { audio.thunk(0.6); fx.flash(0.06, '255,200,140'); }
    dataDirty = graphDirty = true;
    updateLetterbox();
  }
  function replay() {
    if (!shot || charging) return;
    shot.sim = 0; shot.post = 0; shot.evI = 0; shot.done = false; shot.hit = null; shot.tgt = makeTarget(shot);
    cam.from = { x: cam.x, y: cam.y, k: cam.k }; cam.blend = 0; cam.phase = 'start';
    $('#ggReplay').disabled = true; updateLetterbox();
  }
  function makeTarget(sh) {
    const type = sh.set.target, lay = sh.lay, xT = lay.xT;
    const t = { type, xT, hitAt: null };
    if (type === 'pendulum') {
      const M = PEND_M[sh.kind], m = sh.m, V = sh.v * m / (m + M);
      const h = V * V / (2 * C.g), thMax = h >= 2 * PEND_L ? Math.PI : Math.acos(clamp(1 - h / PEND_L, -1, 1));
      Object.assign(t, { M, V, h, thMax, th: 0, maxTh: 0, over: h > PEND_L });
    } else if (type === 'cans') {
      t.cans = [];
      const rows = [[0, 1, 2], [0.5, 1.5], [1]];
      rows.forEach((row, ri) => row.forEach(c => t.cans.push({ x: xT + CAN.w / 2 + c * (CAN.w + 0.004), y: ri * CAN.h, a: 0, vx: 0, vy: 0, w: 0, row: ri, moving: false, fallen: false })));
      t.K = 0.5 * sh.m * sh.v * sh.v; t.p = sh.m * sh.v;
    } else { t.depth = 0; }
    return t;
  }
  function hitTarget(sh) {
    const t = sh.tgt; t.hitAt = sh.sim; sh.hit = sh.sim;
    const K = 0.5 * sh.m * sh.v * sh.v, big = clamp(Math.log10(1 + K * 30) / 2, 0.1, 1);
    const p = toScreen(t.xT, 0);
    if (t.type === 'pendulum') {
      audio.crunch(); fx.burst(p.x, p.y, Math.round(14 + 30 * big), { speed: 140 + 200 * big, life: 0.6, colors: ['214,170,110', '160,120,70', '255,230,190'], debris: true, gravity: 500, size: 2 });
      shake.kick(3 + 6 * big, 0.3);
      if (t.h >= 0.2 && sh.kind === 'coil') missionDone('gg-pend');
    } else if (t.type === 'cans') {
      audio.zap(); audio.crunch();
      let budget = 0.5 * K;                              // half the energy goes into the cans (illustrative split)
      const bottom = t.cans.filter(c => c.row === 0);
      bottom.forEach((c, i) => {
        const share = budget * (i < 2 ? 0.55 : 1); budget -= share;
        if (share > E_TOPPLE) { const v = Math.sqrt(2 * (share - E_TOPPLE) / CAN.m); c.vx = v * rnd(0.75, 1); c.vy = v * rnd(0.15, 0.5); c.w = -v * rnd(4, 9); c.moving = true; }
        else if (share > E_TOPPLE * 0.2) { c.w = -rnd(1, 3); c.wobble = 0.6; }
      });
      fx.burst(p.x, p.y, Math.round(12 + 30 * big), { speed: 200 + 300 * big, life: 0.5, colors: ['255,255,255', '255,220,160', '220,60,50'] });
      shake.kick(2 + 5 * big, 0.25);
    } else {
      audio.crunch(); t.depth = clamp(0.004 + 0.0015 * sh.v, 0.004, 0.09);
      fx.burst(p.x, p.y, Math.round(20 + 40 * big), { speed: 120 + 220 * big, life: 0.9, colors: ['214,184,120', '190,160,100', '240,215,160'], gravity: 420, size: 2.2 });
      shake.kick(1.5 + 3 * big, 0.25);
    }
    dataDirty = true;
  }
  function updateTarget(sh, dt) {
    const t = sh.tgt; if (!t || t.hitAt === null) return;
    if (t.type === 'pendulum') {
      const w = Math.sqrt(C.g / PEND_L), age = sh.post;
      if (t.thMax >= Math.PI * 0.999) t.th = Math.min(Math.PI, w * age * 2);       // loops right over the top
      else t.th = t.thMax * Math.sin(w * age) * Math.exp(-age / 6);
      t.maxTh = Math.max(t.maxTh, Math.abs(t.th));
    } else if (t.type === 'cans') {
      const floor = 0;
      for (const c of t.cans) {
        if (!c.moving && c.row > 0) {             // falls when a can beneath it has moved
          const below = t.cans.filter(o => o.row === c.row - 1 && Math.abs(o.x0 ?? o.x) > 0 && (o.moving || o.fallen) && Math.abs((o.x0 ?? o.x) - c.x) < CAN.w);
          if (below.length) { c.moving = true; c.vx = rnd(0.2, 1.2) * Math.sign(rnd(-0.3, 1)); c.vy = rnd(0, 0.4); c.w = -rnd(2, 7); }
        }
        if (c.wobble) { c.wobble = Math.max(0, c.wobble - dt); c.a = Math.sin(sh.post * 30) * 0.08 * c.wobble; }
        if (!c.moving) continue;
        if (c.x0 === undefined) c.x0 = c.x;
        c.vy -= C.g * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.w * dt;
        const ground = floor;
        if (c.y < ground) { c.y = ground; c.vy = Math.abs(c.vy) > 0.4 ? -c.vy * 0.3 : 0; c.vx *= 0.7; c.w *= 0.6; if (Math.abs(c.vx) < 0.05 && c.vy === 0) { c.fallen = true; c.a = c.a % TAU; const tgt = Math.round(c.a / (Math.PI / 2)) * Math.PI / 2; c.a += (tgt - c.a) * Math.min(1, dt * 8); } }
      }
    }
  }

  /* ------------------------------------------------------------------
     Coil heating and burn-out (heating is computed; the failure is illustrative)
     ------------------------------------------------------------------ */
  function heatCoils(sh) {
    if (sh.kind !== 'coil') return;
    sh.r.st.forEach((s, k) => {
      coilT[k] += s.dT;
      if (!burnt[k] && coilT[k] >= T_BURN) burnOut(k);
    });
    updateHeat();
  }
  function burnOut(k) {
    burnt[k] = true;
    const lay = coilLayout(S.stages), p = toScreen(lay.xc[k] || 0, 0.02);
    audio.boom(0.4); fx.flash(0.35, '255,140,60'); fx.burst(p.x, p.y, 70, { speed: 260, life: 1.1, colors: ['255,220,140', '255,140,60', '255,80,40'] }); fx.puff(p.x, p.y - 10, 16, { shade: 70 });
    shake.kick(8, 0.5);
    toast($('#ggToast'), `<b>Coil ${k + 1} burnt out.</b> It reached ${Math.round(coilT[k])} °C. The enamel insulation on magnet wire is usually rated for about 155 to 200 °C: above that it softens, neighbouring turns short together and the coil is ruined. The heat came from the current: P = I²R. Press <b>Repair coils</b> to fit new ones (the smoke and flames are illustrative).`, 'bad', 12000);
    missionDone('gg-burn');
    updateHeat();
  }
  function repairCoils() { for (let k = 0; k < coilT.length; k++) { coilT[k] = T_ROOM; burnt[k] = false; } updateHeat(); toast($('#ggToast'), '<b>New coils fitted.</b> All coils are back at room temperature.', '', 3500); }
  function updateHeat() {
    const box = $('#ggHeat'); if (!box) return;
    let html = '';
    for (let k = 0; k < S.stages; k++) {
      const f = clamp((coilT[k] - T_ROOM) / (T_BURN - T_ROOM), 0, 1);
      html += `<div class="${burnt[k] ? 'is-burnt' : ''}"><span>Coil ${k + 1}</span><i style="--h:${(f * 100).toFixed(1)}%"></i><span>${burnt[k] ? 'burnt' : Math.round(coilT[k]) + ' °C'}</span></div>`;
    }
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  /* ------------------------------------------------------------------
     Camera
     ------------------------------------------------------------------ */
  const TOP = 46;                                       // the overview strip at the top of the canvas
  const axisY = () => TOP + (H - TOP) * 0.6;
  function toScreen(x, y) {
    if (v3 && v3.on) { const q = v3.scene.project([x, 0, axisZ() + y]); if (q) return { x: q.x, y: q.y + TOP }; }
    return { x: W / 2 + (x - cam.x) * cam.k, y: axisY() - (y - cam.y) * cam.k };
  }
  const X = x => W / 2 + (x - cam.x) * cam.k, Y = y => axisY() - (y - cam.y) * cam.k;
  function sceneInfo() {
    if (shot) return { kind: shot.kind, lay: shot.lay };
    return S.type === 'coil' ? { kind: 'coil', lay: coilLayout() } : { kind: 'balls', lay: ballLayout() };
  }
  function camGoal() {
    const { kind, lay } = sceneInfo(), Hv = H - TOP;
    const geo = kind === 'coil' ? (shot && shot.kind === 'coil' ? shot.r.geo : coilGeoNow()) : null;
    const half = kind === 'coil' ? geo.a2 + 0.02 : 0.05;
    const gunL = lay.muzzle + 0.1 - lay.xBreech;
    const kGun = Math.min(W * 0.94 / gunL, Hv * 0.5 / half);
    const kAll = Math.min(W * 0.95 / (lay.xT + 0.3 - lay.xBreech), Hv * 0.75 / 0.45);
    const kTgt = Math.min(W / 0.7, Hv * 0.85 / 0.5);
    const gunMid = (lay.xBreech + lay.muzzle + 0.1) / 2;
    const zoomed = kind === 'coil' ? Math.min(W / 0.2, Hv * 0.5 / half) : Math.min(W / 0.16, Hv * 0.5 / 0.03);
    const kClose = clamp(zoomed * cam.zoom, kGun * 0.8, kGun * 12);
    if (charging) {                        // move the camera to the breech while the capacitors charge
      if (S.speed === 'real') return { x: (lay.xBreech + lay.xT + 0.3) / 2, y: 0.1, k: kAll, phase: 'all' };
      const L = coilLayout(S.stages), x0 = L.xc[0] - GG.Lc / 2 + 0.005 - S.slugCm / 200;
      return { x: Math.max(x0 + 0.0625 * W / kClose, L.xBreech + W / kClose / 2 - 0.02), y: 0, k: kClose, phase: 'follow' };
    }
    if (!shot) return { x: gunMid, y: 0, k: kGun, phase: 'gun' };
    const t = shot.sim, p = shot.posAt(t);
    if (shot.set.speed === 'real') return { x: (lay.xBreech + lay.xT + 0.3) / 2, y: 0.1, k: kAll, phase: 'all' };
    if (shot.hit !== null || (shot.tHit !== null && t >= shot.tHit)) return { x: lay.xT + 0.15, y: 0.14, k: kTgt, phase: 'target' };
    const inGun = p.x < lay.muzzle + 0.05;
    if (inGun || !shot.fired) return { x: clamp(p.x + 0.0625 * W / kClose, lay.xBreech + W / kClose / 2 - 0.02, lay.xT), y: 0, k: kClose, phase: 'follow' };
    return { x: (p.x + lay.xT + 0.1) / 2, y: 0.05, k: Math.min(kTgt, W * 0.8 / Math.max(0.1, lay.xT + 0.2 - p.x)), phase: 'flight' };
  }
  function updateCam(dt) {
    const g = camGoal();
    if (g.phase !== cam.phase) { cam.from = { x: cam.x, y: cam.y, k: cam.k }; cam.blend = 0; cam.phase = g.phase; }
    cam.blend = Math.min(1, cam.blend + dt / (g.phase === 'follow' ? 0.35 : 0.6));
    const u = reduceMotion ? 1 : 1 - Math.pow(1 - cam.blend, 3);
    const f = cam.from || g;
    cam.x = f.x + (g.x - f.x) * u; cam.y = f.y + (g.y - f.y) * u;
    cam.k = Math.exp(Math.log(f.k) + (Math.log(g.k) - Math.log(f.k)) * u);
  }

  /* ------------------------------------------------------------------
     Drawing helpers
     ------------------------------------------------------------------ */
  function windingPattern(k, isBurnt) {
    const s = GG.wireD * k;
    if (s < 3) return null;
    if (Math.abs(patCache.k - k) / k < 0.04 && patCache.pat) return isBurnt ? patCache.burnt : patCache.pat;
    const mkTile = burntTile => {
      const n = Math.max(3, Math.round(s)), tc = document.createElement('canvas'); tc.width = n; tc.height = n;
      const c = tc.getContext('2d');
      c.fillStyle = burntTile ? '#2a1a12' : '#6d3a17'; c.fillRect(0, 0, n, n);
      const g = c.createRadialGradient(n * 0.38, n * 0.36, 0, n / 2, n / 2, n * 0.48);
      if (burntTile) { g.addColorStop(0, '#5a3b2a'); g.addColorStop(1, '#1b110b'); } else { g.addColorStop(0, '#ffd2a0'); g.addColorStop(0.45, '#d08a4c'); g.addColorStop(1, '#8a4a1e'); }
      c.fillStyle = g; c.beginPath(); c.arc(n / 2, n / 2, n * 0.46, 0, TAU); c.fill();
      return ctx.createPattern(tc, 'repeat');
    };
    patCache.k = k; patCache.pat = mkTile(false); patCache.burnt = mkTile(true);
    return isBurnt ? patCache.burnt : patCache.pat;
  }
  function traceFieldLines() {             // two-pole model of a short coil, in units of half the coil length
    const lines = [];
    const E = (x, y) => {
      const ax = x - 1, ay = y, bx = x + 1, by = y;
      const ra = Math.pow(ax * ax + ay * ay, 1.5), rb = Math.pow(bx * bx + by * by, 1.5);
      return [ax / ra - bx / rb, ay / ra - by / rb];
    };
    for (const deg of [14, 24, 34, 46, 60, 76, 96, 120, 145]) {
      const th = deg * Math.PI / 180;
      let x = 1 + 0.1 * Math.cos(th), y = 0.1 * Math.sin(th);
      const pts = [[x, y]];
      for (let i = 0; i < 2500; i++) {
        const [ex, ey] = E(x, y), L = Math.hypot(ex, ey) || 1;
        const h = 0.025 * (1 + Math.min(Math.hypot(x - 1, y), Math.hypot(x + 1, y)));
        x += ex / L * h; y += ey / L * h;
        if (i % 3 === 0) pts.push([x, y]);
        if (Math.hypot(x + 1, y) < 0.1 || Math.hypot(x, y) > 9) break;
      }
      lines.push(pts);
    }
    return lines;
  }
  function lineThroughClip(pts, ox, s, a1u, a2u, sign) {
    ctx.beginPath(); let pen = false;
    for (const [u, v] of pts) {
      const inside = Math.abs(u) < 1 && Math.abs(v) < a2u;
      if (inside) { pen = false; continue; }
      const px = X(ox + u * s), py = Y(sign * v * s);
      if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  function metalGrad(x0, y0, y1, base) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#f4f7f9'); g.addColorStop(0.18, base); g.addColorStop(0.55, hexA(base, 1)); g.addColorStop(0.82, '#5b6168'); g.addColorStop(1, '#2c3036');
    return g;
  }
  function drawRuler(x0, x1, y, every = 0.01) {
    const px = every * cam.k; if (px < 5) every = px < 1 ? 0.1 : 0.05;
    const step = every;
    ctx.strokeStyle = 'rgba(230,236,230,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
    const s0 = Math.ceil(x0 / step), s1 = Math.floor(x1 / step);
    for (let i = s0; i <= s1; i++) {
      const xx = Math.round(X(i * step)) + 0.5; if (xx < -5 || xx > W + 5) continue;
      const cm = Math.round(i * step * 100), major = cm % 10 === 0, mid = cm % 5 === 0;
      const L = major ? 9 : mid ? 6 : 3.5;
      ctx.moveTo(xx, Y(y)); ctx.lineTo(xx, Y(y) + L);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(230,236,230,0.6)'; ctx.font = '500 12px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const lblStep = cam.k * 0.1 > 60 ? 0.05 : 0.1;
    for (let i = Math.ceil(x0 / lblStep); i <= Math.floor(x1 / lblStep); i++) {
      const xx = X(i * lblStep); if (xx < 12 || xx > W - 12) continue;
      ctx.fillText(Math.round(i * lblStep * 100) + ' cm', xx, Y(y) + 10);
    }
  }
  function lamp(x, y, on, col = '255,176,32', r = 4) {
    ctx.fillStyle = on ? `rgb(${col})` : '#2e2418'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (on) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, `rgba(${col},0.55)`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
  function nixieText(text, x, y, size = 18) {
    ctx.font = `300 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.shadowColor = 'rgba(255,110,20,0.9)'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffcf9e'; ctx.fillText(text, x, y); ctx.restore();
  }

  /* ------------------------------------------------------------------
     Drawing: coil gun
     ------------------------------------------------------------------ */
  function drawCoilGun(now) {
    const sh = shot && shot.kind === 'coil' ? shot : null;
    const geo = sh ? sh.r.geo : coilGeoNow(), lay = sh ? sh.lay : coilLayout();
    const stages = lay.xc.length, set = sh ? sh.set : S;
    const t = sh ? sh.sim : 0, p = sh ? sh.posAt(t) : null;
    const Ls = sh ? sh.r.Ls : S.slugCm / 100, d = GG.slugD;
    const sx = p ? p.x : lay.xc[0] - GG.Lc / 2 + 0.005 - Ls / 2;
    const Inow = p && p.I && p.I.length ? p.I : new Array(stages).fill(0);
    const I0 = sh ? sh.r.I0 : S.current;
    const yTable = -(geo.a2 + 0.012);
    // table and base board with a ruler
    ctx.fillStyle = '#151b18'; ctx.fillRect(0, Y(yTable), W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, Y(yTable), W, 1.5);
    const bx0 = lay.xBreech - 0.02, bx1 = lay.muzzle + 0.09;
    ctx.fillStyle = '#2d3530'; ctx.fillRect(X(bx0), Y(yTable + 0.006), (bx1 - bx0) * cam.k, 0.006 * cam.k);
    drawRuler(bx0 + 0.005, bx1 - 0.005, yTable + 0.006);
    // field lines around the coils that carry current
    if (!fieldLines) fieldLines = traceFieldLines();
    const s = GG.Lc / 2, a1u = geo.a1 / s, a2u = (geo.a2 + 0.0015) / s;
    for (let k = 0; k < stages; k++) {
      const f = I0 > 0 ? Math.abs(Inow[k] || 0) / Math.max(I0, 1e-9) : 0;
      if (f < 0.04) continue;
      ctx.save(); ctx.lineWidth = 1.3; ctx.setLineDash([3, 4]); ctx.lineDashOffset = reduceMotion ? 0 : -now / 40;
      ctx.strokeStyle = `rgba(179,166,255,${0.55 * f})`;
      for (const ln of fieldLines) { lineThroughClip(ln, lay.xc[k], s, a1u, a2u, 1); lineThroughClip(ln, lay.xc[k], s, a1u, a2u, -1); }
      // straight, dense field inside the bore
      ctx.setLineDash([]); ctx.strokeStyle = `rgba(179,166,255,${0.35 * f})`;
      for (const yy of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.moveTo(X(lay.xc[k] - s), Y(yy * geo.a1)); ctx.lineTo(X(lay.xc[k] + s), Y(yy * geo.a1)); ctx.stroke(); }
      ctx.restore();
    }
    // barrel tube
    const xb0 = lay.xBreech, xb1 = lay.muzzle;
    ctx.fillStyle = 'rgba(200,225,235,0.08)'; ctx.fillRect(X(xb0), Y(RB_OUT), (xb1 - xb0) * cam.k, 2 * RB_OUT * cam.k);
    ctx.fillStyle = '#3b4540'; ctx.fillRect(X(xb0) - 0.006 * cam.k, Y(RB_OUT + 0.002), 0.006 * cam.k, 2 * (RB_OUT + 0.002) * cam.k);
    // projectile
    drawSlug(sx, Ls, d, sh ? sh.r.mat : SLUGS[S.material], p ? p.M : 0, sh ? sh.r.Ms : 1, t, sh);
    ctx.strokeStyle = 'rgba(220,235,240,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(xb0), Y(RB_OUT)); ctx.lineTo(X(xb1), Y(RB_OUT)); ctx.moveTo(X(xb0), Y(-RB_OUT)); ctx.lineTo(X(xb1), Y(-RB_OUT)); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,235,240,0.22)';
    ctx.beginPath(); ctx.moveTo(X(xb0), Y(RB_IN)); ctx.lineTo(X(xb1), Y(RB_IN)); ctx.moveTo(X(xb0), Y(-RB_IN)); ctx.lineTo(X(xb1), Y(-RB_IN)); ctx.stroke();
    // coils
    const pat = windingPattern(cam.k, false), patB = windingPattern(cam.k, true);
    for (let k = 0; k < stages; k++) {
      const xc = lay.xc[k], f = I0 > 0 ? clamp(Math.abs(Inow[k] || 0) / I0, 0, 1) : 0, dead = burnt[k], T = coilT[k];
      const xl = X(xc - GG.Lc / 2), wpx = GG.Lc * cam.k;
      for (const sg of [1, -1]) {
        const yA = Y(sg > 0 ? geo.a2 : -geo.a1), hpx = (geo.a2 - geo.a1) * cam.k;
        ctx.save();
        ctx.beginPath(); ctx.rect(xl, yA, wpx, hpx); ctx.clip();
        if ((dead ? patB : pat)) { ctx.fillStyle = dead ? patB : pat; ctx.translate(xl, yA); ctx.fillRect(0, 0, wpx, hpx); }
        else {
          const g = ctx.createLinearGradient(xl, 0, xl + wpx, 0);
          if (dead) { g.addColorStop(0, '#24160f'); g.addColorStop(0.5, '#3a271b'); g.addColorStop(1, '#1d120c'); }
          else { g.addColorStop(0, '#8a4a1e'); g.addColorStop(0.45, '#e0a26a'); g.addColorStop(1, '#8a4a1e'); }
          ctx.fillStyle = g; ctx.fillRect(xl, yA, wpx, hpx);
        }
        ctx.restore();
        if (f > 0.02 && !dead) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,150,40,${0.42 * f})`; ctx.fillRect(xl, yA, wpx, hpx); ctx.restore(); }
        if (T > 60 && !dead) { ctx.fillStyle = `rgba(255,${Math.round(90 - 60 * clamp((T - 60) / 120, 0, 1))},20,${0.55 * clamp((T - 60) / 120, 0, 1)})`; ctx.fillRect(xl, yA, wpx, hpx); }
        ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1; ctx.strokeRect(xl + 0.5, yA + 0.5, wpx - 1, hpx - 1);
        // current direction symbols
        if (f > 0.05 && hpx > 22 && wpx > 22 && !dead) {
          const cx = xl + wpx / 2, cy = yA + hpx / 2, rr = Math.min(9, hpx * 0.28);
          ctx.fillStyle = 'rgba(20,10,4,0.75)'; ctx.beginPath(); ctx.arc(cx, cy, rr + 3, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(255,230,180,${0.5 + 0.5 * f})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
          if (sg > 0) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(cx, cy, rr * 0.3, 0, TAU); ctx.fill(); }
          else { const q = rr * 0.6; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke(); }
        }
      }
      // bobbin flanges
      ctx.fillStyle = '#20262a';
      for (const ex of [xc - GG.Lc / 2 - 0.0015, xc + GG.Lc / 2]) ctx.fillRect(X(ex), Y(geo.a2 + 0.002), 0.0015 * cam.k, (geo.a2 + 0.002 - RB_OUT) * cam.k), ctx.fillRect(X(ex), Y(-RB_OUT), 0.0015 * cam.k, (geo.a2 + 0.002 - RB_OUT) * cam.k);
      // switch-off point marker
      const cutC = sh ? sh.r.st[k].cutoff : set.cutoff;
      const xo = X(xc + clamp(cutC, -1.4, 1.4) * GG.Lc / 2);
      if (cam.k * GG.Lc > 30) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,176,32,0.75)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xo, Y(geo.a2 + 0.004)); ctx.lineTo(xo, Y(RB_OUT)); ctx.stroke(); ctx.restore();
        ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.moveTo(xo, Y(geo.a2 + 0.004)); ctx.lineTo(xo - 5, Y(geo.a2 + 0.004) - 7); ctx.lineTo(xo + 5, Y(geo.a2 + 0.004) - 7); ctx.closePath(); ctx.fill();
      }
      // lamp and label
      const ly = Y(geo.a2 + 0.004) - 18;
      lamp(X(xc), ly, f > 0.05 && !dead, dead ? '255,75,62' : '255,176,32', clamp(cam.k * 0.0016, 3, 6));
      if (cam.k * GG.Lc > 36) haloText(ctx, dead ? `coil ${k + 1}: burnt` : `coil ${k + 1}`, X(xc), Y(-geo.a2 - 0.004) + 12, { font: '600 13.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: dead ? '#ff8a7a' : '#e8c8a8' });
      if (dead) { if (Math.random() < 0.25 && !reduceMotion) fx.puff(X(xc), Y(geo.a2), 1, { shade: 60 }); }
      // light gate in front of coils 2…n
      if (k > 0) drawGate(xc - GG.Lc / 2 - GG.lead, sx, Ls, geo);
    }
    // chronograph
    const g1 = lay.muzzle + 0.02, g2 = lay.muzzle + 0.07;
    drawGate(g1, sx, Ls, geo, true); drawGate(g2, sx, Ls, geo, true);
    const hw = Math.min((g2 - g1 + 0.016) * cam.k, 170), hh = Math.min(0.017 * cam.k, 44), hx = X((g1 + g2) / 2) - hw / 2, hy = Y(RB_OUT + 0.004) - hh - 10;
    if (hw > 40) {
      for (const gx of [g1, g2]) { ctx.strokeStyle = 'rgba(90,100,94,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(gx), hy + hh); ctx.lineTo(X(gx), Y(RB_OUT + 0.0045)); ctx.stroke(); }
      ctx.fillStyle = '#232a26'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.fillRect(hx, hy, hw, hh); ctx.strokeRect(hx + 0.5, hy + 0.5, hw - 1, hh - 1);
      ctx.fillStyle = '#0c0907'; ctx.fillRect(hx + 4, hy + 4, hw - 8, hh - 8);
      const cr = sh && sh.chrono && t >= sh.chrono.t2 ? (0.05 / (sh.chrono.t2 - sh.chrono.t1)) : null;
      nixieText(cr ? pl(cr, 3) + ' m/s' : '- - -', hx + hw / 2, hy + hh / 2, clamp(hh * 0.62, 10, 30));
      if (hh > 22) haloText(ctx, 'chronograph', hx + hw / 2, hy - 8, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#b9c4bb' });
    }
    drawTarget(sh, yTable, now);
    // in-flight slug (drawn over the target area) and coil labels
    if (sh && p && p.x > lay.muzzle) drawSlug(p.x, Ls, d, sh.r.mat, 0, 1, t, sh);
    if (!sh) {
      const notes = [
        [sx, d / 2, sx - 0.01, geo.a2 + 0.026, 'iron slug: becomes a magnet'],
        [lay.xc[0] - GG.Lc / 4, geo.a2, lay.xc[0] - 0.035, geo.a2 + 0.055, 'copper coil: an electromagnet'],
        [lay.xc[0] + set.cutoff * GG.Lc / 2, geo.a2 + 0.004, lay.xc[0] + 0.06, geo.a2 + 0.045, 'amber marker: where the coil switches off'],
      ];
      if (stages > 1) notes.push([lay.xc[1] - GG.Lc / 2 - GG.lead, -RB_OUT - 0.003, lay.xc[1] - 0.01, -geo.a2 - 0.03, 'light gate: switches the next coil on']);
      notes.push([(lay.xBreech + lay.xc[0]) / 2, -RB_OUT, lay.xBreech + 0.005, -geo.a2 - 0.05, 'plastic barrel']);
      callouts(notes);
    }
  }
  function callouts(notes) {
    if (W < 640) return;
    ctx.font = '600 14px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.textBaseline = 'middle';
    for (const [x, y, tx, ty, text] of notes) {
      const ax = X(x), ay = Y(y), bx = X(tx), by = clamp(Y(ty), TOP + 50, H - 14);
      if (bx < 4 || bx > W - 40) continue;
      ctx.strokeStyle = 'rgba(217,225,218,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx + 8, by); ctx.stroke();
      ctx.fillStyle = 'rgba(217,225,218,0.9)'; ctx.beginPath(); ctx.arc(ax, ay, 2.2, 0, TAU); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = '#dfe6df'; ctx.fillText(text, bx + 12, by);
    }
  }
  function drawGate(xg, sx, Ls, geo, chrono) {
    const blocked = sx - Ls / 2 <= xg && sx + Ls / 2 >= xg;
    const y0 = RB_OUT + 0.0015, sz = 0.003;
    ctx.fillStyle = '#121513';
    ctx.fillRect(X(xg) - sz * cam.k / 2, Y(y0 + sz), sz * cam.k, sz * cam.k);
    ctx.fillRect(X(xg) - sz * cam.k / 2, Y(-y0), sz * cam.k, sz * cam.k);
    if (!blocked) { ctx.strokeStyle = chrono ? 'rgba(255,80,60,0.55)' : 'rgba(255,60,60,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(xg), Y(y0)); ctx.lineTo(X(xg), Y(-y0)); ctx.stroke(); }
    lamp(X(xg), Y(y0 + sz) - 5, blocked, '95,211,141', clamp(cam.k * 0.0009, 2, 4));
  }
  function drawSlug(x, Ls, d, mat, M, Ms, t, sh) {
    const x0 = X(x - Ls / 2), w = Ls * cam.k, y0 = Y(d / 2), h = d * cam.k;
    ctx.fillStyle = metalGrad(x0, y0, y0 + h, mat.color);
    ctx.fillRect(x0, y0, w, h);
    const f = Ms > 0 ? clamp(Math.abs(M) / Ms, 0, 1) : 0;
    if (f > 0.03) {
      const north = M >= 0;
      const gN = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      gN.addColorStop(0, `rgba(62,126,230,${0.55 * f})`); gN.addColorStop(0.45, 'rgba(0,0,0,0)'); gN.addColorStop(0.55, 'rgba(0,0,0,0)'); gN.addColorStop(1, `rgba(229,72,63,${0.55 * f})`);
      ctx.fillStyle = gN; ctx.fillRect(x0, y0, w, h);
      if (w > 46 && h > 12) {
        ctx.font = `700 ${Math.round(clamp(h * 0.7, 10, 18))}px "Barlow Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText(north ? 'S' : 'N', x0 + Math.min(10, w * 0.15), y0 + h / 2 + 0.5); ctx.fillText(north ? 'N' : 'S', x0 + w - Math.min(10, w * 0.15), y0 + h / 2 + 0.5);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    // speed streaks in flight
    if (sh && sh.fired && t > sh.r.tEnd && (sh.tHit === null || t < sh.tHit)) {
      const L = clamp(sh.v * 0.004 * cam.k, 8, 90);
      const g = ctx.createLinearGradient(x0 - L, 0, x0, 0); g.addColorStop(0, 'rgba(255,220,170,0)'); g.addColorStop(1, 'rgba(255,220,170,0.45)');
      ctx.fillStyle = g; ctx.fillRect(x0 - L, y0 + h * 0.2, L, h * 0.6);
    }
  }

  /* ------------------------------------------------------------------
     Drawing: magnet-and-ball rifle
     ------------------------------------------------------------------ */
  function ballAt(x, r, glow) {
    const cx = X(x), cy = Y(0), rr = Math.max(1.5, r * cam.k);
    const g = ctx.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.05, cx, cy, rr);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#d7dde2'); g.addColorStop(0.7, '#7c858d'); g.addColorStop(1, '#30363c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    if (glow) { const gg = ctx.createRadialGradient(cx, cy, rr * 0.5, cx, cy, rr * 2.6); gg.addColorStop(0, `rgba(255,220,160,${0.5 * glow})`); gg.addColorStop(1, 'rgba(255,220,160,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, rr * 2.6, 0, TAU); ctx.fill(); }
  }
  function drawBallGun(now) {
    const sh = shot && shot.kind === 'balls' ? shot : null;
    const lay = sh ? sh.lay : ballLayout(), b = lay.b, r = lay.r, k = sh ? sh.set.behind : S.behind;
    const t = sh ? sh.sim : 0;
    const yTable = -r - 0.008;
    ctx.fillStyle = '#151b18'; ctx.fillRect(0, Y(yTable), W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, Y(yTable), W, 1.5);
    // aluminium channel track with a ruler
    const tx0 = lay.xBreech, tx1 = lay.muzzle + 0.02;
    const gTrack = ctx.createLinearGradient(0, Y(-r), 0, Y(yTable));
    gTrack.addColorStop(0, '#c9cfd3'); gTrack.addColorStop(0.3, '#8d959b'); gTrack.addColorStop(1, '#4a5056');
    ctx.fillStyle = gTrack; ctx.fillRect(X(tx0), Y(-r), (tx1 - tx0) * cam.k, (yTable + r) * -cam.k);
    drawRuler(tx0 + 0.005, tx1 - 0.005, -r - 0.0005);
    const impacted = j => sh && sh.impacts.some(im => im.j === j && t >= im.t);
    for (let j = 0; j < lay.mags.length; j++) {
      const xm = lay.mags[j], hit = impacted(j);
      // magnet: nickel-plated cylinder seen from the side, N face upstream
      const x0 = X(xm), w = 2 * r * cam.k, y0 = Y(r), h = 2 * r * cam.k;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#f2f4f5'); g.addColorStop(0.3, '#b9c0c6'); g.addColorStop(0.7, '#7c858c'); g.addColorStop(1, '#41474c');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = 'rgba(229,72,63,0.85)'; ctx.fillRect(x0, y0, Math.max(1.5, w * 0.08), h);
      ctx.fillStyle = 'rgba(62,126,230,0.85)'; ctx.fillRect(x0 + w - Math.max(1.5, w * 0.08), y0, Math.max(1.5, w * 0.08), h);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
      if (w > 22) { ctx.font = `700 ${Math.round(clamp(w * 0.3, 10, 16))}px "Barlow Condensed", "Arial Narrow", sans-serif`; ctx.fillStyle = 'rgba(20,24,28,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', x0 + w * 0.28, y0 + h / 2); ctx.fillText('S', x0 + w * 0.72, y0 + h / 2); }
      // magnetic field hint around the magnet
      if (cam.k * r > 6) {
        ctx.save(); ctx.strokeStyle = 'rgba(179,166,255,0.22)'; ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
        for (const rr of [1.6, 2.4, 3.4]) { ctx.beginPath(); ctx.ellipse(x0 + w / 2, y0 + h / 2, rr * w * 0.55, rr * h * 0.5, 0, 0, TAU); ctx.stroke(); }
        ctx.restore();
      }
      // balls behind the magnet (the far one leaves after the impact unless the stage is stuck)
      const stuck = sh && sh.stopAt === j;
      lay.chain[j].forEach((xb, i) => { if (i === k - 1 && hit && !stuck) return; ballAt(xb, r, 0); });
      // the ball that hit this magnet stays stuck on its upstream face
      if (hit) { ballAt(xm - r, r, 0); const im = sh.impacts.find(q => q.j === j); const age = (t - im.t) / Math.max(1e-4, sh.segs[0].dur * 0.1); if (age < 1) ballAt(xm - r, r, 1 - age); }
      if (cam.k * r > 5) haloText(ctx, `stage ${j + 1}`, x0 + w / 2, Y(yTable) + 16, { font: '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#c9d2cb' });
    }
    // the moving ball
    if (sh) {
      const p = sh.posAt(t), moving = !(sh.stopAt !== null && p.seg === sh.segs.length - 1 && t >= sh.segs[sh.segs.length - 1].t1);
      const atTarget = sh.tHit !== null && t >= sh.tHit;
      if (moving && !atTarget) ballAt(p.x, r, 0);
      if (p.v > 0.3 && !atTarget) {
        const L = clamp(p.v * 0.02 * cam.k, 4, 60), x0 = X(p.x - r);
        const g = ctx.createLinearGradient(x0 - L, 0, x0, 0); g.addColorStop(0, 'rgba(255,220,170,0)'); g.addColorStop(1, 'rgba(255,220,170,0.35)');
        ctx.fillStyle = g; ctx.fillRect(x0 - L, Y(r * 0.5), L, r * cam.k);
      }
    } else ballAt(lay.xStart, r, 0);
    // chronograph gates
    const g1 = lay.muzzle + 0.02, g2 = lay.muzzle + 0.07;
    const hw = Math.min((g2 - g1 + 0.016) * cam.k, 170), hh = Math.min(0.017 * cam.k, 44), hx = X((g1 + g2) / 2) - hw / 2, hy = Y(r + 0.004) - hh - 14;
    if (hw > 40) {
      ctx.fillStyle = '#232a26'; ctx.fillRect(hx, hy, hw, hh); ctx.strokeStyle = '#000'; ctx.strokeRect(hx + 0.5, hy + 0.5, hw - 1, hh - 1);
      ctx.fillStyle = '#0c0907'; ctx.fillRect(hx + 4, hy + 4, hw - 8, hh - 8);
      const cr = sh && sh.chrono && t >= sh.chrono.t2 ? (0.05 / (sh.chrono.t2 - sh.chrono.t1)) : null;
      nixieText(cr ? pl(cr, 3) + ' m/s' : '- - -', hx + hw / 2, hy + hh / 2, clamp(hh * 0.62, 10, 30));
      for (const gx of [g1, g2]) { ctx.strokeStyle = 'rgba(255,80,60,0.5)'; ctx.beginPath(); ctx.moveTo(X(gx), hy + hh); ctx.lineTo(X(gx), Y(-r)); ctx.stroke(); }
      if (hh > 22) haloText(ctx, 'chronograph', hx + hw / 2, hy - 8, { font: '600 12.5px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#b9c4bb' });
    }
    drawTarget(sh, yTable, now);
    if (sh && sh.tHit !== null && t < sh.tHit) { const p = sh.posAt(t); if (p.x > lay.muzzle) ballAt(p.x, r, 0); }
    if (!sh) {
      const notes = [
        [lay.xStart, r, lay.xStart - 0.02, r + 0.05, 'rolling ball (give it a gentle push)'],
        [lay.mags[0] + r, r, lay.mags[0] + 0.01, r + 0.09, 'neodymium magnet'],
        [lay.chain[0][k - 1], -r, lay.chain[0][k - 1] + 0.012, -r - 0.028, `${k} steel ball${k > 1 ? 's' : ''}: the last one flies off`],
      ];
      callouts(notes);
    }
  }

  /* ------------------------------------------------------------------
     Drawing: targets
     ------------------------------------------------------------------ */
  function drawTarget(sh, yTable, now) {
    const { lay } = sceneInfo(), xT = lay.xT, type = sh ? sh.tgt.type : S.target, t = sh ? sh.tgt : null;
    ctx.fillStyle = '#1a201d'; ctx.fillRect(X(xT - 0.12), Y(yTable), (0.75) * cam.k, 3);
    if (type === 'pendulum') {
      const pivotY = PEND_L, px = xT + 0.03, bw = 0.06, bh = 0.045;
      const posts = [xT - 0.03, xT + 0.09];
      ctx.fillStyle = '#3a423d';
      for (const x of posts) ctx.fillRect(X(x) - 0.004 * cam.k, Y(pivotY + 0.02), 0.008 * cam.k, (pivotY + 0.02 - yTable) * cam.k);
      ctx.fillRect(X(posts[0]) - 0.004 * cam.k, Y(pivotY + 0.028), (posts[1] - posts[0] + 0.008) * cam.k, 0.01 * cam.k);
      const th = t ? t.th : 0;
      const cxB = px + PEND_L * Math.sin(th), cyB = pivotY - PEND_L * Math.cos(th);
      // height scale and the pointer that stays at the highest swing
      ctx.strokeStyle = 'rgba(230,236,230,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
      const sxs = X(posts[1] + 0.03);
      for (let i = 0; i <= 30; i++) { const yy = Y(i * 0.01); ctx.moveTo(sxs, yy); ctx.lineTo(sxs + (i % 5 ? 4 : 9), yy); }
      ctx.stroke();
      if (cam.k * 0.05 > 26) { ctx.fillStyle = 'rgba(230,236,230,0.6)'; ctx.font = '500 12px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; for (let i = 0; i <= 30; i += 10) ctx.fillText(i + ' cm', sxs + 12, Y(i * 0.01)); }
      if (t && t.hitAt !== null) {
        const hMax = PEND_L * (1 - Math.cos(t.maxTh));
        ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.moveTo(sxs - 2, Y(hMax)); ctx.lineTo(sxs - 10, Y(hMax) - 5); ctx.lineTo(sxs - 10, Y(hMax) + 5); ctx.closePath(); ctx.fill();
        pill(ctx, 'h = ' + (hMax * 100).toFixed(hMax < 0.1 ? 1 : 0) + ' cm', sxs + 44, Y(hMax) - 16, 'rgba(255,176,32,0.95)', '#2b1900', '600 13px "Barlow Condensed", "Arial Narrow", sans-serif');
      }
      ctx.strokeStyle = '#c9d1cb'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(px), Y(pivotY)); ctx.lineTo(X(cxB), Y(cyB + bh / 2)); ctx.stroke();
      ctx.save(); ctx.translate(X(cxB), Y(cyB)); ctx.rotate(-th);
      const gw = ctx.createLinearGradient(0, -bh * cam.k / 2, 0, bh * cam.k / 2); gw.addColorStop(0, '#c99a62'); gw.addColorStop(1, '#8a6238');
      ctx.fillStyle = gw; ctx.fillRect(-bw * cam.k / 2, -bh * cam.k / 2, bw * cam.k, bh * cam.k);
      ctx.strokeStyle = 'rgba(60,35,10,0.6)'; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { const yy = -bh * cam.k / 2 + i * bh * cam.k / 4; ctx.beginPath(); ctx.moveTo(-bw * cam.k / 2, yy); ctx.bezierCurveTo(-bw * cam.k / 6, yy + 2, bw * cam.k / 6, yy - 2, bw * cam.k / 2, yy); ctx.stroke(); }
      ctx.strokeStyle = '#000'; ctx.strokeRect(-bw * cam.k / 2, -bh * cam.k / 2, bw * cam.k, bh * cam.k);
      if (t && t.hitAt !== null && sh) { ctx.fillStyle = sh.kind === 'coil' ? '#9aa3aa' : '#d7dde2'; ctx.fillRect(-bw * cam.k / 2, -0.003 * cam.k, 0.008 * cam.k, 0.006 * cam.k); }
      ctx.restore();
      if (cam.k * 0.1 > 40) haloText(ctx, `ballistic pendulum, ${Math.round((t ? t.M : PEND_M[sh ? sh.kind : S.type]) * 1000)} g block`, X(px), Y(yTable) + 18, { font: '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#c9d2cb' });
    } else if (type === 'cans') {
      const cans = t ? t.cans : makeTarget({ set: { target: 'cans' }, lay, m: 0, v: 0 }).cans;
      for (const c of cans) {
        ctx.save(); ctx.translate(X(c.x), Y(yTable + c.y + CAN.h / 2)); ctx.rotate(-c.a);
        const w = CAN.w * cam.k, h = CAN.h * cam.k;
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#8e1c16'); g.addColorStop(0.35, '#e0473b'); g.addColorStop(0.6, '#c8352b'); g.addColorStop(1, '#6d140f');
        ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-w / 2, -h * 0.08, w, h * 0.16);
        const gm = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); gm.addColorStop(0, '#7d858b'); gm.addColorStop(0.4, '#e9eef0'); gm.addColorStop(1, '#6b7378');
        ctx.fillStyle = gm; ctx.fillRect(-w / 2, -h / 2, w, h * 0.07); ctx.fillRect(-w / 2, h / 2 - h * 0.07, w, h * 0.07);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
      if (cam.k * 0.1 > 40) haloText(ctx, `${cans.length} empty cans, ${Math.round(CAN.m * 1000)} g each`, X(xT + 0.1), Y(yTable) + 18, { font: '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#c9d2cb' });
    } else {
      const x0 = X(xT), w = 0.14 * cam.k, h = 0.1 * cam.k, y0 = Y(yTable + 0.1);
      ctx.fillStyle = '#5a4128'; ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 4);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#e2c68e'); g.addColorStop(1, '#b4935c');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
      if (t && t.hitAt !== null) { ctx.fillStyle = '#5c4a2c'; ctx.beginPath(); ctx.ellipse(x0 + 2, Y(0), Math.max(2, t.depth * cam.k), Math.max(2, 0.004 * cam.k), 0, 0, TAU); ctx.fill(); }
      if (cam.k * 0.1 > 40) haloText(ctx, 'sand box (just stops it)', x0 + w / 2, Y(yTable) + 18, { font: '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: '#c9d2cb' });
    }
  }

  /* ------------------------------------------------------------------
     3-D view: the same bench seen at an angle. The camera follows the flat
     view's camera (breech while charging, the projectile in flight, then the
     target); drag to turn it. Field lines are the flat view's lines turned
     around the coil's axis.
     ------------------------------------------------------------------ */
  const STEEL = [168, 176, 184], COPPER = [201, 128, 63], BURNT = [42, 28, 20];
  const axisZ = () => { const { kind } = sceneInfo(); if (kind === 'coil') return (shot && shot.kind === 'coil' ? shot.r.geo : coilGeoNow()).a2 + 0.012; return ballLayout().r + 0.008; };
  function draw3D(now) {
    const sc = v3.scene, { kind, lay } = sceneInfo(), zA = axisZ(), Hs = H - TOP;
    const fz = 0.5 * Math.min(W * 0.85, Hs * 1.05) / Math.tan(sc.home.fov * Math.PI / 360), viewW = W / cam.k;
    ctx.save(); ctx.translate(0, TOP); ctx.beginPath(); ctx.rect(0, 0, W, Hs); ctx.clip();   // the scene lives below the overview strip
    if (v3.ride) sc.begin(ctx, W, Hs, rideCam(kind, lay, zA));
    else sc.begin(ctx, W, Hs, { target: [cam.x, 0, zA + cam.y * 0.6], dist: Math.max(0.03, viewW * ({ follow: 1.35, gun: 1.3, all: 1.15 }[cam.phase] || 1.0) * fz / W) });
    const xs0 = lay.xBreech - 0.35, xs1 = lay.xT + 0.7;
    sc.floor(0, xs0, xs1, -0.3, 0.3, { step: 0.1, rgb: [30, 38, 34], cx: cam.x, rx: Math.max(0.25, viewW * 0.6), ry: 0.25, lightA: 0.2 });
    if (kind === 'coil') coil3D(sc, now, zA); else balls3D(sc, now, zA);
    target3D(sc, now, zA);
    sc.end();
    ctx.restore();
  }
  // the ride camera: just behind and above the slug (or the moving ball), looking down the barrel
  function rideCam(kind, lay, zA) {
    if (shot && shot.kind === kind && shot.hit !== null) {     // after the hit: step back and watch the target from the side
      return { target: [lay.xT + 0.05, 0, zA + 0.1], yaw: -Math.PI / 2 - 0.45, pitch: 0.22, dist: 0.62, fov: 56, smooth: 0.25 };
    }
    let x;
    if (shot && shot.kind === kind) { const p = shot.posAt(shot.sim); x = Math.min(p.x, lay.xT + 0.02); }
    else x = kind === 'coil' ? coilLayout().xc[0] - GG.Lc / 2 + 0.005 - S.slugCm / 200 : ballLayout().xStart;
    const near = kind === 'coil' ? 0.085 : 0.06;
    return { target: [x + near * 0.45, 0, zA], yaw: Math.PI + 0.38, pitch: 0.2, dist: near, fov: 64, smooth: 0.05 };
  }
  function ruler3D(sc, x0, x1, y, z) {
    for (let i = Math.ceil(x0 * 100); i <= Math.floor(x1 * 100); i++) {
      const major = i % 10 === 0, mid = i % 5 === 0, L = major ? 0.012 : mid ? 0.008 : 0.004;
      sc.line([i / 100, y, z], [i / 100, y + L, z], 'rgba(230,236,230,0.5)', 1);
      if (major) sc.label([i / 100, y - 0.012, z], i + ' cm', { color: 'rgba(230,236,230,0.7)', font: '500 11.5px "Barlow Condensed", "Arial Narrow", sans-serif' });
    }
  }
  function coil3D(sc, now, zA) {
    const sh = shot && shot.kind === 'coil' ? shot : null;
    const geo = sh ? sh.r.geo : coilGeoNow(), lay = sh ? sh.lay : coilLayout();
    const stages = lay.xc.length, set = sh ? sh.set : S, t = sh ? sh.sim : 0, p = sh ? sh.posAt(t) : null;
    const Ls = sh ? sh.r.Ls : S.slugCm / 100, d = GG.slugD;
    const sx = p ? p.x : lay.xc[0] - GG.Lc / 2 + 0.005 - Ls / 2;
    const Inow = p && p.I && p.I.length ? p.I : new Array(stages).fill(0), I0 = sh ? sh.r.I0 : S.current;
    // base board with a ruler
    const bx0 = lay.xBreech - 0.02, bx1 = lay.muzzle + 0.09;
    sc.box([(bx0 + bx1) / 2, 0, 0.003], [(bx1 - bx0) / 2, 0.035, 0.003], { rgb: [45, 53, 48] });
    ruler3D(sc, bx0 + 0.005, bx1 - 0.005, -0.035, 0.0062);
    // supports under the barrel
    for (const x of [lay.xBreech + 0.01, lay.muzzle - 0.01]) sc.box([x, 0, (zA - RB_OUT) / 2 + 0.003], [0.004, 0.006, (zA - RB_OUT) / 2 - 0.003], { rgb: [60, 70, 66] });
    // field lines of the coils that carry current, turned around the axis
    if (!fieldLines) fieldLines = traceFieldLines();
    const s2 = GG.Lc / 2, a2u = (geo.a2 + 0.0015) / s2;
    for (let k = 0; k < stages; k++) {
      const fI = I0 > 0 ? Math.abs(Inow[k] || 0) / Math.max(I0, 1e-9) : 0;
      if (fI < 0.04) continue;
      const col = `rgba(179,166,255,${0.5 * fI})`, off = reduceMotion ? 0 : -now / 40;
      for (const phi of [0, Math.PI / 3, 2 * Math.PI / 3]) for (const sg of [1, -1]) for (const ln of fieldLines) {
        let run = [];
        const flush = () => { if (run.length > 1) sc.path(run, col, 1.2, { dash: [3, 4], dashOff: off, chunk: 14 }); run = []; };
        for (let i = 0; i < ln.length; i += 2) {
          const [u, v] = ln[i];
          if (Math.abs(u) < 1 && Math.abs(v) < a2u) { flush(); continue; }
          run.push([lay.xc[k] + u * s2, sg * v * s2 * Math.cos(phi), zA + sg * v * s2 * Math.sin(phi)]);
        }
        flush();
      }
    }
    // barrel: a clear plastic tube
    sc.cyl([lay.xBreech, 0, zA], [lay.muzzle, 0, zA], RB_OUT, { rgb: [200, 225, 235], a: 0.14, spec: 0.6, shin: 40, open: true, noCull: true }, 20);
    sc.cyl([lay.xBreech - 0.006, 0, zA], [lay.xBreech, 0, zA], RB_OUT + 0.002, { rgb: [59, 69, 64] }, 16);
    // coils: copper windings on bobbins
    for (let k = 0; k < stages; k++) {
      const xc = lay.xc[k], fI = I0 > 0 ? clamp(Math.abs(Inow[k] || 0) / I0, 0, 1) : 0, dead = burnt[k], T = coilT[k];
      const hot = clamp((T - 60) / 120, 0, 1);
      sc.shadow([xc, 0, 0.0005], GG.Lc * 0.75, geo.a2 * 1.3, 0.5);
      sc.tube([xc - GG.Lc / 2, 0, zA], [xc + GG.Lc / 2, 0, zA], geo.a1, geo.a2, { rgb: dead ? BURNT : COPPER, amb: 0.45, spec: dead ? 0.05 : 0.5, shin: 30, emit: !dead && fI > 0.02 ? '255,140,40' : !dead && hot > 0 ? '255,60,20' : null, emitA: !dead && fI > 0.02 ? 0.55 * fI : 0.5 * hot, noInner: true }, 40);
      for (let j = 1; j < 6; j++) sc.circle([xc - GG.Lc / 2 + GG.Lc * j / 6, 0, zA], [1, 0, 0], geo.a2 + 0.0003, dead ? 'rgba(10,6,4,0.6)' : 'rgba(90,44,14,0.55)', 1, {}, 28);
      for (const ex of [xc - GG.Lc / 2 - 0.0015, xc + GG.Lc / 2]) sc.tube([ex, 0, zA], [ex + 0.0015, 0, zA], RB_OUT, geo.a2 + 0.002, { rgb: [32, 38, 42], noInner: true }, 28);
      if (fI > 0.05 && !dead) sc.glow([xc, 0, zA + geo.a2 + 0.012], 0.012, '255,176,32', 0.9);
      sc.label([xc, 0, zA + geo.a2 + 0.022], dead ? `coil ${k + 1}: burnt` : `coil ${k + 1}`, { color: dead ? '#ff8a7a' : '#e8c8a8' });
      if (dead && Math.random() < 0.25 && !reduceMotion) { const q = sc.project([xc, 0, zA + geo.a2]); if (q) fx.puff(q.x, q.y + TOP, 1, { shade: 60 }); }
      // where this coil switches off
      const cutC = sh ? sh.r.st[k].cutoff : set.cutoff, xo = xc + clamp(cutC, -1.4, 1.4) * GG.Lc / 2;
      sc.line([xo, 0, zA + RB_OUT], [xo, 0, zA + geo.a2 + 0.006], 'rgba(255,176,32,0.85)', 1.2, { dash: [3, 3] });
      sc.sphere([xo, 0, zA + geo.a2 + 0.007], 0.0018, [255, 176, 32], { flat: true });
      if (k > 0) gate3D(sc, xc - GG.Lc / 2 - GG.lead, sx, Ls, zA, false);
    }
    // the slug: a steel or iron cylinder, its ends tinted when it is magnetised
    const slug = (x, M, Ms) => {
      const mat = sh ? sh.r.mat : SLUGS[S.material], rgb = CL.hexRGB(mat.color).split(',').map(Number), fM = Ms > 0 ? clamp(Math.abs(M) / Ms, 0, 1) : 0, north = M >= 0;
      const tint = (c, a) => rgb.map((v, i) => v + (c[i] - v) * a);
      sc.cyl([x - Ls / 2, 0, zA], [x + Ls / 2, 0, zA], d / 2, { rgb, spec: 0.65, shin: 36, capRgb: fM > 0.03 ? tint(north ? [62, 126, 230] : [229, 72, 63], 0.7 * fM) : rgb, capRgb2: fM > 0.03 ? tint(north ? [229, 72, 63] : [62, 126, 230], 0.7 * fM) : rgb }, 18);
      if (sh && sh.fired && t > sh.r.tEnd && (sh.tHit === null || t < sh.tHit)) sc.line([x - Ls / 2 - clamp(sh.v * 0.0009, 0.005, 0.06), 0, zA], [x - Ls / 2, 0, zA], 'rgba(255,220,170,0.5)', Math.max(2, d * 0.6 * (sc.f / sc.dist)), {});
    };
    if (!sh || sh.hit === null) slug(sx, p ? p.M : 0, sh ? sh.r.Ms : 1);   // after the hit it is buried in the target
    // chronograph: two gates and a box with a glowing display
    const g1 = lay.muzzle + 0.02, g2 = lay.muzzle + 0.07;
    gate3D(sc, g1, sx, Ls, zA, true); gate3D(sc, g2, sx, Ls, zA, true);
    chrono3D(sc, g1, g2, zA + RB_OUT + 0.014, sh, t);
    if (!sh) {
      sc.label([sx, 0, zA + d / 2 + 0.014], 'iron slug', { color: '#dfe6df' });
      sc.label([lay.xc[0], -geo.a2, zA - geo.a2 - 0.01], 'copper coil (an electromagnet)', { color: '#dfe6df' });
      sc.label([(lay.xBreech + lay.xc[0]) / 2, 0, zA - RB_OUT - 0.008], 'plastic barrel', { color: '#c9d2cb' });
    }
  }
  function gate3D(sc, xg, sx, Ls, zA, chrono) {
    const blocked = sx - Ls / 2 <= xg && sx + Ls / 2 >= xg, y0 = RB_OUT + 0.0015, sz = 0.003;
    sc.box([xg, 0, zA + y0 + sz / 2], [sz / 2, sz / 2, sz / 2], { rgb: [22, 26, 24] });
    sc.box([xg, 0, zA - y0 - sz / 2], [sz / 2, sz / 2, sz / 2], { rgb: [22, 26, 24] });
    if (!blocked) sc.line([xg, 0, zA + y0], [xg, 0, zA - y0], chrono ? 'rgba(255,80,60,0.7)' : 'rgba(255,60,60,0.6)', 1.2);
    if (blocked) sc.glow([xg, 0, zA + y0 + sz + 0.002], 0.006, '95,211,141', 0.95);
  }
  function chrono3D(sc, g1, g2, zb, sh, t) {
    const w = g2 - g1 + 0.016, hgt = 0.018, dep = 0.02, c = [(g1 + g2) / 2, 0, zb + hgt / 2 + 0.004];
    for (const gx of [g1, g2]) sc.box([gx, 0, zb + 0.002], [0.0015, 0.0015, 0.002], { rgb: [90, 100, 94] });
    sc.box(c, [w / 2, dep / 2, hgt / 2], { rgb: [35, 42, 38] });
    const cr = sh && sh.chrono && t >= sh.chrono.t2 ? (0.05 / (sh.chrono.t2 - sh.chrono.t1)) : null;
    sc.custom([c[0], -dep / 2 - 0.0005, c[2]], (cx, x, y, k) => {
      const ww = w * k * 0.92, hh = hgt * k * 0.7; if (ww < 30) return;
      cx.fillStyle = '#0c0907'; cx.fillRect(x - ww / 2, y - hh / 2, ww, hh);
      cx.font = `300 ${clamp(hh * 0.75, 9, 28)}px "Barlow Condensed", "Arial Narrow", sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.shadowColor = 'rgba(255,110,20,0.9)'; cx.shadowBlur = 10; cx.fillStyle = '#ffcf9e'; cx.fillText(cr ? pl(cr, 3) + ' m/s' : '- - -', x, y);
    }, { bias: -0.001 });
    sc.label([c[0], 0, zb + hgt + 0.012], 'chronograph', { color: '#b9c4bb' });
  }
  function balls3D(sc, now, zA) {
    const sh = shot && shot.kind === 'balls' ? shot : null;
    const lay = sh ? sh.lay : ballLayout(), r = lay.r, k = sh ? sh.set.behind : S.behind, t = sh ? sh.sim : 0;
    // aluminium channel: a base and two low walls
    const tx0 = lay.xBreech, tx1 = lay.muzzle + 0.02, cxm = (tx0 + tx1) / 2, hl = (tx1 - tx0) / 2;
    sc.box([cxm, 0, 0.004], [hl, r * 1.4, 0.004], { rgb: [150, 158, 164] });
    for (const sg of [1, -1]) sc.box([cxm, sg * r * 1.25, 0.008 + r * 0.45], [hl, r * 0.15, r * 0.45], { rgb: [176, 184, 190] });
    ruler3D(sc, tx0 + 0.005, tx1 - 0.005, -r * 1.4 - 0.001, 0.0082);
    const ball = (x, glow) => { sc.sphere([x, 0, zA], r, STEEL); if (glow) sc.glow([x, 0, zA], r * 2.6, '255,220,160', 0.5 * glow); };
    const impacted = j => sh && sh.impacts.some(im => im.j === j && t >= im.t);
    for (let j = 0; j < lay.mags.length; j++) {
      const xm = lay.mags[j], hit = impacted(j), stuck = sh && sh.stopAt === j;
      sc.shadow([xm + r, 0, 0.0085], r * 1.6, r * 1.3, 0.45);
      sc.cyl([xm, 0, zA], [xm + 2 * r, 0, zA], r, { rgb: [196, 202, 208], spec: 0.7, shin: 40, capRgb: [229, 72, 63], capRgb2: [62, 126, 230] }, 22);
      lay.chain[j].forEach((xb, i) => { if (i === k - 1 && hit && !stuck) return; ball(xb, 0); });
      if (hit) { const im = sh.impacts.find(q => q.j === j); const age = (t - im.t) / Math.max(1e-4, sh.segs[0].dur * 0.1); ball(xm - r, age < 1 ? 1 - age : 0); }
      sc.label([xm + r, 0, zA + r + 0.012], `stage ${j + 1}`, { color: '#c9d2cb' });
    }
    if (sh) {
      const p = sh.posAt(t), moving = !(sh.stopAt !== null && p.seg === sh.segs.length - 1 && t >= sh.segs[sh.segs.length - 1].t1), atT = sh.tHit !== null && t >= sh.tHit;
      if (moving && !atT) ball(p.x, 0);
    } else ball(lay.xStart, 0);
    const g1 = lay.muzzle + 0.02, g2 = lay.muzzle + 0.07;
    for (const gx of [g1, g2]) sc.line([gx, 0, zA + r + 0.003], [gx, 0, zA - r], 'rgba(255,80,60,0.6)', 1.2);
    chrono3D(sc, g1, g2, zA + r + 0.006, sh, t);
    if (!sh) {
      sc.label([lay.xStart, 0, zA + r + 0.014], 'rolling ball', { color: '#dfe6df' });
      sc.label([lay.mags[0] + r, -r, zA - r - 0.012], 'neodymium magnet (N red, S blue)', { color: '#dfe6df' });
    }
  }
  function target3D(sc, now, zA) {
    const sh = shot, { lay } = sceneInfo(), xT = lay.xT, type = sh ? sh.tgt.type : S.target, tg = sh ? sh.tgt : null;
    if (type === 'pendulum') {
      const pv = [xT + 0.03, 0, zA + PEND_L], th = tg ? tg.th : 0;
      for (const sg of [1, -1]) sc.box([pv[0], sg * 0.06, (pv[2] + 0.02) / 2], [0.004, 0.004, (pv[2] + 0.02) / 2], { rgb: [58, 66, 61] });
      sc.box([pv[0], 0, pv[2] + 0.024], [0.004, 0.064, 0.004], { rgb: [58, 66, 61] });
      const ux = [Math.cos(th), 0, Math.sin(th)], uz = [-Math.sin(th), 0, Math.cos(th)];
      const bc = [pv[0] + PEND_L * Math.sin(th), 0, pv[2] - PEND_L * Math.cos(th)];
      for (const sg of [1, -1]) sc.line([pv[0], sg * 0.018, pv[2]], [bc[0] + uz[0] * 0.0225, sg * 0.018, bc[2] + uz[2] * 0.0225], '#c9d1cb', 1.1);
      sc.shadow([bc[0], 0, 0.0005], 0.05, 0.04, clamp(0.55 - (bc[2] - zA) * 2, 0.15, 0.55));
      sc.box(bc, [0.03, 0.025, 0.0225], { rgb: [190, 146, 96], spec: 0.08 }, [ux, [0, 1, 0], uz]);
      // height scale and the pointer that stays at the highest swing
      const xs = pv[0] + 0.1;
      sc.box([xs, 0.05, zA + 0.16], [0.002, 0.002, 0.16], { rgb: [80, 90, 84] });
      for (let i = 0; i <= 30; i += 5) { sc.line([xs, 0.05, zA + i * 0.01], [xs + (i % 10 ? 0.008 : 0.016), 0.05, zA + i * 0.01], 'rgba(230,236,230,0.5)', 1); if (i % 10 === 0) sc.label([xs + 0.03, 0.05, zA + i * 0.01], i + ' cm', { color: 'rgba(230,236,230,0.7)', font: '500 11.5px "Barlow Condensed", "Arial Narrow", sans-serif' }); }
      if (tg && tg.hitAt !== null) { const hMax = PEND_L * (1 - Math.cos(tg.maxTh)); sc.label([xs, 0.05, zA + hMax], 'h = ' + (hMax * 100).toFixed(hMax < 0.1 ? 1 : 0) + ' cm', { pill: 'rgba(255,176,32,0.95)', fg: '#2b1900', dx: 44 }); }
      sc.label([pv[0], -0.07, 0.004], `ballistic pendulum, ${Math.round((tg ? tg.M : PEND_M[sh ? sh.kind : S.type]) * 1000)} g block`, { color: '#c9d2cb' });
    } else if (type === 'cans') {
      const cans = tg ? tg.cans : makeTarget({ set: { target: 'cans' }, lay, m: 0, v: 0 }).cans;
      for (const c of cans) {
        const ax = [-Math.sin(c.a), 0, Math.cos(c.a)], ctr = [c.x, 0, c.y + CAN.h / 2];
        const p0 = [ctr[0] - ax[0] * CAN.h / 2, 0, ctr[2] - ax[2] * CAN.h / 2], p1 = [ctr[0] + ax[0] * CAN.h / 2, 0, ctr[2] + ax[2] * CAN.h / 2];
        sc.cyl(p0, p1, CAN.w / 2, { rgb: [214, 60, 48], capRgb: [200, 206, 210] }, 18);
        sc.circle(ctr, ax, CAN.w / 2 + 0.0005, 'rgba(255,255,255,0.85)', Math.max(1.5, 0.018 * sc.f / sc.dist * 0.6), {}, 24);
      }
      sc.label([xT + 0.1, -0.06, 0.004], `${cans.length} empty cans, ${Math.round(CAN.m * 1000)} g each`, { color: '#c9d2cb' });
    } else {
      sc.box([xT + 0.07, 0, 0.05], [0.074, 0.074, 0.05], { rgb: [90, 65, 40] });
      sc.box([xT + 0.07, 0, 0.0505], [0.07, 0.07, 0.05], { rgb: [226, 198, 142] }, null);
      if (tg && tg.hitAt !== null) sc.custom([xT - 0.0045, 0, zA], (cx, x, y, k) => { cx.fillStyle = '#5c4a2c'; cx.beginPath(); cx.ellipse(x, y, Math.max(2, 0.004 * k), Math.max(2, tg.depth * k * 0.5), 0, 0, TAU); cx.fill(); });
      sc.label([xT + 0.07, -0.08, 0.004], 'sand box (just stops it)', { color: '#c9d2cb' });
    }
    // the slug or ball after it left the barrel
    if (sh && sh.tHit !== null && sh.sim < sh.tHit) {
      const p = sh.posAt(sh.sim);
      if (sh.kind === 'coil' && p.x > lay.muzzle) {
        const Ls = sh.r.Ls, d = GG.slugD, rgb = CL.hexRGB(sh.r.mat.color).split(',').map(Number);
        sc.cyl([p.x - Ls / 2, 0, zA], [p.x + Ls / 2, 0, zA], d / 2, { rgb }, 18);
      }
    }
  }

  function drawOverview(now) {
    const { kind, lay } = sceneInfo();
    const x0 = lay.xBreech - 0.03, x1 = lay.xT + 0.4, pad = 12, w = W - 2 * pad, km = w / (x1 - x0), y = 26;
    const MX = x => pad + (x - x0) * km;
    ctx.fillStyle = 'rgba(10,13,11,0.82)'; ctx.fillRect(pad - 6, 6, w + 12, TOP - 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.strokeRect(pad - 5.5, 6.5, w + 11, TOP - 13);
    ctx.strokeStyle = 'rgba(220,235,240,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(MX(lay.xBreech), y); ctx.lineTo(MX(lay.muzzle), y); ctx.stroke();
    if (kind === 'coil') {
      const sh = shot && shot.kind === 'coil' ? shot : null, p = sh ? sh.posAt(sh.sim) : null, I0 = sh ? sh.r.I0 : 0;
      lay.xc.forEach((xc, k) => { const on = p && p.I && I0 > 0 && Math.abs(p.I[k] || 0) / I0 > 0.05; ctx.fillStyle = burnt[k] ? '#3a1d14' : on ? '#ffb020' : '#a8662f'; ctx.fillRect(MX(xc - GG.Lc / 2), y - 7, GG.Lc * km, 14); });
    } else lay.mags.forEach(xm => { ctx.fillStyle = '#b9c0c6'; ctx.fillRect(MX(xm), y - 4, Math.max(2, 2 * lay.r * km), 8); });
    ctx.fillStyle = '#8a6238'; ctx.fillRect(MX(lay.xT), y - 10, 0.06 * km + 2, 16);
    if (shot) { const p = shot.posAt(shot.sim); ctx.fillStyle = '#ffcf9e'; ctx.beginPath(); ctx.arc(MX(Math.min(p.x, lay.xT)), y, 3.5, 0, TAU); ctx.fill(); }
    const v0 = cam.x - W / 2 / cam.k, v1 = cam.x + W / 2 / cam.k;
    ctx.strokeStyle = 'rgba(255,176,32,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(clamp(MX(v0), pad - 4, pad + w), 9.5, clamp(MX(v1), pad - 4, pad + w + 4) - clamp(MX(v0), pad - 4, pad + w), TOP - 19);
    ctx.fillStyle = 'rgba(200,210,202,0.7)'; ctx.font = '500 12px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('target', MX(lay.xT) - 4, y + 11);
  }

  function draw(now) {
    const { ctx: c } = fitCanvas(cv, W, H); ctx = c;
    ctx.clearRect(0, 0, W, H);
    CL.screenBg(ctx, W, H, { grid: 0 });
    const { kind } = sceneInfo();
    if (v3 && v3.on) draw3D(now);
    else if (kind === 'coil') drawCoilGun(now); else drawBallGun(now);
    fx.draw(ctx, W, H);
    drawOverview(now);
    if (charging) {
      const f = clamp(charging.t / charging.dur, 0, 1);
      ctx.fillStyle = `rgba(255,176,32,${0.05 + 0.1 * f})`; ctx.fillRect(0, TOP, W, H - TOP);
    }
  }

  /* ------------------------------------------------------------------
     Loop
     ------------------------------------------------------------------ */
  function frame(now, dt) {
    if (!active) return;
    for (let k = 0; k < coilT.length; k++) if (coilT[k] > T_ROOM + 0.01) coilT[k] = T_ROOM + (coilT[k] - T_ROOM) * Math.exp(-dt / T_COOL);
    if (charging) {
      charging.t += dt;
      $('#ggCharge').style.width = (clamp(charging.t / charging.dur, 0, 1) * 100).toFixed(1) + '%';
      $('#ggChargeLabel').textContent = 'Charging the capacitors';
      if (charging.t >= charging.dur) { charging = null; $('#ggFire').classList.remove('is-down'); $('#ggCharge').style.width = '0%'; $('#ggChargeLabel').textContent = 'Discharging'; startShot(); }
    }
    if (shot && !shot.done) stepShot(dt);
    if (S.rapid && S.type === 'coil' && !charging && (!shot || shot.done || (shot.hit !== null && shot.post > 0.25))) {
      rapidT += dt; if (rapidT > 0.35) { rapidT = 0; fire(); }
    } else rapidT = 0;
    fx.update(dt); shake.update(now);
    updateCam(dt);
    updateLetterbox();
    draw(now);
    if (now - lastPanel > 200) { lastPanel = now; updateHeat(); updateStatus(); if (dataDirty) { renderData(); dataDirty = false; } if (graphDirty) { drawGraphs(); graphDirty = false; } }
  }
  function stepShot(dt) {
    const sh = shot;
    let scale = SPEEDS[sh.set.speed];
    // the first ball's gentle roll towards the first magnet is fast-forwarded
    if (sh.kind === 'balls' && scale < 1 && sh.hit === null) { const p0 = sh.posAt(sh.sim); if (p0.seg === 0) scale *= clamp(1.5 / Math.max(p0.v, 0.02), 1, 30); }
    const before = sh.sim;
    if (sh.hit === null) {
      sh.sim += dt * scale;
      if (sh.tHit !== null && sh.sim >= sh.tHit) { sh.sim = sh.tHit; hitTarget(sh); }
    } else { sh.post += dt; updateTarget(sh, dt); }
    // events during this frame
    if (sh.kind === 'coil') {
      const ev = sh.r.events;
      while (sh.evI < ev.length && ev[sh.evI].t <= sh.sim) {
        const q = ev[sh.evI++];
        if (q.type === 'on' && q.k > 0) audio.thunk(0.35 + 0.08 * q.k);
        if (q.type === 'on' && sh.set.speed !== 'real') { const p = toScreen(sh.lay.xc[q.k], sh.r.geo.a2); fx.burst(p.x, p.y, 4, { speed: 60, life: 0.3, colors: ['255,200,120'] }); }
      }
      if (before < sh.r.tEnd && sh.sim >= sh.r.tEnd && sh.fired) { audio.whoosh(); }
    } else {
      for (const im of sh.impacts) if (before < im.t && sh.sim >= im.t) {
        audio.clack(1); const p = toScreen(sh.lay.mags[im.j], 0); fx.ring(p.x, p.y, { speed: 160, life: 0.35, color: '255,240,220', width: 2 }); fx.burst(p.x, p.y, 10, { speed: 160, life: 0.35, colors: ['255,255,255', '255,220,160'] }); shake.kick(1.5, 0.12);
      }
    }
    const tEnd = sh.tHit !== null ? sh.tHit : sh.tEndBarrel + 0.002;
    const settled = sh.hit !== null ? sh.post > (sh.tgt.type === 'pendulum' ? 3.2 : 1.6) : sh.sim >= tEnd;
    if (settled && !sh.done) finishShot(sh);
    updateLetterbox();
  }
  function finishShot(sh) {
    sh.done = true;
    $('#ggReplay').disabled = false;
    $('#ggChargeLabel').textContent = S.type === 'coil' ? 'Ready to charge' : 'Ready';
    book(sh);
    dataDirty = graphDirty = true;
    renderData(); drawGraphs();
  }
  function book(sh) { if (sh.evDone) return; sh.evDone = true; checkMissions(sh); }
  function missionDone(id) { const m = missions.complete(id); if (m) toast($('#ggToast'), `<b>Mission complete: ${m.title}</b>`, '', 5000); renderMissions(); }
  function checkMissions(sh) {
    if (sh.kind === 'coil') {
      if (sh.fired && sh.v >= 10) missionDone('gg-10');
      if (sh.set.cutoff >= 0.5 && sh.r.st.some(s => s.suck)) missionDone('gg-suck');
      if (sh.set.material === 'aluminium') missionDone('gg-alu');
    } else if (sh.fired && sh.v > 5) missionDone('gg-balls');
  }

  /* ------------------------------------------------------------------
     Status line, letterbox, narration
     ------------------------------------------------------------------ */
  function updateLetterbox() {
    const lb = $('#ggLetterbox'); if (!lb) return;
    const on = !!(shot && !shot.done && shot.set.speed === 'bullet' && shot.hit === null);
    lb.classList.toggle('is-on', !!on);
    if (on) { const p = shot.posAt(shot.sim); $('#ggLbInfo').textContent = `t = ${si(shot.sim, 's', 3)}   v = ${pl(p.v, 3)} m/s`; }
  }
  function speedWords(v) {
    const L = [[1.4, 'a walking person'], [5, 'a jogger'], [10, 'a top sprinter'], [14, 'a car in town'], [30, 'a car on the motorway'], [45, 'a fast cricket bowl'], [70, 'a tennis serve'], [100, 'an arrow from a bow']];
    let w = 'a snail'; for (const [s, t] of L) if (v >= s * 0.9) w = t;
    return w;
  }
  function updateStatus() {
    const st = $('#ggStatus'); if (!st) return;
    let txt, cls = '';
    if (charging) { txt = 'Charging the capacitors…'; cls = 'is-warn'; }
    else if (!shot) txt = S.type === 'coil' ? `Ready: ${S.stages} coils, ${S.turns} turns, ${pl(S.current, 3)} A` : `Ready: ${S.bstages} magnets, ${S.behind} balls behind each`;
    else if (!shot.done) {
      const p = shot.posAt(shot.sim);
      if (shot.hit !== null) txt = 'Hit the target'; else if (shot.kind === 'coil') {
        const on = shot.r.st.filter((s, k) => p.I && Math.abs(p.I[k] || 0) > 0.05 * shot.r.I0).map(s => s.k + 1);
        txt = p.x > shot.lay.muzzle ? `Out of the barrel: ${pl(p.v, 3)} m/s` : on.length ? `Coil ${on.join(' and ')} on: ${pl(p.v, 3)} m/s` : `Coasting: ${pl(p.v, 3)} m/s`;
      } else txt = `Ball moving at ${pl(p.v, 3)} m/s`;
      cls = 'is-run';
    } else if (!shot.fired) { txt = shot.kind === 'coil' ? (shot.r.status === 'stuck' ? 'The slug did not leave the barrel' : 'The slug went backwards') : 'Stuck: the last ball is held by the magnet'; cls = 'is-bad'; }
    else { txt = `Fired: ${pl(shot.v, 3)} m/s (${pl(shot.v * 3.6, 3)} km/h)`; cls = 'is-good'; }
    if (st.textContent !== txt) st.textContent = txt;
    st.className = 'hud hud-status ' + cls;
    narrate();
  }
  function narrate() {
    const el = $('#ggNarrateX'); if (!el || !document.body.classList.contains('is-beginner')) return;
    let h;
    if (S.type === 'coil') {
      if (!shot || shot.kind !== 'coil') h = 'This is a <b>coil gun</b>. Each copper coil becomes an electromagnet when current flows through it. Press <b>Fire</b>: the first coil pulls the iron slug in, then switches off just as the slug reaches its middle, so the slug keeps sliding on to the next coil. Every coil adds a push.';
      else if (!shot.done && shot.hit === null) {
        const p = shot.posAt(shot.sim), on = shot.r.st.filter((s, k) => p.I && Math.abs(p.I[k] || 0) > 0.05 * shot.r.I0);
        h = p.x > shot.lay.muzzle ? `The slug has left the barrel at <b>${pl(p.v, 3)} m/s</b> and is flying to the target.` : on.length ? `Coil ${on.map(s => s.k + 1).join(' and ')} is <b>on</b>: it has turned the slug into a magnet (see the N and S on its ends) and is pulling it towards the coil's middle.` : 'All coils are off: the slug is <b>coasting</b> to the next light gate, which will switch on the next coil.';
      } else {
        const r = shot.r;
        if (!shot.fired) h = r.mat.key === 'aluminium' ? '<b>Nothing happened</b>: aluminium is not magnetic, so the coils cannot turn it into a magnet and have nothing to pull on. (Real "induction" coil guns can push aluminium using eddy currents, but this is a reluctance coil gun.)' : 'The slug <b>stopped inside the barrel</b>. Try more current, more turns, or switching the coils off earlier.';
        else {
          const best = r.st.reduce((a, s) => (s.gain || 0) > (a.gain || 0) ? s : a, r.st[0]);
          const sucked = r.st.filter(s => s.suck && s.gain < 0.98 * (best.gain || 1));
          h = `The slug left at <b>${pl(shot.v, 3)} m/s</b> (${pl(shot.v * 3.6, 3)} km/h), about as fast as ${speedWords(shot.v)}. Coil ${best.k + 1} added the most speed (${pl(best.gain, 2)} m/s).`;
          if (shot.set.cutoff > 0.2) h += ` Because the coils switched off <em>after</em> the middle, they pulled the slug back as it left (<b>suck-back</b>) and wasted speed.`;
          else if (sucked.length) h += ` Coil ${sucked[0].k + 1} pulled back a little as the slug left (suck-back).`;
          h += ` Only about <b>${pct(r.eff, 2)}</b> of the electrical energy ended up as motion; most became heat in the copper.`;
          if (shot.tgt.type === 'pendulum') h += ` The pendulum swung up <b>${pl(shot.tgt.h * 100, 3)} cm</b>: that height alone tells you the speed (Full detail shows how).`;
        }
      }
    } else {
      if (!shot || shot.kind !== 'balls') h = 'This is the <b>magnet-and-ball Gauss rifle</b>: no electricity at all. Each magnet has steel balls stuck to its far side. A rolling ball is pulled in hard and slams into the magnet; the bump passes through, and the <b>last ball flies off</b>, because it sits far from the magnet and is only weakly held.';
      else if (!shot.done) h = 'Watch each impact: the incoming ball sticks to the magnet, and the ball at the far end shoots off a little faster than the one that came in.';
      else if (!shot.fired) h = '<b>Stuck!</b> With only one ball behind the magnet, the last ball touches the magnet and is held as tightly as the incoming ball was pulled in, so the bump cannot free it. Use two or more balls.';
      else h = `The last ball left at <b>${pl(shot.v, 3)} m/s</b>. Each stage added <b>less</b> speed than the one before (${shot.res.stages.map(s => '+' + pl(s.gain, 2)).join(', ')} m/s), because a bump always wastes a fraction of the energy, and the faster the ball, the more that fraction is.`;
    }
    if (el.innerHTML !== h) el.innerHTML = h;
  }

  /* ------------------------------------------------------------------
     Readouts, verbose data and graphs
     ------------------------------------------------------------------ */
  const kmh = v => pl(v * 3.6, 3) + ' km/h';
  function setTile(id, val, sub) { const a = $('#' + id), b = $('#' + id + 'S'); if (a && a.textContent !== val) a.textContent = val; if (b && b.textContent !== sub) b.textContent = sub; }
  function setLbl(a, b) { const x = $('#ggTeL'), y = $('#ggTfL'); if (x.textContent !== a) x.textContent = a; if (y.textContent !== b) y.textContent = b; }
  function renderTiles() {
    const sh = shot && shot.done ? shot : null;
    if (!sh) {
      setLbl(S.type === 'coil' ? 'Efficiency' : 'Stages', S.type === 'coil' ? 'Strongest pull' : 'Magnet well depth'); setTile('ggTv', '—', 'press Fire'); setTile('ggTk', '—', ' '); setTile('ggTe', '—', ' '); setTile('ggTf', '—', ' '); return; }
    const K = 0.5 * sh.m * sh.v * sh.v;
    setTile('ggTv', pl(sh.v, 3) + ' m/s', kmh(sh.v));
    setTile('ggTk', si(K, 'J', 3), 'p = ' + pl(sh.m * sh.v, 3) + ' kg·m/s');
    if (sh.kind === 'coil') {
      setLbl('Efficiency', 'Strongest pull');
      setTile('ggTe', pct(sh.r.eff, 2), 'of ' + si(sh.r.Ein, 'J', 3) + ' used');
      setTile('ggTf', pl(sh.r.Fpk, 3) + ' N', pl(sh.r.Fpk / (sh.m * C.g), 3) + ' × its weight');
    } else {
      setLbl('Stages', 'Magnet well depth');
      setTile('ggTe', String(sh.res.stages.length), `${sh.res.k} balls behind each magnet`);
      setTile('ggTf', si(sh.res.Uc, 'J', 3), 'magnet well depth U꜀');
    }
  }
  const row = (label, val, sub, work, cls = '') => `<div class="drow${cls ? ' is-' + cls : ''}"><div class="drow-head"><span class="drow-label">${label}</span><span class="drow-val">${val}</span></div>${sub ? `<div class="drow-sub">${sub}</div>` : ''}${work ? `<div class="drow-work">${work}</div>` : ''}</div>`;
  const sec = t => `<div class="dsec">${t}</div>`;
  const expert = html => `<div data-level="expert">${html}</div>`;
  function renderData() {
    renderTiles();
    const body = $('#ggDataBody'); if (!body) return;
    const tabs = $$('#ggData .tabs button');
    const names = S.type === 'coil' ? { shot: 'This shot', stages: 'Stage by stage', coil: 'The coils' } : { shot: 'This shot', stages: 'Stage by stage', coil: 'How it works' };
    tabs.forEach(b => { b.textContent = names[b.dataset.tab]; b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)); });
    $('#ggData').classList.toggle('no-working', !S.working);
    let h = '';
    const sh = shot && shot.done && shot.kind === (S.type === 'coil' ? 'coil' : 'balls') ? shot : null;
    if (S.type === 'coil') h = S.tab === 'coil' ? coilRows(sh) : S.tab === 'stages' ? stageRows(sh) : shotRows(sh);
    else h = S.tab === 'coil' ? ballHowRows() : S.tab === 'stages' ? ballStageRows(sh) : ballShotRows(sh);
    body.innerHTML = h;
  }
  function shotRows(sh) {
    if (!sh) return `<p class="hint">Press <b>Fire</b> (or the space bar). Every number from the shot appears here, with the physics behind it.</p>` + coilPreviewRows();
    const r = sh.r, v = sh.v, m = sh.m, K = 0.5 * m * v * v;
    let h = sec('The result');
    if (!sh.fired) h += row('Outcome', r.status === 'stuck' ? 'stuck in the barrel' : 'went backwards', r.mat.key === 'aluminium' ? `Aluminium is not ferromagnetic: its susceptibility is only about ${e(r.mat.chi, 2)}, so the coil can barely magnetise it. The pull was at most ${si(Math.max(r.Fpk, 1e-12), 'N', 2)}, far less than the friction ${si(GG.mu * m * C.g, 'N', 2)}.` : 'The pull was not enough to get the slug through. More current, more turns or an earlier switch-off point help.', '', 'bad');
    else {
      const ch = sh.chrono;
      h += row('Exit speed', `${pl(v, 4)} m/s`, `${kmh(v)}, about as fast as ${speedWords(v)}.`, ch ? `Chronograph: v = Δx / Δt = 0.0500 m / ${si(ch.t2 - ch.t1, 's', 4)} = ${pl(0.05 / (ch.t2 - ch.t1), 4)} m/s` : '', 'good');
      h += row('Kinetic energy', si(K, 'J', 4), `Enough to lift a 1 kg book by ${len3(K / C.g)}.`, `K = ½mv² = ½ × ${pl(m * 1000, 4)} g × (${pl(v, 4)} m/s)² = ${si(K, 'J', 4)}`);
      h += row('Momentum', `${pl(m * v, 4)} kg·m/s`, 'This is what a target feels: the pendulum and the cans are pushed by momentum.', `p = mv = ${e(m, 4)} kg × ${pl(v, 4)} m/s = ${pl(m * v, 4)} kg·m/s`);
      h += row('Efficiency', pct(r.eff, 3), `Only this fraction of the energy taken from the power supply ended up as motion. Most became heat in the copper (I²R). Real hobby coil guns usually manage only about 1 to 3 %: the model leaves out capacitor losses, eddy currents and hysteresis.`, `η = K / E<sub>in</sub> = ${si(K, 'J', 4)} / ${si(r.Ein, 'J', 4)} = ${pct(r.eff, 3)}`);
      if (sh.tgt && sh.tgt.type === 'pendulum') {
        const t = sh.tgt, vBack = (m + t.M) / m * Math.sqrt(2 * C.g * t.h);
        h += row('Pendulum swing', `${pl(t.h * 100, 3)} cm`, `The slug sticks in the ${Math.round(t.M * 1000)} g block, and momentum is conserved in the collision. The swing height then gives back the speed, which is how speeds were measured before electronic timers.${t.over ? ' The block swung right over the top.' : ''}`, `V = mv/(m + M) = ${pl(m * 1000, 3)} g × ${pl(v, 4)} m/s / ${pl((m + t.M) * 1000, 4)} g = ${pl(t.V, 4)} m/s<br>h = V²/(2g) = ${pl(t.h * 100, 4)} cm<br>Backwards: v = (m + M)/m × √(2gh) = ${pl(vBack, 4)} m/s`);
      } else if (sh.tgt && sh.tgt.type === 'cans') {
        const n = Math.min(6, Math.floor(0.5 * K / E_TOPPLE));
        h += row('Cans', `${pl(K, 3)} J delivered`, `Tipping one ${Math.round(CAN.m * 1000)} g can over needs only about ${si(E_TOPPLE, 'J', 2)} (its centre must rise ${pl((Math.hypot(CAN.h / 2, CAN.w / 2) - CAN.h / 2) * 1000, 2)} mm). How the cans tumble is illustrative.`, `E<sub>tip</sub> = mgΔh = ${CAN.m} kg × 9.81 m/s² × ${pl((Math.hypot(CAN.h / 2, CAN.w / 2) - CAN.h / 2) * 1000, 3)} mm = ${si(E_TOPPLE, 'J', 3)}; energy for about ${n} cans`);
      }
    }
    h += sec('Why the slug moves');
    h += row('Field in the middle of an empty coil', `${pl(r.B0, 3)} T`, `For comparison: a fridge magnet is about 0.005 T, a hospital MRI 1.5 to 3 T. More turns or more current give a stronger field.`, `B = μ₀ × H(0) = μ₀ × (${pl(PHYS.coilH1(r.geo, 0), 4)} A/m per ampere) × ${pl(r.I0, 4)} A = ${pl(r.B0, 4)} T`);
    h += row('How magnetised the slug got', r.mat.Bs > 0 ? `${Math.round(r.satMax * 100)} % of saturation` : 'almost not at all', r.mat.Bs > 0 ? `The coil's field lines up the tiny magnetic domains in the ${r.mat.name.toLowerCase()}, turning the slug into a magnet. ${r.satMax > 0.98 ? 'It is <b>saturated</b>: every domain already points the same way, so more current makes the coil stronger but the slug no stronger. That is why doubling the current does not double the speed.' : 'It is not saturated yet, so more current would magnetise it more.'}` : 'Aluminium has no magnetic domains to line up.',
      expert(`M = min(χ<sub>eff</sub>H̄, M<sub>s</sub>), χ<sub>eff</sub> = χ/(1 + N<sub>d</sub>χ) = ${pl(r.mat.chi, 3)}/(1 + ${pl(r.Nd, 3)} × ${pl(r.mat.chi, 3)}) = ${pl(r.chiEff, 3)}; M<sub>s</sub> = B<sub>s</sub>/μ₀ = ${e(r.Ms, 3)} A/m. N<sub>d</sub> is the demagnetising factor of a ${pl(r.Ls * 100, 2)} cm × ${pl(r.d * 1000, 2)} mm rod: a long thin rod is easier to magnetise along its length.`));
    h += row('Strongest pull', `${pl(r.Fpk, 3)} N`, `${pl(r.Fpk / (m * C.g), 3)} times the slug's own weight. The pull is strongest as the slug enters a coil, where the field changes fastest, and zero at the coil's middle.`, `F = μ₀ M A [H(front) − H(back)], A = π(${pl(r.d * 1000, 2)} mm)²/4 = ${e(r.A, 3)} m²`);
    if (r.Fmin < -0.02 * r.Fpk) h += row('Strongest backwards pull', `${pl(-r.Fmin, 3)} N`, 'When the slug is past a coil\'s middle and the coil is still on, the pull points backwards: suck-back.', '', 'warn');
    return h;
  }
  function len3(m) { return m >= 1 ? pl(m, 3) + ' m' : pl(m * 100, 3) + ' cm'; }
  function coilPreviewRows() {
    const g = coilGeoNow(), B0 = C.mu0 * PHYS.coilH1(g, 0) * S.current;
    return sec('Your coils right now') + row('Field in the middle of each coil', `${pl(B0, 3)} T`, `${S.turns} turns carrying ${pl(S.current, 3)} A.`, `B = μ₀ × ${pl(PHYS.coilH1(g, 0), 4)} A/m per ampere × ${pl(S.current, 4)} A`) + row('Power in each coil while it is on', si(S.current * S.current * g.R, 'W', 3), 'Electric heating, P = I²R. A coil is only on for a few milliseconds per shot.', `P = I²R = (${pl(S.current, 3)} A)² × ${pl(g.R, 3)} Ω`);
  }
  function stageRows(sh) {
    if (!sh) return '<p class="hint">Fire a shot to see what each coil did.</p>';
    const r = sh.r, ms = t => t === null ? '–' : pl(t * 1000, 3);
    let h = `<div class="table-wrap"><table class="nb-table"><thead><tr><th>Coil</th><th>On at (ms)</th><th>Off at (ms)</th><th>Speed in → out (m/s)</th><th>Gain (m/s)</th><th>Work on slug</th><th>Energy used</th><th>Warmed by</th></tr></thead><tbody>`;
    for (const s of r.st) {
      const used = s.tOn !== null;
      h += `<tr><td>Coil ${s.k + 1}${s.dead ? ' (burnt)' : ''}${sh.glitch ? ` <small>(off at ${s.cutoff >= 0 ? '+' : ''}${Math.round(s.cutoff * 50)} %)</small>` : ''}</td><td>${used ? ms(s.tOn) : '–'}</td><td>${used ? ms(s.tOff) : '–'}</td><td>${s.vIn !== null ? pl(s.vIn, 3) : '–'} → ${s.vOut !== null ? pl(s.vOut, 3) : '–'}</td><td>${s.gain !== null ? (s.gain >= 0 ? '+' : '') + pl(s.gain, 3) : '–'}</td><td>${si(s.W, 'J', 3)}${s.suck ? ` <small>(${si(s.Wneg, 'J', 2)} backwards)</small>` : ''}</td><td>${si(s.Ein, 'J', 3)}</td><td>${pl(s.dT, 2)} °C</td></tr>`;
    }
    h += '</tbody></table></div>';
    h += row('Why later coils add less speed', '', 'A faster slug spends less time in each coil, so each coil has less time to push. The pull (force) is about the same, but the speed gained is Δv = FΔt/m, and Δt gets shorter.', expert('Work–energy: each coil adds about the same energy W = ∫F dx, so ½mv² grows by W per coil and v grows like √(number of coils).'));
    h += row('Suck-back', r.st.some(s => s.suck) ? 'happened' : 'none', 'After the slug passes a coil\'s middle, that coil pulls it backwards. A well-timed gun switches each coil off right at the middle, when the forward pull has dropped to zero.', '', r.st.some(s => s.suck) ? 'warn' : 'good');
    return h;
  }
  function coilRows(sh) {
    const g = sh ? sh.r.geo : coilGeoNow(), I = sh ? sh.r.I0 : S.current;
    let h = sec('One coil');
    h += row('Turns and layers', `${g.turns} turns, ${g.layers} layers`, `The wire is 1.0 mm² copper (${pl(GG.wireD * 1000, 3)} mm thick with its enamel), so ${g.perLayer} turns fit side by side on the ${pl(GG.Lc * 100, 2)} cm coil. More turns means more layers: the coil gets fatter and its outer turns are farther from the slug.`, `outer radius = ${pl(g.a1 * 1000, 3)} mm + ${g.layers} × ${pl(GG.wireD * 1000, 3)} mm = ${pl(g.a2 * 1000, 3)} mm`);
    h += row('Length of wire', len3(g.wireLen), '', `ℓ<sub>wire</sub> = N × 2π r<sub>mean</sub> = ${g.turns} × 2π × ${pl(g.am * 1000, 3)} mm = ${len3(g.wireLen)}`);
    h += row('Resistance', `${pl(g.R, 3)} Ω`, 'Longer wire, more resistance. This decides how much heat each shot makes.', `R = ρℓ/A = 1.68 × 10⁻⁸ Ω·m × ${pl(g.wireLen, 4)} m / 1.0 × 10⁻⁶ m² = ${pl(g.R, 4)} Ω`);
    h += row('Inductance', si(g.L, 'H', 3), 'A coil resists sudden changes of current. Inductance grows with the square of the number of turns.', expert(`Wheeler's formula for a multilayer coil: L = 31.6 N²r²/(6r + 9ℓ + 10d) μH = 31.6 × ${g.turns}² × ${pl(g.am, 3)}² / (6 × ${pl(g.am, 3)} + 9 × ${GG.Lc} + 10 × ${pl(g.depth, 3)}) μH = ${si(g.L, 'H', 4)}`));
    h += row('Time for the current to build up', si(g.tau, 's', 3), `The current needs about τ = L/R to rise most of the way. ${sh ? `This shot lasted ${si(sh.r.tExit || sh.r.tEnd, 's', 2)}.` : ''} Turn on <b>Current takes time to build up</b> to include this; the best switch-off point then moves earlier.`, `τ = L/R = ${si(g.L, 'H', 3)} / ${pl(g.R, 3)} Ω = ${si(g.tau, 's', 3)}`);
    h += row('Heating power while on', si(I * I * g.R, 'W', 3), '', `P = I²R = (${pl(I, 3)} A)² × ${pl(g.R, 3)} Ω`);
    h += row('Copper mass and heat capacity', `${pl(g.mCu * 1000, 3)} g, ${pl(g.heatCap, 3)} J/°C`, 'Each joule of heat warms the coil by 1/(mc). Rapid fire adds up; the coils cool slowly between shots (cooling is illustrative).', `mc = ${pl(g.mCu, 3)} kg × 385 J/(kg·°C) = ${pl(g.heatCap, 3)} J/°C`);
    h += row('Coil temperatures now', coilT.slice(0, S.stages).map((T, k) => burnt[k] ? 'burnt' : Math.round(T) + ' °C').join(', '), `Enamelled magnet wire is typically rated for about 155 to 200 °C. Burn-out happens above ${T_BURN} °C here.`, '', coilT.slice(0, S.stages).some(T => T > 120) ? 'warn' : '');
    return h;
  }
  function ballShotRows(sh) {
    const b = (BALLS.find(x => x.key === S.ball) || BALLS[0]);
    if (!sh) return `<p class="hint">Press <b>Fire</b> to roll the first ball.</p>` + row('Steel ball', `${b.name}, ${pl(b.m * 1000, 3)} g`, `Paired with a ${b.magnet} neodymium magnet.`, '');
    const res = sh.res, v = sh.v, K = 0.5 * sh.m * v * v;
    let h = sec('The result');
    if (!sh.fired) return h + row('Outcome', 'stuck', `With ${res.k} ball${res.k > 1 ? 's' : ''} behind the magnet, the last ball sits ${2 * res.k - 1} ball radius${res.k > 1 ? 'es' : ''} from the magnet face, held with ${si(res.Uout, 'J', 3)}. The impact brings only ${si(res.eta * (res.stages[res.stages.length - 1].Kin + res.Uc), 'J', 3)}.`, `K<sub>out</sub> = η(K<sub>in</sub> + U꜀) − U꜀/(2k − 1)⁴ < 0`, 'bad');
    h += row('Exit speed of the last ball', `${pl(v, 4)} m/s`, `${kmh(v)} (${pl(v / PHYS.MPH, 3)} mph).`, sh.chrono ? `Chronograph: v = 0.0500 m / ${si(sh.chrono.t2 - sh.chrono.t1, 's', 4)}` : '', 'good');
    h += row('Kinetic energy', si(K, 'J', 3), `About ${pl(K / (sh.m * C.g) * 100, 3)} cm of drop height for the same ball.`, `K = ½mv² = ½ × ${pl(sh.m * 1000, 4)} g × (${pl(v, 4)} m/s)²`);
    h += row('The limit', `${pl(res.vmax, 3)} m/s`, 'Even with endless stages, the ball cannot beat this: at that speed, the energy lost in each bump equals the energy each magnet adds.', expert(`K<sub>max</sub> = (ηU꜀ − U<sub>out</sub>)/(1 − η) = ${si(res.Kmax, 'J', 3)}`));
    if (sh.tgt && sh.tgt.type === 'pendulum') h += row('Pendulum swing', `${pl(sh.tgt.h * 100, 3)} cm`, `A light ${Math.round(sh.tgt.M * 1000)} g block: the ball carries little momentum (${pl(sh.m * v, 3)} kg·m/s).`, `V = mv/(m + M) = ${pl(sh.tgt.V, 3)} m/s, h = V²/(2g)`);
    return h;
  }
  function ballStageRows(sh) {
    if (!sh) return '<p class="hint">Fire to see each stage.</p>';
    const res = sh.res;
    let h = `<div class="table-wrap"><table class="nb-table"><thead><tr><th>Stage</th><th>Speed in</th><th>Speed at impact</th><th>Speed out</th><th>Gain</th><th>Lost in the bump</th></tr></thead><tbody>`;
    for (const s of res.stages) h += `<tr><td>${s.i + 1}</td><td>${pl(s.vin, 3)} m/s</td><td>${pl(s.vimp, 3)} m/s</td><td>${s.stuck ? 'stuck' : pl(s.vout, 3) + ' m/s'}</td><td>${s.stuck ? '–' : '+' + pl(s.gain, 3)}</td><td>${si(s.lost, 'J', 2)}</td></tr>`;
    h += '</tbody></table></div>';
    h += row('Diminishing returns', '', 'Every stage adds the same energy U꜀ (minus what the last ball needs to escape), but loses 10 % of what the incoming ball brings. Faster balls lose more, so each stage adds less speed.', '');
    return h;
  }
  function ballHowRows() {
    const b = (BALLS.find(x => x.key === S.ball) || BALLS[0]);
    let h = sec('Where the energy comes from');
    h += row('Magnet well depth', si(b.Uc, 'J', 3), `The energy a ${b.name} ball gains falling into the magnet from far away. Set so that one stage reproduces K&J Magnetics' measured exit speed of ${b.mph} mph (${pl(b.v1, 3)} m/s).`, `U꜀ = ½mv₁² / (η − 3⁻⁴) = ½ × ${pl(b.m * 1000, 3)} g × (${pl(b.v1, 3)} m/s)² / (0.9 − 0.0123)`);
    h += row('Why the last ball escapes', '', 'The pull falls off very quickly with distance (here as 1/d⁴). The incoming ball falls all the way into the deep well at the magnet face. The last ball sits several radii away, in a shallow part of the well, so the bump easily frees it.', `U(d) = −U꜀ (r/d)⁴; the last of k balls is at d = (2k − 1)r: k = 2 gives U꜀/81`);
    h += row('Speed out of one stage', '', 'Energy in: the incoming ball\'s kinetic energy plus the well depth. 90 % of it passes through the bump; the last ball spends a little to climb out.', 'K<sub>out</sub> = η(K<sub>in</sub> + U꜀) − U꜀/(2k − 1)⁴, η = 0.9');
    h += row('Is this free energy?', 'no', 'The energy was stored when the balls were stuck onto the magnets. To reset the rifle you must pull them off again, and that takes at least as much work as the shot released.', '');
    return h;
  }

  function graphOpts() {
    return S.type === 'coil'
      ? [['v-x', 'Speed along the barrel'], ['F-x', 'Force on the slug'], ['I-t', 'Current in each coil'], ['v-t', 'Speed against time']]
      : [['v-stage', 'Speed after each stage'], ['K-stage', 'Energy at each stage'], ['v-x', 'Speed along the track']];
  }
  function fillSelects() {
    const opts = graphOpts();
    const keyA = S.type === 'coil' ? 'gA' : 'gbA', keyB = S.type === 'coil' ? 'gB' : 'gbB';
    if (!opts.find(o => o[0] === S[keyA])) S[keyA] = opts[0][0];
    if (!opts.find(o => o[0] === S[keyB])) S[keyB] = opts[1][0];
    for (const [id, key] of [['#ggSelA', keyA], ['#ggSelB', keyB]]) { const sel = $(id); sel.innerHTML = opts.map(([v, l]) => `<option value="${v}"${S[key] === v ? ' selected' : ''}>${l}</option>`).join(''); }
  }
  function drawGraphs() {
    const keyA = S.type === 'coil' ? 'gA' : 'gbA', keyB = S.type === 'coil' ? 'gB' : 'gbB';
    drawGraph($('#ggGraphA'), S[keyA]); drawGraph($('#ggGraphB'), S[keyB]);
  }
  const COLS = ['#ffb020', '#4dabf7', '#4fd67f', '#ff6aa8', '#b3a6ff', '#ff8a3d', '#63e6be', '#e2a066'];
  function drawGraph(cvG, type) {
    if (!cvG) return;
    const sh = shot && shot.done ? shot : null, gh = ghost && ghost.done && ghost.kind === (sh ? sh.kind : '') ? ghost : null;
    const empty = msg => { const res = plot(cvG, { xmin: 0, xmax: 1, ymin: 0, ymax: 1, series: [], xlabel: '', ylabel: '' }); if (res) { res.ctx.fillStyle = '#93a197'; res.ctx.font = '600 14px "Barlow", sans-serif'; res.ctx.textAlign = 'center'; res.ctx.textBaseline = 'middle'; res.ctx.fillText(msg, res.W / 2, res.H / 2); } };
    if (S.type === 'coil') {
      if (!sh || sh.kind !== 'coil') return empty('Fire to see this graph');
      const r = sh.r, smp = r.samples, lay = sh.lay;
      const bands = lay.xc.map((x, k) => ({ x0: (x - GG.Lc / 2) * 100, x1: (x + GG.Lc / 2) * 100, color: 'rgba(201,128,63,0.14)', label: `coil ${k + 1}`, text: '#e2a066' }));
      const thin = (arr, f) => { const step = Math.max(1, Math.floor(arr.length / 600)); const out = []; for (let i = 0; i < arr.length; i += step) out.push(f(arr[i])); return out; };
      if (type === 'v-x' || type === 'F-x') {
        const xmin = (lay.xBreech) * 100, xmax = (lay.muzzle + 0.02) * 100;
        if (type === 'v-x') {
          const pts = thin(smp, s => [s.x * 100, s.v]);
          const series = [{ pts, color: '#4fd67f', width: 2.4 }];
          if (gh) series.unshift({ pts: thin(gh.r.samples, s => [s.x * 100, s.v]), color: '#7f8b83', width: 1.5, dash: [4, 4] });
          const ymax = Math.max(1, ...pts.map(p => p[1]), ...(gh ? gh.r.samples.map(s => s.v) : [])) * 1.12;
          plot(cvG, { xmin, xmax, ymin: 0, ymax, series, bands, xlabel: 'position along the barrel (cm)', ylabel: 'speed (m/s)', vlines: gh ? [{ x: xmax - 0.5, label: 'dashed: previous shot', color: '#7f8b83', dash: [1, 1e9] }] : [] });
        } else {
          const pts = thin(smp.filter(s => s.x * 100 <= xmax), s => [s.x * 100, s.F]);
          const pos = pts.map(([x, F]) => [x, Math.max(0, F)]), neg = pts.map(([x, F]) => [x, Math.min(0, F)]);
          const fmax = Math.max(1e-6, ...pts.map(p => Math.abs(p[1])));
          const ymin = Math.min(0, ...pts.map(p => p[1])) * 1.15, ymax = Math.max(fmax * 0.1, ...pts.map(p => p[1])) * 1.15;
          plot(cvG, { xmin, xmax, ymin: ymin || -fmax * 0.1, ymax, bands, xlabel: 'position of the slug (cm)', ylabel: 'force (N): up = forwards', series: [{ pts: pos, color: '#4fd67f', width: 0.01, fill: 'rgba(79,214,127,0.25)' }, { pts: neg, color: '#ff4b3e', width: 0.01, fill: 'rgba(255,75,62,0.35)' }, { pts, color: '#e5eae3', width: 1.6 }] });
        }
      } else if (type === 'I-t') {
        const tmax = (r.tExit || r.tEnd) * 1000;
        const series = lay.xc.map((x, k) => ({ pts: thin(smp, s => [s.t * 1000, s.I[k] || 0]), color: COLS[k % COLS.length], width: 1.8 }));
        plot(cvG, { xmin: 0, xmax: Math.max(tmax, 0.1), ymin: 0, ymax: Math.max(1, r.I0) * 1.12, series, xlabel: 'time (ms)', ylabel: 'current (A), one colour per coil' });
      } else {
        const tmax = (r.tExit || r.tEnd) * 1000;
        const pts = thin(smp, s => [s.t * 1000, s.v]);
        const series = [{ pts, color: '#4fd67f', width: 2.4 }];
        if (gh) series.unshift({ pts: thin(gh.r.samples, s => [s.t * 1000, s.v]), color: '#7f8b83', width: 1.5, dash: [4, 4] });
        plot(cvG, { xmin: 0, xmax: Math.max(0.1, tmax), ymin: 0, ymax: Math.max(1, ...pts.map(p => p[1])) * 1.12, series, xlabel: 'time (ms)', ylabel: 'speed (m/s)', vlines: r.events.filter(q => q.type === 'on').map(q => ({ x: q.t * 1000, color: 'rgba(255,176,32,0.45)', dash: [2, 4] })) });
      }
    } else {
      const res = sh && sh.kind === 'balls' ? sh.res : PHYS.gaussBalls({ ball: S.ball, stages: S.bstages, behind: S.behind, v0: S.v0 });
      if (type === 'v-x') {
        if (!sh || sh.kind !== 'balls') return empty('Fire to see this graph');
        const pts = []; for (const sg of sh.segs) for (let i = 0; i < sg.pts.length; i += 4) pts.push([sg.pts[i].x * 100, sg.pts[i].v]);
        const bands = sh.lay.mags.map((xm, j) => ({ x0: xm * 100, x1: (xm + 2 * sh.lay.r) * 100, color: 'rgba(185,192,198,0.18)', label: `${j + 1}` }));
        plot(cvG, { xmin: sh.lay.xStart * 100, xmax: (sh.lay.xT) * 100, ymin: 0, ymax: Math.max(...pts.map(p => p[1])) * 1.12, series: [{ pts, color: '#4fd67f', width: 2 }], bands, xlabel: 'position (cm)', ylabel: 'speed of the moving ball (m/s)' });
        return;
      }
      const n = res.stages.length;
      if (type === 'v-stage') {
        const pts = [[0, S.v0], ...res.stages.map((s, i) => [i + 1, s.vout])];
        const out = plot(cvG, { xmin: 0, xmax: Math.max(1, n), ymin: 0, ymax: Math.max(res.vmax, ...pts.map(p => p[1])) * 1.1, series: [{ pts, color: '#4fd67f', width: 2.2 }, { pts: [[0, res.vmax], [Math.max(1, n), res.vmax]], color: '#ffb020', width: 1.2, dash: [5, 4] }], xlabel: 'stage', ylabel: 'speed after the stage (m/s)', vlines: [{ x: Math.max(1, n) - 0.02, label: 'limit', color: '#ffb020', dash: [1, 1e9] }] });
        if (out) for (const [x, y] of pts) { out.ctx.fillStyle = '#4fd67f'; out.ctx.beginPath(); out.ctx.arc(out.XP(x), out.YP(y), 4, 0, TAU); out.ctx.fill(); }
      } else {
        const out = plot(cvG, { xmin: 0.4, xmax: n + 0.6, ymin: 0, ymax: Math.max(...res.stages.map(s => s.Kimp)) * 1000 * 1.15, series: [], xlabel: 'stage', ylabel: 'energy (mJ): in, at impact, out' });
        if (out) res.stages.forEach((s, i) => {
          const x = out.XP(i + 1), bw = Math.min(22, (out.XP(2) - out.XP(1)) * 0.22);
          [[s.Kin, '#7f8b83', -1], [s.Kimp, '#ffb020', 0], [s.Kout, '#4fd67f', 1]].forEach(([K, col, o]) => { out.ctx.fillStyle = col; const y = out.YP(K * 1000); out.ctx.fillRect(x + o * (bw + 2) - bw / 2, y, bw, out.YP(0) - y); });
        });
      }
    }
  }

  /* ------------------------------------------------------------------
     Controls
     ------------------------------------------------------------------ */
  function limitsFor(key) {
    if (key === 'current') return [0, S.over ? 1500 : 300];
    return { stages: [1, 8], turns: [20, 800], slugCm: [1, 4], cutoff: [-50, 50], bstages: [1, 8], behind: [1, 4], v0: [0.05, 1] }[key];
  }
  function bindSlider(key, o = {}) {
    const [min, max] = limitsFor(key);
    ctl[key] = bindRange({ range: $('#r-gg-' + key), num: $('#n-gg-' + key), min, max, step: o.step || 1, int: !!o.int, log: !!o.log, fmt: o.fmt,
      get: () => key === 'cutoff' ? S.cutoff * 50 : S[key],
      set: v => { S[key] = key === 'cutoff' ? v / 50 : v; changed(key); } });
  }
  function changed(key) {
    save(); dataDirty = true;
    if (key === 'stages') updateHeat();
    if (!busy()) { if (shot && shot.done && sceneChanged()) { ghost = shot; shot = null; } }
    syncLabels();
  }
  function sceneChanged() {
    if (!shot) return false;
    const s = shot.set;
    return shot.kind !== (S.type === 'coil' ? 'coil' : 'balls') || (shot.kind === 'coil' ? (s.stages !== S.stages || s.turns !== S.turns) : (s.bstages !== S.bstages || s.behind !== S.behind || s.ball !== S.ball)) || s.target !== S.target;
  }
  function syncLabels() {
    $('#ggCoilPill').textContent = `${S.stages} × ${S.turns} turns`;
    const c = Math.round(S.cutoff * 50);
    $('#ggCutNote').innerHTML = c === 0 ? 'Each coil switches off when the slug\'s middle reaches the coil\'s middle: the ideal moment for instant switching.' : c < 0 ? `Switching off ${-c} % of a coil length <b>before</b> the middle: the slug misses some of the pull.` : `Switching off ${c} % of a coil length <b>after</b> the middle: the coil pulls the slug back as it leaves (<b>suck-back</b>).`;
    const mat = SLUGS[S.material];
    $('#ggMatNote').textContent = mat.note;
    const b = BALLS.find(x => x.key === S.ball);
    $('#ggBallNote').textContent = `${b.name} steel ball (${pl(b.m * 1000, 3)} g) with a ${b.magnet} magnet. One stage measured at ${b.mph} mph (${pl(b.v1, 3)} m/s) by K&J Magnetics.`;
    $('#ggTypeNote').textContent = S.type === 'coil' ? 'Electromagnets switched on one after another pull an iron slug along a barrel.' : 'Permanent magnets and steel balls: a chain of bumps, no electricity.';
    $('#ggOverBox').hidden = !S.over;
    for (const b2 of $$('#ggMat button')) b2.setAttribute('aria-checked', String(b2.dataset.key === S.material));
    for (const b2 of $$('#ggBalls button')) b2.setAttribute('aria-checked', String(b2.dataset.key === S.ball));
  }
  function setType(t) { if (v3 && v3.updateRide) setTimeout(() => v3.updateRide());
    S.type = t; save();
    $('#ggCoilPanels').hidden = t !== 'coil'; $('#ggBallPanels').hidden = t !== 'balls';
    $('#ggRapidBox').hidden = t !== 'coil';
    if (shot && shot.kind !== (t === 'coil' ? 'coil' : 'balls')) { ghost = null; shot = null; }
    cam.from = { x: cam.x, y: cam.y, k: cam.k }; cam.blend = 0;
    fillSelects(); syncLabels(); dataDirty = graphDirty = true; renderData(); drawGraphs(); updateStatus();
  }
  function bindControls() {
    segInit($('#ggType'), () => S.type, setType);
    segInit($('#ggTarget'), () => S.target, v => { S.target = v; save(); if (shot && shot.done) { ghost = shot; shot = null; } dataDirty = true; });
    bindSlider('stages', { int: true }); bindSlider('turns', { int: true, step: 10 }); bindSlider('current', { step: 1 }); bindSlider('slugCm', { step: 0.1 }); bindSlider('cutoff', { step: 5, int: true });
    bindSlider('bstages', { int: true }); bindSlider('behind', { int: true }); bindSlider('v0', { step: 0.05 });
    $('#ggMat').innerHTML = Object.values(SLUGS).map(m => `<button type="button" class="pbtn-part" role="radio" data-key="${m.key}"><span class="dot" style="background:${m.color};color:${m.color}"></span><span class="sym">${m.key === 'aluminium' ? 'Al' : m.key === 'ferrite' ? 'Fe₃O₄' : 'Fe'}</span><span class="nm">${m.name}</span></button>`).join('');
    $('#ggMat').addEventListener('click', ev => { const b = ev.target.closest('button[data-key]'); if (!b) return; S.material = b.dataset.key; changed('material'); });
    $('#ggBalls').innerHTML = BALLS.map(b => `<button type="button" class="chip-btn" role="radio" data-key="${b.key}">${b.name}</button>`).join('');
    $('#ggBalls').addEventListener('click', ev => { const b = ev.target.closest('button[data-key]'); if (!b) return; S.ball = b.dataset.key; for (const x of $$('#ggBalls button')) x.classList.toggle('is-on', x.dataset.key === S.ball); changed('ball'); });
    for (const x of $$('#ggBalls button')) x.classList.toggle('is-on', x.dataset.key === S.ball);
    const sw = (id, key, after) => { const el = $(id); el.checked = !!S[key]; el.addEventListener('change', () => { S[key] = el.checked; save(); if (after) after(); dataDirty = true; }); };
    sw('#ggReal', 'real'); sw('#ggGlitch', 'glitch', () => { if (S.glitch) toast($('#ggToast'), '<b>Sensor glitch on.</b> Every light gate now switches its coil off at a random moment, up to 35 % early or late. Fire a few times and compare the speeds: timing matters!', 'warn', 6000); });
    sw('#ggOver', 'over', () => { ctl.current.setLimits(...limitsFor('current')); if (!S.over && S.current > 300) { S.current = 300; ctl.current.sync(); } $('#ggOverBox').hidden = !S.over; if (S.over) { audio.alarm(false); toast($('#ggToast'), '<b>Overload mode.</b> The current can now go up to 1500 A. Every shot heats the coils (P = I²R); fire fast and see what happens.', 'hot', 6000); } });
    sw('#ggRapid', 'rapid');
    $('#ggWorking').checked = S.working; $('#ggWorking').addEventListener('change', () => { S.working = $('#ggWorking').checked; save(); renderData(); });
    for (const b of $$('#ggData .tabs button')) b.addEventListener('click', () => { S.tab = b.dataset.tab; save(); renderData(); });
    for (const inp of $$('#ggSpeeds input')) { inp.checked = inp.value === S.speed; inp.addEventListener('change', () => { if (inp.checked) { S.speed = inp.value; save(); $('#ggLbSpeed').textContent = SPEED_LABEL[S.speed]; } }); }
    $('#ggLbSpeed').textContent = SPEED_LABEL[S.speed];
    $('#ggFire').addEventListener('click', fire);
    $('#ggReplay').addEventListener('click', replay);
    $('#ggRepair').addEventListener('click', repairCoils);
    $('#ggSelA').addEventListener('change', ev => { S[S.type === 'coil' ? 'gA' : 'gbA'] = ev.target.value; save(); drawGraphs(); });
    $('#ggSelB').addEventListener('change', ev => { S[S.type === 'coil' ? 'gB' : 'gbB'] = ev.target.value; save(); drawGraphs(); });
    $('#ggZoomIn').addEventListener('click', () => { cam.zoom = clamp(cam.zoom * 1.4, 0.3, 6); });
    $('#ggZoomOut').addEventListener('click', () => { cam.zoom = clamp(cam.zoom / 1.4, 0.3, 6); });
    $('#ggZoomFit').addEventListener('click', () => { cam.zoom = 1; });
    $('#ggToast .toast-close').addEventListener('click', () => { $('#ggToast').hidden = true; });
    CL.bus.on('mission', renderMissions);
    CL.bus.on('level', () => { dataDirty = true; narrate(); });
    document.addEventListener('keydown', ev => {
      if (!active) return;
      const tg = ev.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      if (ev.key === ' ' && tg !== 'BUTTON' && tg !== 'SUMMARY') { ev.preventDefault(); fire(); }
    });
  }
  function renderMissions() { missions.render($('#ggMissions'), 'gauss'); const [d, n] = missions.count('gauss'); $('#ggMissionCount').textContent = `${d} / ${n}`; }

  function resize() {
    if (!active) return;
    const wrap = $('#ggWrap');
    if (v3 && v3.full) { const b = v3.fullBox(); W = b.W; H = b.H; cv.style.height = H + 'px'; }
    else {
      cv.style.height = '';
      const w = wrap.clientWidth;
      const h = userH ? Math.round(clamp(userH, 260, 1400)) : Math.round(clamp(w * 0.4, 300, 430));
      wrap.style.setProperty('--arena-h', h + 'px');
      W = w; H = h;
    }
    patCache.pat = null;
    drawGraphs();
  }
  function init() {
    cv = $('#ggCanvas');
    v3 = CL.V3.attach($('#ggWrap'), { home: { yaw: -2.05, pitch: 0.32, dist: 0.5, target: [0, 0, 0], fov: 46, minDist: 0.01 }, storeKey: 'cl-3d-gauss',
      full: { bar: () => $('#ggWrap').nextElementSibling, onChange: () => resize() },
      ride: { label: () => S.type === 'coil' ? 'Ride the slug' : 'Ride the ball', title: 'Ride along with the projectile, just behind it, then press Fire',
        onToggle: on => { if (on && !shot) toast($('#ggToast'), `<b>Ride mode.</b> Press <b>Fire</b> and you fly with the ${S.type === 'coil' ? 'slug through the coils' : 'balls from magnet to magnet'} and into the target. Slow motion or bullet time are best for this.`, '', 6500); } } });
    shake = shaker($('#ggWrap'));
    bindControls(); setType(S.type); renderMissions(); updateHeat();
    CL.grip($('#ggGrip'), {
      axis: 'y', get: () => H,
      set: (v, dragging) => { userH = Math.round(v); resize(); userH = H; if (!dragging) store.set('cl-h-gauss', userH); CL.sizeBadge($('#ggWrap'), `${W} × ${H} px`, dragging ? 'release to keep this height' : 'double-click the corner for automatic height', dragging ? 0 : 1400); },
      reset: () => { userH = 0; store.set('cl-h-gauss', 0); resize(); CL.sizeBadge($('#ggWrap'), `${W} × ${H} px`, 'automatic height'); },
    });
  }
  CL.screens.gauss = {
    init, frame, resize,
    show() { active = true; requestAnimationFrame(() => { resize(); dataDirty = graphDirty = true; }); },
    hide() { active = false; S.rapid = false; const r = $('#ggRapid'); if (r) r.checked = false; },
    fire, get S() { return S; }, get shot() { return shot; },
  };
})();
