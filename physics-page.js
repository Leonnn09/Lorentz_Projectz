/* =====================================================================
   Project Lorentz — Physics & Quiz screen (CL.screens.physics)
   ===================================================================== */
(() => {
  'use strict';
  const { C, $, $$, clamp, e, pl, en, si, pct, fitCanvas, skin, missions, store, audio, reduceMotion } = CL;
  let active = false;

  const QUIZ = [
    { q: 'Inside a dee, what does the magnetic field do to the particle?', opts: ['Speeds it up', 'Bends its path into a circle without changing its speed', 'Pushes it across the gap', 'Slows it down a little every turn'], a: 1,
      why: 'The magnetic force F = qv × B is always at 90° to the velocity, so it does no work: it changes the direction, never the speed. All the energy comes from the electric field in the gap.' },
    { q: 'A proton’s orbit radius doubles (no relativity). What happened to its speed?', opts: ['It halved', 'It stayed the same', 'It doubled', 'It became four times bigger'], a: 2,
      why: 'r = mv/(|q|B), so for the same particle and field the radius is proportional to the speed.' },
    { q: 'Why can an RF voltage with a fixed frequency stay in step with the particle?', opts: ['Because the particle slows down in each dee', 'Because the time for one revolution, 2πm/(|q|B), does not depend on the speed', 'Because the dees are shaped like a D', 'Because the voltage is very high'], a: 1,
      why: 'A faster particle travels a bigger circle in exactly the same time. This is the resonance condition: f = |q|B/(2πm).' },
    { q: 'You double the dee voltage V. What happens to the maximum kinetic energy?', opts: ['It doubles', 'It halves', 'It stays the same; the particle just needs half as many turns', 'It becomes four times bigger'], a: 2,
      why: 'K_max = q²B²R²/(2m) contains no V. The voltage only decides how many pushes (turns) it takes: N = K_max/(2|q|V).' },
    { q: 'You double the number of turns on each coil and keep the current the same. The field B…', opts: ['doubles', 'halves', 'stays the same', 'becomes four times bigger'], a: 0,
      why: 'B = μ₀NI/g: the field is proportional to the ampere-turns NI.' },
    { q: 'The LHC’s ring cannot grow: it is a 27 km tunnel. As its protons gain energy from 450 GeV to 6.8 TeV, what must happen to the field in its bending magnets?', opts: ['It stays the same, like in a cyclotron', 'It gets weaker', 'It grows in step with the momentum, from about 0.54 T to 8.1 T', 'It flips direction every lap'], a: 2,
      why: 'r = p/(|q|B). With r fixed, B must grow in proportion to the momentum p. A cyclotron does the opposite: B stays fixed and the radius grows. The LHC simulation shows both side by side.' },
    { q: 'Why did classic fixed-frequency cyclotrons stop at roughly 20–25 MeV for protons?', opts: ['Iron magnets cannot be made bigger', 'Relativity: the revolution frequency |q|B/(2πγm) drops as γ grows, so the particle falls out of step', 'The dees overheat', 'Protons break apart above 25 MeV'], a: 1,
      why: 'Near light speed each turn takes longer. Synchrocyclotrons lower the RF frequency to follow the particle; isochronous cyclotrons make B grow with radius instead.' },
    { q: 'An electron circles one of Earth’s field lines where B is about 100 nT. Compared with the same electron in a 1 T cyclotron magnet, it circles…', opts: ['about 10 million times more slowly', 'at the same rate', 'about 10 million times faster', 'not at all: Earth’s field is too weak'], a: 0,
      why: 'f = |q|B/(2πm) is proportional to B, and 100 nT is 10⁷ times weaker than 1 T. So the electron circles about 2.8 thousand times a second instead of 28 billion: the cyclotron frequency, in the aurora.' },
    { q: 'Two 150 MeV protons collide head-on. How much energy is available to create new particles?', opts: ['150 MeV', '300 MeV', '1877 MeV', 'None'], a: 1,
      why: 'E_cm = 2 × (150 + 938.3) MeV = 2176.5 MeV, and Q = E_cm − 2 × 938.3 MeV = 300 MeV. Hitting a proton at rest would need a 648 MeV beam for the same Q.' },
    { q: 'What happened at the LHC on 19 September 2008?', opts: ['A nuclear chain reaction started', 'A faulty electrical connection caused an arc and about six tonnes of liquid helium escaped, damaging magnets', 'The proton beam exploded like a bomb', 'A tiny black hole was created'], a: 1,
      why: 'Accelerators cannot explode like bombs. The danger is stored energy in magnets and beams. CERN repaired the damage and the LHC restarted in November 2009.' },
    { q: 'In a coil gun, a coil stays switched on after the iron slug has passed its middle. What happens?', opts: ['Nothing: the slug is already past it', 'The coil pulls the slug backwards and slows it down (suck-back)', 'The coil pushes the slug forwards even harder', 'The slug loses its magnetism'], a: 1,
      why: 'The pull on the magnetised slug always points towards the coil\'s middle, where the field is strongest. Past the middle that means backwards, so each coil must be switched off as the slug reaches its middle.' },
    { q: 'Why does a magnet-and-ball Gauss rifle need at least two balls behind each magnet?', opts: ['Two balls are heavier, so they hit harder', 'With only one, it touches the magnet and is held as tightly as the incoming ball was pulled in, so the bump cannot free it', 'The magnet only works with an even number of balls', 'One ball would fly off too fast'], a: 1,
      why: 'The magnet\'s pull falls off very quickly with distance. A ball a few radii away is only weakly held, so the bump easily knocks it free; a ball touching the magnet sits at the bottom of the deep energy well.' },
  ];
  let answers = store.get('cl-quiz', {}) || {};

  function renderQuiz() {
    const box = $('#quizBox');
    const score = QUIZ.filter((q, i) => answers[i] === q.a).length, done = Object.keys(answers).length;
    box.innerHTML = `<div class="quiz-score">Score: ${score} / ${QUIZ.length}${done < QUIZ.length ? ` · ${QUIZ.length - done} to go` : ' · finished'}</div>` +
      QUIZ.map((q, i) => {
        const ans = answers[i];
        return `<div class="q" data-i="${i}"><div class="q-text">${i + 1}. ${q.q}</div><div class="q-opts">${q.opts.map((o, j) => {
          const cls = ans === undefined ? '' : j === q.a ? ' is-right' : j === ans ? ' is-wrong' : '';
          return `<button type="button" data-j="${j}" class="${cls}"${ans !== undefined ? ' disabled' : ''}>${o}</button>`;
        }).join('')}</div>${ans !== undefined ? `<div class="q-why"><b>${ans === q.a ? 'Correct.' : 'Not quite.'}</b> ${q.why}</div>` : ''}</div>`;
      }).join('') + '<button type="button" class="pbtn pbtn-ghost" id="quizReset">Reset the quiz</button>';
  }
  function bindQuiz() {
    $('#quizBox').addEventListener('click', ev => {
      if (ev.target.id === 'quizReset') { answers = {}; store.set('cl-quiz', answers); renderQuiz(); return; }
      const b = ev.target.closest('button[data-j]'); if (!b) return;
      const i = +b.closest('.q').dataset.i, j = +b.dataset.j;
      if (answers[i] !== undefined) return;
      answers[i] = j; store.set('cl-quiz', answers);
      audio.unlock(); if (j === QUIZ[i].a) audio.ding(); else audio.beep(220, 0.18);
      renderQuiz();
    });
  }

  /* worked example with the lab's current settings */
  function renderWorked() {
    const w = $('#worked'), L = CL.lab; if (!w || !L || !L.D) return;
    const D = L.D, S = L.S, p = L.pred;
    if (D.Bmag < 1e-9) { w.innerHTML = '<p>Give the coils some current in the lab to see a worked example.</p>'; return; }
    const q = D.absq, B = D.Bmag, R = S.R, V = S.Vkv * 1e3;
    const qS = e(q, 4) + ' C', mS = e(D.m, 4) + ' kg', BS = pl(B, 4) + ' T';
    const items = [
      ['Particle', `${D.part.name} (${D.part.symbol}): m = ${mS}, |q| = ${qS}`],
      ['Magnetic field', `B = μ₀NI/g = (1.2566 × 10⁻⁶)(${S.coils} × ${S.turns})(${pl(D.I, 4)} A) / (${pl(D.gap, 3)} m) = <b>${BS}</b>`],
      ['Cyclotron frequency', `f = |q|B/(2πm) = (${qS})(${BS}) / (2π × ${mS}) = <b>${si(p.fc, 'Hz', 4)}</b>`],
      ['Maximum speed', S.rel
        ? `v = |q|BR/m = (${qS})(${BS})(${pl(R, 3)} m) / ${mS} = ${e(p.vcl, 4)} m/s (classical); with relativity <b>${e(p.vrel, 4)} m/s</b> (${pct(p.vrel / C.c)} of c)`
        : `v = |q|BR/m = (${qS})(${BS})(${pl(R, 3)} m) / ${mS} = <b>${e(p.vcl, 4)} m/s</b> (${pct(p.vcl / C.c)} of c)`],
      ['Maximum energy', S.rel
        ? `K = q²B²R²/(2m) = ${e(p.Kcl, 4)} J = ${en(p.Kcl, 4)} (classical); with relativity <b>${en(p.Krel, 4)}</b>`
        : `K = q²B²R²/(2m) = <b>${e(p.Kcl, 4)} J = ${en(p.Kcl, 4)}</b>`],
      ['Revolutions', `N = K/(2|q|V) = ${en(p.Kmax, 4)} / (2 × ${en(q * V, 4)}) = <b>${pl(p.nRev, 4)}</b>`],
      ['Time', `t = πBR²/(2V) = π(${BS})(${pl(R, 3)} m)² / (2 × ${e(V, 3)} V) = <b>${si(p.tAccClassical, 's', 4)}</b>`],
      ['Relativity check', `γ = 1 + K/(mc²) = 1 + ${en(p.Krel, 4)} / ${en(D.mc2, 5)} = <b>${pl(p.grel, 6)}</b>`],
    ];
    w.innerHTML = items.map(([a, b]) => `<div class="wk"><div class="wk-q">${a}</div><div class="wk-a">${b}</div></div>`).join('');
  }

  function drawRelChart(cv) {
    if (!cv) return;
    const rect = cv.getBoundingClientRect(); if (rect.width < 20) return;
    const { ctx } = fitCanvas(cv, rect.width, rect.height), W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);
    const pad = { l: 40, r: 12, t: 12, b: 34 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const lx0 = 3, lx1 = 9;
    const XP = K => pad.l + (Math.log10(K) - lx0) / (lx1 - lx0) * pw, YP = f => pad.t + (1 - f) * ph;
    ctx.strokeStyle = skin.c('--plot-grid'); ctx.fillStyle = skin.c('--plot-text'); ctx.font = '12.5px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.lineWidth = 1;
    const labs = ['1 keV', '10 keV', '100 keV', '1 MeV', '10 MeV', '100 MeV', '1 GeV'];
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 0; i <= 6; i++) { const x = XP(10 ** (lx0 + i)); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.fillText(labs[i], x, pad.t + ph + 4); }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const f of [0, 0.25, 0.5, 0.75, 1]) { const y = YP(f); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.fillText(String(f), pad.l - 5, y); }
    const curve = (mcEv, color, label, lx) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const K = 10 ** (lx0 + (lx1 - lx0) * i / 120), f = mcEv / (mcEv + K); i ? ctx.lineTo(XP(K), YP(f)) : ctx.moveTo(XP(K), YP(f)); }
      ctx.stroke();
      const K = 10 ** lx, f = mcEv / (mcEv + K);
      ctx.fillStyle = color; ctx.font = '700 12px "Barlow", "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(label, XP(K) + 4, YP(f) - 4);
    };
    curve(938.272e6, '#ff6b6b', 'proton', 8.3);
    curve(0.511e6, '#4dabf7', 'electron', 5.7);
    ctx.fillStyle = skin.c('--plot-strong'); ctx.font = '600 11.5px "Barlow", "Segoe UI", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('kinetic energy (log scale)', W - pad.r, H - 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('f / f₀', pad.l + 4, pad.t + 2);
  }

  function drawFigures() {
    const ink = 'var(--ink)';
    const svg = $('#figTop');
    if (svg && !svg.childElementCount) {
      const cx = 160, cy = 150, R = 112, w = 12;
      const h = Math.sqrt(R * R - (w / 2) ** 2);
      let dir = 1;
      const radii = []; for (let k = 0; k < 12; k++) radii.push(27 * Math.sqrt(k + 1));
      let yy = 0; const centers = [];
      for (let k = 0; k < radii.length; k++) { const r = radii[k], c = yy - dir * r; centers.push(c); yy = c - dir * r; dir = -dir; }
      const shift = (centers[centers.length - 1] + centers[centers.length - 2]) / 2;
      let y = cy - shift; dir = 1; let path = `M ${cx} ${y.toFixed(1)}`;
      for (let k = 0; k < radii.length - 1; k++) { const r = radii[k]; const y2 = y - dir * 2 * r; path += ` A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 0 ${cx} ${y2.toFixed(1)}`; y = y2; dir = -dir; }
      const rl = radii[radii.length - 1], ycl = y - dir * rl, ang = 2.1;
      const ex = cx + dir * rl * Math.sin(ang), ey = ycl + dir * rl * Math.cos(ang);
      path += ` A ${rl.toFixed(1)} ${rl.toFixed(1)} 0 0 0 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
      const tx = dir * Math.cos(ang), ty = -dir * Math.sin(ang);
      const lbx = clamp(ex + tx * 72, 40, 290), lby = clamp(ey + ty * 72 + 14, 30, 270);
      const syms = [];
      for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
        const px = cx + (i + 0.5) * 24, py = cy + (j + 0.5) * 24;
        if (Math.hypot(px - cx, py - cy) > 116 || Math.abs(px - cx) < 12) continue;
        syms.push(`<g transform="translate(${px} ${py})"><circle r="4" fill="none"/><path d="M-2.5-2.5L2.5 2.5M2.5-2.5L-2.5 2.5"/></g>`);
      }
      svg.innerHTML = `
        <defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ffd43b"/></marker></defs>
        <circle cx="${cx}" cy="${cy}" r="${R + 10}" fill="#0b100d" stroke="#3b4540" stroke-width="5"/>
        <g stroke="rgba(186,176,255,0.55)" stroke-width="1">${syms.join('')}</g>
        <path d="M ${cx + w / 2} ${cy - h} A ${R} ${R} 0 0 1 ${cx + w / 2} ${cy + h} Z" fill="rgba(229,72,63,0.2)" stroke="#e2a066" stroke-width="1.5"/>
        <path d="M ${cx - w / 2} ${cy + h} A ${R} ${R} 0 0 1 ${cx - w / 2} ${cy - h} Z" fill="rgba(62,126,230,0.2)" stroke="#e2a066" stroke-width="1.5"/>
        <path d="${path}" fill="none" stroke="#ffb84d" stroke-width="1.6"/>
        <path d="M ${ex.toFixed(1)} ${ey.toFixed(1)} l ${(tx * 70).toFixed(1)} ${(ty * 70).toFixed(1)}" stroke="#ffd43b" stroke-width="2.2" marker-end="url(#ah)"/>
        <circle cx="${cx}" cy="${(cy - shift).toFixed(1)}" r="3.5" fill="#c6ccd8" stroke="#1d2533"/>
        <g font-family="Barlow Condensed, Arial Narrow, sans-serif" font-size="13.5" font-weight="600" fill="#eef2ec" text-anchor="middle">
          <text x="${cx + 62}" y="${cy + 92}">Dee 1</text><text x="${cx - 62}" y="${cy + 92}">Dee 2</text>
          <text x="${cx}" y="${cy - h + 14}" fill="#ffd8a0" font-size="10">gap</text>
        </g>
        <g font-family="Barlow Condensed, Arial Narrow, sans-serif" font-size="13" font-weight="600" style="fill:${ink}">
          <text x="6" y="16">B ⊗ into page</text>
          <text x="${lbx.toFixed(1)}" y="${lby.toFixed(1)}" text-anchor="middle">beam out</text>
          <text x="6" y="292">RF source ~ connects to both dees</text>
        </g>`;
    }
    const sf = $('#figForce');
    if (sf && !sf.childElementCount) {
      const cx = 140, cy = 120, r = 78, px = cx + r, py = cy;
      const syms = [];
      for (let i = 0; i < 12; i++) for (let j = 0; j < 9; j++) syms.push(`<g transform="translate(${12 + i * 25} ${12 + j * 26})"><circle r="4"/><path d="M-2.4-2.4L2.4 2.4M2.4-2.4L-2.4 2.4"/></g>`);
      sf.innerHTML = `
        <defs>
          <marker id="av" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3fdc7c"/></marker>
          <marker id="af" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ff5ca8"/></marker>
        </defs>
        <g fill="none" stroke="rgba(179,166,255,0.35)" stroke-width="1">${syms.join('')}</g>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#4dabf7" stroke-width="2" stroke-dasharray="6 5"/>
        <line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="#8fa2c8" stroke-width="1.2" stroke-dasharray="3 3"/>
        <text x="${cx + r / 2}" y="${cy + 16}" font-family="Barlow, serif" font-style="italic" font-size="14" text-anchor="middle" style="fill:var(--ink-2)">r</text>
        <line x1="${px}" y1="${py}" x2="${px}" y2="${py - 62}" stroke="#3fdc7c" stroke-width="3" marker-end="url(#av)"/>
        <line x1="${px}" y1="${py}" x2="${px - 46}" y2="${py}" stroke="#ff5ca8" stroke-width="3" marker-end="url(#af)"/>
        <circle cx="${px}" cy="${py}" r="9" fill="#fff" stroke="#ff6b6b" stroke-width="2.2"/>
        <text x="${px}" y="${py + 4.5}" font-size="13" font-weight="700" text-anchor="middle" fill="#17202e">+</text>
        <g font-family="Barlow, serif" font-weight="700" font-size="15">
          <text x="${px + 8}" y="${py - 50}" fill="#3fdc7c" font-style="italic">v</text>
          <text x="${px - 40}" y="${py - 8}" fill="#ff5ca8" font-style="italic">F</text>
        </g>
        <g font-family="Barlow Condensed, Arial Narrow, sans-serif" font-size="13" font-weight="600" style="fill:${ink}">
          <text x="${cx}" y="${cy + 4}" text-anchor="middle">centre</text>
          <text x="292" y="232" text-anchor="end">B into page (⊗), positive charge, anticlockwise</text>
        </g>`;
    }
  }

  function render() {
    if (!active) return;
    drawFigures();
    if (CL.lab) CL.lab.drawSideView($('#figMagnet'));
    drawRelChart($('#figRel'));
    renderWorked();
  }
  function init() {
    for (const b of $$('[data-goto]')) b.addEventListener('click', () => { const t = document.getElementById(b.dataset.goto); if (t) t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); });
    bindQuiz(); renderQuiz();
    CL.bus.on('lab-changed', () => { if (active) render(); });
    CL.bus.on('skin', () => { if (active) render(); });
  }
  CL.screens.physics = { init, show() { active = true; requestAnimationFrame(render); }, hide() { active = false; }, frame() {}, resize: render };
})();
