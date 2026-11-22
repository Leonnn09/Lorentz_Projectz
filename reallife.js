/* =====================================================================
   Project Lorentz — "In real life" (CL.reallife).
   Where the physics of each station is used outside the classroom:
   a hospital that finds cancer, and a train that floats to the airport.
   A drawer opened from the top bar shows the stories for the current
   station (all of them on Home and Physics); Home also has a grid of them.
   Every number is checked against the sources listed with its story.
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, TAU, reduceMotion, fitCanvas } = CL;

  /* ---------------- the stories ---------------- */
  const PRESET = id => () => { CL.go('lab'); const s = $('#labPreset'); if (s) { s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); } };
  const CLICK = (screen, sel) => () => { CL.go(screen); setTimeout(() => { const b = $(sel); if (b) b.click(); }, 60); };
  const CARDS = {
    pet: {
      machine: 'Cyclotron', where: 'Hospitals', title: 'PET scans find cancer', art: 'pet',
      stat: ['110 min', 'half-life of fluorine-18: why the cyclotron must be close to the scanner'],
      text: [
        'A hospital cyclotron fires protons of about 10 to 20 MeV into water made with oxygen-18, turning some of it into fluorine-18. The fluorine is built into a sugar (FDG). Cancer cells use a lot of sugar, so they collect it and light up in the scan.',
        'Each fluorine-18 atom sends out a positron. It meets an electron and both turn into two gamma rays of 511 keV that fly off in opposite directions. The ring of detectors catches the pair, and the computer draws a line through the spot they came from.',
        'In Jakarta, cyclotrons for PET run at RSK Dharmais, MRCCC Siloam and RS Gading Pluit, and in November 2024 one opened at RS Mandaya Royal Puri in Tangerang.'],
      here: 'The default machine here reaches about 7.8 MeV. The hospital preset reaches about 17 MeV, inside the 10–20 MeV range used for fluorine-18.',
      try: ['Load the hospital PET cyclotron', PRESET('pet')], sim: 'pet',
      src: [['Kemenkes RI (Nov 2024): cyclotrons in Jakarta', 'https://kemkes.go.id/id/menkes-dorong-rumah-sakit-swasta-tingkatkan-layanan-dengan-teknologi-canggih-untuk-deteksi-kanker'],
        ['Silakhuddin, Jurnal Penelitian Saintek (UNY): ¹⁸O(p,n)¹⁸F with 10–20 MeV protons', 'https://journal.uny.ac.id/index.php/saintek/article/view/10555']],
    },
    maglev: {
      machine: 'Gauss gun', where: 'Trains', title: 'Maglev trains are pulled by coils in the track', art: 'maglev',
      stat: ['603 km/h', 'record set by Japan’s L0 Series maglev, 2015'],
      text: [
        'A maglev train floats on magnetic forces. Its propulsion is a linear motor: coils in the guideway are switched on in turn, so their magnetic field travels along the track and pulls the magnets on the train forward.',
        'The Japanese L0 Series reached 603 km/h in 2015. The Shanghai maglev, from the airport to the city, carried passengers at up to 431 km/h.'],
      here: 'Your Gauss gun does the same with four coils: each one pulls the slug, then switches off as the slug reaches its middle.',
      try: ['Open the Gauss gun', () => CL.go('gauss')], sim: 'maglev',
      src: [['Wikipedia: Maglev (records, linear motors)', 'https://en.wikipedia.org/wiki/Maglev'], ['Wikipedia: SCMaglev', 'https://en.wikipedia.org/wiki/SCMaglev']],
    },
  };
  const BY_SCREEN = { lab: ['pet'], gauss: ['maglev'] };
  const GROUPS = [['Cyclotron', ['pet']], ['Gauss gun', ['maglev']]];
  const HOME_TILES = ['pet', 'maglev'];
  const SCREEN_OF = { pet: 'lab', maglev: 'gauss' };
  const TITLE = { lab: 'the cyclotron', gauss: 'the Gauss gun' };

  /* ---------------- the drawings: small looping animations ---------------- */
  const F = n => `600 ${n}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  function back(c, w, h) {
    c.fillStyle = '#070b0d'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1; c.beginPath();
    for (let x = 0.5; x < w; x += 22) { c.moveTo(x, 0); c.lineTo(x, h); }
    for (let y = 0.5; y < h; y += 22) { c.moveTo(0, y); c.lineTo(w, y); }
    c.stroke();
  }
  function txt(c, s, x, y, col = 'rgba(214,224,218,0.78)', al = 'left', n = 12) { c.font = F(n); c.fillStyle = col; c.textAlign = al; c.textBaseline = 'alphabetic'; c.fillText(s, x, y); }
  function glow(c, x, y, r, rgb, a = 1) { if (r <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  const rnd = (a, b) => a + Math.random() * (b - a);
  // half circles alternating between the dees, radius growing as the square root of the number of pushes (as on Home)
  function spiralArcs(R, n) {
    const out = []; let y = 0;
    for (let k = 0; k < n; k++) { const up = k % 2 === 0, r = R * Math.sqrt((k + 1) / n), c = up ? y - r : y + r; out.push({ r, cy: c, a0: up ? Math.PI / 2 : -Math.PI / 2 }); y = up ? c - r : c + r; }
    const sh = (out[n - 1].cy + out[n - 2].cy) / 2; for (const a of out) a.cy -= sh;
    return out;
  }
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  const ART = {
    // positron + electron → two 511 keV gamma rays, back to back; the ring lights where they land
    pet(c, w, h, t, st) {
      back(c, w, h);
      const cx = w * 0.5, cy = h * 0.52, R = Math.min(w * 0.34, h * 0.42), N = 36;
      if (!st.hits) { st.hits = new Array(N).fill(-9); st.ev = []; st.next = 0; }
      c.fillStyle = '#152029'; c.strokeStyle = 'rgba(150,185,200,0.22)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(cx, cy, R * 0.66, R * 0.5, 0, 0, TAU); c.fill(); c.stroke();
      const tx = cx + R * 0.22, ty = cy - R * 0.12;
      glow(c, tx, ty, R * 0.22, '220,80,130', 0.5 + 0.15 * Math.sin(t * 3));
      if (t > st.next) {
        st.next = t + rnd(0.18, 0.4);
        const hot = Math.random() < 0.72, a0 = Math.random() * TAU, r0 = hot ? Math.random() * R * 0.09 : Math.random() * R * 0.42;
        st.ev.push({ x: (hot ? tx : cx) + Math.cos(a0) * r0, y: (hot ? ty : cy) + Math.sin(a0) * r0 * 0.7, th: Math.random() * Math.PI, t0: t });
      }
      for (const e of st.ev) {
        const px = e.x - cx, py = e.y - cy, ux = Math.cos(e.th), uy = Math.sin(e.th), d = (t - e.t0) * R * 2.2;
        const reach = s => { const b = s * (px * ux + py * uy); return -b + Math.sqrt(b * b - (px * px + py * py) + R * R); };
        let both = true;
        for (const s of [1, -1]) {
          const dm = reach(s), dd = Math.min(d, dm), ex = e.x + s * ux * dd, ey = e.y + s * uy * dd;
          if (d < dm) { both = false; c.strokeStyle = 'rgba(255,230,140,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(e.x + s * ux * Math.max(0, dd - R * 0.25), e.y + s * uy * Math.max(0, dd - R * 0.25)); c.lineTo(ex, ey); c.stroke(); glow(c, ex, ey, 5, '255,235,160', 0.9); }
          else if (!e['h' + s]) { e['h' + s] = 1; const a = Math.atan2(ey - cy, ex - cx); st.hits[((Math.round(a / TAU * N) % N) + N) % N] = t; }
        }
        if (both) {
          if (e.tl == null) e.tl = t;
          const k = 1 - (t - e.tl) / 0.8;
          if (k > 0) { const dA = reach(1), dB = reach(-1); c.strokeStyle = `rgba(120,220,255,${0.45 * k})`; c.lineWidth = 1; c.beginPath(); c.moveTo(e.x + ux * dA, e.y + uy * dA); c.lineTo(e.x - ux * dB, e.y - uy * dB); c.stroke(); }
          else e.dead = 1;
        }
      }
      st.ev = st.ev.filter(e => !e.dead);
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU, lit = clamp(1 - (t - st.hits[i]) / 0.55, 0, 1);
        c.save(); c.translate(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6)); c.rotate(a);
        c.fillStyle = lit > 0 ? `rgb(${90 + 165 * lit},${110 + 120 * lit},${120 + 30 * lit})` : '#26343c';
        c.fillRect(-5, -R * 0.08, 10, R * 0.16); c.restore();
        if (lit > 0) glow(c, cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6), 12, '255,220,140', 0.5 * lit);
      }
      txt(c, 'detector ring', 10, h - 10, 'rgba(214,224,218,0.6)');
      txt(c, '511 keV back to back', w - 10, 18, 'rgba(255,230,140,0.85)', 'right');
    },
    // the train stays in view; the guideway and its coils slide underneath
    maglev(c, w, h, t) {
      back(c, w, h);
      const gy = h * 0.7, sp = 160, off = (t * sp) % 16;
      c.strokeStyle = 'rgba(214,224,218,0.12)'; c.lineWidth = 1;
      for (let i = 0; i < 9; i++) { const y = h * 0.12 + i * h * 0.06, x = w - ((t * sp * (1.4 + i * 0.13) + i * 97) % (w + 120)); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 50 + i * 4, y); c.stroke(); }
      c.fillStyle = '#2a3137'; c.fillRect(0, gy, w, h - gy);
      const trainX = w * 0.3, trainW = w * 0.46;
      for (let x = -off; x < w + 16; x += 16) {
        const rel = (x - trainX) / 48, near = clamp(1 - Math.abs(x - (trainX + trainW / 2)) / (trainW * 0.75), 0, 1);
        const ph = Math.sin(rel * Math.PI + t * 0.0), on = near > 0;
        c.fillStyle = on ? (ph > 0 ? `rgba(229,72,63,${0.25 + 0.7 * near})` : `rgba(62,126,230,${0.25 + 0.7 * near})`) : '#3a434a';
        c.fillRect(x + 2, gy - 9, 11, 8);
      }
      const hov = 4 + Math.sin(t * 3) * 0.8, ty = gy - 12 - hov;
      glow(c, trainX + trainW / 2, gy - 6, trainW * 0.6, '120,180,255', 0.12);
      c.fillStyle = '#d9dee2'; c.beginPath(); c.moveTo(trainX, ty); c.lineTo(trainX, ty - 26); c.lineTo(trainX + trainW * 0.78, ty - 26);
      c.quadraticCurveTo(trainX + trainW * 1.02, ty - 22, trainX + trainW, ty); c.closePath(); c.fill();
      c.fillStyle = '#29425e'; c.fillRect(trainX + 8, ty - 20, trainW * 0.66, 7);
      c.fillStyle = '#4a5560'; for (let i = 0; i < 5; i++) c.fillRect(trainX + 10 + i * trainW * 0.18, ty, trainW * 0.1, 3);
      txt(c, 'coils in the guideway switch on in turn', 10, h - 8, 'rgba(214,224,218,0.6)');
      txt(c, '603 km/h', w - 10, 20, '#9df5b8', 'right', 16);
    },
  };

  /* ---------------- animation loop: only the drawings that are on screen ---------------- */
  const live = new Map();          // canvas -> { art, st, w, h, ctx, vis }
  let raf = 0, last = 0;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { for (const e of es) { const L = live.get(e.target); if (L) L.vis = e.isIntersecting; } kick(); }) : null;
  function attach(cv, art) {
    const L = { art, st: {}, vis: !io }; live.set(cv, L);
    if (io) io.observe(cv);
    size(cv);
  }
  function size(cv) { const L = live.get(cv); if (!L) return; const r = cv.getBoundingClientRect(); if (r.width < 4) return; L.w = r.width; L.h = r.height; L.ctx = fitCanvas(cv, r.width, r.height).ctx; L.st = {}; }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    const t = now / 1000; let any = false;
    for (const [cv, L] of live) {
      if (!cv.isConnected) { live.delete(cv); continue; }
      if (!L.vis || !cv.offsetParent) continue;
      if (!L.ctx || Math.abs(cv.getBoundingClientRect().width - L.w) > 1) size(cv);
      if (!L.ctx) continue;
      any = true;
      try { ART[L.art](L.ctx, L.w, L.h, reduceMotion ? 2.2 : t, L.st); } catch (e) { console.error(e); live.delete(cv); }
    }
    if (any && !reduceMotion) raf = requestAnimationFrame(tick);
    last = now;
  }
  window.addEventListener('resize', () => { for (const cv of live.keys()) size(cv); kick(); });

  /* ---------------- markup ---------------- */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function cardHTML(id) {
    const k = CARDS[id];
    return `<article class="rl-card" id="rl-${id}" aria-labelledby="rl-${id}-t">
      <canvas class="rl-art" data-art="${k.art}" aria-hidden="true"></canvas>
      <div class="rl-body">
        <p class="rl-where">${esc(k.where)}</p>
        <h3 id="rl-${id}-t">${esc(k.title)}</h3>
        <div class="rl-stat"><b>${esc(k.stat[0])}</b><span>${esc(k.stat[1])}</span></div>
        ${k.text.map(p => `<p>${esc(p)}</p>`).join('')}
        <p class="rl-here"><span class="rl-hand">In this app:</span> ${esc(k.here)}</p>
        ${k.sim || k.try ? `<div class="rl-acts">${k.sim ? `<button type="button" class="btn-go rl-sim" data-sim="${k.sim}">Simulate it</button>` : ''}${k.try ? `<button type="button" class="pbtn rl-try" data-try="${id}">${esc(k.try[0])}</button>` : ''}</div>` : ''}
        <details class="rl-src"><summary>Sources</summary><ul>${k.src.map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}</ul></details>
      </div>
    </article>`;
  }
  let opener = null;
  function open(screen, focusId) {
    const dr = $('#rlDrawer'), body = $('#rlBody');
    screen = screen || CL.active || 'home';
    const list = BY_SCREEN[screen];
    $('#rlTitle').textContent = list ? `In real life: ${TITLE[screen]}` : 'In real life';
    $('#rlSub').textContent = list ? 'Where the physics on this screen is used outside the classroom.' : 'Where the physics of every station is used outside the classroom.';
    body.innerHTML = list ? list.map(cardHTML).join('') : GROUPS.map(([g, ids]) => `<h3 class="rl-group">${g}</h3>` + ids.map(cardHTML).join('')).join('');
    for (const cv of $$('canvas.rl-art', body)) attach(cv, cv.dataset.art);
    opener = document.activeElement;
    dr.hidden = false; $('#rlScrim').hidden = false;
    requestAnimationFrame(() => { document.body.classList.add('rl-open'); for (const cv of $$('canvas.rl-art', body)) size(cv); kick(); });
    const target = focusId && $('#rl-' + focusId);
    if (target) { setTimeout(() => { target.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); target.classList.add('is-flash'); }, 280); }
    $('#rlClose').focus({ preventScroll: true });
    $('#btnReal').setAttribute('aria-expanded', 'true');
  }
  function close() {
    const dr = $('#rlDrawer'); if (dr.hidden) return;
    document.body.classList.remove('rl-open'); $('#btnReal').setAttribute('aria-expanded', 'false');
    setTimeout(() => { dr.hidden = true; $('#rlScrim').hidden = true; for (const cv of $$('canvas.rl-art', dr)) live.delete(cv); }, reduceMotion ? 0 : 260);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  function init() {
    $('#btnReal').addEventListener('click', () => ($('#rlDrawer').hidden ? open() : close()));
    $('#rlClose').addEventListener('click', close);
    $('#rlScrim').addEventListener('click', close);
    $('#rlDrawer').addEventListener('click', ev => {
      const sb = ev.target.closest('[data-sim]');
      if (sb && CL.realsim) { close(); CL.realsim.open(sb.dataset.sim); return; }
      const b = ev.target.closest('[data-try]'); if (!b) return; const k = CARDS[b.dataset.try]; close(); k.try[1]();
    });
    document.addEventListener('keydown', ev => {
      if ($('#rlDrawer').hidden) return;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
      else if (ev.key === 'Tab') {                         // keep the keyboard inside the drawer while it is open
        const f = $$('#rlDrawer button, #rlDrawer a[href], #rlDrawer summary').filter(e => e.offsetParent);
        if (!f.length) return;
        if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
      }
    }, true);
    // Home: a grid of the stories, each opening its station's drawer at that story
    const grid = $('#usesGrid');
    if (grid) {
      grid.innerHTML = HOME_TILES.map(id => { const k = CARDS[id]; return `<button type="button" class="use" data-use="${id}"><canvas class="rl-art" data-art="${k.art}" aria-hidden="true"></canvas><span class="use-where">${esc(k.where)}</span><span class="use-t">${esc(k.title)}</span><span class="use-stat"><b>${esc(k.stat[0])}</b> ${esc(k.stat[1])}</span>${k.sim ? '<span class="use-sim">You can run it</span>' : ''}</button>`; }).join('');
      for (const cv of $$('canvas.rl-art', grid)) attach(cv, cv.dataset.art);
      grid.addEventListener('click', ev => { const b = ev.target.closest('[data-use]'); if (b) open(SCREEN_OF[b.dataset.use], b.dataset.use); });
    }
    CL.bus.on('screen', kick);
    kick();
  }
  CL.reallife = { init, open, close, kick, CARDS, art: attach };
})();
