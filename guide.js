/* =====================================================================
   Project Lorentz — beginner mode.
   "Simple" (the default for first-time visitors) hides expert controls,
   shows plain-language "What is happening" notes on every screen and
   puts little "?" buttons next to the controls. "Full detail" shows all
   the theory and every control.
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, store, bus } = CL;

  /* ---------- tooltips: [label selector, title, plain-language text] ---------- */
  const TIPS = [
    ['label[for="r-coils"]', 'Number of coils', 'Copper coils wound around the iron poles of the magnet. They are connected one after another, so the same current flows through every coil.'],
    ['label[for="r-turns"]', 'Turns per coil', 'How many times the wire goes round in each coil. More turns means more "loops" of current, so a stronger magnetic field.'],
    ['label[for="r-current"]', 'Coil current', 'How much electric charge flows through the wire each second, in amperes (A). Double the current and the field doubles: B = μ₀NI/g.'],
    ['label[for="r-targetB"]', 'Magnetic field B', 'How strong the magnet is, in tesla (T). A fridge magnet is about 0.005 T; this magnet is around 1 T. The field is what bends the particle into a circle.'],
    ['label[for="r-gapCm"]', 'Pole gap', 'The space between the two magnet poles, where the dees sit. A smaller gap gives a stronger field for the same current.'],
    ['label[for="r-R"]', 'Dee radius', 'The size of the machine. A bigger machine lets the particle go round in bigger circles, so it can get faster before it reaches the edge. You can also drag the edge of the dees on the machine itself.'],
    ['label[for="r-Vkv"]', 'Dee voltage', 'The push the particle gets every time it crosses the gap. A bigger voltage means fewer laps to reach full speed, but not a higher final speed.'],
    ['label[for="r-chaosMult"]', 'Field strength', 'Makes the magnetic field stronger or weaker while the particle is flying. Watch the circles shrink or grow.'],
    ['label[for="r-gg-stages"]', 'Number of coils', 'Each coil is one "stage" that pulls the slug forwards. More coils, more pushes, more speed.'],
    ['label[for="r-gg-turns"]', 'Turns per coil', 'More turns make a stronger electromagnet, but the coil gets fatter and its resistance goes up, so it heats more.'],
    ['label[for="r-gg-current"]', 'Current', 'The current through each coil while it is switched on. More current, stronger pull, until the iron slug is saturated (fully magnetised).'],
    ['label[for="r-gg-cutoff"]', 'Switch-off point', 'When each coil turns off. 0 % means exactly when the slug reaches the coil\'s middle. Later than that, the coil pulls the slug back: suck-back.'],
    ['label[for="r-gg-slugCm"]', 'Slug length', 'A longer slug is heavier but magnetises more easily along its length. Try a few lengths and compare the speeds.'],
    ['label[for="r-gg-behind"]', 'Balls behind each magnet', 'With one ball, it touches the magnet and is held too tightly to fly off. With two or more, the last ball is far enough away to escape.'],
    ['label[for="r-raceB"]', 'Magnetic field B', 'Bends each racer into a half circle. The time for half a circle depends only on charge, mass and field, not on speed.'],
    ['label[for="r-collKa"]', 'Kinetic energy', 'The energy of motion of each beam particle. More energy means a harder smash and more energy available to create new particles.'],
    ['label[for="r-tgtK"]', 'Beam energy', 'Faster particles go deeper into the material before they stop. Most of their energy is dropped right at the end: the Bragg peak.'],
  ];
  let box = null, openBtn = null;
  function attachTips() {
    TIPS.forEach(([sel, title, text], i) => {
      const el = $(sel); if (!el || el.querySelector('.tip')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tip'; b.textContent = '?'; b.dataset.tipI = String(i);
      b.setAttribute('aria-label', 'What is ' + title.toLowerCase() + '?');
      el.appendChild(b);
    });
    box = document.createElement('div'); box.className = 'tipbox'; box.hidden = true; box.setAttribute('role', 'tooltip'); box.id = 'tipbox';
    document.body.appendChild(box);
    const show = b => {
      const [, title, text] = TIPS[+b.dataset.tipI];
      box.innerHTML = `<b>${title}</b>${text}`; box.hidden = false; openBtn = b; b.classList.add('is-open'); b.setAttribute('aria-describedby', 'tipbox');
      const r = b.getBoundingClientRect(), bw = Math.min(290, innerWidth - 20), bh = box.offsetHeight;
      let left = r.left + r.width / 2 - bw / 2, top = r.bottom + 8;
      if (top + bh > innerHeight - 8) top = r.top - bh - 8;
      box.style.left = Math.max(10, Math.min(left, innerWidth - bw - 10)) + 'px'; box.style.top = Math.max(8, top) + 'px'; box.style.width = bw + 'px';
    };
    const hide = () => { if (!openBtn) return; box.hidden = true; openBtn.classList.remove('is-open'); openBtn.removeAttribute('aria-describedby'); openBtn = null; };
    document.addEventListener('mouseover', ev => { const b = ev.target.closest && ev.target.closest('.tip'); if (b) show(b); });
    document.addEventListener('mouseout', ev => { const b = ev.target.closest && ev.target.closest('.tip'); if (b && b === openBtn) hide(); });
    document.addEventListener('focusin', ev => { if (ev.target.classList && ev.target.classList.contains('tip')) show(ev.target); });
    document.addEventListener('focusout', ev => { if (ev.target === openBtn) hide(); });
    document.addEventListener('click', ev => {
      const b = ev.target.closest && ev.target.closest('.tip');
      if (b) { ev.preventDefault(); ev.stopPropagation(); if (openBtn === b) hide(); else show(b); return; }
      hide();
    }, true);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, true);
  }

  /* ---------- level switch ---------- */
  const level = { name: 'simple' };
  function apply(name, silent) {
    level.name = name === 'full' ? 'full' : 'simple';
    store.set('cl-level', level.name);
    document.body.classList.toggle('is-beginner', level.name === 'simple');
    for (const b of $$('.lvl button')) b.setAttribute('aria-pressed', String(b.dataset.level === level.name));
    for (const b of $$('#homeLevel button')) b.setAttribute('aria-checked', String(b.dataset.value === level.name));
    if (!silent) {
      // "Show working" follows the level: off in Simple, on in Full detail
      for (const id of ['#workingToggle', '#ggWorking']) { const el = $(id); if (el && el.checked !== (level.name === 'full')) { el.checked = level.name === 'full'; el.dispatchEvent(new Event('change')); } }
    }
    bus.emit('level', level.name);
  }
  CL.level = level;
  CL.setLevel = apply;

  function init() {
    attachTips();
    for (const b of $$('.lvl button')) b.addEventListener('click', () => apply(b.dataset.level));
    const hl = $('#homeLevel'); if (hl) hl.addEventListener('click', ev => { const b = ev.target.closest('button[data-value]'); if (b) apply(b.dataset.value); });
    apply(store.get('cl-level', 'simple'));
  }
  CL.guide = { init };
})();
