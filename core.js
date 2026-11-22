/* =====================================================================
   Project Lorentz — shared core: helpers, skins, sound, visual effects,
   plotting, controls and missions. Exposed as the global CL.
   ===================================================================== */
const CL = (() => {
  'use strict';
  const { C, fmt } = PHYS;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const e = (x, s = 3) => fmt.sci(x, s);
  const pl = (x, s = 3) => fmt.plain(x, s);
  const en = (J, s = 3) => fmt.energy(J, s);
  const len = (m, s = 3) => fmt.length(m, s);
  const si = (x, u, s = 3) => fmt.si(x, u, s);
  const pct = (f, s = 3) => pl(f * 100, s) + ' %';
  const mev = (M, s = 3) => fmt.energy(M * C.MeV, s);          // value in MeV → "x MeV/keV/GeV"
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* storage unavailable */ } },
  };

  /* ---------- tiny event bus ---------- */
  const bus = {
    h: {},
    on(n, f) { (this.h[n] = this.h[n] || []).push(f); },
    emit(n, ...a) { for (const f of this.h[n] || []) f(...a); },
  };

  /* ---------- skins (dark control room / light classroom) ---------- */
  const skin = {
    name: 'radlab', v: {},
    // the colour schemes; Rad Lab is the default, 'classroom' (Daylight) is the light one for bright rooms and projectors
    list: [
      { id: 'radlab', label: 'Rad Lab 1939', note: 'slate, cream, brass, green phosphor', sw: ['#262d31', '#414c52', '#e9b949', '#9df5b8'] },
      { id: 'control', label: 'Night shift', note: 'green-black bench, amber lamps', sw: ['#1d2420', '#36413b', '#ffb020', '#ffc278'] },
      { id: 'bakelite', label: 'Bakelite', note: 'warm brown, brass, nixie orange', sw: ['#1d1815', '#372d28', '#ffb020', '#ffa15c'] },
      { id: 'blueprint', label: 'Blueprint', note: 'drafting blue, safety orange', sw: ['#0f2d4d', '#1c4775', '#ff7b22', '#dff3ff'] },
      { id: 'classroom', label: 'Daylight', note: 'light, for bright rooms', sw: ['#c5ccc4', '#e9ede7', '#ffb020', '#1d2521'] },
    ],
    apply(name) {
      this.name = skin.list.some(k => k.id === name) ? name : 'radlab';
      document.body.dataset.skin = this.name;
      store.set('cl-scheme', this.name);
      this.read();
      bus.emit('skin', this.name);
    },
    read() {
      const cs = getComputedStyle(document.body);
      for (const k of ['--plot-grid', '--plot-axis', '--plot-text', '--plot-strong', '--ink', '--ink-2', '--ink-3', '--accent', '--hot', '--amber', '--ok', '--bad', '--panel-solid', '--bg', '--note-ink', '--note-halo', '--lamp', '--copper'])
        this.v[k] = cs.getPropertyValue(k).trim() || '#888';
    },
    c(k) { return this.v[k] || '#888'; },
  };

  /* ---------- sound (Web Audio, synthesised, no files) ---------- */
  const audio = (() => {
    let ctx = null, master = null, muted = store.get('cl-muted', false), lastTick = 0, alarmTimer = null, noiseBuf = null;
    const ensure = () => {
      if (ctx) return ctx;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (_) { ctx = null; }
      return ctx;
    };
    const ready = () => ctx && !muted && ctx.state === 'running';
    function tone(f, dur, type = 'sine', vol = 0.1, when = 0, to = null) {
      if (!ready()) return;
      const t0 = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(dur, vol = 0.2, freq = 1200, type = 'lowpass', to = null, when = 0) {
      if (!ready()) return;
      const t0 = ctx.currentTime + when, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t0);
      if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + dur + 0.05);
    }
    const api = {
      unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); },
      get muted() { return muted; },
      setMuted(m) { muted = m; store.set('cl-muted', m); if (master) master.gain.value = m ? 0 : 0.55; if (m) api.alarm(false); bus.emit('muted', m); },
      tick(f = 0.5) { const n = performance.now(); if (n - lastTick < 55) return; lastTick = n; tone(420 + 1200 * clamp(f, 0, 1), 0.045, 'triangle', 0.045); },
      whoosh() { noise(0.8, 0.16, 300, 'bandpass', 3200); tone(240, 0.6, 'sine', 0.05, 0, 900); },
      crunch() { noise(0.4, 0.32, 1400, 'lowpass', 200); tone(110, 0.35, 'sine', 0.22, 0, 40); },
      boom(big = 1) { noise(1.6 + big, 0.6, 900, 'lowpass', 60); tone(70, 1.4, 'sine', 0.45, 0, 26); noise(0.25, 0.4, 3000, 'highpass', null, 0.02); },
      zap() { tone(1600, 0.22, 'sawtooth', 0.045, 0, 160); },
      spark() { noise(0.07, 0.1, 5000, 'highpass'); },
      scribble(dur = 0.6) { const n = Math.max(3, Math.round(dur * 9)); for (let i = 0; i < n; i++) noise(0.04 + Math.random() * 0.05, 0.05, 2200 + Math.random() * 1800, 'bandpass', null, i * dur / n + Math.random() * 0.02); },
      beep(f = 660, d = 0.14) { tone(f, d, 'square', 0.05); },
      fanfare() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, i * 0.11)); },
      ding() { tone(1318.5, 0.5, 'sine', 0.06); tone(1975.5, 0.6, 'sine', 0.035, 0.05); },
      charge(dur = 0.5) { tone(180, dur, 'sine', 0.05, 0, 2600); tone(90, dur, 'triangle', 0.03, 0, 1300); },
      thunk(f = 0.5) { tone(70 + 60 * f, 0.12, 'square', 0.06, 0, 40); noise(0.05, 0.12, 900, 'lowpass'); },
      metro() { tone(2100, 0.025, 'square', 0.018); },
      clack(v = 1) { noise(0.05, 0.22 * v, 3800, 'bandpass'); tone(2600, 0.05, 'triangle', 0.05 * v); },
      alarm(on) {
        if (on && !alarmTimer && !muted) {
          let hi = false;
          const fire = () => { tone(hi ? 930 : 690, 0.27, 'square', 0.03); hi = !hi; };
          fire(); alarmTimer = setInterval(fire, 330);
        } else if (!on && alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
      },
    };
    return api;
  })();

  /* ---------- particle effects drawn on a canvas (screen coordinates) ---------- */
  class FX {
    constructor() { this.p = []; this.rings = []; this.flashA = 0; this.flashC = '255,255,255'; this.smoke = []; this.bolts = []; }
    burst(x, y, n, o = {}) {
      if (reduceMotion) n = Math.ceil(n / 3);
      const sp = o.speed || 220, life = o.life || 0.8;
      for (let i = 0; i < n; i++) {
        const a = o.dir !== undefined ? o.dir + rnd(-o.spread || -0.6, o.spread || 0.6) : rnd(0, TAU), s = sp * rnd(0.25, 1);
        this.p.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rnd(0.5, 1.1), max: life, size: o.size || rnd(1.2, 2.8),
          color: o.colors ? o.colors[Math.floor(Math.random() * o.colors.length)] : (o.color || '255,200,120'), drag: o.drag || 2.2, g: o.gravity || 0, debris: !!o.debris, rot: rnd(0, TAU), vr: rnd(-8, 8) });
      }
    }
    ring(x, y, o = {}) { this.rings.push({ x, y, r: o.r0 || 4, vr: o.speed || 420, life: o.life || 0.7, max: o.life || 0.7, color: o.color || '255,230,200', w: o.width || 3 }); }
    flash(a = 1, color = '255,255,255') { this.flashA = Math.max(this.flashA, a); this.flashC = color; }
    puff(x, y, n = 8, o = {}) { for (let i = 0; i < n; i++) this.smoke.push({ x: x + rnd(-12, 12), y: y + rnd(-12, 12), vx: rnd(-30, 30), vy: rnd(-40, -5), r: rnd(8, 18), vr: rnd(14, 40), life: rnd(1.2, 2.6), max: 2.6, shade: o.shade || rnd(90, 150) }); }
    bolt(x0, y0, x1, y1, o = {}) {
      const pts = [[x0, y0]], n = 9;
      for (let i = 1; i < n; i++) { const f = i / n; pts.push([x0 + (x1 - x0) * f + rnd(-1, 1) * (o.jag || 7), y0 + (y1 - y0) * f + rnd(-1, 1) * (o.jag || 7)]); }
      pts.push([x1, y1]);
      this.bolts.push({ pts, life: o.life || 0.12, max: o.life || 0.12, color: o.color || '190,220,255' });
    }
    get busy() { return this.p.length || this.rings.length || this.flashA > 0.01 || this.smoke.length || this.bolts.length; }
    clear() { this.p = []; this.rings = []; this.flashA = 0; this.smoke = []; this.bolts = []; }
    update(dt) {
      for (const s of this.p) { s.life -= dt; const k = Math.exp(-s.drag * dt); s.vx *= k; s.vy = s.vy * k + s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; }
      this.p = this.p.filter(s => s.life > 0);
      for (const r of this.rings) { r.life -= dt; r.r += r.vr * dt; }
      this.rings = this.rings.filter(r => r.life > 0);
      for (const s of this.smoke) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt; }
      this.smoke = this.smoke.filter(s => s.life > 0);
      for (const b of this.bolts) b.life -= dt;
      this.bolts = this.bolts.filter(b => b.life > 0);
      this.flashA = Math.max(0, this.flashA - dt * 2.4);
    }
    draw(ctx, w, h) {
      for (const s of this.smoke) {
        const a = clamp(s.life / s.max, 0, 1) * 0.35;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        g.addColorStop(0, `rgba(${s.shade},${s.shade},${s.shade + 8},${a})`); g.addColorStop(1, `rgba(${s.shade},${s.shade},${s.shade},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const r of this.rings) {
        const a = clamp(r.life / r.max, 0, 1);
        ctx.strokeStyle = `rgba(${r.color},${a * 0.85})`; ctx.lineWidth = r.w * (0.4 + a);
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      }
      for (const s of this.p) {
        const a = clamp(s.life / s.max, 0, 1);
        if (s.debris) {
          ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.translate(s.x, s.y); ctx.rotate(s.rot);
          ctx.fillStyle = `rgba(${s.color},${a})`; ctx.fillRect(-s.size, -s.size * 0.6, s.size * 2, s.size * 1.2); ctx.restore();
        } else {
          ctx.strokeStyle = `rgba(${s.color},${a})`; ctx.lineWidth = s.size; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025); ctx.stroke();
        }
      }
      for (const b of this.bolts) {
        const a = clamp(b.life / b.max, 0, 1);
        for (const [wid, al] of [[6, 0.25], [2, 0.95]]) {
          ctx.strokeStyle = `rgba(${b.color},${a * al})`; ctx.lineWidth = wid; ctx.lineJoin = 'round';
          ctx.beginPath(); b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        }
      }
      ctx.restore();
      if (this.flashA > 0.01) { ctx.fillStyle = `rgba(${this.flashC},${Math.min(this.flashA, 1) * 0.85})`; ctx.fillRect(0, 0, w, h); }
    }
  }

  /* ---------- screen shake for a DOM element ---------- */
  function shaker(el) {
    let amp = 0, until = 0;
    return {
      kick(a, dur = 0.5) { if (reduceMotion) return; amp = Math.max(amp, a); until = Math.max(until, performance.now() + dur * 1000); },
      update(now) {
        if (!el) return;
        if (now > until || amp < 0.2) { if (el.style.transform) el.style.transform = ''; amp = 0; return; }
        const f = (until - now) / 1000;
        const a = amp * Math.min(1, f * 2);
        el.style.transform = `translate(${rnd(-a, a).toFixed(1)}px, ${rnd(-a, a).toFixed(1)}px) rotate(${rnd(-a, a) * 0.04}deg)`;
      },
      stop() { amp = 0; until = 0; if (el) el.style.transform = ''; },
    };
  }

  /* ---------- drawing helpers ---------- */
  function arrow(ctx, x0, y0, x1, y1, head, color, width) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    if (L < 1) return;
    const ux = dx / L, uy = dy / L, hb = Math.min(head, L * 0.6);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hb * 0.8, y1 - uy * hb * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * hb - uy * hb * 0.55, y1 - uy * hb + ux * hb * 0.55);
    ctx.lineTo(x1 - ux * hb + uy * hb * 0.55, y1 - uy * hb - ux * hb * 0.55);
    ctx.closePath(); ctx.fill();
  }
  function haloText(ctx, text, x, y, o = {}) {
    ctx.font = o.font || '600 13.5px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = o.halo || 3.5;
    ctx.strokeStyle = o.haloColor || 'rgba(6,9,7,0.85)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = o.color || '#eef2ec'; ctx.fillText(text, x, y);
  }
  function pill(ctx, text, x, y, bg, fg, font) {
    ctx.font = font || '600 13px "Barlow Condensed", "Arial Narrow", sans-serif';
    const fsz = parseFloat((ctx.font.match(/(\d+(?:\.\d+)?)px/) || [0, 13])[1]), h = Math.max(19, fsz + 7), w = ctx.measureText(text).width + 14;
    ctx.fillStyle = bg; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5);
  }
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const hexRGB = hex => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

  /* ---------- colour palettes for trails ---------- */
  const PALETTES = {
    rainbow: [[0, [140, 70, 255]], [0.2, [60, 110, 255]], [0.38, [30, 200, 255]], [0.55, [60, 230, 120]], [0.72, [255, 230, 60]], [0.86, [255, 140, 40]], [1, [255, 60, 70]]],
    plasma: [[0, [79, 63, 217]], [0.25, [155, 60, 207]], [0.5, [224, 69, 123]], [0.75, [255, 138, 61]], [1, [255, 224, 102]]],
    ice: [[0, [40, 60, 160]], [0.4, [60, 140, 230]], [0.75, [120, 220, 255]], [1, [235, 250, 255]]],
  };
  const paletteCache = {};
  function palette(name) {
    if (paletteCache[name]) return paletteCache[name];
    const stops = PALETTES[name] || PALETTES.rainbow, out = [];
    for (let i = 0; i < 64; i++) {
      const f = i / 63; let k = 0;
      while (k < stops.length - 2 && f > stops[k + 1][0]) k++;
      const [f0, c0] = stops[k], [f1, c1] = stops[k + 1], u = (f - f0) / (f1 - f0);
      out.push(`rgb(${c0.map((c, j) => Math.round(c + (c1[j] - c) * u)).join(',')})`);
    }
    out.css = 'linear-gradient(90deg,' + stops.map(([f, c]) => `rgb(${c.join(',')}) ${Math.round(f * 100)}%`).join(',') + ')';
    return (paletteCache[name] = out);
  }

  /* ---------- axis helpers ---------- */
  function niceTicks(lo, hi, n) {
    const span = hi - lo;
    if (!(span > 0)) return [lo];
    const step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), f = step0 / mag;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }
  const tickLabel = v => {
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e4 || a < 1e-3) return fmt.sci(v, 2);
    return String(+v.toPrecision(4)).replace('-', '−');
  };
  function unitFor(max, base, prefixes) {
    const P = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, '': 1, m: 1e-3, μ: 1e-6, n: 1e-9, p: 1e-12 };
    for (const p of prefixes) if (max >= P[p] * 0.999) return { f: P[p], u: p + base };
    const p = prefixes[prefixes.length - 1];
    return { f: P[p], u: p + base };
  }
  const timeUnit = t => unitFor(t, 's', ['', 'm', 'μ', 'n', 'p']);
  const energyUnit = J => { const u = unitFor(J / C.e, 'eV', ['T', 'G', 'M', 'k', '']); return { f: u.f * C.e, u: u.u }; };
  const lengthUnit = m => m >= 2 ? { f: 1, u: 'm' } : m >= 0.02 ? { f: 0.01, u: 'cm' } : m >= 2e-5 ? { f: 0.001, u: 'mm' } : { f: 1e-6, u: 'μm' };
  function powUnit(max, base) {
    const ex = Math.floor(Math.log10(Math.max(max, 1e-300)));
    if (ex >= -2 && ex <= 3) return { f: 1, u: base };
    return { f: 10 ** ex, u: '× 10' + PHYS.sup(ex) + ' ' + base };
  }

  /* ---------- dark glass screen with an oscilloscope graticule ---------- */
  function screenBg(ctx, W, H, o = {}) {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, o.c0 || '#121a16'); g.addColorStop(1, o.c1 || '#060907');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const step = o.grid === undefined ? 40 : o.grid;
    if (!step) return;
    const x0 = (W / 2) % step, y0 = (H / 2) % step;
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(190,225,200,0.05)'; ctx.beginPath();
    for (let x = x0; x < W; x += step) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
    for (let y = y0; y < H; y += step) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
    ctx.stroke();
    if (o.ticks === false) return;
    const cx = Math.round(W / 2) + 0.5, cy = Math.round(H / 2) + 0.5, m = step / 5;
    ctx.strokeStyle = 'rgba(190,225,200,0.11)'; ctx.beginPath();
    for (let x = (W / 2) % m; x < W; x += m) { ctx.moveTo(x, cy - 3); ctx.lineTo(x, cy + 3); }
    for (let y = (H / 2) % m; y < H; y += m) { ctx.moveTo(cx - 3, y); ctx.lineTo(cx + 3, y); }
    ctx.stroke();
  }

  /* ---------- canvas sizing ---------- */
  function fitCanvas(cv, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, dpr, w, h };
  }

  /* ---------- generic plot (graphs on every screen) ---------- */
  function plot(cv, cfg) {
    const r = cv.getBoundingClientRect();
    if (r.width < 20) return null;
    const { ctx } = fitCanvas(cv, r.width, r.height);
    const W = r.width, H = r.height;
    ctx.clearRect(0, 0, W, H);
    const pad = Object.assign({ l: 54, r: 14, t: 14, b: 32 }, cfg.pad || {});
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const xs = cfg.xlog ? (x => Math.log10(Math.max(x, 1e-300))) : (x => x);
    const xmin = xs(cfg.xmin), xmax = xs(cfg.xmax);
    const XP = x => pad.l + (xs(x) - xmin) / (xmax - xmin || 1) * pw;
    const YP = y => pad.t + (1 - (y - cfg.ymin) / (cfg.ymax - cfg.ymin || 1)) * ph;
    ctx.font = '12.5px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.lineWidth = 1;
    ctx.strokeStyle = skin.c('--plot-grid'); ctx.fillStyle = skin.c('--plot-text');
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const yf = cfg.yf || 1, xf = cfg.xf || 1;
    for (const v of niceTicks(cfg.ymin / yf, cfg.ymax / yf, cfg.yticks || 4)) {
      const yy = Math.round(YP(v * yf)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
      ctx.fillText(tickLabel(v), pad.l - 6, yy);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (cfg.xlog) {
      for (let d = Math.ceil(xmin); d <= Math.floor(xmax); d++) {
        const xx = Math.round(pad.l + (d - xmin) / (xmax - xmin) * pw) + 0.5;
        ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, pad.t + ph); ctx.stroke();
        ctx.fillText(cfg.xlogLabel ? cfg.xlogLabel(10 ** d) : tickLabel(10 ** d), xx, pad.t + ph + 4);
      }
    } else {
      for (const v of niceTicks(cfg.xmin / xf, cfg.xmax / xf, Math.max(3, Math.floor(pw / 80)))) {
        const xx = Math.round(XP(v * xf)) + 0.5;
        ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, pad.t + ph); ctx.stroke();
        ctx.fillText(tickLabel(v), xx, pad.t + ph + 4);
      }
    }
    ctx.strokeStyle = skin.c('--plot-axis'); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph); ctx.lineTo(W - pad.r, pad.t + ph); ctx.stroke();
    if (cfg.bands) for (const b of cfg.bands) {
      ctx.fillStyle = b.color; ctx.fillRect(XP(b.x0), pad.t, XP(b.x1) - XP(b.x0), ph);
      if (b.label && XP(b.x1) - XP(b.x0) > ctx.measureText(b.label).width + 4) { ctx.fillStyle = b.text || skin.c('--plot-text'); ctx.font = '600 10.5px "Barlow", "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(b.label, (XP(b.x0) + XP(b.x1)) / 2, pad.t + 20); }
    }
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t - 1, pw + 1, ph + 2); ctx.clip();
    for (const s of cfg.series || []) {
      if (!s.pts || !s.pts.length) continue;
      if (s.fill) {
        ctx.beginPath(); ctx.moveTo(XP(s.pts[0][0]), YP(cfg.ymin));
        for (const [x, y] of s.pts) ctx.lineTo(XP(x), YP(y));
        ctx.lineTo(XP(s.pts[s.pts.length - 1][0]), YP(cfg.ymin)); ctx.closePath();
        ctx.fillStyle = s.fill; ctx.fill();
      }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []); ctx.lineJoin = 'round';
      if (!s.dash && !reduceMotion) { ctx.shadowColor = s.color; ctx.shadowBlur = 6; }
      ctx.beginPath(); s.pts.forEach(([x, y], i) => i ? ctx.lineTo(XP(x), YP(y)) : ctx.moveTo(XP(x), YP(y))); ctx.stroke();
      ctx.shadowBlur = 0; ctx.setLineDash([]);
      if (s.dot) { const [x, y] = s.pts[s.pts.length - 1]; ctx.fillStyle = '#fff'; ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(XP(x), YP(y), 4, 0, TAU); ctx.fill(); ctx.stroke(); }
    }
    if (cfg.vlines) for (const v of cfg.vlines) {
      ctx.strokeStyle = v.color || skin.c('--plot-axis'); ctx.setLineDash(v.dash || [4, 4]); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(XP(v.x), pad.t); ctx.lineTo(XP(v.x), pad.t + ph); ctx.stroke(); ctx.setLineDash([]);
      if (v.label) { ctx.fillStyle = v.color || skin.c('--plot-text'); ctx.font = '600 10.5px "Barlow", "Segoe UI", sans-serif'; ctx.textAlign = XP(v.x) > W - pad.r - 90 ? 'right' : 'left'; ctx.textBaseline = 'top'; ctx.fillText(v.label, XP(v.x) + (XP(v.x) > W - pad.r - 90 ? -4 : 4), pad.t + 36); }
    }
    ctx.restore();
    ctx.fillStyle = skin.c('--plot-strong'); ctx.font = '600 11.5px "Barlow", "Segoe UI", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(cfg.ylabel || '', pad.l + 6, pad.t + 2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(cfg.xlabel || '', W - pad.r, H - 1);
    return { ctx, XP, YP, pad, pw, ph, W, H };
  }

  /* ---------- controls ---------- */
  // Slider + number box; log sliders map 0..1000 to [min, max] logarithmically.
  function bindRange(o) {
    const r = o.range, n = o.num;
    const toPos = v => o.log ? 1000 * Math.log(v / o.min) / Math.log(o.max / o.min) : v;
    const fromPos = p => o.log ? o.min * Math.pow(o.max / o.min, p / 1000) : p;
    if (o.log) { r.min = 0; r.max = 1000; r.step = 1; } else { r.min = o.min; r.max = o.max; r.step = o.step; }
    if (n) { n.min = o.min; n.max = o.max; n.step = o.int ? '1' : 'any'; }
    const ctl = {
      sync() {
        const v = o.get();
        r.value = String(clamp(toPos(v), +r.min, +r.max));
        const f = clamp((toPos(v) - +r.min) / (+r.max - +r.min) * 100, 0, 100);
        r.style.setProperty('--fill', f + '%');
        if (n && document.activeElement !== n) n.value = o.fmt ? o.fmt(v) : String(+(+v).toPrecision(6));
      },
      setLimits(min, max) { o.min = min; o.max = max; if (!o.log) { r.min = min; r.max = max; } if (n) { n.min = min; n.max = max; } ctl.sync(); },
    };
    r.addEventListener('input', () => { let v = fromPos(+r.value); if (o.int) v = Math.round(v); else if (o.log) v = +v.toPrecision(3); o.set(clamp(v, o.min, o.max)); ctl.sync(); });
    if (n) {
      n.addEventListener('change', () => { let v = parseFloat(n.value); if (!isFinite(v)) v = o.get(); if (o.int) v = Math.round(v); o.set(clamp(v, o.min, o.max)); n.blur(); ctl.sync(); });
      n.addEventListener('keydown', ev => { if (ev.key === 'Enter') n.dispatchEvent(new Event('change')); });
    }
    ctl.sync();
    return ctl;
  }
  function segInit(el, get, set) {
    const sync = () => { for (const b of $$('button', el)) b.setAttribute('aria-checked', String(b.dataset.value === get())); };
    el.addEventListener('click', ev => { const b = ev.target.closest('button[data-value]'); if (!b) return; set(b.dataset.value); sync(); });
    sync();
    return { sync };
  }

  /* ---------- drag-to-resize grips ---------- */
  // o: { axis: 'xy' | 'y', get() → current size, set(v, dragging), reset() }
  function grip(el, o) {
    if (!el) return;
    let d = null;
    const cls = o.axis === 'y' ? 'is-resizing-y' : o.axis === 'x' ? 'is-resizing-x' : 'is-resizing';
    el.addEventListener('pointerdown', ev => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation();
      try { el.setPointerCapture(ev.pointerId); } catch (_) { /* old browsers */ }
      d = { x: ev.clientX, y: ev.clientY, v0: o.get() };
      el.classList.add('is-dragging'); document.body.classList.add(cls);
    });
    el.addEventListener('pointermove', ev => {
      if (!d) return;
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      const delta = o.axis === 'y' ? dy : o.axis === 'x' ? dx : (Math.abs(dx) > Math.abs(dy) ? dx : dy);
      o.set(d.v0 + delta, true);
    });
    const end = () => { if (!d) return; d = null; el.classList.remove('is-dragging'); document.body.classList.remove(cls); o.set(o.get(), false); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    el.addEventListener('dblclick', ev => { ev.preventDefault(); o.reset(); });
    el.addEventListener('keydown', ev => {
      const st = ev.shiftKey ? 80 : 20;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { o.set(o.get() + st, false); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { o.set(o.get() - st, false); ev.preventDefault(); }
      else if (ev.key === 'Home' || ev.key === 'Escape') { o.reset(); ev.preventDefault(); }
    });
  }
  function sizeBadge(wrap, big, small, ms = 1300) {
    const b = wrap && wrap.querySelector('.size-badge'); if (!b) return;
    b.innerHTML = big + (small ? `<small>${small}</small>` : '');
    b.hidden = false; clearTimeout(b._t);
    if (ms) b._t = setTimeout(() => { b.hidden = true; }, ms);
  }

  /* ---------- toasts ---------- */
  function toast(el, html, kind = '', ms = 9000) {
    if (!el) return;
    el.querySelector('.toast-text').innerHTML = html;
    el.className = 'toast' + (kind ? ' is-' + kind : '');
    el.hidden = false;
    clearTimeout(el._t);
    if (ms) el._t = setTimeout(() => { el.hidden = true; }, ms);
  }

  /* ---------- missions (shared by all screens) ---------- */
  const missions = {
    list: [], done: {},
    init() { this.done = store.get('cl-missions2', {}) || {}; },
    add(m) { this.list.push(m); },
    complete(id) {
      if (this.done[id]) return false;
      const m = this.list.find(x => x.id === id); if (!m) return false;
      this.done[id] = Date.now(); store.set('cl-missions2', this.done);
      audio.ding();
      bus.emit('mission', m);
      return m;
    },
    count(screen) { const L = screen ? this.list.filter(m => m.screen === screen) : this.list; return [L.filter(m => this.done[m.id]).length, L.length]; },
    render(el, screen) {
      if (!el) return;
      el.innerHTML = this.list.filter(m => m.screen === screen).map(m =>
        `<li class="mission${this.done[m.id] ? ' is-done' : ''}"><span class="mk">${this.done[m.id] ? '✓' : ''}</span><div><div class="mt">${m.title}${m.full ? ' <span class="m-full" title="Needs a control that only Intermediate shows">Intermediate</span>' : ''}</div><div class="mg">${m.goal}</div></div></li>`).join('');
    },
    reset() { this.done = {}; store.set('cl-missions2', {}); bus.emit('mission', null); },
  };

  // ---- zoom keys (+, − and the level key): + and − step through these levels; the level key shows the zoom in use
  // and steps 1× → 2× → 3× → back to 1× (from any other level it goes back to 1×)
  const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128];
  const zoom = {
    step(z, dir, lo = 1, hi = 128) {
      const L = ZOOMS.filter(v => v >= lo - 1e-9 && v <= hi + 1e-9);
      if (dir > 0) { for (const v of L) if (v > z * 1.02) return v; return hi; }
      for (let i = L.length - 1; i >= 0; i--) if (L[i] < z / 1.02) return L[i];
      return lo;
    },
    cycle: z => (Math.abs(z - 1) < 0.02 ? 2 : Math.abs(z - 2) < 0.04 ? 3 : 1),
    label(z) { const r = z >= 10 ? Math.round(z) : z < 1 ? Math.round(z * 100) / 100 : Math.round(z * 10) / 10; return `${r}×`; },
    // write the level onto a key, with a title that says what the next press does
    show(btn, z, what = 'whole machine') {
      if (!btn) return;
      const t = zoom.label(z), next = zoom.cycle(z);
      if (btn.textContent !== t) btn.textContent = t;
      btn.classList.toggle('is-zoomed', Math.abs(z - 1) > 0.02);
      btn.classList.toggle('is-long', t.length > 3);
      const tip = `Zoom ${t}. Press for ${next === 1 ? `1× (the ${what})` : `${next}×`}`;
      btn.title = tip; btn.setAttribute('aria-label', tip);
    },
  };

  return {
    zoom,
    PHYS, C, fmt, $, $$, clamp, TAU, DEG, e, pl, en, len, si, pct, mev, rnd, reduceMotion, store, bus, skin, audio, FX, shaker,
    arrow, haloText, pill, hexA, hexRGB, palette, PALETTES, niceTicks, tickLabel, unitFor, timeUnit, energyUnit, lengthUnit, powUnit,
    fitCanvas, plot, screenBg, bindRange, segInit, toast, missions, grip, sizeBadge, screens: {},
  };
})();
