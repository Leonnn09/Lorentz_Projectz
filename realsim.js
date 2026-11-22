/* =====================================================================
   Project Lorentz — Real life, simulated (CL.realsim).
   Two machines from the "In real life" stories, run with real physics
   and real numbers, inside the station they belong to:
     Gauss gun  → a maglev train (the Shanghai airport line)
     Cyclotron  → PET medicine: a hospital cyclotron making fluorine-18
   Each has a "Why is this here?" card that runs the station's physics
   next to the real machine's, with the student's own settings.
   The physics is in realsim-physics.js (REAL); this file draws it and
   gives it controls. Every real number is listed with its source.
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, TAU, DEG, reduceMotion, fitCanvas, skin, audio, bus, plot, bindRange, segInit, pl, si, en, store } = CL;
  const R = REAL, G0 = R.C.g;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const mmss = t => { const s = Math.max(0, Math.round(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const F = (n, w = 600) => `${w} ${n}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const lamp = () => skin.c('--lamp');
  const simple = () => document.body.classList.contains('is-beginner');      // the Simple / Full switch in the top bar
  function glow(c, x, y, r, rgb, a = 1) { if (!(r > 0.5)) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function text(c, s, x, y, o = {}) { CL.haloText(c, s, x, y, { font: F(o.size || 13, o.weight || 600), align: o.align || 'left', base: o.base || 'middle', color: o.color || '#e6ece8', halo: o.halo || 3.5, haloColor: o.haloColor || 'rgba(4,7,9,0.88)' }); }
  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  const lerp = (a, b, f) => a + (b - a) * f;

  /* ---------------- where the numbers come from ---------------- */
  const SRC = {
    shanghai: ['Wikipedia: Shanghai maglev train (30.5 km; 300 km/h in 2:15; trips 7:20 and 8:10)', 'https://en.wikipedia.org/wiki/Shanghai_maglev_train'],
    ieee: ['IEEE Spectrum: Faster than a speeding bullet train (up to 1.5 m/s², 300 km/h in about 5 km)', 'https://spectrum.ieee.org/faster-than-a-speeding-bullet-train'],
    dewe: ['Dewesoft: testing the world’s fastest train (153.6 m, 574 passengers, 505 km/h allowed)', 'https://dewesoft.com/blog/testing-worlds-fastest-train'],
    tri: ['Transrapid International: the Transrapid maglev system (10 mm gap, 150 mm clearance)', 'https://www.ncl.ac.uk/media/wwwnclacuk/pressoffice/files/pressreleaseslegacy/TRI_Flug_Hoehe_e_5_021.pdf', 'Transrapid International'],
    wctr: ['WCTR 1992: the Transrapid’s long-stator propulsion (0 to 270 Hz)', 'https://wctrs-society.com/wp-content/uploads/abstracts/lyon/Segment%20062%20of%20WCTR92_Lyon%20_Vol4.pdf'],
    meis: ['Meisinger: 40 years of maglev vehicles in Germany (Transrapid 06: 120 t)', 'https://opus4.kobv.de/opus4-ohm/files/44/Meisinger_40years_MAGLEV.pdf'],
    transrapid: ['Wikipedia: Transrapid (levitation and guidance about 1.7 kW per tonne)', 'https://en.wikipedia.org/wiki/Transrapid'],
    maglev: ['Wikipedia: Maglev (603 km/h record, drag takes most of the energy)', 'https://en.wikipedia.org/wiki/Maglev'],
    stator: ['Patent CA 2308267: a long-stator winding divided into sections, e.g. about 1.2 km long, each fed from a substation', 'https://brevets-patents.ic.gc.ca/opic-cipo/cpd/eng/patent/2308267/summary.html'],
    hess: ['Hess et al. (2001), Radiochimica Acta 89, 357: the ¹⁸O(p,n)¹⁸F reaction from threshold up to 30 MeV, with thick-target yields', 'https://core.ac.uk/download/34905665.pdf'],
    exfor: ['IAEA EXFOR entry D4095: the measured data of Hess et al. (2001)', 'https://www-nds.iaea.org/nrdc/exfor-master/entry/d/d4095.txt'],
    nndc: ['NNDC, Brookhaven: adopted levels of fluorine-18 (half-life 109.77 min)', 'https://www.nndc.bnl.gov/ensnds/18/F/adopted.pdf', 'NNDC'],
    ame: ['KAERI table of nuclides: fluorine-18 (mass excess 0.873 MeV, from the atomic mass evaluation)', 'https://atom.kaeri.re.kr/cgi-bin/nuclide?nuc=F-18'],
    uny: ['Silakhuddin (2016), Jurnal Penelitian Saintek (UNY): the fluorine-18 yield of DECY-13, checked against the Dharmais and MRCCC cyclotrons in Jakarta', 'https://journal.uny.ac.id/index.php/saintek/article/view/10555'],
    dharm: ['Kambali et al.: fluorine-18 from the 11 MeV Eclipse cyclotron at Dharmais Cancer Hospital, Jakarta', 'https://core.ac.uk/download/194633535.pdf'],
    umich: ['University of Michigan (2018), EJNMMI Radiopharmacy and Chemistry: a GE PETtrace at 16 MeV, 55 µA for 22 min, gave 1330 ± 153 mCi; FDG came out at 72 % without decay correction', 'https://link.springer.com/10.1186/s41181-018-0048-x'],
    ibat: ['IBA at Cyclotrons 2013: Nirta Conical water targets at 18 MeV give 8.3–8.7 GBq per µA at saturation', 'https://accelconf.web.cern.ch/CYCLOTRONS2013/posters/wepsh043_poster.pdf'],
    fastlab: ['Journal of Nuclear Medicine Technology 41(1):32: FDG on a FASTlab takes about 22–25 minutes', 'https://tech.snmjournals.org/content/41/1/32.abstract'],
    snmmi: ['SNMMI/EANM guideline (2021), table 4: an adult FDG PET/CT uses about 259–370 MBq (7–10 mCi)', 'https://jnm.snmjournals.org/content/62/1/99/tab-figures-data'],
    eanm: ['EANM procedure guidelines for FDG PET/CT tumour imaging, version 2.0 (2015)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4315529/'],
    kemkes: ['Kemenkes RI (November 2024): cyclotrons for PET in Jakarta hospitals', 'https://kemkes.go.id/id/menkes-dorong-rumah-sakit-swasta-tingkatkan-layanan-dengan-teknologi-canggih-untuk-deteksi-kanker'],
    // why each machine exists, and who it helps
    kemkesfw: ['Kemenkes RI: cancer prevention and control framework (cancer is the third leading cause of death in Indonesia; 408,661 new cases and 242,099 deaths in 2022, GLOBOCAN)', 'https://www.kemkes.go.id/eng/layanan/cancer-prevention-and-control-framework', 'Kemenkes'],
    ugm: ['UGM: cancer cases surge in Indonesia; the high death rate is largely due to late diagnosis and treatment', 'https://ugm.ac.id/en/news/cancer-cases-surge-in-indonesia-experts-stress-early-symptom-awareness', 'UGM'],
    acs: ['American Cancer Society: PET scan for cancer (cancer cells take up more of the FDG sugar; PET helps find cancer, stage it and check treatment)', 'https://www.cancer.org/cancer/diagnosis-staging/tests/imaging-tests/pet-scan-for-cancer.html', 'American Cancer Society'],
    pudong: ['Pudong government: getting to the airport (about 30 km from downtown, an hour’s drive from People’s Square)', 'https://english.pudong.gov.cn/2017-07/19/c_84852_2.htm', 'Pudong government'],
  };

  /* ---------------- the three simulations and where they live ---------------- */
  const SIM = {
    maglev: { name: 'Maglev train', tag: 'the airport in 8 minutes', art: 'maglev', host: 'gauss', line: 'The Shanghai airport train: 30 km in about 8 minutes.', why: 'Crosses 30 km to the airport in about 8 minutes, pulled by coils in the track: a Gauss gun as a railway.' },
    pet: { name: 'PET medicine', tag: 'finds cancer early', art: 'pet', host: 'lab', line: 'Make the medicine that finds cancer, before it decays.', why: 'Makes the medicine that finds cancer, fresh every morning, because it halves every 110 minutes.' },
  };
  const ORDER = ['pet', 'maglev'];
  const HOSTS = { lab: ['pet'], gauss: ['maglev'] };
  const HOST_NAME = { lab: 'cyclotron', gauss: 'Gauss gun' };
  const ICON = {
    maglev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 14.5h15.8c2.9 0 5.2-1.2 5.2-2.9 0-2.1-3.2-4.6-8.5-4.6H1.5zm2-5.6h3v2.4h-3zm4.5 0h3v2.4H8zm4.5 0h2.4c1 0 2.1.5 2.8 1.3l.9 1.1h-6.1zM1.5 16.5h21v1.8h-21z"/></svg>',
    pet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M10 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 3.6a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8z"/><path d="M3 12.2h20v1.9H3z"/><circle cx="10" cy="10.3" r="1.4"/></svg>',
  };

  /* ---------------- small builders for the side panel ---------------- */
  const ctl = (id, label, unit, mode = 'decimal') => `<div class="ctl"><div class="ctl-row"><label class="ctl-label" for="r-rs-${id}">${label}</label><div class="ctl-num"><input id="n-rs-${id}" type="number" inputmode="${mode}" aria-label="${label}${unit ? ' in ' + unit : ''}"><span class="ctl-unit">${unit}</span></div></div><input id="r-rs-${id}" type="range"></div>`;
  const range = (id, o) => bindRange(Object.assign({ range: $('#r-rs-' + id), num: $('#n-rs-' + id) }, o));
  const segHTML = (id, label, opts, cls = '') => `<div class="seg ${cls}" id="rs-${id}" role="radiogroup" aria-label="${label}">${opts.map(([v, t, s]) => `<button type="button" role="radio" data-value="${v}">${t}${s ? `<small>${s}</small>` : ''}</button>`).join('')}</div>`;
  const row = (label, val, sub, work, cls = '') => `<div class="drow${cls ? ' is-' + cls : ''}"><div class="drow-head"><span class="drow-label">${label}</span><span class="drow-val">${val}</span></div>${sub ? `<div class="drow-sub">${sub}</div>` : ''}${work ? `<div class="drow-work">${work}</div>` : ''}</div>`;
  const sec = t => `<div class="dsec">${t}</div>`;
  const cmpTable = rows => `<div class="table-wrap"><table class="nb-table rs-cmp"><thead><tr><th>What</th><th>This simulation</th><th>Real world</th><th>Source</th></tr></thead><tbody>${rows.map(([w, m, r, s, cls]) => `<tr${cls ? ` class="is-${cls}"` : ''}><td>${w}</td><td>${m}</td><td>${r}</td><td>${s ? `<a href="${SRC[s][1]}" target="_blank" rel="noopener">${esc(SRC[s][0].split(':')[0])}</a>` : '–'}</td></tr>`).join('')}</tbody></table></div>`;

  /* ---------------- the stations' own numbers, for the side-by-side comparisons ---------------- */
  let gaussCache = { key: '' };
  function gaussNow() {                       // the student's coil gun as it is set now (fired in the background, not on screen)
    const g = CL.screens.gauss && CL.screens.gauss.S;
    if (!g) return null;
    const key = [g.stages, g.turns, g.current, g.slugCm, g.material, g.cutoff].join();
    if (gaussCache.key !== key) {
      try { const r = CL.PHYS.coilgun({ stages: g.stages, turns: g.turns, current: g.current, slugLen: g.slugCm / 100, material: g.material, cutoff: g.cutoff, real: false }); gaussCache = { key, r, g: Object.assign({}, g) }; }
      catch (err) { return null; }
    }
    return gaussCache;
  }
  function labNow() {                         // the student's cyclotron as it is set now
    if (!CL.lab || !CL.lab.D) return null;
    const D = CL.lab.D, P = CL.lab.pred, S = CL.lab.S;
    return { B: D.Bmag, part: D.part, fc: P.fc, Kmax: P.Kmax, vmax: P.vmax, R: S.R, V: S.Vkv * 1e3, gain: P.gainTurn, coils: S.coils, turns: S.turns, I: D.I };
  }
  const fmtLenS = m => m >= 1000 ? `${pl(m / 1000, 3)} km` : m >= 1 ? `${pl(m, 3)} m` : m >= 0.01 ? `${pl(m * 100, 3)} cm` : `${pl(m * 1000, 3)} mm`;
  const fmtB = B => B >= 0.1 ? `${pl(B, 3)} T` : B >= 1e-4 ? `${pl(B * 1e3, 3)} mT` : B >= 1e-6 ? `${pl(B * 1e6, 3)} μT` : `${pl(B * 1e9, 3)} nT`;

  /* ---------------- backgrounds shared by the 2D and 3D views ---------------- */
  // blue hour over a city: the sky down to the horizon at hy, a low moon, a warm afterglow; the land below it
  function drawBlueHour(c, W, H, hy, tt) {
    const top = Math.min(0, hy - H * 1.1);
    const sg = c.createLinearGradient(0, top, 0, hy);
    sg.addColorStop(0, '#0a1430'); sg.addColorStop(0.45, '#1d2d5c'); sg.addColorStop(0.75, '#5a4778'); sg.addColorStop(0.92, '#c46e6a'); sg.addColorStop(1, '#f0a070');
    c.fillStyle = sg; c.fillRect(0, 0, W, Math.max(0, hy));
    for (let i = 0; i < 60; i++) { const x = hash(i) * W, y = top + hash(i + 50) * (hy - top) * 0.5; if (y < 0 || y > hy) continue; c.fillStyle = `rgba(230,240,255,${(0.15 + 0.4 * hash(i + 9)) * (1 - (y - top) / Math.max(1, (hy - top) * 0.5))})`; c.fillRect(x, y, 1.3, 1.3); }
    glow(c, W * 0.82, hy, Math.max(W, H) * 0.55, '255,160,100', 0.25);
    const mx = W * 0.18, my = top + (hy - top) * 0.3, mr = Math.max(9, H * 0.026);
    if (my > -mr && my < hy) { glow(c, mx, my, mr * 5, '220,230,255', 0.12); c.fillStyle = '#f3f0e2'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.fillStyle = 'rgba(29,45,92,0.92)'; c.beginPath(); c.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.92, 0, TAU); c.fill(); }
    if (hy < H) { const gg = c.createLinearGradient(0, hy, 0, H); gg.addColorStop(0, '#2a2a3a'); gg.addColorStop(0.08, '#1b2224'); gg.addColorStop(1, '#0c1110'); c.fillStyle = gg; c.fillRect(0, Math.max(0, hy), W, H - Math.max(0, hy)); }
  }
  // a starry sky with the Milky Way: stars are fixed to the screen size (seeded), and twinkle a little
  let starCache = null;

  /* ---------------- small looping drawings for the comparison card ---------------- */
  // 3-D skies: stars are directions, so they turn with the camera but never come closer; the Milky Way is a band of faint ones
  const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const v3n = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const v3x = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let skyDirs = null;
  const ease = f => f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
  function linkBack(c, W, H) { c.fillStyle = '#070b0d'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1; c.beginPath(); for (let x = 0.5; x < W; x += 22) { c.moveTo(x, 0); c.lineTo(x, H); } for (let y = 0.5; y < H; y += 22) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke(); }
  // two panels side by side, or one above the other on a narrow screen
  function twoPanels(c, W, H, t, left, right) {
    linkBack(c, W, H);
    const stack = W < 520, w = stack ? W : W / 2, h = stack ? H / 2 : H;
    c.save(); left(c, w, h, t); c.restore();
    c.save(); c.translate(stack ? 0 : w, stack ? h : 0); right(c, w, h, t); c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 1; c.beginPath();
    if (stack) { c.moveTo(8, h + 0.5); c.lineTo(W - 8, h + 0.5); } else { c.moveTo(w + 0.5, 8); c.lineTo(w + 0.5, H - 8); }
    c.stroke();
  }
  // the cyclotron's spiral: two dees, a half-circle per crossing, each one a little bigger
  function spiral(c, cx, cy, R, t, T = 4, n = 10) {
    const ph = (t % T) / T * n;
    for (const s of [-1, 1]) { c.fillStyle = s < 0 ? 'rgba(229,72,63,0.16)' : 'rgba(62,126,230,0.16)'; c.beginPath(); c.arc(cx + s * 2, cy, R, s < 0 ? Math.PI / 2 : -Math.PI / 2, s < 0 ? Math.PI * 1.5 : Math.PI / 2); c.fill(); }
    let y = cy, last = null; c.lineWidth = 1.6;
    for (let k = 0; k < Math.min(n, Math.ceil(ph)); k++) {
      const up = k % 2 === 0, r = R * 0.95 * Math.sqrt((k + 1) / n), ccy = up ? y - r : y + r, fr = Math.min(1, ph - k), a0 = up ? Math.PI / 2 : -Math.PI / 2;
      c.strokeStyle = `hsl(${200 - k * 14},90%,62%)`; c.beginPath(); c.arc(cx, ccy, r, a0, a0 - Math.PI * fr, true); c.stroke();
      const a = a0 - Math.PI * fr; last = [cx + r * Math.cos(a), ccy + r * Math.sin(a)];
      y = up ? ccy - r : ccy + r;
    }
    if (last) glow(c, last[0], last[1], 7, '255,255,255', 0.9);
  }
  const perSec = f => f >= 1e6 ? `${pl(f / 1e6, 3)} million times a second` : f >= 1e4 ? `${pl(f / 1e3, 3)} thousand times a second` : `${pl(f, 3)} times a second`;
  function panelCyclo(caption) {
    return (c, w, h, t) => {
      const lab = labNow(), R = Math.min(w * 0.2, h * 0.36);
      spiral(c, w * 0.72, h * 0.56, R, t);
      text(c, 'your cyclotron', 10, 15, { size: 13 });
      text(c, lab ? `B = ${fmtB(lab.B)}` : 'B ≈ 1 T', 10, 33, { size: 12, color: '#9df5b8' });
      text(c, lab ? `circles ${perSec(lab.fc)}` : 'circles millions of times a second', 10, 50, { size: 12, color: '#9df5b8' });
      text(c, caption, 10, h - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
    };
  }
  // two lanes that move together: your coil gun on top, the real machine below; a coil lights up while it pulls
  function drawLinkGauss(c, W, H, t, kind) {
    linkBack(c, W, H);
    const g = CL.screens.gauss && CL.screens.gauss.S, nCoil = g ? g.stages : 4, T = 3.4, f = ease(clamp((t % T) / (T * 0.85), 0, 1));
    const narrow = W < 520, x0 = narrow ? 10 : Math.min(160, W * 0.28), x1 = W - 12;
    const lanes = [
      { y: narrow ? H * 0.34 : H * 0.32, n: nCoil, label: 'your coil gun', sub: `${nCoil} coil${nCoil > 1 ? 's' : ''}, one iron slug`, big: true },
      { y: narrow ? H * 0.82 : H * 0.74, n: kind === 'maglev' ? 30 : 26, label: kind === 'maglev' ? 'maglev guideway' : 'EMALS in the deck', sub: kind === 'maglev' ? 'coils along the whole track' : 'a row of coils 91 m long', big: false },
    ];
    for (const L of lanes) {
      const pitch = (x1 - x0) / L.n, xo = x0 + f * (x1 - x0 + pitch * 0.5) - pitch * 0.5, ch = L.big ? 24 : 12;
      if (narrow) text(c, `${L.label}: ${L.sub}`, 10, L.y - (L.big ? 28 : 30), { size: 12, color: '#e6ece8' });
      else { text(c, L.label, 10, L.y - 8, { size: 13, color: '#e6ece8' }); text(c, L.sub, 10, L.y + 9, { size: 11, color: 'rgba(214,224,218,0.65)' }); }
      c.fillStyle = 'rgba(214,224,218,0.14)'; c.fillRect(x0, L.y - 1, x1 - x0, 2);
      for (let k = 0; k < L.n; k++) {
        const xc = x0 + (k + 0.5) * pitch, on = xo > xc - pitch * 1.05 && xo < xc;     // on while the load comes towards it, off once it reaches the middle
        c.fillStyle = on ? '#ffb020' : '#5a3a22'; c.fillRect(xc - pitch * 0.32, L.y - ch / 2, pitch * 0.64, ch);
        if (on) glow(c, xc, L.y, ch * 1.4, '255,176,32', 0.45);
      }
      if (L.big) { c.fillStyle = '#c3c9cd'; c.fillRect(xo - Math.min(pitch * 0.3, 14), L.y - 4, Math.min(pitch * 0.6, 28), 8); }
      else if (kind === 'maglev') {                      // a little train riding over the lit coils
        const tw = pitch * 6; c.fillStyle = '#e8ebe4'; c.beginPath(); c.moveTo(xo - tw, L.y - 4); c.lineTo(xo - tw, L.y - 16); c.lineTo(xo - 6, L.y - 16); c.quadraticCurveTo(xo + 6, L.y - 14, xo + 8, L.y - 4); c.closePath(); c.fill();
        c.fillStyle = '#1c2a36'; c.fillRect(xo - tw + 4, L.y - 13, tw - 12, 4);
      } else {                                            // the shuttle, towing a jet
        c.fillStyle = lamp(); c.fillRect(xo - 4, L.y - 4, 8, 4);
        c.fillStyle = '#a9b2b9'; c.beginPath(); c.moveTo(xo + 10, L.y - 9); c.lineTo(xo - 26, L.y - 11); c.lineTo(xo - 34, L.y - 20); c.lineTo(xo - 37, L.y - 20); c.lineTo(xo - 36, L.y - 9); c.lineTo(xo - 20, L.y - 6); c.lineTo(xo + 4, L.y - 6); c.closePath(); c.fill();
      }
    }
    if (W >= 640) text(c, 'same idea: each coil switches on as the load arrives, so the pull always comes from just ahead', x0, H - 10, { size: 11.5, color: '#ffd590' });
  }

  /* =====================================================================
     1. MAGLEV TRAIN — the Shanghai Transrapid
     ===================================================================== */
  function makeMaglev() {
    const LINES = {
      s431: { t: 'Shanghai 2004–21', s: 'up to 431 km/h', v: 431, km: 30.5 },
      s300: { t: 'Shanghai today', s: 'up to 300 km/h', v: 300, km: 30.5 },
      fast: { t: 'Flat out', s: '505 km/h, 60 km', v: 505, km: 60 },
    };
    // cur: current in the track coils, % of the real line's (not published: 100 % is the current that gives the
    // 44 kN per section fitted to the real acceleration). The pull of a synchronous motor is proportional to it.
    const p = { line: 's431', sections: 6, pax: 574, v: 431, km: 30.5, brake: 1.5, cur: 100, power: 20 };
    const thr = () => 44 * p.cur / 100;                  // kN of pull per section
    const TAU_V = R.ML.tau * 10, SEC = 1200;             // coils drawn 10× bigger; winding sections about 1.2 km long
    let d, st, hist, pred, scene = 0, lensX = 0, ctlPax, segLine, checkKey = '', checkCache = null;
    const params = (vKmh, km) => ({ sections: p.sections, pax: p.pax, vSet: vKmh / 3.6, length: km * 1e3, brake: p.brake, thrustPerSec: thr() * 1e3, power: p.power * 1e6 });
    function trip(vKmh, km) {
      const dd = R.mlSetup(params(vKmh, km)), s2 = R.mlInit(), pts = [[0, 0]];
      let next = 2;
      while (!s2.done && s2.t < 7200) { R.mlStep(s2, dd, 0.05); if (s2.t >= next) { pts.push([s2.t, s2.v]); next += 2; } }
      pts.push([s2.t, 0]);
      return { d: dd, st: s2, pts };
    }
    const shanghai = () => Math.abs(p.km - 30.5) < 1e-6;
    const ROAD_V = 30 / 3.6;                              // m/s: about an hour for the airport's 30 km by road (Pudong government)
    const roadT = () => p.km * 1e3 / ROAD_V;
    const ends = () => shanghai() ? ['Longyang Road', 'Pudong Airport'] : ['Start', 'End'];
    function reset() { d = R.mlSetup(params(p.v, p.km)); st = R.mlInit(); hist = [[0, 0]]; pred = trip(p.v, p.km); }
    function step(dts) {
      let left = dts;
      while (left > 1e-9 && !st.done) { const h = Math.min(0.05, left); R.mlStep(st, d, h); left -= h; if (st.t - hist[hist.length - 1][0] >= 0.5) hist.push([st.t, st.v]); }
      if (st.done && hist[hist.length - 1][1] !== 0) hist.push([st.t, 0]);
      return st.done;
    }
    const lineOf = () => Object.keys(LINES).find(k => Math.abs(LINES[k].v - p.v) < 0.6 && LINES[k].km === p.km) || '';
    const real = () => shanghai() && p.sections === 6 && p.cur === 100 && p.power === 20 && p.brake === 1.5 && (Math.round(p.v) === 431 || Math.round(p.v) === 300);
    function sideNotes() {
      const pill = $('#rsMlPill'); if (pill) pill.textContent = `${p.sections} sections · ${pl(d.m / 1000, 3)} t`;
      const n = $('#rsMlMass'); if (n) n.innerHTML = `Train ${pl(d.trainLen, 3)} m long, <b>${pl(d.m / 1000, 3)} t</b> (${p.sections} × 60 t plus ${p.pax} passengers at 80 kg). Seats: ${R.seats(p.sections)}.`;
      const fN = $('#rsMlFNote'); if (fN) fN.innerHTML = `The pull travels along the track at <b>2τf = ${pl(p.v, 3)} km/h</b>, and the train rides with it (τ = ${R.ML.tau} m between poles).`;
      const iN = $('#rsMlINote'); if (iN) iN.innerHTML = `Pull of the whole train: <b>${si(p.sections * thr() * 1e3, 'N', 3)}</b> (${pl(thr(), 3)} kN per section). More current, stronger magnets, stronger pull: like the current in your Gauss gun.${p.cur > 100 ? ' Real coils run close to their heat limit, so this is a what-if.' : ''}`;
      const ln = $('#rsMlLineNote'); if (ln) ln.textContent = p.line === 's300' ? 'Since May 2021 the line runs at 300 km/h: 8 min 10 s.' : p.line === 's431' ? 'From 2004 to May 2021 the trains ran at up to 431 km/h: 7 min 20 s.' : p.line === 'fast' ? 'The Shanghai trains are authorised for up to 505 km/h; the real line is too short to reach it.' : 'Your own run.';
    }
    const sim = {
      go: 'Depart', speeds: [['1', 'Real time'], ['10', '10× faster'], ['30', '30× faster']], speed0: '10',
      canvasLabel: 'Side view of the maglev train on its guideway, with the speed, the frequency of the travelling field and a close-up of the magnetic gap',
      graphs: ['Speed during the trip', 'Motor pull and air drag'],
      side() {
        return `<div class="panel" data-level="expert"><div class="panel-title">Which run?</div>${segHTML('ml-line', 'Which run', Object.entries(LINES).map(([k, L]) => [k, L.t, L.s]), 'seg-3')}<p class="hint" id="rsMlLineNote"></p></div>
          <details class="acc tag-copper" open><summary><span class="acc-title">Coils in the track</span><span class="acc-pill">like a Gauss gun</span></summary><div class="acc-body">
            ${ctl('ml-f', 'How fast the coils switch', 'Hz')}<p class="hint" id="rsMlFNote"></p>
            ${ctl('ml-i', 'Current in the coils', '%')}<p class="hint" id="rsMlINote"></p>
            <p class="hint" data-level="beginner">Faster switching makes the pull move faster, so the train goes faster. More current makes the pull stronger, so it speeds up sooner.</p></div></details>
          <details class="acc tag-particle" open data-level="expert"><summary><span class="acc-title">Train</span><span class="acc-pill" id="rsMlPill"></span></summary><div class="acc-body">
            <div data-level="expert">${ctl('ml-sec', 'Sections', '', 'numeric')}</div>${ctl('ml-pax', 'Passengers', '', 'numeric')}<p class="hint" id="rsMlMass"></p></div></details>
          <details class="acc tag-rf" data-level="expert"><summary><span class="acc-title">Line and motor</span><span class="acc-pill">estimated</span></summary><div class="acc-body">
            ${ctl('ml-km', 'Length of the line', 'km')}${ctl('ml-br', 'Braking limit', 'm/s²')}${ctl('ml-pw', 'Converter power', 'MW')}
            <p class="hint">The coil current at 100 % and the converter power are not published. They were set once so the model accelerates like the real train (300 km/h in 2 min 15 s, 431 km/h in about 4 min); everything else follows from the physics.</p></div></details>`;
      },
      bind(changed) {
        segLine = segInit($('#rs-ml-line'), () => p.line, v => { p.line = v; p.v = LINES[v].v; p.km = LINES[v].km; ctlF.sync(); ctlKm.sync(); changed(); });
        range('ml-sec', { min: 2, max: 10, step: 1, int: true, get: () => p.sections, set: v => { const full = p.pax >= R.seats(p.sections); p.sections = v; p.pax = full ? R.seats(v) : Math.min(p.pax, R.seats(v)); ctlPax.setLimits(0, R.seats(v)); changed(); } });
        ctlPax = range('ml-pax', { min: 0, max: R.seats(p.sections), step: 1, int: true, get: () => p.pax, set: v => { p.pax = v; changed(); } });
        const ctlF = range('ml-f', { min: 20, max: 270, step: 1, int: true, get: () => Math.round(R.mlFreq(p.v / 3.6)), set: f => { p.v = Math.round(f * 2 * R.ML.tau * 36) / 10; p.line = lineOf(); segLine.sync(); changed(); } });
        range('ml-i', { min: 20, max: 150, step: 5, int: true, get: () => p.cur, set: v => { p.cur = v; changed(); } });
        const ctlKm = range('ml-km', { min: 2, max: 60, step: 0.5, get: () => p.km, set: v => { p.km = v; p.line = lineOf(); segLine.sync(); changed(); } });
        range('ml-br', { min: 0.2, max: 1.5, step: 0.05, get: () => p.brake, set: v => { p.brake = v; changed(); } });
        range('ml-pw', { min: 2, max: 60, step: 0.5, get: () => p.power, set: v => { p.power = v; changed(); } });
      },
      reset() { reset(); sideNotes(); },
      step,
      draw(c, W, H, dtr, running) {
        if (running) { scene += st.v * dtr; lensX += st.v * dtr / 400; }
        drawMaglev(c, W, H);
      },
      clock: () => `t = ${mmss(st.t)}`,
      status() {
        const e = ends();
        if (st.phase === 'ready') return [`Ready at ${e[0]}`, ''];
        if (st.done) return [`Arrived at ${e[1]} after ${mmss(st.t)}`, 'is-good'];
        const k = `${pl(st.v * 3.6, 3)} km/h`;
        return st.phase === 'brake' ? [`Braking · ${k}`, 'is-warn'] : st.phase === 'cruise' ? [`Cruising · ${k}`, 'is-run'] : st.phase === 'top' ? [`Flat out · ${k}`, 'is-warn'] : [`Accelerating · ${k}`, 'is-run'];
      },
      narrate() {
        const f = R.mlFreq(st.v), e = ends();
        if (simple()) {
          if (st.phase === 'ready') return `The track is lined with coils, a Gauss gun 30 km long. Their current makes a magnetic pull that <b>moves along the track</b>, and the magnets under the train ride along with it, just as your Gauss gun’s slug is pulled from coil to coil. You set how fast the coils switch (<b>${Math.round(R.mlFreq(p.v / 3.6))} times a second</b>, so ${pl(p.v, 3)} km/h) and how much current they carry (<b>${p.cur} %</b>). Press <b>Depart</b>.`;
          if (st.done) return `Arrived after <b>${mmss(st.t)}</b>, an average of ${pl(p.km * 1e3 / st.t * 3.6, 3)} km/h.${real() ? ` The real train takes ${Math.round(p.v) === 431 ? '7 min 20 s' : '8 min 10 s'}.` : ''}`;
          if (st.phase === 'brake') return `Braking: the moving field now sits just <b>behind</b> the train’s magnets, so it pulls them backwards. That is the “suck-back” a Gauss gun tries to avoid, used here on purpose. ${pl(st.v * 3.6, 3)} km/h.`;
          if (st.phase === 'cruise') return `Cruising at ${pl(st.v * 3.6, 3)} km/h. Now the coils only have to make up for the air pushing back.`;
          if (st.phase === 'top') return `Flat out: the air now pushes back as hard as the coils pull, so the train can’t go faster than about ${pl(d.vBal * 3.6, 3)} km/h.${Math.sqrt(d.Fmax / d.k) <= Math.cbrt(d.P / d.k) + 1e-9 ? ' Give the coils more current to pull harder.' : ''}`;
          if (st.v < d.vKnee) return `Speeding up at ${pl(st.a, 2)} m/s². The pull moves along the track just ahead of the train. To go faster, the coils must switch faster: <b>${pl(f, 3)} times a second</b> now.`;
          return `Still speeding up, but more slowly: the motor is at full power and the air pushes back harder and harder (drag grows with v²). ${pl(st.v * 3.6, 3)} km/h.`;
        }
        if (st.phase === 'ready') return `The guideway’s three-phase coils make a magnetic field that <b>travels along the track</b>; the electromagnets under the train lock onto it and are pulled along, just as your Gauss gun’s slug chases the next coil. Speed is set by frequency: <b>v = 2τf</b>, with a pole pitch τ of about ${R.ML.tau} m. Press <b>Depart</b> to run ${pl(p.km, 3)} km from ${e[0]} to ${e[1]}.`;
        if (st.done) { const rl = real() ? ` The real train needs <b>${Math.round(p.v) === 431 ? '7 min 20 s' : '8 min 10 s'}</b> for this run.` : ''; return `Arrived after <b>${mmss(st.t)}</b>, an average of ${pl(p.km * 1e3 / st.t * 3.6, 3)} km/h.${rl} The motor did ${pl(st.Edrive / 3.6e6, 3)} kWh of work; ${Math.round(st.Edrag / st.Edrive * 100)} % of it went into pushing air aside, and braking as a generator could send up to ${pl(st.Ebrake / 3.6e6, 3)} kWh back to the line.`; }
        if (st.phase === 'brake') return `Braking: the control centre shifts the travelling field so that it <b>lags just behind</b> the train’s magnets, which are now pulled backwards, and lowers the frequency as the train slows. The motor works as a generator and can feed energy back to the line. Deceleration ${pl(-st.a, 2)} m/s²; field ${pl(f, 3)} Hz.`;
        if (st.phase === 'cruise') return `Cruising at ${pl(st.v * 3.6, 3)} km/h. The motor only has to replace what air drag takes: ${si(st.D, 'N', 3)}, which at ${pl(st.v, 3)} m/s is <b>${si(st.D * st.v, 'W', 3)}</b>. Levitating and guiding the ${pl(d.m / 1000, 3)} t train takes only about ${si(R.ML.lev * d.m / 1000, 'W', 2)}.`;
        if (st.phase === 'top') return `Flat out: air drag (${si(st.D, 'N', 3)}) now takes almost all of the motor’s pull, so the train cannot go much faster than about <b>${pl(d.vBal * 3.6, 3)} km/h</b>, below the ${pl(p.v, 3)} km/h of the switching rate you set. ${Math.sqrt(d.Fmax / d.k) <= Math.cbrt(d.P / d.k) + 1e-9 ? `Here the coil current limits it: ${p.cur} % gives ${si(d.Fmax, 'N', 3)}, and drag reaches that at ${pl(d.vBal * 3.6, 3)} km/h. The control centre stops raising the frequency there, or the field would run away from the magnets and the train would fall out of step.` : 'Here the converters’ power limits it: drag grows as v², the power it needs as v³.'}`;
        if (st.v < d.vKnee) return `Accelerating at ${pl(st.a, 2)} m/s². The motor gives its full pull of <b>${si(d.Fmax, 'N', 3)}</b> (${pl(thr(), 3)} kN on each section at ${p.cur} % current) and the control centre raises the frequency to keep the field just ahead of the magnets: now <b>${pl(f, 3)} Hz</b>.`;
        return `Above ${pl(d.vKnee * 3.6, 3)} km/h the converters are at full power (${pl(p.power, 3)} MW), so the pull falls as <b>P/v</b> while air drag grows as v²: acceleration is down to ${pl(st.a, 2)} m/s². Field frequency ${pl(f, 3)} Hz.`;
      },
      tiles() {
        const f = R.mlFreq(st.v), P = st.F * st.v;
        return [
          ['Speed', `${pl(st.v * 3.6, 3)} km/h`, `${pl(st.v, 3)} m/s · ${st.a < 0 ? '−' : ''}${pl(Math.abs(st.a), 2)} m/s²`],
          ['Travelling field', `${pl(f, 3)} Hz`, `wave speed 2τf = ${pl(2 * R.ML.tau * f, 3)} m/s`],
          ['Motor power', P >= 0 ? si(P, 'W', 3) : `−${si(-P, 'W', 3)}`, `${st.F >= 0 ? 'pull' : 'braking'} ${si(Math.abs(st.F), 'N', 3)} · drag ${si(st.D, 'N', 3)}`, 'expert'],
          ['Trip', mmss(st.t), `${pl(st.x / 1e3, 3)} of ${pl(p.km, 3)} km`],
        ];
      },
      graphA(cv) {
        const tMax = Math.max(pred.st.t, st.t, 60) * 1.02;
        const r = plot(cv, { xmin: 0, xmax: tMax, xf: 60, ymin: 0, ymax: 560, xlabel: 'time (min)', ylabel: 'speed (km/h)', pad: { r: 16 },
          series: [{ pts: pred.pts.map(([t, v]) => [t, v * 3.6]), color: 'rgba(210,220,214,0.45)', width: 1.3, dash: [4, 4] }, { pts: hist.map(([t, v]) => [t, v * 3.6]), color: lamp(), width: 2.4, dot: st.phase !== 'ready' && !st.done }] });
        if (!r) return;
        const c = r.ctx;
        for (const [v, t] of [[300, 'Shanghai today 300'], [431, 'record service 431'], [505, 'allowed 505']]) {
          const y = Math.round(r.YP(v)) + 0.5; c.strokeStyle = 'rgba(255,210,120,0.28)'; c.setLineDash([2, 5]); c.lineWidth = 1; c.beginPath(); c.moveTo(r.pad.l, y); c.lineTo(r.W - r.pad.r, y); c.stroke(); c.setLineDash([]);
          c.fillStyle = 'rgba(255,214,140,0.75)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(t, r.W - r.pad.r - 4, y - 2);
        }
        c.fillStyle = 'rgba(210,220,214,0.6)'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('dashed: the whole trip, worked out in advance', r.pad.l + 6, r.pad.t + 18);
      },
      graphB(cv) {
        const vTop = Math.max(560, d.vBal * 3.6 * 1.06), thr = [], drg = [];
        for (let i = 0; i <= 160; i++) { const v = i / 160 * vTop / 3.6; thr.push([v * 3.6, R.mlThrust(d, v) / 1e3]); drg.push([v * 3.6, d.k * v * v / 1e3]); }
        const ymax = d.Fmax / 1e3 * 1.18;
        const r = plot(cv, { xmin: 0, xmax: vTop, ymin: 0, ymax, xlabel: 'speed (km/h)', ylabel: 'force (kN)', pad: { r: 16 },
          series: [{ pts: thr, color: lamp(), width: 2.2 }, { pts: drg, color: '#5cc8ff', width: 2.2 }],
          vlines: [{ x: d.vKnee * 3.6, label: 'full power', color: 'rgba(255,214,140,0.55)' }, { x: d.vBal * 3.6, label: `top ≈ ${pl(d.vBal * 3.6, 3)}`, color: 'rgba(120,210,255,0.7)' }] });
        if (!r) return;
        const c = r.ctx, v = st.v;
        c.font = '600 11px "Barlow", sans-serif'; c.textBaseline = 'bottom'; c.textAlign = 'left';
        c.fillStyle = lamp(); c.fillText('best pull of the motor', r.XP(d.vKnee * 3.6 * 0.3), r.YP(d.Fmax / 1e3) - 3);
        const vd = Math.min(vTop * 0.55, d.vBal * 3.6 * 0.62); c.fillStyle = '#5cc8ff'; c.fillText('air drag ½ρ·Cd·A·v²', r.XP(vd), r.YP(d.k * Math.pow(vd / 3.6, 2) / 1e3) - 4);
        if (st.phase !== 'ready' && !st.done) {
          const F = Math.abs(st.F) / 1e3, x = r.XP(v * 3.6);
          c.fillStyle = '#fff'; c.strokeStyle = st.F >= 0 ? lamp() : '#ff7b6b'; c.lineWidth = 2;
          c.beginPath(); c.arc(x, r.YP(F), 4.5, 0, TAU); c.fill(); c.stroke();
          c.beginPath(); c.arc(x, r.YP(st.D / 1e3), 3.5, 0, TAU); c.fillStyle = '#5cc8ff'; c.fill();
        }
      },
      numbers() {
        const m = d.m, f = R.mlFreq(st.v), vb = d.vBal;
        let h = sec('The train');
        h += row('Mass', `${pl(m / 1000, 4)} t`, `${p.sections} sections of about 60 t (the two-section Transrapid 06 weighed 120 t) and ${p.pax} passengers of 80 kg. Both are estimates; the real mass of the Shanghai trains is not published.`, `m = ${p.sections} × 60,000 kg + ${p.pax} × 80 kg = ${pl(m, 6)} kg`);
        h += row('Length', `${pl(d.trainLen, 4)} m`, 'Each section is about 25.6 m: the six-section Shanghai train is 153.6 m long.', '');
        h += row('Air drag', `C<sub>d</sub>A = ${pl(d.CdA, 3)} m²`, 'Nose and tail, plus friction along the sides that grows with every section (an estimate). Drag force is ½ρC<sub>d</sub>A v².', `½ρC<sub>d</sub>A = ½ × ${R.ML.rho} kg/m³ × ${pl(d.CdA, 3)} m² = ${pl(d.k, 3)} kg/m, so at 431 km/h: ${pl(d.k, 3)} × (119.7 m/s)² = ${si(d.k * 119.72 * 119.72, 'N', 3)}`);
        h += row('Floating', '10 mm gap', 'Electromagnets on the train hang under the guideway and pull up towards it. An electronic control system keeps adjusting their current to hold the gap at about 10 mm; the underside of the train clears the top of the guideway by 150 mm.', `lift needed = mg = ${pl(m, 4)} kg × 9.81 m/s² = ${si(m * G0, 'N', 3)}; levitation and guidance power ≈ 1.7 kW per tonne = ${si(R.ML.lev * m / 1000, 'W', 3)}`);
        h += sec('The motor');
        h += row('Travelling field', `${pl(f, 4)} Hz now`, 'Three-phase current in the guideway makes north and south poles that march along the track. The train’s magnets lock onto them, so the train moves exactly as fast as the wave.', `v = 2τf → f = v / 2τ = ${pl(st.v, 4)} m/s / (2 × ${R.ML.tau} m) = ${pl(f, 4)} Hz. The pole pitch τ ≈ 0.26 m is inferred: the converters go up to 270 Hz, and 2 × 0.26 m × 270 Hz = ${pl(2 * R.ML.tau * 270 * 3.6, 3)} km/h, the trains’ top speed.`);
        h += row('Best pull', si(d.Fmax, 'N', 3), `Set by the current in the track coils: ${pl(thr(), 3)} kN for each section at ${p.cur} % (100 % = 44 kN, estimated). The pull of a synchronous motor is proportional to the current.`, `F<sub>max</sub> = ${p.sections} × 44 kN × ${p.cur} % = ${si(d.Fmax, 'N', 3)} → a = F/m = ${pl(d.Fmax / m, 3)} m/s² from a standstill`);
        h += row('Full power from', `${pl(d.vKnee * 3.6, 3)} km/h`, `Above this speed the converters’ power (${pl(p.power, 3)} MW, estimated) runs out, so the pull is P/v.`, `v = P / F<sub>max</sub> = ${si(d.P, 'W', 3)} / ${si(d.Fmax, 'N', 3)} = ${pl(d.vKnee, 3)} m/s`);
        h += row('Top speed this train could reach', `${pl(vb * 3.6, 3)} km/h`, 'Where the motor’s pull equals air drag. The Shanghai trains are only allowed 505 km/h.', `P/v = ½ρC<sub>d</sub>A v² → v = ∛(P / ½ρC<sub>d</sub>A) = ∛(${si(d.P, 'W', 3)} / ${pl(d.k, 3)} kg/m) = ${pl(vb, 3)} m/s`);
        h += sec('This trip');
        const done = st.done, s0 = done ? st : pred.st;
        h += row(done ? 'Trip time' : 'Trip time (worked out ahead)', mmss(s0.t), `${pl(p.km, 3)} km at up to ${pl(p.v, 3)} km/h: average ${pl(p.km * 1e3 / s0.t * 3.6, 3)} km/h.`, '');
        if (s0.marks.k300) h += row('Reached 300 km/h', `${mmss(s0.marks.k300.t)}, after ${pl(s0.marks.k300.x / 1e3, 3)} km`, '', '');
        if (s0.marks.k431) h += row('Reached 431 km/h', `${mmss(s0.marks.k431.t)}, after ${pl(s0.marks.k431.x / 1e3, 3)} km`, '', '');
        h += row('Kinetic energy at top speed', `${pl(0.5 * m * s0.vmax * s0.vmax / 3.6e6, 3)} kWh`, '', `½mv² = ½ × ${pl(m, 4)} kg × (${pl(s0.vmax, 4)} m/s)² = ${si(0.5 * m * s0.vmax * s0.vmax, 'J', 3)}`);
        h += row('Work done by the motor', `${pl(s0.Edrive / 3.6e6, 3)} kWh`, `${Math.round(s0.Edrag / s0.Edrive * 100)} % of it is lost to air drag; the rest becomes kinetic energy, and braking as a generator can recover up to ${pl(s0.Ebrake / 3.6e6, 3)} kWh of that. Losses in the motor and converters are not included.`, `W = Σ F·Δx; air drag took Σ D·Δx = ${pl(s0.Edrag / 3.6e6, 3)} kWh`);
        if (p.pax > 0) h += row('Per passenger', `${pl(s0.Edrive / 3.6e6 / p.pax * 1000, 3)} Wh`, `For ${pl(p.km, 3)} km, before anything is recovered by braking.`, '');
        h += row('Levitation and guidance', `${pl(s0.Elev / 3.6e6, 3)} kWh`, 'About 1.7 kW per tonne for as long as the train floats: small next to drag at speed.', `${si(R.ML.lev * m / 1000, 'W', 3)} × ${mmss(s0.t)}`);
        return h;
      },
      check() {
        const key = [p.sections, p.pax, p.cur, p.power, p.brake].join();
        if (key !== checkKey) { checkKey = key; checkCache = { a: trip(431, 30.5), b: trip(300, 30.5) }; }
        const a = checkCache.a.st, b = checkCache.b.st, ok = (x, y, tol) => Math.abs(x - y) <= tol * y ? 'good' : 'warn';
        let h = `<p class="hint">Your train run on the real 30.5 km Shanghai line, against the published numbers. The motor’s strength was set once to match the first two lines; the rest are predictions.</p>`;
        h += cmpTable([
          ['0 to 300 km/h', a.marks.k300 ? mmss(a.marks.k300.t) : 'not reached', '2 min 15 s', 'shanghai', a.marks.k300 ? ok(a.marks.k300.t, 135, 0.05) : 'bad'],
          ['0 to 431 km/h', a.marks.k431 ? mmss(a.marks.k431.t) : 'not reached', 'about 4 min', 'shanghai', a.marks.k431 ? ok(a.marks.k431.t, 240, 0.06) : 'bad'],
          ['Distance to reach 300 km/h', a.marks.k300 ? `${pl(a.marks.k300.x / 1e3, 2)} km` : '–', 'about 5 km', 'ieee', a.marks.k300 ? ok(a.marks.k300.x, 5000, 0.2) : 'bad'],
          ['Trip at up to 431 km/h', mmss(a.t), '7 min 20 s', 'shanghai', ok(a.t, 440, 0.04)],
          ['Trip at up to 300 km/h', mmss(b.t), '8 min 10 s', 'shanghai', ok(b.t, 490, 0.04)],
          ['Gap under the guideway', '10 mm', 'about 10 mm', 'tri'],
          ['Frequency at 505 km/h (sets the pole pitch)', `${pl(R.mlFreq(505 / 3.6), 3)} Hz`, 'converters run up to 270 Hz', 'wctr'],
          ['Fastest maglev ever', '–', '603 km/h (Japan’s L0, 2015, a different superconducting design)', 'maglev'],
        ]);
        h += `<p class="hint">Green: within a few per cent of the real train. The real line also has curves and gentler acceleration near the stations, which this model leaves out.</p>`;
        return h;
      },
      keyNumbers() {
        const m = d.m, v = p.v / 3.6, f = R.mlFreq(v), K = 0.5 * m * v * v;
        return row('Coils switching', `${pl(f, 3)} times a second`, `Each switch moves the pull ${pl(2 * R.ML.tau, 2)} m along the track, so the pull, and the train, travel at v = 2τf = ${pl(2 * R.ML.tau, 2)} m × ${pl(f, 3)} /s = ${pl(v * 3.6, 3)} km/h.`)
          + row('Strongest pull', si(d.Fmax, 'N', 3), `From the current in the coils (${p.cur} %). F = ma: a = F/m = ${pl(d.Fmax / m, 3)} m/s² when it sets off.`)
          + row('Mass of the train', `${pl(m / 1000, 3)} t`, `${p.sections} sections and ${p.pax} passengers (an estimate).`)
          + row('Kinetic energy at top speed', si(K, 'J', 3), `½mv², the same formula as your Gauss gun’s slug, with a train instead of a ${gaussNow() ? pl(gaussNow().r.m * 1000, 2) + ' g' : 'small'} slug.`)
          + row('Trip time', mmss((st.done ? st : pred.st).t), `${pl(p.km, 3)} km at up to ${pl(Math.min(p.v, d.vBal * 3.6), 3)} km/h.`);
      },
      link(sm) {
        const gn = gaussNow(), r = gn && gn.r, g = gn && gn.g, v = p.v / 3.6;
        const rows = [
          ['What pulls', g ? `${g.stages} coil${g.stages > 1 ? 's' : ''} of ${g.turns} turns, ${g.current} A` : 'coils in a row', `coils along the whole track, at ${p.cur} % current`],
          ['How the pull moves', 'each coil switches on as the slug arrives', `the coils switch ${Math.round(R.mlFreq(p.v / 3.6))} times a second, so the pull moves at 2τf`],
          ['What is pulled', r ? `an iron slug, ${pl(r.m * 1000, 3)} g` : 'an iron slug', `magnets on a ${pl(d.m / 1000, 3)} t train`],
          ['Top speed', r ? `${pl(r.vExit, 3)} m/s` : '–', `${pl(Math.min(v, d.vBal), 3)} m/s (${pl(Math.min(p.v, d.vBal * 3.6), 3)} km/h)`],
          ['Kinetic energy, ½mv²', r ? si(r.K, 'J', 3) : '–', si(0.5 * d.m * v * v, 'J', 3)],
        ];
        if (!sm) rows.push(
          ['Pulling backwards', 'suck-back, if a coil stays on too long', 'used on purpose to brake: the field is put behind the magnets'],
          ['Length', `about ${pl(Math.max(1, g ? g.stages : 4) * 6.5, 2)} cm of coils`, `${pl(p.km, 3)} km of track`]);
        return {
          title: 'How is the maglev a Gauss gun?',
          text: sm ? 'Your coil gun and the maglev work the same way: <b>coils switch on one after another</b>, so the magnetic pull is always just ahead of the thing they move. Your gun pulls a small iron slug through a few coils; the maglev’s track pulls the magnets of a whole train, all the way along a 30 km line.'
            : `Both are linear electromagnetic motors: current in a row of coils makes a magnetic pull that is switched along the row in step with the load. In your coil gun light gates switch each coil on and it goes off at the coil’s middle. The Transrapid uses a long-stator linear synchronous motor: three-phase current in the guideway makes a field that travels at v = 2τf, and the train’s electromagnets lock onto it. Same F = ma and ½mv²${r && r.K > 0 ? `; about 10${CL.PHYS.sup(Math.round(Math.log10(0.5 * d.m * v * v / r.K)))} times more kinetic energy` : ''}.`,
          cols: ['Your coil gun', 'Maglev train'], rows, alt: 'Animation: your coil gun’s coils light up one after another as the slug passes, and so do the coils along the maglev track under the train', draw: (c, W, H, t) => drawLinkGauss(c, W, H, t, 'maglev'),
        };
      },
      sources: ['shanghai', 'ieee', 'dewe', 'tri', 'wctr', 'meis', 'transrapid', 'maglev', 'stator'],
      whySources: ['pudong'],
      why(sm) {
        const tM = pred.st.t, tR = roadT();
        // the real timetable changed in May 2021 (431 → 300 km/h), so say which train these numbers are
        const trip = real() && Math.round(p.v) === 431
          ? (sm ? 'From 2004 to 2021 the maglev did it in about 7 minutes; today, at up to 300 km/h, it takes about 8.'
            : 'From 2004 to May 2021 the maglev covered its 30.5 km in 7 min 20 s at up to 431 km/h; since then it has run at up to 300 km/h and takes 8 min 10 s.')
          : real() ? (sm ? 'The maglev does it in about 8 minutes.'
            : 'Since May 2021 the maglev has covered its 30.5 km in 8 min 10 s at up to 300 km/h (from 2004, 7 min 20 s at up to 431 km/h).')
          : (sm ? `In this run the maglev covers ${pl(p.km, 3)} km in about ${Math.max(1, Math.round(tM / 60))} minutes; the real train takes about 8 for its 30 km.`
            : `In this run the maglev covers ${pl(p.km, 3)} km in ${mmss(tM)}; the real train takes 8 min 10 s for its 30.5 km, at up to 300 km/h.`);
        return {
          q: 'Why build a floating train to the airport?',
          a: sm ? `Shanghai’s Pudong Airport is about 30 km from the city centre: about an hour by road. ${trip} Nothing touches the track: magnets hold the train 10 mm away, and coils in the track pull it along, a Gauss gun 30 km long, so there are no wheels to slip or wear out.`
            : `Pudong Airport is about 30 km from the centre of Shanghai, about an hour by road (Pudong government). ${trip} It rides 10 mm from the guideway and is pulled by a travelling magnetic field, v = 2τf, from coils switched one after another: nothing rubs, so there is no wheel to slip and the push does not depend on grip.`,
          metric: `Time for ${pl(p.km, 3)} km`,
          rows: [
            { k: 'off', label: 'By road (city traffic, about 30 km/h)', v: tR / 60, txt: `about ${Math.round(tR / 60)} min` },
            { k: 'on', label: 'By maglev (this run)', v: tM / 60, txt: mmss(tM) },
          ],
          verdict: `Every passenger saves about <b>${Math.round((tR - tM) / 60)} minutes</b> a trip. Watch the car at the bottom of the view.`,
        };
      },
      helps() {
        const tM = pred.st.t, tR = roadT();
        return [
          ['clock', 'Travellers', `About ${Math.round((tR - tM) / 60)} minutes saved on every trip: about ${Math.round(tR / 60)} min by road, ${mmss(tM)} by maglev in this run.`, 'pudong'],
          ['track', 'No wear', 'Nothing touches the guideway: magnets hold the train 10 mm away and the coils pull it, so no wheels rub, slip or wear.', 'tri'],
        ];
      },
      get st() { return st; },
      home3d: { yaw: -0.78, pitch: 0.07, dist: 25, target: [-11, 0, 6.8], fov: 50, minDist: 3, maxDist: 700 },
      draw3d(sc, c, W, H, dtr, running) {
        if (running) { scene += st.v * dtr; lensX += st.v * dtr / 400; }
        drawMaglev3d(sc, c, W, H);
      },
    };

    /* ---- 3D: the train on its guideway, with the skirt drawn see-through so the Gauss part shows:
       the coils under the edges of the guideway and the magnets on the train just below them ---- */
    function drawMaglev3d(sc, c, W, H) {
      const tt = performance.now() / 1000, Lt = d.trainLen, ZT = 7.0;
      sc.begin(c, W, H, { dist: W < 600 ? sc.home.dist * 1.5 : undefined, bg: [44, 42, 66], fogNear: 2.5, fogFar: 26, fogMax: 0.7, backdrop: (g, W2, H2, hy) => drawBlueHour(g, W2, H2, hy, tt) });
      const x0 = -Lt - 260, x1 = 320, at = X => X - scene;                    // the train's nose stays at x = 0; the world slides past
      // the land: fields, their edges sliding past, and trees
      sc.poly([[-1400, -1400, 0], [1400, -1400, 0], [1400, 1400, 0], [-1400, 1400, 0]], { rgb: [26, 33, 30], shade: false, layer: 'back' });
      for (let k = Math.floor((scene + x0) / 60); k <= Math.ceil((scene + x1) / 60); k++) { const x = at(k * 60); sc.line([x, -260, 0.02], [x, 260, 0.02], 'rgba(120,150,120,0.12)', 1, { layer: 'back' }); }
      for (let k = Math.floor((scene + x0) / 23); k <= Math.ceil((scene + x1) / 23); k++) {
        for (const sd of [-1, 1]) { if (hash(k * 2 + (sd > 0 ? 1 : 0)) < 0.55) continue; const y = sd * (28 + 70 * hash(k + (sd > 0 ? 300 : 500))), x = at(k * 23 + 9 * hash(k + 77)), r = 1.4 + 1.6 * hash(k + 11);
          sc.cyl([x, y, 0], [x, y, r * 1.1], 0.2, { rgb: [52, 40, 30], flat: true }, 6); sc.sphere([x, y, r * 1.7], r, [30, 52, 38]); }
      }
      // the city far away, its windows lit
      for (let k = Math.floor((scene - 3000) / 140); k <= Math.ceil((scene + 3000) / 140); k++) {
        const x = at(k * 140), y = 900 + 500 * hash(k + 40), h = 40 + 220 * Math.pow(hash(k + 60), 2), w = 30 + 40 * hash(k + 80);
        sc.box([x, y, h / 2], [w / 2, w / 2, h / 2], { rgb: [26, 32, 50], shade: false, noFog: false });
        if (hash(k + 90) > 0.6) sc.glow([x, y, h + 6], 5, [255, 80, 60], 0.8, { px: true });
      }
      // pillars every 24.8 m and the guideway beam on top of them
      for (let k = Math.floor((scene + x0) / 24.8); k <= Math.ceil((scene + x1) / 24.8); k++) {
        const x = at(k * 24.8);
        sc.box([x, 0, 2.45], [0.75, 0.85, 2.45], { rgb: [112, 118, 118], spec: 0.05 });
        sc.box([x, 0, 5.0], [1.0, 1.2, 0.2], { rgb: [120, 126, 126] });
        const xm = x + 12.4;
        if (xm - 12.4 < x1 && xm + 12.4 > x0) { sc.box([xm, 0, 5.85], [12.38, 0.62, 0.65], { rgb: [128, 134, 134], spec: 0.05 }); sc.box([xm, 0, 6.75], [12.38, 1.4, 0.25], { rgb: [150, 156, 154], spec: 0.08 }); }
      }
      // the coils (long stator) under both edges of the guideway, drawn 10× bigger; powered sections show the travelling poles
      const lead = st.F && d.Fmax ? 0.25 * TAU_V * clamp(st.F / d.Fmax, -1, 1) : 0;
      for (let k = Math.floor((scene + x0) / TAU_V); k <= Math.ceil((scene + x1) / TAU_V); k++) {
        const X = (k + 0.5) * TAU_V, x = at(X), on = powered(X), I = Math.cos(Math.PI * (X - scene - lead) / TAU_V);
        const rgb = on ? (I > 0 ? [255, 96 + 60 * (1 - Math.abs(I)), 70] : [90, 150 + 40 * (1 - Math.abs(I)), 255]) : [96, 64, 40];
        const emit = on && Math.abs(I) > 0.35 ? (I > 0 ? '255,80,50' : '60,130,255') : null;
        for (const sd of [-1, 1]) sc.box([x, sd * 1.18, 6.38], [TAU_V * 0.4, 0.22, 0.12], { rgb, emit, emitA: on ? 0.6 * Math.abs(I) : 0, spec: 0.2, skip: n => n[2] > 0.5 });
        if (on && Math.abs(I) > 0.85 && x > -Lt - 10 && x < 20) sc.glow([x, 1.45, 6.35], 1.6, I > 0 ? [255, 110, 80] : [110, 170, 255], 0.45);
      }
      // section ends, with a marker on the guideway
      for (let n = Math.floor((scene + x0) / SEC); n <= Math.ceil((scene + x1) / SEC); n++) {
        const x = at(n * SEC);
        if (x < x0 || x > x1) continue;
        sc.box([x, 0, 7.05], [0.15, 1.42, 0.06], { rgb: [20, 22, 22] });
        sc.label([x, -1.6, 7.9], powered(n * SEC + 1) ? `section ${n + 1}: on` : `section ${n + 1}: off`, { color: powered(n * SEC + 1) ? '#ffd590' : 'rgba(214,224,218,0.7)', font: '600 12px "Barlow Condensed", "Arial Narrow", sans-serif' });
      }
      // the train: magnets under the stator, the see-through skirt, the cabin with its windows, nose and tail
      for (let k = Math.floor((scene - Lt) / TAU_V); k <= Math.ceil(scene / TAU_V); k++) {
        const X = (k + 0.5) * TAU_V, x = at(X); if (x < -Lt + 1 || x > -1) continue;
        const M = Math.cos(Math.PI * (X - scene) / TAU_V);
        for (const sd of [-1, 1]) sc.box([x, sd * 1.18, 6.14], [TAU_V * 0.32, 0.2, 0.09], { rgb: M > 0 ? [90, 150, 255] : [255, 96, 70], spec: 0.25 });
      }
      for (const sd of [-1, 1]) {
        sc.poly([[-Lt + 3, sd * 1.9, 6.0], [-1.5, sd * 1.9, 6.0], [-1.5, sd * 1.9, 7.2], [-Lt + 3, sd * 1.9, 7.2]], { rgb: [200, 214, 222], a: 0.22, out: [0, sd, 0] });
        sc.poly([[-Lt + 3, sd * 0.9, 6.0], [-1.5, sd * 0.9, 6.0], [-1.5, sd * 1.9, 6.0], [-Lt + 3, sd * 1.9, 6.0]], { rgb: [200, 214, 222], a: 0.18, out: [0, 0, -1] });
      }
      const zb = 7.2, zt = 10.3, wb = 1.85, xn = -7, xtl = -Lt + 4.5;
      const body = (pts, st2) => sc.poly(pts, Object.assign({ rgb: [236, 240, 236], amb: 0.62, spec: 0.35, shin: 30 }, st2));
      sc.box([(xn + xtl) / 2, 0, (zb + zt) / 2], [(xn - xtl) / 2, wb, (zt - zb) / 2], { rgb: [236, 240, 236], amb: 0.62, spec: 0.35, shin: 30 });
      // nose: from the full body at x = xn to a rounded tip at x = 0
      const tip = [[0, -1.0, 7.35], [0, 1.0, 7.35], [0, 1.0, 8.2], [0, -1.0, 8.2]], fr = [[xn, -wb, zb], [xn, wb, zb], [xn, wb, zt], [xn, -wb, zt]];
      body([fr[2], fr[3], tip[3], tip[2]], { out: [0.4, 0, 1] }); body([fr[0], fr[1], tip[1], tip[0]], { out: [0, 0, -1] });
      body([fr[1], fr[2], tip[2], tip[1]], { out: [0, 1, 0] }); body([fr[3], fr[0], tip[0], tip[3]], { out: [0, -1, 0] }); body(tip, { out: [1, 0, 0] });
      // the tail, blunter
      const tt2 = [[-Lt, -1.4, 7.4], [-Lt, 1.4, 7.4], [-Lt, 1.4, 9.2], [-Lt, -1.4, 9.2]], bk = [[xtl, -wb, zb], [xtl, wb, zb], [xtl, wb, zt], [xtl, -wb, zt]];
      body([bk[2], bk[3], tt2[3], tt2[2]], { out: [-0.4, 0, 1] }); body([bk[0], bk[1], tt2[1], tt2[0]], { out: [0, 0, -1] });
      body([bk[1], bk[2], tt2[2], tt2[1]], { out: [0, 1, 0] }); body([bk[3], bk[0], tt2[0], tt2[3]], { out: [0, -1, 0] }); body(tt2, { out: [-1, 0, 0] });
      for (const sd of [-1, 1]) {
        sc.poly([[xtl + 1, sd * (wb + 0.01), 8.55], [xn - 0.4, sd * (wb + 0.01), 8.55], [xn - 0.4, sd * (wb + 0.01), 9.4], [xtl + 1, sd * (wb + 0.01), 9.4]], { rgb: [22, 34, 46], spec: 0.6, shin: 40, out: [0, sd, 0] });
        sc.poly([[xtl, sd * (wb + 0.01), 7.65], [xn, sd * (wb + 0.01), 7.65], [xn, sd * (wb + 0.01), 7.85], [xtl, sd * (wb + 0.01), 7.85]], { rgb: [214, 150, 50], out: [0, sd, 0] });
        for (let i = 1; i < p.sections; i++) { const x = -i * R.ML.secLen; sc.line([x, sd * (wb + 0.02), zb], [x, sd * (wb + 0.02), zt], 'rgba(60,70,76,0.8)', 1); }
      }
      sc.glow([0.3, 0, 7.8], 1.2, [255, 240, 200], 0.8);
      // what is what
      sc.label([-1, -2.0, 6.05], 'coils in the track (drawn 10× bigger)', { color: '#ffd590' });
      sc.label([-34, -2.3, 5.75], 'magnets on the train', { color: '#9fd8ff' });
      sc.end();
      drawGauge(c, W, H); drawProgress(c, W, H);
      text(c, 'skirt drawn see-through', W - 10, H - 52, { align: 'right', size: 11, color: 'rgba(214,224,218,0.6)' });
    }
    /* ---- drawing: side view, the camera rides with the nose of the train ---- */
    function drawMaglev(c, W, H) {
      const s = clamp(W / 74, 3.8, 16), yG = Math.round(H * 0.8), beamTop = yG - Math.max(6.6 * s, 44);
      const Y = m => beamTop - m * s, xF = Math.round(W * 0.72), v = st.v;
      // sky: blue hour over Shanghai, a warm afterglow low in the west, a few stars and a low moon
      const sg = c.createLinearGradient(0, 0, 0, yG);
      sg.addColorStop(0, '#0a1430'); sg.addColorStop(0.45, '#1d2d5c'); sg.addColorStop(0.75, '#5a4778'); sg.addColorStop(0.92, '#c46e6a'); sg.addColorStop(1, '#f0a070');
      c.fillStyle = sg; c.fillRect(0, 0, W, yG);
      for (let i = 0; i < 46; i++) { const x = hash(i) * W, y = hash(i + 50) * yG * 0.4; c.fillStyle = `rgba(230,240,255,${(0.15 + 0.4 * hash(i + 9)) * (1 - y / (yG * 0.4))})`; c.fillRect(x, y, 1.3, 1.3); }
      glow(c, W * 0.86, yG - 10, H * 0.6, '255,160,100', 0.22);
      { const mx = W * 0.2, my = yG * 0.22, mr = Math.max(9, H * 0.028); glow(c, mx, my, mr * 5, '220,230,255', 0.12); c.fillStyle = '#f3f0e2'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.fillStyle = 'rgba(29,45,92,0.9)'; c.beginPath(); c.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.92, 0, TAU); c.fill(); }
      // far city (parallax 3 %)
      const off1 = scene * s * 0.03;
      for (let i = Math.floor(off1 / 34) - 1; i < Math.floor(off1 / 34) + W / 34 + 2; i++) {
        const x = i * 34 - off1, h = (0.12 + 0.55 * Math.pow(hash(i), 2)) * yG * 0.75, w = 16 + 14 * hash(i + 3);
        c.fillStyle = '#1a2236'; c.fillRect(x, yG - h, w, h);
        if (hash(i + 7) > 0.8) { c.fillRect(x + w / 2 - 1, yG - h - 12, 2, 12); if (Math.sin(performance.now() / 500 + i) > 0.2) { c.fillStyle = 'rgba(255,70,60,0.9)'; c.fillRect(x + w / 2 - 1.5, yG - h - 14, 3, 3); } }
        c.fillStyle = 'rgba(255,214,140,0.45)';
        for (let k = 0; k < 6; k++) if (hash(i * 13 + k) > 0.55) c.fillRect(x + 3 + (k % 2) * (w - 8), yG - h + 6 + k * h / 7, 2, 2);
      }
      // trees and lamps (parallax 25 %)
      const off2 = scene * s * 0.25;
      for (let i = Math.floor(off2 / 60) - 1; i < Math.floor(off2 / 60) + W / 60 + 2; i++) {
        const x = i * 60 - off2 + hash(i + 21) * 30, r = 8 + 9 * hash(i + 31);
        c.fillStyle = '#0f1a17'; c.beginPath(); c.arc(x, yG - r * 0.9, r, 0, TAU); c.fill(); c.fillRect(x - 1.5, yG - r * 0.5, 3, r * 0.5);
      }
      // ground
      const gg = c.createLinearGradient(0, yG, 0, H); gg.addColorStop(0, '#1b2521'); gg.addColorStop(1, '#0a0f0d');
      c.fillStyle = gg; c.fillRect(0, yG, W, H - yG);
      c.strokeStyle = 'rgba(200,230,210,0.07)'; c.lineWidth = 1; const off3 = (scene * s) % 40;
      for (let x = -off3; x < W; x += 40) { c.beginPath(); c.moveTo(x, yG + 3); c.lineTo(x - 30, H); c.stroke(); }
      // pillars every 25 m and the beam
      const k0 = Math.ceil((scene - xF / s - 4) / 25), k1 = Math.floor((scene + (W - xF) / s + 4) / 25);
      for (let k = k0; k <= k1; k++) {
        const x = xF - (scene - 25 * k) * s, pw = Math.max(1.3 * s, 6);
        const pg = c.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0); pg.addColorStop(0, '#3e4648'); pg.addColorStop(0.5, '#5b6466'); pg.addColorStop(1, '#2f3537');
        c.fillStyle = pg; c.fillRect(x - pw / 2, Y(-2.3), pw, yG - Y(-2.3));
        c.fillStyle = '#4b5355'; c.fillRect(x - pw * 0.9, Y(-2.3), pw * 1.8, Math.max(3, 0.5 * s));
      }
      const bg = c.createLinearGradient(0, Y(0), 0, Y(-2.3)); bg.addColorStop(0, '#9aa2a2'); bg.addColorStop(0.3, '#7b8483'); bg.addColorStop(1, '#4b5352');
      c.fillStyle = bg; c.fillRect(0, Y(0), W, Y(-2.3) - Y(0));
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, Y(-0.75), W, Y(-2.3) - Y(-0.75));
      c.strokeStyle = 'rgba(20,24,24,0.7)'; c.lineWidth = 1;
      for (let k = k0; k <= k1; k++) { const x = Math.round(xF - (scene - 25 * k - 12.5) * s) + 0.5; c.beginPath(); c.moveTo(x, Y(0)); c.lineTo(x, Y(-2.3)); c.stroke(); }
      // the train, then (seen through its skirt) the Gauss part: the coils in the track and the magnets on the train
      const tl = d.trainLen * s, xT = xF - tl;
      drawTrain(c, xF, Y, s, tl);
      drawCoils(c, W, Y, s, xF, tl);
      // speed streaks
      if (v > 25 && !reduceMotion) {
        const a = clamp((v - 25) / 100, 0, 0.5);
        c.strokeStyle = `rgba(220,235,255,${a})`; c.lineWidth = 1;
        for (let i = 0; i < 18; i++) { const y = beamTop - (0.3 + 4 * hash(i + 90)) * s - 6, ln = 30 + 80 * hash(i + 40), x = W - ((scene * s * 0.9 + i * 157) % (W + 200)); c.beginPath(); c.moveTo(x, y); c.lineTo(x + ln, y); c.stroke(); }
      }
      drawGauge(c, W, H);
      drawLens(c, W, H);
      drawProgress(c, W, H);
    }
    function drawTrain(c, xF, Y, s, tl) {
      const xT = xF - tl, nose = Math.min(7 * s, tl * 0.2), tail = Math.min(5 * s, tl * 0.15);
      // skirt round the beam, with the support magnets just under the stator
      c.fillStyle = '#2b3236'; c.fillRect(xT + tail * 0.4, Y(0.2), tl - nose * 0.55 - tail * 0.4, Y(-1.05) - Y(0.2));
      c.fillStyle = 'rgba(120,200,255,0.55)'; c.fillRect(xT + tail * 0.4, Y(-0.78), tl - nose * 0.55 - tail * 0.4, Math.max(1.5, 0.05 * s));
      if (st.phase !== 'ready') glow(c, xT + tl / 2, Y(-0.78), tl * 0.35, '120,200,255', 0.07);
      // body
      const bodyG = c.createLinearGradient(0, Y(3.3), 0, Y(0.2)); bodyG.addColorStop(0, '#f4f6f2'); bodyG.addColorStop(0.55, '#dfe4df'); bodyG.addColorStop(1, '#a9b1ad');
      c.fillStyle = bodyG; c.beginPath();
      c.moveTo(xT + tail, Y(3.3)); c.lineTo(xF - nose, Y(3.3));
      c.bezierCurveTo(xF - nose * 0.35, Y(3.25), xF, Y(1.6), xF, Y(0.9));
      c.quadraticCurveTo(xF - 2, Y(0.2), xF - nose * 0.4, Y(0.2));
      c.lineTo(xT + tail * 0.3, Y(0.2)); c.quadraticCurveTo(xT, Y(0.6), xT, Y(1.5));
      c.bezierCurveTo(xT, Y(2.6), xT + tail * 0.3, Y(3.3), xT + tail, Y(3.3)); c.closePath(); c.fill();
      // brass stripe and the window band
      c.fillStyle = lamp(); c.fillRect(xT + tail * 0.4, Y(1.05), tl - tail * 0.4 - nose * 0.25, Math.max(2, 0.16 * s));
      c.fillStyle = '#1c2a36'; c.fillRect(xT + tail, Y(2.55), tl - nose * 0.75 - tail, Y(1.75) - Y(2.55));
      c.fillStyle = 'rgba(160,210,255,0.18)'; c.fillRect(xT + tail, Y(2.55), tl - nose * 0.75 - tail, Math.max(1, 0.08 * s));
      // the cab window
      c.fillStyle = '#16232e'; c.beginPath(); c.moveTo(xF - nose * 0.72, Y(2.95)); c.quadraticCurveTo(xF - nose * 0.22, Y(2.8), xF - nose * 0.12, Y(1.95)); c.lineTo(xF - nose * 0.72, Y(1.95)); c.closePath(); c.fill();
      // section joints and doors
      c.strokeStyle = 'rgba(40,50,56,0.75)'; c.lineWidth = 1;
      for (let i = 1; i < p.sections; i++) { const x = Math.round(xF - i * R.ML.secLen * s) + 0.5; c.beginPath(); c.moveTo(x, Y(3.3)); c.lineTo(x, Y(0.2)); c.stroke(); }
      c.strokeStyle = 'rgba(60,70,76,0.5)';
      for (let i = 0; i < p.sections; i++) { const x = xF - (i + 0.5) * R.ML.secLen * s; c.strokeRect(Math.round(x - 0.6 * s) + 0.5, Math.round(Y(2.9)) + 0.5, Math.round(1.2 * s), Math.round(Y(0.35) - Y(2.9))); }
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(xT + tail, Y(3.25), tl - nose - tail, Math.max(1, 0.06 * s));
      // head light
      glow(c, xF - 2, Y(0.9), 18, '255,240,200', 0.55);
    }
    // the long stator as a row of coils, drawn 10× bigger than the real 0.26 m pole pitch. It is powered in sections
    // (about 1.2 km each) that switch on as the train comes, like a Gauss gun switching its next coil. Inside a powered
    // section the three-phase current makes north (red) and south (blue) poles that travel with the train at 2τf;
    // when the motor pulls, the poles sit a little ahead of the train's magnets (behind them when it brakes).
    function powered(X) {
      if (st.phase === 'ready' || st.done) return false;
      const k = Math.floor(X / SEC), tail = scene - d.trainLen;
      return k >= Math.floor(tail / SEC) && k <= Math.floor((scene + 250) / SEC);
    }
    function drawCoils(c, W, Y, s, xF, tl) {
      const pitch = TAU_V * s, k0 = Math.floor((scene - xF / s) / TAU_V) - 1, k1 = Math.ceil((scene + (W - xF) / s) / TAU_V) + 1;
      const yC = Y(-0.62), hC = Math.max(4, 0.34 * s), yM = Y(-0.9), hM = Math.max(3, 0.24 * s);
      const lead = st.F && d.Fmax ? 0.25 * TAU_V * clamp(st.F / d.Fmax, -1, 1) : 0;
      const xT = xF - tl;
      c.save();
      for (let k = k0; k <= k1; k++) {
        const X = (k + 0.5) * TAU_V, x = xF - (scene - X) * s;
        if (x < -pitch || x > W + pitch) continue;
        const on = powered(X), I = Math.cos(Math.PI * (X - scene - lead) / TAU_V);
        c.fillStyle = '#4a321e'; c.fillRect(x - pitch * 0.4, yC, pitch * 0.8, hC);
        if (on) {
          const a = 0.25 + 0.75 * Math.abs(I);
          c.fillStyle = I > 0 ? `rgba(255,96,70,${a})` : `rgba(90,160,255,${a})`;
          c.fillRect(x - pitch * 0.4, yC, pitch * 0.8, hC);
          if (Math.abs(I) > 0.8 && x > xT - pitch && x < xF + pitch) glow(c, x, yC + hC / 2, pitch * 0.7, I > 0 ? '255,110,80' : '110,170,255', 0.35);
        }
      }
      // section ends: the next section switches on before the train gets there
      for (let n = Math.floor((scene - xF / s) / SEC); n <= Math.ceil((scene + (W - xF) / s) / SEC); n++) {
        const x = xF - (scene - n * SEC) * s;
        if (x < 0 || x > W) continue;
        c.fillStyle = '#0b0e0f'; c.fillRect(x - 1.5, yC - 3, 3, hC + 6);
        text(c, powered(n * SEC + 1) ? `section ${n + 1}: on` : `section ${n + 1}: off`, x + 5, yC - 10, { size: 11, color: powered(n * SEC + 1) ? '#ffd590' : 'rgba(214,224,218,0.6)' });
      }
      // the train's magnets, fixed to the train: opposite poles sit under the coils' poles and are pulled along
      for (let k = Math.floor((scene - d.trainLen) / TAU_V); k <= Math.ceil(scene / TAU_V); k++) {
        const X = (k + 0.5) * TAU_V, x = xF - (scene - X) * s;
        if (x < xT + pitch * 0.4 || x > xF - pitch * 0.4) continue;
        const M = Math.cos(Math.PI * (X - scene) / TAU_V);
        c.fillStyle = M > 0 ? 'rgba(90,160,255,0.85)' : 'rgba(255,96,70,0.85)';
        c.fillRect(x - pitch * 0.32, yM, pitch * 0.64, hM);
      }
      c.restore();
      const lx = Math.max(12, Math.min(xT + 8, W * 0.06));
      text(c, 'coils in the track (drawn 10× bigger)', lx, yC - 9, { size: 11.5, color: '#ffd590' });
      if (xT < W - 40) text(c, 'magnets on the train', Math.max(xT + 8, 12), yM + hM + 12, { size: 11.5, color: '#9fd8ff' });
    }
    function drawGauge(c, W, H) {
      const x = 16, y = W < 560 ? 48 : 14, w = Math.min(230, W * 0.46), h = 70;
      rrect(c, x, y, w, h, 8); c.fillStyle = 'rgba(6,10,12,0.72)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.08)'; c.stroke();
      const kmh = st.v * 3.6;
      c.font = F(38, 500); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.shadowColor = 'rgba(255,170,60,0.7)'; c.shadowBlur = 12; c.fillStyle = '#ffd590'; c.fillText(pl(kmh, 3), x + 12, y + 44); c.shadowBlur = 0;
      const wN = c.measureText(pl(kmh, 3)).width;
      text(c, 'km/h', x + 18 + wN, y + 38, { size: 14, color: 'rgba(255,220,170,0.8)' });
      // speed bar with marks at 300, 431 and 505
      const bx = x + 12, bw = w - 24, by = y + 54;
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(bx, by, bw, 5);
      const g = c.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ffb020'); g.addColorStop(1, '#ff6a3d');
      c.fillStyle = g; c.fillRect(bx, by, bw * clamp(kmh / 505, 0, 1), 5);
      for (const m of [300, 431, 505]) { const xm = bx + bw * m / 505; c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(xm - 0.5, by - 2, 1, 9); }
      text(c, `field ${pl(R.mlFreq(st.v), 3)} Hz`, x + w - 10, y + 18, { size: 13, align: 'right', color: '#9df5b8' });
    }
    function drawLens(c, W, H) {
      const r = clamp(Math.min(W, H) * 0.15, 42, 74), cx = W - r - 62, cy = r + (W < 560 ? 52 : 18);   // clear of the 2D/3D buttons
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
      c.fillStyle = '#05080a'; c.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      const sc = 2 * r / (2.2 * 2 * R.ML.tau), gapY = cy - r * 0.02, xT = lensX;   // px per metre; the train frame (magnets fixed)
      // stator iron with slots (six per wavelength), coils carrying the travelling current pattern
      c.fillStyle = '#3c4246'; c.fillRect(cx - r, cy - r, 2 * r, gapY - 4 - (cy - r));
      const slot = R.ML.tau / 3, k0 = Math.floor((xT - r / sc) / slot) - 1, k1 = Math.ceil((xT + r / sc) / slot) + 1;
      for (let k = k0; k <= k1; k++) {
        const xw = k * slot, x = cx + (xw - xT) * sc, I = Math.cos(Math.PI * (xw - xT) / R.ML.tau);
        c.fillStyle = '#1a1e20'; c.fillRect(x - slot * sc * 0.22, gapY - 4 - r * 0.42, slot * sc * 0.44, r * 0.42);
        c.fillStyle = I > 0 ? `rgba(255,${120 - 60 * I},${80 - 40 * I},${0.25 + 0.7 * Math.abs(I)})` : `rgba(${90 + 40 * I},${150 + 30 * I},255,${0.25 + 0.7 * Math.abs(I)})`;
        c.fillRect(x - slot * sc * 0.16, gapY - 4 - r * 0.38, slot * sc * 0.32, r * 0.32);
      }
      // the magnet on the train: poles fixed in the train's frame
      c.fillStyle = '#20262a'; c.fillRect(cx - r, gapY + 4, 2 * r, r);
      for (let i = -3; i <= 3; i++) {
        const x = cx + (i + 0.5) * R.ML.tau * sc, n = i % 2 === 0;
        c.fillStyle = n ? 'rgba(229,72,63,0.85)' : 'rgba(62,126,230,0.85)'; c.fillRect(x - R.ML.tau * sc * 0.42, gapY + 6, R.ML.tau * sc * 0.84, r * 0.24);
        c.fillStyle = '#fff'; c.font = F(11); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n ? 'N' : 'S', x, gapY + 6 + r * 0.12);
      }
      // the 10 mm gap and its field
      c.strokeStyle = 'rgba(157,245,184,0.35)'; c.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { const x = cx + (i + 0.5) * R.ML.tau * sc; c.beginPath(); c.moveTo(x, gapY + 6); c.bezierCurveTo(x, gapY - r * 0.3, x + R.ML.tau * sc, gapY - r * 0.3, x + R.ML.tau * sc, gapY + 6); c.stroke(); }
      c.fillStyle = 'rgba(120,200,255,0.9)'; c.fillRect(cx - r, gapY - 4, 2 * r, 2);
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
      text(c, 'stator in the guideway', cx, cy - r * 0.78, { align: 'center', size: 11 });
      text(c, 'magnet on the train', cx, cy + r * 0.62, { align: 'center', size: 11 });
      text(c, '10 mm gap', cx - r - 6, gapY - 2, { size: 11.5, color: '#9fd8ff', align: 'right' });
      if (W < 560) text(c, 'close-up, slowed 400×', W - 8, cy + r + 12, { align: 'right', size: 11, color: 'rgba(214,224,218,0.7)' });
      else text(c, 'close-up under the train, slowed 400×', cx, cy + r + 12, { align: 'center', size: 11, color: 'rgba(214,224,218,0.7)' });
    }
    function drawProgress(c, W, H) {
      const x0 = 18, x1 = W - 18, y = H - 16, e = ends();
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
      const f = clamp(st.x / (p.km * 1e3), 0, 1), xm = x0 + (x1 - x0) * f;
      c.strokeStyle = lamp(); c.beginPath(); c.moveTo(x0, y); c.lineTo(xm, y); c.stroke();
      for (const [k, lab] of [['k300', '300'], ['k431', '431']]) { const mk = st.marks[k]; if (mk) { const xx = x0 + (x1 - x0) * mk.x / (p.km * 1e3); c.fillStyle = 'rgba(255,214,140,0.8)'; c.fillRect(xx - 0.5, y - 6, 1, 12); text(c, lab, xx, y - 11, { size: 10.5, align: 'center', color: 'rgba(255,214,140,0.85)' }); } }
      for (const [x, lab, al] of [[x0, e[0], 'left'], [x1, e[1], 'right']]) { c.fillStyle = '#e6ece8'; c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fill(); text(c, lab, x + (al === 'left' ? 8 : -8), y - 10, { size: 11.5, align: al }); }
      glow(c, xm, y, 10, '255,190,90', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(xm, y, 3, 0, TAU); c.fill();
      // the same trip by road, started at the same moment: about 30 km/h through the city
      if (st.t > 0) {
        const fr = clamp(st.t * ROAD_V / (p.km * 1e3), 0, 1), xr = x0 + (x1 - x0) * fr, yr = y - 22;
        c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, yr); c.lineTo(x1, yr); c.stroke();
        c.strokeStyle = 'rgba(255,120,100,0.85)'; c.beginPath(); c.moveTo(x0, yr); c.lineTo(xr, yr); c.stroke();
        c.fillStyle = '#ff8a78'; rrect(c, xr - 7, yr - 4, 14, 8, 2); c.fill(); c.fillStyle = '#1b2022'; c.fillRect(xr - 5, yr + 3, 3, 2); c.fillRect(xr + 2, yr + 3, 3, 2);
        const lab = st.done ? `by road, the car is only ${pl(st.t * ROAD_V / 1e3, 2)} km along` : `same trip by road: ${pl(st.t * ROAD_V / 1e3, 2)} km`;
        text(c, lab, clamp(xr + 12, x0 + 4, x1 - 180), yr - 9, { size: 11, color: 'rgba(255,170,150,0.95)' });
      }
    }
    return sim;
  }

  /* =====================================================================
     PET medicine: a hospital cyclotron fires protons into oxygen-18 water and makes fluorine-18. It is turned into a
     sugar (FDG), driven to the hospital and given to patients, all the time decaying with a 110-minute half-life.
     ===================================================================== */
  function makePET() {
    const P = R.PET, MEV = 1.602176634e-13, MCI = 3.7e7;
    const MACH = {
      yours: { t: 'Your cyclotron', sub: 'from the Cyclotron station', E: null, I: 30 },
      dharmais: { t: 'RS Kanker Dharmais', sub: 'Jakarta · 11 MeV', E: 11, I: 30, note: 'Indonesia’s national cancer hospital in Jakarta makes fluorine-18 every day with an 11 MeV Eclipse cyclotron. Measured: 395 mCi (14.6 GBq) after 20 minutes at 30 µA.' },
      decy: { t: 'DECY-13', sub: 'BRIN · 13 MeV', E: 13, I: 30, note: 'The 13 MeV cyclotron Indonesia’s nuclear agency (now BRIN) is building in Yogyakarta, so hospitals depend less on imported isotopes. Its designers worked out the same yield as this simulation: 1223 mCi after 40 minutes at 30 µA.' },
      pettrace: { t: 'GE PETtrace', sub: 'hospital · 16.5 MeV', E: 16.5, I: 55, note: 'A common hospital machine: an H⁻ cyclotron for 16.5 MeV protons. At the University of Michigan one made 1330 mCi (49 GBq) of fluorine-18 in 22 minutes at 55 µA.' },
      mrccc: { t: 'MRCCC Siloam', sub: 'Jakarta · 18 MeV', E: 18, I: 37, note: 'An 18 MeV IBA Cyclone 18/9 at the MRCCC Siloam hospital in Jakarta. Measured: 1961 mCi (72.6 GBq) after 40 minutes at 37 µA.' },
    };
    const p = { m: 'dharmais', I: 30, tbMin: 60, tdMin: 30, eff: 60 };
    const FAR = 300, FAR_MIN = 180;                    // the "without" world: the nearest cyclotron is in another city, 5 hours away
    let tdNear = 30;
    const ctls = {};
    let run = null, t = 0, flashes = [], spin = 0, vanX = 0, lastPat = -1, v3s = null;
    const lab = () => labNow();
    function energy() {
      if (p.m !== 'yours') return MACH[p.m].E;
      const L = lab(); if (!L || !L.part || L.part.key !== 'proton') return 0;
      return L.Kmax / MEV;
    }
    const yoursWhy = () => { const L = lab(); if (!L) return 'Open the Cyclotron station first.'; if (!L.part || L.part.key !== 'proton') return `Your cyclotron is set to accelerate ${L.part ? L.part.name.toLowerCase() + 's' : 'other particles'}; this reaction needs protons. Pick the proton in the Cyclotron station.`; const E = L.Kmax / MEV; return E < P.eth ? `Your protons reach only ${pl(E, 3)} MeV: below the 2.57 MeV threshold of ¹⁸O(p,n)¹⁸F, so no fluorine-18 at all. Make B or R bigger.` : `Your protons leave with ${pl(E, 3)} MeV (K = (qBR)²/2m with ${fmtB(L.B)} and R = ${pl(L.R, 3)} m). ${E >= 10.5 ? 'That is in the range hospital cyclotrons use (11–18 MeV).' : 'Enough to make some fluorine-18, but hospitals use 11–18 MeV: the yield grows steeply with energy (compare the machines above).'}`; };
    const GBq = A => A >= 1e9 ? `${pl(A / 1e9, 3)} GBq` : A >= 1e6 ? `${pl(A / 1e6, 3)} MBq` : `${pl(A / 1e3, 3)} kBq`;
    const mCi = A => `${pl(A / MCI, 3)} mCi`;
    const hm = s => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
    function compute() { run = R.petRun({ E: energy(), I: p.I, tb: p.tbMin * 60, eff: p.eff / 100, td: p.tdMin * 60 }); }
    const endT = () => (run.pats.length ? run.pats[run.pats.length - 1].t + P.slot : run.t3 + 1800);
    const phase = () => t <= 0 ? 'ready' : t < run.t1 ? 'beam' : t < run.t2 ? 'synth' : t < run.t3 ? 'drive' : t < endT() ? 'clinic' : 'done';
    const patNow = () => { let k = -1; for (let i = 0; i < run.pats.length; i++) if (t >= run.pats[i].t) k = i; return k; };
    function reset() { compute(); t = 0; flashes = []; lastPat = -1; }
    function step(dts) {
      t = Math.min(endT(), t + dts);
      const k = patNow(); if (k !== lastPat) { lastPat = k; if (k >= 0 && audio.tick) audio.tick(); }
      return t >= endT();
    }

    /* ---- 3D: the cyclotron vault, the road and the hospital with its PET scanner, at dusk ---- */
    const BX = -7, BY = 0.8, HX0 = 13.8, RY = -2.5;                     // vault centre, hospital centre, the road
    const CX = -8.3, CY = 1.0, TX = -5.0, TY = 1.0, KX = -4.6, KY = 2.85, SX = 13.4, SY = 1.4, SZ = 1.05;
    let skyline = null, camF = null;
    function drawSkyline(g, W, H, hy) {              // a far city on the horizon, with lit windows
      if (hy <= 4 || hy >= H) return;
      if (!skyline || skyline.W !== W) { skyline = { W, b: [] }; let x = -10; let i = 0; while (x < W + 10) { const w = 10 + hash(i * 3.1) * 26, h = 6 + Math.pow(hash(i * 7.7), 2.2) * 46; skyline.b.push([x, w, h, i]); x += w + 2 + hash(i * 1.3) * 10; i++; } }
      const s = Math.min(1, H / 520);
      for (const [x, w, h, i] of skyline.b) {
        const hh = h * s; g.fillStyle = h > 30 ? '#1c2240' : '#262a4a'; g.fillRect(x, hy - hh, w, hh);
        for (let yy = hy - hh + 4; yy < hy - 3; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5) if (hash(xx * 0.37 + yy * 1.91 + i) > 0.78) { g.fillStyle = `rgba(255,${200 + Math.round(40 * hash(xx + yy))},140,${0.25 + 0.35 * hash(yy + i)})`; g.fillRect(xx, yy, 1.6, 2.2); }
        if (h > 40 && hash(i * 9.1) > 0.5) { g.fillStyle = `rgba(255,60,60,${0.5 + 0.5 * Math.sin(performance.now() / 500 + i)})`; g.fillRect(x + w / 2 - 1, hy - hh - 3, 2, 2); }
      }
    }
    const room = (sc, cx, cy, floorRgb, wallRgb, sideX) => {
      sc.box([cx, cy, 0.06], [3.7, 2.7, 0.06], { rgb: floorRgb, amb: 0.62, spec: 0.05 });
      sc.box([cx, cy + 2.85, 0.95], [3.85, 0.15, 0.95], { rgb: wallRgb, amb: 0.55 });
      sc.box([sideX, cy, 0.95], [0.15, 2.7, 0.95], { rgb: wallRgb.map(v => v * 0.92), amb: 0.55 });
    };
    function draw3d(sc, c, W, H, dtr, running) {
      const tt = performance.now() / 1000, ph = phase(), A = run.activity(Math.max(0, t)), wide = W >= 620;
      // the camera follows the medicine: the vault while the beam is on, the van on the road, then the scanner
      const f = 0.5 * Math.min(W * 0.85, H * 1.05) / Math.tan(46 * Math.PI / 360), span = s => clamp(s / (W / f), 7, 80);
      const k0 = ph === 'drive' ? (t - run.t2) / Math.max(1, run.t3 - run.t2) : 0;
      const goal = ph === 'beam' || ph === 'synth' ? [-6.4, span(wide ? 18 : 12)] : ph === 'drive' ? [0.4 + 9.2 * k0, span(wide ? 25 : 15)] : ph === 'clinic' ? [13.7, span(wide ? 18 : 12)] : [3.6, span(33)];
      if (!camF) camF = goal.slice();
      const kk = clamp(dtr * 2.2, 0, 1); camF[0] += (goal[0] - camF[0]) * kk; camF[1] += (goal[1] - camF[1]) * kk;
      sc.begin(c, W, H, { dist: camF[1], target: [camF[0], 0.6, 0.5], lift: wide ? 0.05 : 0.02, bg: [40, 40, 62], fogNear: 1.1, fogFar: 3.2, fogMax: 0.6,
        backdrop: (g, W2, H2, hy) => { drawBlueHour(g, W2, H2, hy, tt); drawSkyline(g, W2, H2, hy); } });
      sc.poly([[-60, -40, 0], [70, -40, 0], [70, 40, 0], [-60, 40, 0]], { rgb: [30, 38, 36], shade: false, layer: 'back' });
      // the road, with its centre line and kerbs
      sc.poly([[-12, RY - 0.75, 0.01], [19, RY - 0.75, 0.01], [19, RY + 0.75, 0.01], [-12, RY + 0.75, 0.01]], { rgb: [46, 50, 56], shade: false, layer: 'back' });
      for (let x = -11.5; x < 18.5; x += 1.3) sc.poly([[x, RY - 0.04, 0.02], [x + 0.65, RY - 0.04, 0.02], [x + 0.65, RY + 0.04, 0.02], [x, RY + 0.04, 0.02]], { rgb: [236, 204, 96], a: 0.85, shade: false, layer: 'back' });
      for (const k of [-1, 1]) sc.poly([[-12, RY + k * 0.75, 0.02], [19, RY + k * 0.75, 0.02], [19, RY + k * 0.8, 0.02], [-12, RY + k * 0.8, 0.02]], { rgb: [150, 156, 160], shade: false, layer: 'back' });
      // the vault: thick concrete stops the neutrons and gamma rays the beam makes
      room(sc, BX, BY, [118, 122, 120], [150, 150, 144], BX - 3.85);
      sc.pool([CX + 1.2, CY, 0.13], 3, 2.2, [120, 200, 255], ph === 'beam' ? 0.16 : 0.05);
      sc.shadow([CX, CY, 0.13], 1.6, 1.6, 0.35);
      const beam = ph === 'beam';
      // the cyclotron: an iron magnet with its upper half lifted on jacks, so the dees and the beam's spiral show
      const yoke = { rgb: [48, 94, 140], amb: 0.55, spec: 0.35, shin: 26 };
      sc.cyl([CX, CY, 0.12], [CX, CY, 0.78], 1.45, yoke, 36);
      sc.cyl([CX, CY, 1.78], [CX, CY, 2.32], 1.45, yoke, 36);
      for (const a of [0.55, 2.2, 3.85, 5.5]) sc.cyl([CX + 1.22 * Math.cos(a), CY + 1.22 * Math.sin(a), 0.78], [CX + 1.22 * Math.cos(a), CY + 1.22 * Math.sin(a), 1.78], 0.07, { rgb: [190, 196, 200], spec: 0.6, flat: true }, 8);
      for (const s2 of [-1, 1]) { const pts = []; for (let i = 0; i <= 18; i++) { const a = -Math.PI / 2 + Math.PI * i / 18; pts.push([CX + s2 * (0.05 + 1.08 * Math.cos(a)), CY + 1.08 * Math.sin(a), 0.8]); } sc.poly(pts, { rgb: [196, 142, 84], amb: 0.7, spec: 0.5, shin: 30, out: [0, 0, 1] }); }
      if (beam && !reduceMotion) spin += dtr * 2.2;
      { const pts = []; for (let i = 0; i <= 260; i++) { const u = i / 260, a = u * 8 * TAU, r = 0.07 + 0.98 * Math.sqrt(u); pts.push([CX + r * Math.cos(a), CY + r * Math.sin(a), 0.83]); }
        sc.path(pts, `rgba(130,225,255,${beam ? 0.85 : 0.22})`, beam ? 1.6 : 1.1, { chunk: 6, glow: beam ? 'rgba(120,220,255,0.6)' : null });
        if (beam) for (let k = 0; k < 3; k++) { const u = (spin + k / 3) % 1, a = u * 8 * TAU, r = 0.07 + 0.98 * Math.sqrt(u); sc.glow([CX + r * Math.cos(a), CY + r * Math.sin(a), 0.86], 8, [170, 238, 255], 0.95, { px: true, core: true }); } }
      // the beam line and the target: water made with oxygen-18 behind a thin metal window
      const glowA = clamp(A / Math.max(run.Asat, 1), 0, 1);
      sc.cyl([CX + 1.45, CY, 0.83], [TX - 0.22, TY, 0.83], 0.07, { rgb: [176, 182, 186], spec: 0.6, shin: 30 }, 10);
      if (beam) sc.line([CX + 1.1, CY, 0.83], [TX - 0.22, TY, 0.83], 'rgba(150,235,255,0.95)', 2.6, { glow: 'rgba(140,230,255,0.85)' });
      sc.cyl([TX - 0.22, TY, 0.83], [TX + 0.26, TY, 0.83], 0.27, { rgb: [158, 166, 172], spec: 0.5, shin: 30 }, 18);
      if (ph !== 'ready' && (ph === 'beam' || ph === 'synth')) sc.glow([TX, TY, 0.83], 0.45 + 0.7 * glowA, [90, 255, 200], (0.25 + 0.6 * glowA) * (beam ? 1 : 0.35));
      // the hot cell: lead walls; the fluoride is piped in and comes out as FDG
      const syn = ph === 'synth';
      sc.cyl([TX, TY + 0.27, 0.83], [TX, KY - 0.5, 0.83], 0.035, { rgb: [200, 200, 190], flat: true }, 6);
      if (syn) { const u = clamp((t - run.t1) / 240, 0, 1); if (u < 1) sc.glow([TX, TY + 0.27 + (KY - 0.5 - TY - 0.27) * u, 0.83], 7, [120, 255, 210], 0.95, { px: true, core: true }); }
      sc.box([KX, KY, 0.66], [0.85, 0.5, 0.6], { rgb: [112, 118, 124], amb: 0.55, spec: 0.25 });
      sc.poly([[KX - 0.5, KY - 0.51, 0.62], [KX + 0.5, KY - 0.51, 0.62], [KX + 0.5, KY - 0.51, 1.08], [KX - 0.5, KY - 0.51, 1.08]], { rgb: syn ? [255, 212, 120] : [34, 46, 54], emit: syn ? '255,180,80' : null, emitA: 0.6, out: [0, -1, 0], spec: 0.8 });
      if (syn) sc.glow([KX, KY - 0.6, 0.85], 0.75, [255, 196, 110], 0.42 + 0.18 * Math.sin(tt * 6));
      // the van with its lead pot, driving the medicine to the hospital (the road is drawn shorter than it is)
      const k = ph === 'drive' ? (t - run.t2) / Math.max(1, run.t3 - run.t2) : (ph === 'clinic' || ph === 'done') ? 1 : 0;
      const ek = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      vanX = p.tdMin <= 0 && k > 0 ? 8.6 : -0.6 + 9.2 * ek;
      const VX = vanX, VY = RY - 0.34, lit = ph === 'drive';
      sc.shadow([VX + 0.2, VY, 0.03], 1.3, 0.45, 0.45);
      sc.box([VX, VY, 0.6], [0.78, 0.32, 0.4], { rgb: [238, 240, 242], amb: 0.62, spec: 0.35 });
      sc.box([VX + 0.98, VY, 0.47], [0.22, 0.3, 0.27], { rgb: [222, 226, 230], amb: 0.62 });
      sc.poly([[VX + 1.21, VY - 0.27, 0.45], [VX + 1.21, VY + 0.27, 0.45], [VX + 1.12, VY + 0.25, 0.72], [VX + 1.12, VY - 0.25, 0.72]], { rgb: [40, 62, 84], out: [1, 0, 0.3], spec: 0.9 });
      sc.poly([[VX - 0.78, VY - 0.33, 0.52], [VX + 0.78, VY - 0.33, 0.52], [VX + 0.78, VY - 0.33, 0.66], [VX - 0.78, VY - 0.33, 0.66]], { rgb: [242, 192, 40], out: [0, -1, 0], shade: false });
      // the radiation sign on the side
      sc.custom([VX - 0.1, VY - 0.34, 0.9], (g, x, y, kk) => { const r = Math.max(3, kk * 0.13); g.fillStyle = '#f2c028'; g.beginPath(); g.arc(x, y, r * 1.35, 0, TAU); g.fill(); g.fillStyle = '#1a1a1a'; for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU / 3; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, a - 0.52, a + 0.52); g.fill(); } g.fillStyle = '#f2c028'; g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill(); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(x, y, r * 0.18, 0, TAU); g.fill(); });
      for (const wx of [-0.45, 0.85]) for (const wy of [-0.33, 0.33]) sc.cyl([VX + wx, VY + wy - 0.06, 0.16], [VX + wx, VY + wy + 0.06, 0.16], 0.16, { rgb: [28, 28, 30], flat: true }, 10);
      if (lit) { for (const dy of [-0.18, 0.18]) sc.glow([VX + 1.23, VY + dy, 0.5], 6, [255, 240, 200], 0.95, { px: true }); sc.glow([VX + 2.2, VY, 0.05], 1.1, [255, 230, 170], 0.18); }
      // the hospital, cut open: the PET scanner, its bed and today's patients
      room(sc, HX0, 0.8, [206, 214, 216], [176, 196, 204], HX0 + 3.85);
      sc.pool([SX, SY - 0.6, 0.13], 2.6, 2.2, [255, 214, 170], 0.12);
      sc.shadow([SX, SY, 0.13], 1.1, 0.5, 0.3);
      sc.box([HX0 - 2.6, 3.6, 1.6], [0.08, 0.04, 0.36], { rgb: [214, 52, 52], amb: 0.9, shade: false }); sc.box([HX0 - 2.6, 3.6, 1.6], [0.36, 0.04, 0.08], { rgb: [214, 52, 52], amb: 0.9, shade: false });
      sc.box([SX, SY, 0.34], [0.72, 0.3, 0.3], { rgb: [200, 206, 212], amb: 0.6 });
      sc.tube([SX, SY - 0.32, SZ], [SX, SY + 0.32, SZ], 0.42, 0.95, { rgb: [236, 240, 244], innerRgb: [120, 130, 140], endRgb: [244, 246, 248], amb: 0.62, spec: 0.35 }, 36);
      sc.circle([SX, SY - 0.33, SZ], [0, 1, 0], 0.7, 'rgba(90,170,255,0.85)', 2.2);
      sc.box([SX, SY - 1.55, 0.6], [0.26, 1.2, 0.05], { rgb: [64, 104, 150], amb: 0.6 });
      sc.box([SX, SY - 1.9, 0.3], [0.18, 0.4, 0.27], { rgb: [150, 156, 162], amb: 0.6 });
      const kp = patNow(), inScan = ph === 'clinic' && kp >= 0 && t - run.pats[kp].t < P.slot * 0.85;
      if (inScan || ph === 'clinic') { const y0 = inScan ? SY - 1.1 : SY - 2.5; sc.cyl([SX, y0, 0.82], [SX, y0 + 1.3, 0.82], 0.16, { rgb: [120, 172, 214], amb: 0.62 }, 12); sc.cyl([SX, y0 + 1.3, 0.82], [SX, y0 + 1.55, 0.82], 0.12, { rgb: [222, 186, 160], amb: 0.65 }, 10); }
      // positrons meet electrons: two 511 keV gamma rays fly apart back to back and light up the ring of detectors
      if (inScan && running && !reduceMotion) if (Math.random() < 14 * dtr) flashes.push({ o: [SX + (Math.random() - 0.5) * 0.2, SY - 0.35, SZ - 0.18 + (Math.random() - 0.5) * 0.12], a: Math.random() * Math.PI, age: 0 });
      flashes = flashes.filter(q => (q.age += dtr) < 0.4);
      for (const q of flashes) {
        const d = [Math.cos(q.a), 0, Math.sin(q.a)], al = 1 - q.age / 0.4, e1 = [SX + d[0] * 0.72, q.o[1], SZ + d[2] * 0.72], e2 = [SX - d[0] * 0.72, q.o[1], SZ - d[2] * 0.72];
        sc.line(q.o, e1, `rgba(255,130,255,${al})`, 1.6, { glow: 'rgba(255,120,255,0.8)', layer: 'front' }); sc.line(q.o, e2, `rgba(255,130,255,${al})`, 1.6, { glow: 'rgba(255,120,255,0.8)', layer: 'front' });
        sc.glow(e1, 9, [255, 170, 255], al, { px: true, layer: 'front' }); sc.glow(e2, 9, [255, 170, 255], al, { px: true, layer: 'front' });
      }
      // today's patients: a slot every 20 minutes; dark slots are the ones the medicine ran out for
      const nSlot = Math.floor(P.day / P.slot), done = ph === 'clinic' || ph === 'done' ? patNow() + 1 : 0;
      for (let i = 0; i < nSlot; i++) {
        const col = i % 6, rw = Math.floor(i / 6), x = HX0 + 1.05 + col * 0.42, y = 3.1 - rw * 0.62;
        const has = i < run.pats.length, sc2 = i < done;
        const rgb = sc2 ? [236, 120, 226] : has ? [214, 222, 228] : [64, 70, 74];
        sc.cyl([x, y, 0.12], [x, y, 0.4], 0.1, { rgb, amb: 0.8, spec: 0.15 }, 10);
        sc.sphere([x, y, 0.5], 0.085, sc2 ? [255, 170, 245] : has ? [240, 236, 230] : [78, 82, 86]);
        if (sc2) sc.glow([x, y, 0.45], 0.32, [255, 120, 240], 0.35);
      }
      // labels
      sc.label([CX, CY, 2.7], 'cyclotron', { color: '#e6ece8' });
      sc.label([TX + 0.1, TY - 0.35, 0.3], '¹⁸O water', { color: '#9df5d0', dy: 12 });
      sc.label([KX, KY, 1.75], 'hot cell: FDG', { color: '#ffd590' });
      if (ph === 'drive' || (ph === 'synth' && wide)) sc.label([VX, VY, 1.35], ph === 'synth' ? 'van waiting' : GBq(A), { color: '#ffd590' });
      sc.label([SX, SY, 2.35], 'PET scanner', { color: '#e6ece8' });
      if (wide) sc.label([HX0 + 2.1, 3.1, 1.05], 'today’s patients', { color: '#ffb0ff' });
      if (wide && (ph === 'ready' || ph === 'done')) sc.label([3.0, RY - 1.2, 0.1], p.tdMin > 0 ? `road: ${hm(p.tdMin * 60)} (drawn shorter)` : 'no road: the cyclotron is in the hospital', { color: 'rgba(214,224,218,0.8)' });
      sc.end();
      overlay(c, W, H, A, ph);
    }
    // the big readout, the timeline of the day, the doses
    function overlay(c, W, H, A, ph) {
      const wide = W >= 620, x = 14, y = wide ? 16 : 52;
      c.fillStyle = 'rgba(6,10,12,0.72)'; rrect(c, x - 6, y - 8, wide ? 238 : 170, wide ? 86 : 64, 8); c.fill();
      text(c, 'fluorine-18 in hand', x + 4, y + 6, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
      text(c, GBq(A), x + 4, y + 28, { size: wide ? 28 : 20, color: '#9df5d0' });
      if (wide) text(c, `${mCi(A)} · halves every 110 min`, x + 4, y + 56, { size: 11.5, color: 'rgba(214,224,218,0.7)' });
      // timeline
      const tl = W < 600 ? 12 : 16, tr = W - (W < 600 ? 60 : 70), ty = H - 26, T = endT(), X = s => tl + (tr - tl) * clamp(s / T, 0, 1);
      const segs = [[0, run.t1, '90,220,255', 'beam'], [run.t1, run.t2, '255,190,90', 'FDG'], [run.t2, run.t3, '214,224,218', 'drive'], [run.t3, T, '255,130,255', 'patients']];
      c.fillStyle = 'rgba(6,10,12,0.72)'; rrect(c, tl - 6, ty - 20, tr - tl + 12, 34, 7); c.fill();
      for (const [a, b, rgb, s] of segs) { if (b <= a) continue; c.fillStyle = `rgba(${rgb},0.75)`; c.fillRect(X(a), ty, Math.max(1, X(b) - X(a) - 1), 6); if (X(b) - X(a) > 40) text(c, s, (X(a) + X(b)) / 2, ty - 9, { size: 11, align: 'center', color: `rgba(${rgb},0.95)` }); }
      for (const q of run.pats) { c.fillStyle = t >= q.t ? '#fff' : 'rgba(255,255,255,0.35)'; c.fillRect(X(q.t) - 0.5, ty - 2, 1, 10); }
      if (t > 0) { const mx = X(t); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mx, ty - 3); c.lineTo(mx - 5, ty - 10); c.lineTo(mx + 5, ty - 10); c.fill(); }
      // doses
      if (ph === 'clinic' || ph === 'done' || (wide && ph === 'drive')) {
        const n = ph === 'drive' ? 0 : patNow() + 1, bx = W < 600 ? x - 6 : W - 260, by = W < 600 ? y + 72 : 16;
        c.fillStyle = 'rgba(6,10,12,0.72)'; rrect(c, bx, by - 8, W < 600 ? 170 : 190, 50, 8); c.fill();
        text(c, `${run.doses} doses’ worth arrived`, bx + 10, by + 6, { size: 11.5, color: 'rgba(214,224,218,0.8)' });
        text(c, `${n} of ${run.pats.length} patients scanned`, bx + 10, by + 26, { size: 13.5, color: '#ffb0ff' });
      }
    }

    /* ---- 2D: the same day as a strip from cyclotron to scanner ---- */
    function draw2d(c, W, H, dtr, running) {
      const ph = phase(), A = run.activity(Math.max(0, t)), tt = performance.now() / 1000, gy = H * 0.66;
      const g = c.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, '#16213a'); g.addColorStop(1, '#6a4a5a'); c.fillStyle = g; c.fillRect(0, 0, W, gy);
      c.fillStyle = '#1b2220'; c.fillRect(0, gy, W, H - gy);
      const u = Math.min(W / 16, H / 6.5), X = s => W * s, beam = ph === 'beam';
      // cyclotron seen from above: the two dees and the spiral
      const cx = X(0.12), cy = gy - u * 1.35, r = u * 0.9;
      c.fillStyle = '#2b4f74'; c.beginPath(); c.arc(cx, cy, r * 1.16, 0, TAU); c.fill();
      for (const s of [-1, 1]) { c.fillStyle = s < 0 ? 'rgba(229,72,63,0.32)' : 'rgba(62,126,230,0.4)'; c.beginPath(); c.arc(cx + s * 2, cy, r, s < 0 ? Math.PI / 2 : -Math.PI / 2, s < 0 ? Math.PI * 1.5 : Math.PI / 2); c.fill(); }
      c.strokeStyle = `rgba(140,230,255,${beam ? 0.95 : 0.3})`; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i <= 200; i++) { const q = i / 200, a = q * 5 * TAU + (beam && !reduceMotion ? tt * 4 : 0), rr = r * (0.06 + 0.9 * Math.sqrt(q)); i ? c.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : c.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); } c.stroke();
      text(c, 'cyclotron', cx, cy + r * 1.16 + 14, { size: 12, align: 'center' });
      text(c, `${pl(energy(), 3)} MeV protons`, cx, cy + r * 1.16 + 30, { size: 11, align: 'center', color: '#9fd8ff' });
      const tx = X(0.25), ty = cy, ga = clamp(A / Math.max(run.Asat, 1), 0, 1);
      c.strokeStyle = beam ? 'rgba(140,230,255,0.95)' : 'rgba(170,176,180,0.5)'; c.lineWidth = beam ? 3 : 2; c.beginPath(); c.moveTo(cx + r * 1.16, cy); c.lineTo(tx - 10, ty); c.stroke();
      if (ph !== 'ready') glow(c, tx, ty, 14 + 30 * ga, '90,255,200', 0.3 + 0.6 * ga * (beam ? 1 : 0.4));
      c.fillStyle = '#9aa4aa'; rrect(c, tx - 10, ty - 12, 20, 24, 4); c.fill();
      text(c, '¹⁸O water', tx, ty + 26, { size: 11, align: 'center', color: '#9df5d0' });
      const hx = X(0.36); c.fillStyle = ph === 'synth' ? '#c9a24a' : '#5c666c'; rrect(c, hx - 22, gy - 52, 44, 52, 5); c.fill(); text(c, 'FDG', hx, gy - 26, { size: 13, align: 'center', color: ph === 'synth' ? '#1b1b1b' : '#e6ece8', halo: ph === 'synth' ? 0 : 3.5 }); text(c, `${Math.round(P.synthT / 60)} min`, hx, gy + 14, { size: 11, align: 'center', color: 'rgba(214,224,218,0.75)' });
      // road and van
      const r0 = X(0.44), r1 = X(0.74);
      c.fillStyle = '#30363a'; c.fillRect(r0, gy - 4, r1 - r0, 10); c.fillStyle = '#e6c85a'; for (let x = r0; x < r1; x += 18) c.fillRect(x, gy, 9, 2);
      const k = ph === 'drive' ? (t - run.t2) / Math.max(1, run.t3 - run.t2) : ph === 'ready' || ph === 'beam' || ph === 'synth' ? 0 : 1, vx = r0 + (r1 - r0 - 46) * k;
      c.fillStyle = '#eceef0'; rrect(c, vx, gy - 26, 46, 22, 4); c.fill(); c.fillStyle = '#f0be28'; c.fillRect(vx, gy - 16, 34, 4); c.fillStyle = '#202022'; c.beginPath(); c.arc(vx + 9, gy - 3, 5, 0, TAU); c.arc(vx + 37, gy - 3, 5, 0, TAU); c.fill();
      text(c, p.tdMin > 0 ? `${hm(p.tdMin * 60)} on the road` : 'no road: same building', (r0 + r1) / 2, gy + 22, { size: 11.5, align: 'center', color: 'rgba(214,224,218,0.8)' });
      // hospital with the scanner ring seen from the front
      const sx = X(0.86), sy = gy - u * 1.3, sr = u * 1.05;
      c.fillStyle = '#d7dce0'; rrect(c, sx - sr * 1.6, gy - sr * 2.9, sr * 3.2, sr * 2.9, 6); c.fill(); c.fillStyle = '#c84040'; c.fillRect(sx - 10, gy - sr * 2.75, 20, 6); c.fillRect(sx - 3, gy - sr * 2.75 - 7, 6, 20);
      c.fillStyle = '#eef1f4'; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill(); c.fillStyle = '#7a8a96'; c.beginPath(); c.arc(sx, sy, sr * 0.45, 0, TAU); c.fill();
      const kp = patNow(), inScan = ph === 'clinic' && kp >= 0 && t - run.pats[kp].t < P.slot * 0.85;
      if (inScan) { c.fillStyle = '#78aad2'; c.beginPath(); c.arc(sx, sy + sr * 0.12, sr * 0.2, 0, TAU); c.fill(); }
      if (inScan && running && !reduceMotion && Math.random() < 20 * dtr) flashes.push({ o: null, a: Math.random() * Math.PI, age: 0 });
      flashes = flashes.filter(q => (q.age += dtr) < 0.35);
      for (const q of flashes) { const al = 1 - q.age / 0.35, dx = Math.cos(q.a) * sr * 0.72, dy = Math.sin(q.a) * sr * 0.72; c.strokeStyle = `rgba(255,120,255,${al})`; c.lineWidth = 1.6; c.beginPath(); c.moveTo(sx - dx, sy - dy); c.lineTo(sx + dx, sy + dy); c.stroke(); glow(c, sx + dx, sy + dy, 7, '255,160,255', al); glow(c, sx - dx, sy - dy, 7, '255,160,255', al); }
      text(c, 'PET scanner', sx, gy + 14, { size: 12, align: 'center' });
      // today's patients: one slot every 20 minutes; dark where the medicine ran out
      { const nS = Math.floor(P.day / P.slot), done = ph === 'clinic' || ph === 'done' ? patNow() + 1 : 0, dw = Math.min(10, (sr * 3.2) / nS), x0 = sx - dw * (nS - 1) / 2;
        for (let i = 0; i < nS; i++) { c.fillStyle = i < done ? '#ff9cf0' : i < run.pats.length ? '#dfe6ea' : '#40464a'; c.beginPath(); c.arc(x0 + i * dw, gy + 32, Math.max(1.6, dw * 0.32), 0, TAU); c.fill(); }
        text(c, W < 600 ? `${run.pats.length} of ${nS} patients` : `today’s patients: ${run.pats.length} of ${nS} slots`, Math.min(sx, W - 52), gy + 48, { size: 11, align: 'center', color: '#ffb0ff' }); }
      overlay(c, W, H, A, ph);
    }

    function sideNotes() {
      const mn = $('#rsPetMNote'); if (mn) mn.innerHTML = p.m === 'yours' ? yoursWhy() : MACH[p.m].note;
      const tn = $('#rsPetTNote'); if (tn) tn.innerHTML = `After ${hm(p.tbMin * 60)} the target holds <b>${pl(100 * (1 - Math.exp(-P.lam * p.tbMin * 60)), 3)} %</b> of the most it can ever hold: fluorine-18 decays while it is being made, so a longer run gives less and less extra.`;
      const dn = $('#rsPetDNote'); if (dn) dn.innerHTML = `On the road the medicine loses <b>${pl(100 * (1 - Math.exp(-P.lam * p.tdMin * 60)), 3)} %</b> of its fluorine-18: half every 110 minutes, so the cyclotron must be close to the hospital.`;
      const en2 = $('#rsPetENote'); if (en2) en2.innerHTML = `Real targets give about half to two thirds of the ideal yield: the protons lose energy in the window foils and not all the fluorine is recovered.`;
    }
    const sim = {
      go: 'Start the day', speeds: [['300', '300× faster'], ['900', '900× faster'], ['3600', 'an hour a second']], speed0: '900',
      canvasLabel: 'A hospital cyclotron makes fluorine-18 in a target of oxygen-18 water, a hot cell turns it into FDG, a van drives it to the hospital and a PET scanner uses it on patients, with the activity shown as it decays',
      graphs: ['Fluorine-18 through the day', 'Patients against the drive to the hospital'],
      side() {
        return `<div class="panel"><div class="panel-title">Which cyclotron?</div><div class="chips chips-cards" id="rs-pet-m">${Object.entries(MACH).map(([k, M]) => `<button type="button" class="chip-btn" data-m="${k}">${M.t}<small>${M.sub}</small></button>`).join('')}</div><p class="hint" id="rsPetMNote"></p></div>
          <details class="acc tag-copper" open data-level="expert"><summary><span class="acc-title">The run</span></summary><div class="acc-body">
            ${ctl('pet-i', 'Beam current', 'µA')}
            ${ctl('pet-tb', 'Time in the beam', 'min')}<p class="hint" id="rsPetTNote"></p>
            <div data-level="expert">${ctl('pet-eff', 'Target efficiency', '%')}<p class="hint" id="rsPetENote"></p></div></div></details>
          <details class="acc tag-hazard" open><summary><span class="acc-title">The trip to the hospital</span></summary><div class="acc-body">
            ${ctl('pet-td', 'Driving time', 'min')}<p class="hint" id="rsPetDNote"></p>
            <p class="hint" data-level="beginner">Try 0 (a cyclotron inside the hospital) and then 4 hours. Same machine, same run: count the patients.</p></div></details>`;
      },
      bind(changed) {
        const sync = () => { for (const b of $$('#rs-pet-m button')) b.classList.toggle('is-on', b.dataset.m === p.m); };
        this._sync = sync;
        $('#rs-pet-m').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; p.m = b.dataset.m; p.I = MACH[p.m].I; for (const k in ctls) ctls[k].sync(); changed(); });
        ctls.i = range('pet-i', { min: 1, max: 100, step: 1, get: () => p.I, set: v => { p.I = v; changed(); } });
        ctls.tb = range('pet-tb', { min: 5, max: 240, step: 5, get: () => p.tbMin, set: v => { p.tbMin = v; changed(); } });
        ctls.td = range('pet-td', { min: 0, max: 360, step: 5, get: () => p.tdMin, set: v => { p.tdMin = v; changed(); } });
        ctls.eff = range('pet-eff', { min: 30, max: 100, step: 1, get: () => p.eff, set: v => { p.eff = v; changed(); } });
        sync();
      },
      reset() { reset(); sideNotes(); if (this._sync) this._sync(); },
      step,
      draw(c, W, H, dtr, running) { draw2d(c, W, H, dtr, running); },
      home3d: { yaw: -1.38, pitch: 0.3, dist: 30, target: [3.4, 0.6, 0.5], fov: 46, minDist: 2, maxDist: 120, minPitch: 0.05 },
      draw3d(sc, c, W, H, dtr, running) { draw3d(sc, c, W, H, dtr, running); },
      clock: () => t <= 0 ? 'ready' : `${hm(t)} into the day`,
      status() {
        const ph = phase();
        const L = lab();
        if (p.m === 'yours' && (!L || !L.part || L.part.key !== 'proton')) return ['This needs protons: pick the proton in the Cyclotron station', 'is-bad'];
        if (energy() < P.eth) return ['These protons are too slow to make fluorine-18', 'is-bad'];
        if (ph === 'ready') return [`${pl(energy(), 3)} MeV protons, ${pl(p.I, 3)} µA`, ''];
        if (ph === 'beam') return [`Beam on · ${GBq(run.activity(t))} made`, 'is-run'];
        if (ph === 'synth') return ['Turning fluorine into FDG', 'is-run'];
        if (ph === 'drive') return [`On the road · ${GBq(run.activity(t))} left`, 'is-run'];
        if (ph === 'clinic') return [`Patient ${patNow() + 1} of ${run.pats.length}`, 'is-good'];
        return [`${run.pats.length} patients scanned today`, run.pats.length ? 'is-good' : 'is-bad'];
      },
      narrate() {
        const ph = phase(), E = energy(), A = run.activity(Math.max(0, t));
        if (E < P.eth) return p.m === 'yours' ? yoursWhy() : 'Below 2.57 MeV a proton cannot knock a neutron out of oxygen-18, so no fluorine-18 is made.';
        if (simple()) {
          if (ph === 'ready') return `Cancer cells eat a lot of sugar. Hospitals give patients a sugar carrying <b>fluorine-18</b>, which glows in a PET scanner and shows where the cancer is. Fluorine-18 does not exist in nature: a <b>cyclotron</b> makes it, by firing ${pl(E, 3)} MeV protons into water made with oxygen-18. Press <b>Start the day</b>.`;
          if (ph === 'beam') return `The protons spiral out just like in your cyclotron, then hit the water. Now and then a proton knocks a neutron out of an oxygen-18 nucleus and leaves <b>fluorine-18</b>: about 1 in ${pl(1 / Math.max(run.perProton, 1e-12), 2)} protons do it. ${GBq(A)} so far.`;
          if (ph === 'synth') return 'A machine behind lead walls builds the fluorine into a sugar called FDG. This takes about 25 minutes, and the fluorine keeps decaying.';
          if (ph === 'drive') return p.tdMin >= FAR_MIN ? `This van comes from a cyclotron in another city: <b>${hm(p.tdMin * 60)} on the road</b>. Fluorine-18 halves every 110 minutes, so only ${pl(100 * Math.pow(0.5, p.tdMin / 109.77), 2)} % of it will arrive. ${GBq(A)} left.` : `On the road. Fluorine-18 <b>halves every 110 minutes</b>, so every minute in the van costs patients. ${GBq(A)} left.`;
          if (ph === 'clinic') return `Each patient gets 370 MBq. Inside them, each fluorine-18 sends out a positron, which meets an electron: both vanish into <b>two gamma rays</b> flying apart in opposite directions. The ring catches the pair and draws a line to where they came from.`;
          return run.pats.length ? `${run.pats.length} patients scanned with ${run.doses} doses’ worth that arrived. Try a longer drive and see how many fewer.` : 'Not even one dose arrived, so nobody could be scanned. Make more fluorine-18 (a stronger beam or a longer run), or drive less.';
        }
        if (ph === 'ready') return `${pl(E, 3)} MeV protons at ${pl(p.I, 3)} µA (${pl(run.protons / 1e14, 3)} × 10¹⁴ per second) will hit water enriched in oxygen-18. The reaction ¹⁸O(p,n)¹⁸F needs at least 2.57 MeV; its ideal saturation yield at ${pl(E, 3)} MeV is ${pl(R.yIdeal(E) / 1e9, 3)} GBq per µA (Hess et al. 2001), and real targets get about ${p.eff} % of it. Press <b>Start the day</b>.`;
        if (ph === 'beam') return `Beam on. Fluorine-18 builds up as A = A<sub>sat</sub>(1 − e<sup>−λt</sup>): made at a steady rate, but the more there is, the more decays, so it creeps towards A<sub>sat</sub> = ${GBq(run.Asat)}. Now ${GBq(A)} (${pl(100 * A / run.Asat, 3)} %). About one proton in ${pl(1 / Math.max(run.perProton, 1e-12), 2)} makes a nucleus.`;
        if (ph === 'synth') return `End of the beam: ${GBq(run.Aeob)} (${mCi(run.Aeob)}). The hot cell makes FDG in about 25 minutes; about ${pl(P.synthY * 100, 2)} % of the activity comes out as medicine (decay during synthesis included): ${GBq(run.Asyn)}.`;
        if (ph === 'drive') return `On the road for ${hm(p.tdMin * 60)}: A = A₀·e<sup>−λt</sup> with λ = ln 2 / 109.77 min, so ${pl(100 * Math.exp(-P.lam * p.tdMin * 60), 3)} % will arrive: ${GBq(run.Aarr)}, worth ${run.doses} doses of 370 MBq.`;
        if (ph === 'clinic') return `One patient every 20 minutes (one scanner), 370 MBq each, drawn from a vial that keeps decaying. Each ¹⁸F nucleus emits a positron; it annihilates with an electron into two 511 keV photons (E = mc² of each particle) going opposite ways, and the ring of detectors records the pair.`;
        if (!run.pats.length) return `Only ${GBq(run.Aarr)} arrived: less than one 370 MBq dose, so nobody could be scanned. Make more fluorine-18 (a stronger beam, a longer run, faster protons) or drive less.`;
        return `${run.pats.length} patients scanned in ${hm(Math.max(0, endT() - run.t3))}. ${run.doses} doses’ worth had arrived, but the vial kept decaying while patients waited their turn: after the last one ${GBq(run.left)} was left, and 20 minutes later that is ${GBq(run.left * Math.exp(-P.lam * P.slot))}, less than one dose. Try a driving time of 0, or a longer run.`;
      },
      tiles() {
        const E = energy();
        return [
          ['Proton energy', E > 0 ? `${pl(E, 3)} MeV` : '–', p.m === 'yours' ? (E > 0 ? 'from your own cyclotron' : 'your cyclotron is not set to protons') : MACH[p.m].sub],
          ['Fluorine-18 made', GBq(run.Aeob), `${mCi(run.Aeob)} at the end of the beam`, 'expert'],
          ['Reaches the hospital', GBq(run.Aarr), `after FDG making and ${hm(p.tdMin * 60)} of road`],
          ['Patients', `${run.pats.length}`, `370 MBq each · ${run.doses} doses’ worth arrived`],
        ];
      },
      graphA(cv) {
        const T = endT(), pts = []; for (let i = 0; i <= 300; i++) { const s = T * i / 300; pts.push([s / 3600, run.activity(s) / 1e9]); }
        const ymax = Math.max(1, run.Aeob / 1e9) * 1.15;
        const r = plot(cv, { xmin: 0, xmax: T / 3600, ymin: 0, ymax, xlabel: 'time (hours)', ylabel: 'fluorine-18 (GBq)', pad: { r: 16 }, series: [{ pts, color: '#7dffd0', width: 2.2 }] });
        if (!r) return;
        const c = r.ctx;
        for (const [s, lab] of [[run.t1, 'beam off'], [run.t2, 'FDG ready'], [run.t3, 'arrives']]) { const x = Math.round(r.XP(s / 3600)) + 0.5; c.strokeStyle = 'rgba(255,214,140,0.35)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(x, r.pad.t); c.lineTo(x, r.H - r.pad.b); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,214,140,0.85)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(lab, x + 3, r.pad.t + 2); }
        if (t > 0) { const x = r.XP(t / 3600), y = r.YP(run.activity(t) / 1e9); glow(c, x, y, 9, '125,255,208', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); }
      },
      graphB(cv) {
        const pts = [], E = energy();
        for (let m = 0; m <= 360; m += 10) { const q = R.petRun({ E, I: p.I, tb: p.tbMin * 60, eff: p.eff / 100, td: m * 60 }); pts.push([m / 60, q.pats.length]); }
        const r = plot(cv, { xmin: 0, xmax: 6, ymin: 0, ymax: Math.max(5, ...pts.map(q => q[1])) + 2, xlabel: 'drive to the hospital (hours)', ylabel: 'patients scanned', pad: { r: 16 }, series: [{ pts, color: '#ffb0ff', width: 2.2 }] });
        if (!r) return;
        const c = r.ctx, x = r.XP(p.tdMin / 60), y = r.YP(run.pats.length); glow(c, x, y, 9, '255,176,255', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
      },
      numbers() {
        const E = energy(), L = lab();
        let h = sec('The protons');
        if (p.m === 'yours' && L) h += row('Energy from your cyclotron', `${pl(E, 3)} MeV`, 'The energy a proton has when its circle reaches the edge of the dees.', `K = (qBR)²/2m = (1.602 × 10⁻¹⁹ C × ${pl(L.B, 3)} T × ${pl(L.R, 3)} m)² / (2 × 1.673 × 10⁻²⁷ kg)`);
        else h += row('Energy', `${pl(E, 3)} MeV`, `${MACH[p.m].t}: ${MACH[p.m].sub}. Most hospital cyclotrons accelerate H⁻ ions and strip off both electrons in a thin foil at the edge: the charge flips from − to +, so the magnet now bends the protons outwards and out of the machine.`, '');
        h += row('Protons per second', `${pl(run.protons / 1e14, 4)} × 10¹⁴`, 'Current is charge per second, and each proton carries e.', `N = I/e = ${pl(p.I, 3)} × 10⁻⁶ A / 1.602 × 10⁻¹⁹ C`);
        h += sec('Making fluorine-18: ¹⁸O + p → ¹⁸F + n');
        h += row('Threshold', '2.57 MeV', 'The products are heavier than what goes in, so the proton must bring the difference as energy, plus a little more because momentum must be kept.', 'Q = (Δ<sub>¹⁸O</sub> + Δ<sub>p</sub>) − (Δ<sub>¹⁸F</sub> + Δ<sub>n</sub>) = (−0.783 + 7.289) − (0.873 + 8.071) MeV = −2.438 MeV; E<sub>th</sub> = −Q·(m<sub>p</sub> + m<sub>O</sub>)/m<sub>O</sub> = 2.438 × 19/18 = 2.57 MeV');
        h += row('Ideal yield at saturation', `${pl(R.yIdeal(E) / 1e9, 4)} GBq per µA`, 'A thick target stops the protons; every slice of energy on the way down adds its share. Measured by Hess et al. (2001) for 96.7 % ¹⁸O water.', 'Y = (I/e)·n·∫σ(E)/S(E) dE, from the threshold up to the beam energy');
        h += row('Real target', `${pl(run.Asat / 1e9, 4)} GBq at saturation`, `× ${p.eff} % target efficiency (an assumption: real machines get roughly 50–65 %).`, `A<sub>sat</sub> = ${pl(R.yIdeal(E) / 1e9, 3)} GBq/µA × ${p.eff} % × ${pl(p.I, 3)} µA`);
        h += row('One fluorine-18 for every', `${pl(1 / Math.max(run.perProton, 1e-12), 3)} protons`, 'At saturation the target makes as many nuclei each second as decay, A<sub>sat</sub>; divide by the protons per second.', '');
        h += row('At the end of the beam', `${GBq(run.Aeob)} = ${mCi(run.Aeob)}`, '', `A = A<sub>sat</sub>(1 − e<sup>−λt</sup>), λ = ln 2 / 109.77 min, t = ${p.tbMin} min → ${pl(100 * (1 - Math.exp(-P.lam * p.tbMin * 60)), 3)} %`);
        h += sec('From the target to the patient');
        h += row('After making FDG', GBq(run.Asyn), 'A cassette machine takes about 22–25 minutes; about 72 % of the activity comes out as FDG (measured without decay correction, so the decay during synthesis is already in it).', '');
        h += row('After the drive', GBq(run.Aarr), `${hm(p.tdMin * 60)} on the road.`, `A = ${GBq(run.Asyn)} × e<sup>−λ·${p.tdMin} min</sup> = ${GBq(run.Aarr)}`);
        h += row('Doses’ worth on arrival', `${run.doses}`, 'An adult PET scan uses about 259–370 MBq (SNMMI/EANM); 370 MBq is used here.', `${GBq(run.Aarr)} / 370 MBq`);
        h += row('Patients scanned', `${run.pats.length}`, 'One scanner, a patient every 20 minutes for up to 8 hours (assumed); each dose is drawn from a vial that keeps decaying. Each patient rests for about an hour after the injection while the sugar is taken up, then is scanned.', '');
        h += sec('In the scanner');
        h += row('Each decay', 'a positron', '¹⁸F → ¹⁸O + e⁺ + ν in 97 % of decays. The positron slows down and meets an electron within about a millimetre; both are annihilated.', '');
        h += row('Gamma rays', '2 × 511 keV, back to back', 'Each gamma ray carries E = mc² of one electron, 511 keV. The pair was almost at rest, so momentum must stay almost zero: the two fly apart in (almost exactly) opposite directions. Detectors on both sides fire together and the line between them passes through the tumour.', 'E = m<sub>e</sub>c² = 9.109 × 10⁻³¹ kg × (2.998 × 10⁸ m/s)² = 8.19 × 10⁻¹⁴ J = 511 keV');
        return h;
      },
      check() {
        const eta = p.eff / 100, Y = (E, I, tm) => R.yIdeal(E) * eta * I * (1 - Math.exp(-P.lam * tm * 60));
        const cmp = (what, model, real, fmt, realTxt, src) => [what, fmt(model), realTxt, src, Math.abs(model / real - 1) <= 0.2 ? 'good' : 'warn'];
        const rows = [
          cmp('RS Kanker Dharmais: 11 MeV, 30 µA for 20 min', Y(11, 30, 20), 395 * MCI, mCi, '395 mCi (measured)', 'uny'),
          cmp('MRCCC Siloam: 18 MeV, 37 µA for 40 min', Y(18, 37, 40), 1961 * MCI, mCi, '1961 mCi (measured)', 'uny'),
          cmp('DECY-13: 13 MeV, 30 µA for 40 min', Y(13, 30, 40), 1223 * MCI, mCi, '1223 mCi (its designers’ calculation)', 'uny'),
          cmp('GE PETtrace, Michigan: 16 MeV, 55 µA for 22 min', Y(16, 55, 22), 1330 * MCI, mCi, '1330 ± 153 mCi (measured)', 'umich'),
          cmp('IBA water targets at 18 MeV, at saturation', R.yIdeal(18) * eta, 8.5e9, A => `${pl(A / 1e9, 3)} GBq per µA`, '8.3–8.7 GBq per µA (measured)', 'ibat'),
          ['Half-life of fluorine-18', '109.77 min', '109.77 min', 'nndc', 'good'],
          ['FDG out of the hot cell', `${pl(P.synthY * 100, 2)} % in 25 min`, '72 % (not decay-corrected); 22–25 min', 'umich', 'good'],
        ];
        return `<p class="hint">The same model, with ${p.eff} % target efficiency, against four real machines (two of them in Jakarta) and the one Indonesia is building. Green: within 20 %.</p>` + cmpTable(rows)
          + '<p class="hint">Real targets differ in their window foils, how enriched the water is and how much fluorine is recovered, so no single efficiency fits every machine exactly.</p>';
      },
      keyNumbers() {
        const E = energy();
        return row('Proton energy', `${pl(E, 3)} MeV`, 'Enough to knock a neutron out of oxygen-18 (needs 2.57 MeV).')
          + row('Fluorine-18 made', GBq(run.Aeob), `After ${hm(p.tbMin * 60)} in the beam.`)
          + row('Half-life', '110 minutes', 'Every 110 minutes half of it is gone, made or not.')
          + row('Reaches the hospital', GBq(run.Aarr), `${pl(100 * Math.exp(-P.lam * p.tdMin * 60), 3)} % survives the drive.`)
          + row('Patients scanned', `${run.pats.length}`, '370 MBq each, one every 20 minutes.');
      },
      link(sm) {
        const L = lab();
        const rows = [
          ['Particle', L ? `${L.part.name} (${L.part.symbol})` : 'proton', 'protons (from H⁻ ions)'],
          ['Energy at the edge, K = (qBR)²/2m', L ? `${en(L.Kmax)}` : '–', `${pl(energy(), 3)} MeV`],
          ['What it is for', 'learning how the cyclotron works', 'making fluorine-18 for cancer scans'],
        ];
        if (!sm) rows.push(['Beam', L ? 'one particle at a time' : '–', `${pl(p.I, 3)} µA: ${pl(run.protons / 1e14, 3)} × 10¹⁴ protons a second`], ['Why a cyclotron', 'f = qB/2πm does not depend on speed, so one RF frequency keeps pushing', 'the same: a compact machine that fits in a hospital basement']);
        return {
          title: 'How is a hospital cyclotron like yours?',
          text: sm ? `Hospital cyclotrons are your machine at work: the same dees, the same magnet, the same spiral. At 11 to 18 MeV the protons are fast enough to turn oxygen-18 into <b>fluorine-18</b>, which shows doctors where cancer is. And because fluorine-18 halves every 110 minutes, the cyclotron has to be close to the hospital.`
            : `Every hospital cyclotron is a fixed-frequency machine like yours: f = qB/2πm stays the same as the protons speed up (they stay far below the speed of light at 18 MeV), so one RF frequency keeps them in step, and the energy is set by the size of the magnet: K = (qBR)²/2m. Above 2.57 MeV a proton can turn ¹⁸O into ¹⁸F; the yield rises steeply up to about 18 MeV, which is why hospital machines are built for 11–18 MeV.`,
          cols: ['Your cyclotron', 'A hospital cyclotron'], rows, alt: 'Animation: on the left your cyclotron’s spiral, on the right the hospital cyclotron’s beam hitting a target and a PET scanner catching two gamma rays',
          draw: (c, W, H, t2) => twoPanels(c, W, H, t2, panelCyclo('the dees push it: the circle grows'), (c2, w2, h2, t3) => {
            const ex = w2 * 0.3, ey = h2 * 0.56, rr = Math.min(w2, h2) * 0.2;
            c2.strokeStyle = 'rgba(120,220,255,0.8)'; c2.lineWidth = 1.3; c2.beginPath(); for (let i = 0; i <= 120; i++) { const q = i / 120, a = q * 5 * TAU, r = rr * Math.sqrt(q); i ? c2.lineTo(ex + r * Math.cos(a), ey + r * Math.sin(a)) : c2.moveTo(ex + r * Math.cos(a), ey + r * Math.sin(a)); } c2.stroke();
            const sx = w2 * 0.75, ph2 = (t3 % 1.2) / 1.2;
            c2.strokeStyle = 'rgba(140,230,255,0.9)'; c2.lineWidth = 2; c2.beginPath(); c2.moveTo(ex + rr, ey); c2.lineTo(ex + rr + (sx - rr * 1.2 - ex - rr) * Math.min(1, ph2 * 2), ey); c2.stroke();
            c2.strokeStyle = 'rgba(230,234,238,0.8)'; c2.lineWidth = 5; c2.beginPath(); c2.arc(sx, ey, rr * 0.9, 0, TAU); c2.stroke();
            if (ph2 > 0.5) { const a = (Math.floor(t3 / 1.2) * 1.7) % Math.PI, d = rr * 0.9; c2.strokeStyle = 'rgba(255,120,255,0.9)'; c2.lineWidth = 1.5; c2.beginPath(); c2.moveTo(sx - d * Math.cos(a), ey - d * Math.sin(a)); c2.lineTo(sx + d * Math.cos(a), ey + d * Math.sin(a)); c2.stroke(); glow(c2, sx + d * Math.cos(a), ey + d * Math.sin(a), 7, '255,160,255', 0.9); glow(c2, sx - d * Math.cos(a), ey - d * Math.sin(a), 7, '255,160,255', 0.9); }
            text(c2, 'a hospital cyclotron', 10, 15, { size: 13 });
            text(c2, `${pl(energy(), 3)} MeV protons → fluorine-18`, 10, 33, { size: 12, color: '#9df5b8' });
            text(c2, 'the scanner catches two 511 keV gamma rays', 10, h2 - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
          }),
        };
      },
      sources: ['hess', 'exfor', 'nndc', 'ame', 'uny', 'dharm', 'umich', 'ibat', 'fastlab', 'snmmi', 'eanm', 'kemkes'],
      whySources: ['kemkesfw', 'ugm', 'acs'],
      // why it exists: the same cyclotron and the same run, with the cyclotron near the scanner or in another city
      get without() { return p.tdMin >= FAR_MIN; },
      setWithout(b) {
        if (b && p.tdMin < FAR_MIN) { tdNear = p.tdMin; p.tdMin = FAR; }
        else if (!b && p.tdMin >= FAR_MIN) p.tdMin = tdNear < FAR_MIN ? tdNear : 30;
        if (ctls.td) ctls.td.sync();
      },
      why(sm) {
        const E = energy(), near = p.tdMin < FAR_MIN ? p.tdMin : (tdNear < FAR_MIN ? tdNear : 30);
        const run2 = td => R.petRun({ E, I: p.I, tb: p.tbMin * 60, eff: p.eff / 100, td: td * 60 }).pats.length;
        const nFar = run2(FAR), nNear = run2(near), far = p.tdMin >= FAR_MIN;
        const pt = n => `${n} patient${n === 1 ? '' : 's'}`;
        return {
          q: 'Why does a hospital need a cyclotron nearby?',
          a: sm ? 'Cancer is the third biggest cause of death in Indonesia, and many people die because it is found too late. A PET scan finds it and shows where it has spread: cancer cells take up more sugar, so a sugar carrying <b>fluorine-18</b> makes them light up on the scan. But fluorine-18 does not exist in nature and halves every 110 minutes, so a cyclotron has to make it every morning, close to the patients.'
            : 'Cancer killed 242,099 people in Indonesia in 2022, many because it was found late. PET finds tumours and their spread because cancer cells take up more glucose, so FDG labelled with <b>fluorine-18</b> lights them up. Fluorine-18 is made by ¹⁸O(p,n)¹⁸F with 11–18 MeV protons and decays with a 110-minute half-life: the cyclotron has to be close to the scanner.',
          metric: 'Patients scanned in one day, one scanner',
          pick: true,
          rows: [
            { k: 'off', label: `Cyclotron in another city, ${FAR / 60} hours away`, v: nFar, txt: pt(nFar), cur: far },
            { k: 'on', label: near ? `Cyclotron nearby, ${hm(near * 60)} away` : 'Cyclotron in the hospital itself', v: nNear, txt: pt(nNear), cur: !far },
          ],
          verdict: E < P.eth ? 'These protons are too slow to make fluorine-18: no scans at all.' : nNear === 0 ? 'Not enough fluorine-18 for even one patient: make more (a stronger beam or a longer run).' : nNear > nFar ? `Same cyclotron, same run: <b>${nNear - nFar} more patient${nNear - nFar === 1 ? '' : 's'} a day</b> when it is close, because the medicine decays on the road.` : 'Both fill every slot of the day: here the scanner, not the drive, is the limit.',
        };
      },
      helps(sm) {
        const lossH = 100 * (1 - Math.pow(0.5, 60 / 109.77)), n = run.pats.length;
        return [
          ['scan', 'Patients', 'A PET scan shows where cancer is, how far it has spread and whether the treatment is working.', 'acs'],
          ['chart', 'Indonesia', 'Cancer is the third leading cause of death: 408,661 new cases and 242,099 deaths in 2022. Many die because it is found late.', 'kemkesfw'],
          ['clock', 'Hospitals', `Every hour on the road costs ${pl(lossH, 2)} % of the medicine, so cyclotrons are built in or next to hospitals, as in Jakarta.`, 'nndc'],
          ['people', 'This setup', n ? `${n} patients a day from one scanner: about ${(n * 250).toLocaleString('en-US')} scans a year (250 working days).` : 'No patient can be scanned with these settings: make more fluorine-18 or drive less.', ''],
        ];
      },
    };
    return sim;
  }


  const MAKE = { maglev: makeMaglev, pet: makePET };

  /* =====================================================================
     The frame round the simulations: header, picker, run controls,
     tiles, graphs, notebook; and the doors into it from the stations
     ===================================================================== */
  let root = null, host = null, cur = null, sim = null, runState = 'idle', speedKey = '1', dataTab = 'numbers', working = true;
  let cv = null, ctx = null, W = 0, H = 0, lastUI = 0, lastGraph = 0, lastData = 0, graphDirty = true, dataDirty = true, opener = null;
  let linkCv = null, linkCtx = null, LW = 0, LH = 0, linkT = 0, linkDraw = null, linkSeen = true, v3 = null;
  const sims = {};

  function shellHTML() {
    return `<div class="rsim-head">
        <button type="button" class="pbtn rsim-back" id="rsBack"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 4.4 7.8 12l7.6 7.6-1.8 1.8L4.2 12l9.4-9.4z"/></svg><span>Back to the <b id="rsHost">Gauss gun</b></span></button>
        <div class="rsim-titles"><p class="rsim-kicker">Real life, simulated</p><h2 class="rsim-title" id="rsTitle" tabindex="-1"></h2></div>
        <button type="button" class="xp-open rsim-xp" id="rsXp" data-xp="pet">How it works</button>
        <div class="rsim-picks" role="tablist" aria-label="Choose what to simulate">${ORDER.map(id => `<button type="button" role="tab" class="rsim-pick" id="rsTab-${id}" data-sim="${id}" aria-selected="false" aria-controls="rsBody">${ICON[id]}<span>${SIM[id].name}<small>${SIM[id].tag}</small></span></button>`).join('')}</div>
      </div>
      <section class="paper rsim-why" id="rsWhy" aria-labelledby="rsWhyQ">
        <div class="why-text"><h3 class="why-q" id="rsWhyQ"></h3><p class="why-a" id="rsWhyA"></p></div>
        <div class="why-cmp" id="rsWhyCmp"></div>
        <button type="button" class="why-fold" id="rsWhyFold" aria-expanded="true" aria-label="Hide the answer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 15.4 12 9.8l5.6 5.6 1.4-1.4-7-7-7 7z"/></svg></button>
      </section>
      <div class="arena-layout rsim-layout" id="rsBody" role="tabpanel">
        <div class="arena-main">
          <div class="arena-wrap rsim-wrap" id="rsWrap"><canvas id="rsCanvas" role="img"></canvas><div class="hud hud-status" id="rsStatus" aria-live="polite">Ready</div></div>
          <div class="arena-bar">
            <button type="button" class="btn-go" id="rsGo">Start</button>
            <button type="button" class="pbtn" id="rsReset">Reset</button>
            <div class="speeds" role="radiogroup" aria-label="Playback speed" id="rsSpeeds" data-level="expert"></div>
            <span class="arena-time" id="rsClock">t = 0 s</span>
          </div>
          <div class="narrate rsim-narrate"><div class="narrate-t">What is happening</div><p class="narrate-x" id="rsNarrate" aria-live="polite"></p></div>
          <div class="tiles" id="rsTiles"></div>
          <section class="card paper rsim-helps" id="rsHelps" data-level="expert" aria-labelledby="rsHelpsT">
            <h3 class="rsim-helps-t" id="rsHelpsT">Who it helps</h3>
            <ul class="rsim-helps-l" id="rsHelpsL"></ul>
          </section>
          <section class="card paper rsim-link" id="rsLink" aria-labelledby="rsLinkT">
            <h3 class="rsim-link-t" id="rsLinkT"></h3>
            <p class="rsim-link-x" id="rsLinkX"></p>
            <div class="rsim-link-body"><canvas class="rsim-link-cv" id="rsLinkCv" role="img"></canvas><div class="rsim-link-tab table-wrap" id="rsLinkTab"></div></div>
          </section>
          <div class="card gg-graphs">
            <div class="gg-graph"><div class="graph-head"><span class="panel-title" id="rsGAt"></span></div><canvas id="rsGA" role="img"></canvas></div>
            <div class="gg-graph" data-level="expert"><div class="graph-head"><span class="panel-title" id="rsGBt"></span></div><canvas id="rsGB" role="img"></canvas></div>
          </div>
          <div class="card data" id="rsData" data-level="expert">
            <div class="data-head">
              <div class="tabs" role="tablist" aria-label="Numbers behind the simulation">
                <button type="button" role="tab" data-tab="numbers" id="rsNumTab">The numbers</button>
                <button type="button" role="tab" data-tab="check">Real-world check</button>
                <button type="button" role="tab" data-tab="sources">Sources</button>
              </div>
              <label class="switch switch-sm" data-level="expert"><input type="checkbox" id="rsWorking" checked><span class="switch-track" aria-hidden="true"></span><span class="switch-text">Show working</span></label>
            </div>
            <div class="data-body" id="rsDataBody" role="tabpanel"></div>
          </div>
        </div>
        <aside class="side" id="rsSide" aria-label="Settings for this simulation"></aside>
      </div>`;
  }
  function entryHTML(hostName) {
    return `<div class="panel rsim-entry"><div class="panel-title">Real life, simulated</div>
      ${HOSTS[hostName].map(id => `<button type="button" class="rsim-card" data-open-sim="${id}"><span class="rsim-card-ico" aria-hidden="true">${ICON[id]}</span><span class="rsim-card-t">${SIM[id].name}</span><span class="rsim-card-s">${SIM[id].why}</span></button>`).join('')}</div>`;
  }

  function open(id, hostName) {
    if (!root) return;
    hostName = hostName || (HOSTS[CL.active] && HOSTS[CL.active].includes(id) ? CL.active : SIM[id].host);
    opener = document.activeElement;
    if (CL.active !== hostName) CL.go(hostName);
    const scr = $('#screen-' + hostName);
    if (host && host !== hostName) { const old = $('#screen-' + host); if (old) old.classList.remove('has-rsim'); }
    if (root.parentNode !== scr) scr.appendChild(root);
    host = hostName; scr.classList.add('has-rsim'); root.hidden = false; scr.scrollTop = 0;
    if (getComputedStyle(scr).position !== 'absolute') window.scrollTo(0, 0);     // narrow screens scroll the page, not the station
    if (CL.screens[host] && CL.screens[host].hide) CL.screens[host].hide();
    $('#rsHost').textContent = HOST_NAME[host];
    select(id, true);
    const picks = root.querySelector('.rsim-picks'); if (picks) picks.hidden = (HOSTS[host] || []).length < 2;
    requestAnimationFrame(() => { resize(); $('#rsTitle').focus({ preventScroll: true }); if (CL.explain) CL.explain.auto(id); });
  }
  function close() {
    if (!host) return;
    const h = host, scr = $('#screen-' + h);
    setRun(runState === 'run' ? 'pause' : runState);
    if (scr) scr.classList.remove('has-rsim');
    root.hidden = true; host = null;
    if (CL.active === h && CL.screens[h] && CL.screens[h].show) CL.screens[h].show();
    const back = (scr && scr.querySelector(`[data-open-sim="${cur}"]`)) || opener;
    if (back && back.focus && back.isConnected) back.focus({ preventScroll: true });
    if (CL.reallife) CL.reallife.kick();
  }
  function select(id, fresh) {
    if (sim && runState === 'run') setRun('pause');
    cur = id; sim = sims[id] || (sims[id] = MAKE[id]());
    for (const b of $$('.rsim-pick', root)) b.setAttribute('aria-selected', String(b.dataset.sim === id));
    $('#rsTitle').textContent = SIM[id].name;
    const xb = $('#rsXp'); if (xb) xb.dataset.xp = id;
    cv.setAttribute('aria-label', sim.canvasLabel);
    $('#rsGAt').textContent = sim.graphs[0]; $('#rsGBt').textContent = sim.graphs[1];
    $('#rsGA').setAttribute('aria-label', sim.graphs[0]); $('#rsGB').setAttribute('aria-label', sim.graphs[1]);
    $('#rsSide').innerHTML = sim.side();
    sim.bind(changed);
    if (v3) { v3.scene.setHome(Object.assign({ yaw: -0.9, pitch: 0.45, dist: 4, target: [0, 0, 0], fov: 46, minDist: 0.05, maxDist: 100 }, sim.home3d || {})); v3.scene.reset(); if (v3.syncZoomKey) v3.syncZoomKey(); }
    if (!sim._speed) sim._speed = sim.speed0;
    renderSpeeds();
    sim.reset();
    setRun('idle');
    $('#rsTiles').innerHTML = '';
    graphDirty = dataDirty = true; W = 0;
    renderLink(); linkT = 0; renderWhy(); renderHelps();
    if (!fresh) requestAnimationFrame(resize);
    updateUI(true);
  }
  // Why it exists: the problem it solves, the world without it and with it (both worked out by the same model), and who it helps
  let whyOpen = true;
  function renderWhy() {
    const box = $('#rsWhy');
    let Y = null;
    try { Y = sim && sim.why ? sim.why(simple()) : null; } catch (err) { console.error(err); }
    if (!Y) { box.hidden = true; return; }
    box.hidden = false;
    setText($('#rsWhyQ'), Y.q);
    const a = $('#rsWhyA'); if (a._h !== Y.a) { a._h = Y.a; a.innerHTML = Y.a; }
    const pick = !!Y.pick, max = Math.max(...Y.rows.map(r => r.v), Y.mark ? Y.mark.v : 0) * 1.08 || 1;
    const pc = v => `${clamp(100 * v / max, 0, 100).toFixed(1)}%`;
    const rowHTML = r => {
      const inner = `<span class="why-row-l">${r.label}</span><span class="why-track"><i style="width:${pc(r.v)}"></i>${Y.mark ? `<b class="why-tick" style="left:${pc(Y.mark.v)}"></b>` : ''}</span><span class="why-row-v">${r.txt}</span>`;
      const cls = `why-row ${r.k === 'off' ? 'is-off' : 'is-on'}${r.cur ? ' is-cur' : ''}`;
      return pick ? `<button type="button" class="${cls}" role="radio" aria-checked="${r.cur ? 'true' : 'false'}" data-why="${r.k}">${inner}</button>` : `<div class="${cls}" role="listitem">${inner}</div>`;
    };
    const html = `<p class="why-m">${Y.metric}${Y.mark ? ` <span class="why-mk"><i aria-hidden="true"></i>${Y.mark.label}</span>` : ''}</p>
      <div class="why-rows" role="${pick ? 'radiogroup' : 'list'}" aria-label="${esc(Y.metric)}">${Y.rows.map(rowHTML).join('')}</div>
      <p class="why-v">${Y.verdict}${pick ? ' <span class="why-hint">Pick a row to see that world in the simulation.</span>' : ''}</p>`;
    const cmp = $('#rsWhyCmp'); if (cmp._h !== html) { cmp._h = html; cmp.innerHTML = html; }
    box.classList.toggle('is-folded', !whyOpen);
    const f = $('#rsWhyFold'); f.setAttribute('aria-expanded', String(whyOpen)); f.setAttribute('aria-label', whyOpen ? 'Hide the answer' : 'Show the answer');
  }
  // Who it helps: the people who gain from it, with where each fact comes from
  const HICON = {
    person: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z',
    people: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm8 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM8 13c-3.3 0-6 1.8-6 4v2h12v-2c0-2.2-2.7-4-6-4zm8 0c-.5 0-1 0-1.5.1 1.5.9 2.5 2.3 2.5 3.9v2h5v-2c0-2.2-2.7-4-6-4z',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v6.2l5 3 1-1.7-4-2.4V7z',
    chart: 'M3 20h18v2H3zm2-3h3V9H5zm5.5 0h3V4h-3zm5.5 0h3v-6h-3z',
    scan: 'M10 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 3.6a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8zM3 12.2h20v1.9H3z',
    shield: 'M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
    sat: 'M2 6.2 6.2 2l5 5L7 11.2zM12.8 17l4.2-4.2 5 5-4.2 4.2zM8.8 12.4l3.6-3.6 2.8 2.8-3.6 3.6z',
    web: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15 15 0 0 0-1.3-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm.8 2h3a15 15 0 0 0 1.3 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.3-3.6A15 15 0 0 0 8.1 8zM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4zm.3 5.6c.6-1.1 1-2.3 1.3-3.6h3a8 8 0 0 1-4.3 3.6zm1.7-5.6a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4z',
    beam: 'M14 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM1 11h9v2H1z',
    magnet: 'M5 3h5v8.5a2 2 0 0 0 4 0V3h5v8.5a7 7 0 0 1-14 0zm0 0v3h5V3zm9 0v3h5V3z',
    jet: 'M2 12.6 8.6 12l2.9-6.4h2.2l-1.5 6.2 4.9-.4L19.6 8h1.6l-.9 3.8 1.7.4v1.6l-1.7.4.9 3.8h-1.6l-2.5-3.4-4.9-.4 1.5 6.2h-2.2L8.6 14 2 13.4z',
    drone: 'M5 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm14 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM5 16.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm14 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 5.1l12.4 12.4-1.4 1.4L5.1 6.5zm11 0 1.4 1.4L6.5 18.9l-1.4-1.4zM9.5 9.5h5v5h-5z',
    wrench: 'M21 7.5a5 5 0 0 1-6.6 4.7L6.7 20a2 2 0 0 1-2.8-2.8l7.8-7.7A5 5 0 0 1 16.5 3l-3 3 .9 2.6 2.6.9z',
    planet: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-3 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
    star: 'M12 2l2.4 7.2H22l-6.1 4.6 2.3 7.2L12 16.5 5.8 21l2.3-7.2L2 9.2h7.6z',
    track: 'M2 15h20v2H2zm2-5h16v3H4zm3-4h10v3H7z',
    virus: (() => { let d = 'M12 6.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8z'; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a), px = -s * 0.6, py = c * 0.6, x0 = 12 + c * 5, y0 = 12 + s * 5, x1 = 12 + c * 7.6, y1 = 12 + s * 7.6, kx = 12 + c * 8.8, ky = 12 + s * 8.8, f = v => v.toFixed(2); d += `M${f(x0 + px)} ${f(y0 + py)}L${f(x1 + px)} ${f(y1 + py)}L${f(x1 - px)} ${f(y1 - py)}L${f(x0 - px)} ${f(y0 - py)}zM${f(kx + 1.5)} ${f(ky)}a1.5 1.5 0 1 0-3 0 1.5 1.5 0 1 0 3 0z`; } return d; })(),
    chip: 'M7 7h10v10H7zM9 2.5h2V6H9zm4 0h2V6h-2zM9 18h2v3.5H9zm4 0h2v3.5h-2zM2.5 9H6v2H2.5zm0 4H6v2H2.5zM18 9h3.5v2H18zm0 4h3.5v2H18z',
    syringe: 'M18.4 2.2l3.4 3.4-1.4 1.4-1-1-2.1 2.1 1 1-1.4 1.4-1-1-6.7 6.7-2.8.1-2.2 2.2-1.4-1.4 2.2-2.2.1-2.8 6.7-6.7-1-1 1.4-1.4 1 1 2.1-2.1-1-1z',
  };
  function renderHelps() {
    const box = $('#rsHelps');
    let L = null;
    try { L = sim && sim.helps ? sim.helps(simple()) : null; } catch (err) { console.error(err); }
    if (!L || !L.length) { box.hidden = true; return; }
    box.hidden = false;
    const h = L.map(([ic, t, x, src]) => `<li class="hp"><span class="hp-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${HICON[ic] || HICON.star}"/></svg></span><span class="hp-t">${t}</span><span class="hp-x">${x}${src && SRC[src] ? ` <span class="hp-src">(<a href="${SRC[src][1]}" target="_blank" rel="noopener">${SRC[src][2] || 'source'}</a>)</span>` : ''}</span></li>`).join('');
    const ul = $('#rsHelpsL'); if (ul._h !== h) { ul._h = h; ul.innerHTML = h; }
  }
  // "Why is this here?": the same physics as the station, with the student's own numbers next to the real machine's
  function renderLink() {
    const box = $('#rsLink');
    if (!sim || !sim.link) { box.hidden = true; linkDraw = null; return; }
    let L;
    try { L = sim.link(simple()); } catch (err) { console.error(err); box.hidden = true; linkDraw = null; return; }
    box.hidden = false;
    $('#rsLinkT').textContent = L.title;
    $('#rsLinkX').innerHTML = L.text;
    $('#rsLinkTab').innerHTML = `<table class="rs-link-table"><thead><tr><th scope="col"><span class="sr-only">Quantity</span></th><th scope="col">${L.cols[0]}</th><th scope="col">${L.cols[1]}</th></tr></thead><tbody>${L.rows.map(r => `<tr><th scope="row">${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`;
    linkCv.setAttribute('aria-label', L.alt);
    linkDraw = L.draw;
  }
  function drawLink(dt) {
    if (!linkDraw || !linkSeen) return;
    if (!linkCtx || !LW) sizeLink();
    if (!LW) return;
    linkT += reduceMotion ? 0 : dt;
    try { linkDraw(linkCtx, LW, LH, reduceMotion ? 2.6 : linkT); } catch (err) { console.error(err); linkDraw = null; }
  }
  function sizeLink() {
    const w = linkCv.clientWidth;
    if (w < 20) return;
    const h = w < 520 ? 260 : 176;
    linkCv.style.height = h + 'px';
    ({ ctx: linkCtx } = fitCanvas(linkCv, w, h)); LW = w; LH = h;
  }
  function renderSpeeds() {
    const box = $('#rsSpeeds');
    box.innerHTML = sim.speeds.map(([k, t]) => `<label><input type="radio" name="rsspeed" value="${k}"${k === sim._speed ? ' checked' : ''}><span>${t}</span></label>`).join('');
    speedKey = sim._speed;
  }
  function changed() {
    const w = sim.wantSpeed && sim.wantSpeed();
    if (w) { sim._speed = w; renderSpeeds(); }
    sim.reset(); setRun('idle'); graphDirty = dataDirty = true; updateUI(true); renderLink(); renderWhy(); renderHelps();
  }
  function setRun(s) {
    runState = s;
    const b = $('#rsGo');
    if (b) { b.textContent = s === 'run' ? 'Pause' : s === 'pause' ? 'Resume' : s === 'done' ? 'Run again' : sim.go; b.classList.toggle('btn-go-hot', s === 'idle' || s === 'done'); b.setAttribute('aria-pressed', String(s === 'run')); }
  }
  function go() {
    audio.unlock();
    if (runState === 'run') setRun('pause');
    else if (runState === 'pause') setRun('run');
    else { if (runState === 'done') sim.reset(); setRun('run'); graphDirty = dataDirty = true; }
    updateUI(true);
  }

  function resize() {
    if (!host || !cv) return;
    const wrap = $('#rsWrap');
    if (v3 && v3.full) { const b = v3.fullBox(); cv.style.height = b.H + 'px'; ({ ctx } = fitCanvas(cv, b.W, b.H)); W = b.W; H = b.H; graphDirty = true; return; }
    cv.style.height = '';
    const w = wrap.clientWidth;
    if (w < 20) return;
    let h = Math.round(w < 560 ? clamp(w * 1.02, 300, 460) : clamp(w * 0.44, 320, 470));
    const main = wrap.parentElement, bar = $('#rsim .arena-bar');
    if (main && bar && getComputedStyle(main).overflowY === 'auto' && main.clientHeight > 0) h = Math.round(clamp(main.clientHeight - bar.offsetHeight - 14, 300, h));
    wrap.style.setProperty('--arena-h', h + 'px');
    ({ ctx } = fitCanvas(cv, w, h)); W = w; H = h;
    sizeLink();
    graphDirty = true;
  }
  const setText = (el, s) => { if (el && el.textContent !== s) el.textContent = s; };
  function updateUI(force) {
    if (!sim) return;
    const [st, cls] = sim.status(), hs = $('#rsStatus');
    setText(hs, st); hs.className = 'hud hud-status ' + (cls || '');
    const n = sim.narrate(), nx = $('#rsNarrate'); if (nx._h !== n) { nx._h = n; nx.innerHTML = n; }
    setText($('#rsClock'), sim.clock() + (speedKey !== '1' && (!sim.speedApplies || sim.speedApplies()) ? ` · ${(sim.speeds.find(s => s[0] === speedKey) || ['', ''])[1].toLowerCase()}` : ''));
    const beg = document.body.classList.contains('is-beginner'), T = sim.tiles().filter(t => !(beg && t[3] === 'expert')), box = $('#rsTiles');
    if (box.children.length !== T.length) box.innerHTML = T.map((t, i) => `<div class="tile tile-${'vkrn'[i]}"><div class="tile-label"></div><div class="tile-val"></div><div class="tile-sub"></div></div>`).join('');
    T.forEach((t, i) => { const el = box.children[i]; setText(el.children[0], t[0]); setText(el.children[1], t[1]); setText(el.children[2], t[2] || ' '); });
    if (force) { graphDirty = true; dataDirty = true; }
  }
  function drawGraphs() { try { sim.graphA($('#rsGA')); sim.graphB($('#rsGB')); } catch (err) { console.error(err); } }
  function renderData() {
    const body = $('#rsDataBody');
    let h;
    if (dataTab === 'numbers') h = simple() && sim.keyNumbers ? `<p class="hint">The most important numbers, in plain words. Switch to <b>Intermediate</b> for every step of the working.</p>${sim.keyNumbers()}` : sim.numbers();
    else if (dataTab === 'check') h = sim.check();
    else h = `<ul class="rs-src">${[...new Set(sim.sources.concat(sim.whySources || []))].filter(k => SRC[k]).map(k => `<li><a href="${SRC[k][1]}" target="_blank" rel="noopener">${esc(SRC[k][0])}</a></li>`).join('')}</ul><p class="hint">Numbers that are not published (for example the strength of the maglev’s motor or the jets’ maximum lift coefficient) are marked as estimates or assumptions where they are used.</p>`;
    body.innerHTML = h;
    setText($('#rsNumTab'), simple() ? 'Key numbers' : 'The numbers');
    $('#rsData').classList.toggle('no-working', !working);
    for (const b of $$('#rsData .tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === dataTab));
  }
  function frame(now, dt) {
    if (!host || !sim) return;
    if (!W || !ctx) resize();
    if (!W) return;
    const k = +speedKey || 1;
    if (runState === 'run') {
      let fin = false;
      try { fin = sim.step(dt * k, dt); } catch (err) { console.error(err); fin = true; }
      if (fin) { setRun('done'); graphDirty = dataDirty = true; updateUI(true); }
    }
    try { if (v3 && v3.on && sim.draw3d) sim.draw3d(v3.scene, ctx, W, H, dt, runState === 'run'); else sim.draw(ctx, W, H, dt, runState === 'run'); } catch (err) { console.error(err); }
    drawLink(dt);
    if (now - lastUI > 110) { lastUI = now; updateUI(); }
    if (graphDirty || (runState === 'run' && now - lastGraph > 220)) { lastGraph = now; graphDirty = false; drawGraphs(); }
    if (dataDirty || (runState === 'run' && now - lastData > 2000)) { lastData = now; dataDirty = false; renderData(); }
  }

  function init() {
    root = document.createElement('div');
    root.className = 'rsim'; root.id = 'rsim'; root.hidden = true;
    root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Real life, simulated');
    root.innerHTML = shellHTML();
    document.body.appendChild(root);
    cv = $('#rsCanvas'); linkCv = $('#rsLinkCv');
    // the 3D key (with full screen); the real machines open in 3D unless the student switched it off before
    v3 = CL.V3.attach($('#rsWrap'), { storeKey: 'cl-rsim-3d', full: { bar: () => $('#rsim .arena-bar'), onChange: () => resize() }, onToggle: () => { graphDirty = true; } });
    if (store.get('cl-rsim-3d', null) === null) v3.set(true, true);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { for (const e of es) linkSeen = e.isIntersecting; }).observe(linkCv);
    // the doors: a panel in each station's settings
    const near = (sel, up) => { const el = $(sel); return el ? el.closest(up) : null; };
    const spots = { lab: $('#accPartBox'), gauss: near('#ggTarget', '.panel') };
    for (const [h, after] of Object.entries(spots)) {
      if (!after) continue;
      after.insertAdjacentHTML('afterend', entryHTML(h));
      const panel = after.nextElementSibling;
      panel.addEventListener('click', ev => { const b = ev.target.closest('[data-open-sim]'); if (b) open(b.dataset.openSim, h); });
    }
    $('#rsBack').addEventListener('click', close);
    whyOpen = store.get('cl-rsim-why', true) !== false;
    $('#rsWhyCmp').addEventListener('click', ev => {
      const b = ev.target.closest('[data-why]'); if (!b || !sim || !sim.setWithout) return;
      const off = b.dataset.why === 'off';
      if (b.getAttribute('aria-checked') === 'true') return;
      sim.setWithout(off);
      changed();
      const nb = $(`#rsWhyCmp [data-why="${off ? 'off' : 'on'}"]`); if (nb) nb.focus({ preventScroll: true });
    });
    $('#rsWhyCmp').addEventListener('keydown', ev => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      const b = ev.target.closest('[data-why]'); if (!b) return;
      ev.preventDefault();
      const other = $(`#rsWhyCmp [data-why="${b.dataset.why === 'off' ? 'on' : 'off'}"]`); if (other) other.click();
    });
    $('#rsWhyFold').addEventListener('click', () => { whyOpen = !whyOpen; store.set('cl-rsim-why', whyOpen); renderWhy(); requestAnimationFrame(resize); });
    root.querySelector('.rsim-picks').addEventListener('click', ev => { const b = ev.target.closest('[data-sim]'); if (b && b.dataset.sim !== cur) select(b.dataset.sim); });
    root.querySelector('.rsim-picks').addEventListener('keydown', ev => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      const i = ORDER.indexOf(cur), j = (i + (ev.key === 'ArrowRight' ? 1 : ORDER.length - 1)) % ORDER.length;
      ev.preventDefault(); select(ORDER[j]); $('#rsTab-' + ORDER[j]).focus();
    });
    $('#rsGo').addEventListener('click', go);
    $('#rsReset').addEventListener('click', () => { sim.reset(); setRun('idle'); graphDirty = dataDirty = true; updateUI(true); });
    $('#rsSpeeds').addEventListener('change', ev => { if (ev.target.name === 'rsspeed') { speedKey = sim._speed = ev.target.value; updateUI(); } });
    $('#rsData .tabs').addEventListener('click', ev => { const b = ev.target.closest('[data-tab]'); if (!b) return; dataTab = b.dataset.tab; renderData(); });
    $('#rsWorking').addEventListener('change', ev => { working = ev.target.checked; $('#rsData').classList.toggle('no-working', !working); });
    document.addEventListener('keydown', ev => {
      if (!host || CL.active !== host) return;
      const t = ev.target, tag = t.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SUMMARY' || t.isContentEditable) return;
      if (ev.key === ' ') { ev.preventDefault(); go(); }
    });
    bus.on('screen', name => {
      if (host && name === host && CL.screens[host] && CL.screens[host].hide) CL.screens[host].hide();   // the station stays paused behind its simulation
      if (host && name === host) requestAnimationFrame(resize);
    });
    bus.on('skin', () => { graphDirty = true; });
    bus.on('level', name => {
      const w = $('#rsWorking'); if (w && w.checked !== (name === 'full')) { w.checked = name === 'full'; working = w.checked; }
      if (!sim) return;
      dataDirty = graphDirty = true; renderLink(); renderWhy(); renderHelps(); updateUI(true);
      if (host) requestAnimationFrame(resize);
    });
    window.addEventListener('resize', () => { if (host) requestAnimationFrame(resize); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (host) resize(); }).observe($('#rsWrap'));
  }

  CL.realsim = { init, open, close, frame, resize, SIM, HOSTS, get host() { return host; }, get current() { return cur; }, get sim() { return sim; }, get state() { return runState; }, get v3() { return v3; }, reselect: () => { if (cur) select(cur); } };
})();
