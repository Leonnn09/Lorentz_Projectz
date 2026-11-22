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
    // first visit: ask once who is using it; the intro plays first
    if (!store.get('cl-level-chosen', false) && !/[?&]nointro\b/.test(location.search)) {
      let shown = false;
      const later = () => { if (!shown) { shown = true; setTimeout(chooser, 350); } };
      bus.on('intro', on => { if (!on) later(); });
      setTimeout(() => { if (!(CL.intro && CL.intro.on)) later(); }, 1500);
    }
  }
  // "How much physics do you know?": two big choices, remembered, changeable at any time from the top bar
  function chooser() {
    if ($('#chooser')) return;
    const el = document.createElement('div');
    el.className = 'chooser'; el.id = 'chooser';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'chooserT');
    el.innerHTML = `<div class="chooser-card">
        <p class="chooser-kicker">Before you start</p>
        <h2 id="chooserT">How much physics do you know?</h2>
        <p class="chooser-sub">Pick one. You can switch at any time with the keys at the top right.</p>
        <div class="chooser-opts">
          <button type="button" class="chooser-opt" data-pick="simple">
            <svg viewBox="0 0 120 80" aria-hidden="true"><circle cx="60" cy="40" r="26" class="co-orbit"/><circle cx="86" cy="40" r="5" class="co-dot"/><path d="M86 40 l0 -14" class="co-arrow"/><path d="M83 29 l3 -4 3 4" class="co-arrow"/><text x="60" y="44" class="co-txt">B</text></svg>
            <b>I’m a complete beginner</b>
            <span>The big ideas in plain words first. Fewer controls, a note on every screen saying what is happening and why, ? buttons, and a one-minute tour.</span>
            <i>Start as a beginner</i>
          </button>
          <button type="button" class="chooser-opt" data-pick="full">
            <svg viewBox="0 0 120 92" aria-hidden="true"><path d="M60 38 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0 a20 20 0 1 1 40 0 a24 24 0 1 1 -48 0" class="co-orbit"/><text x="60" y="88" class="co-txt co-f">r = mv/qB</text></svg>
            <b>I know some physics</b>
            <span>Every control, the formulas with your own numbers put in, two graphs, and checks against real published data.</span>
            <i>Go intermediate</i>
          </button>
        </div>
      </div>`;
    document.body.appendChild(el);
    const done = pick => {
      store.set('cl-level-chosen', true); apply(pick);
      el.classList.add('is-leaving'); setTimeout(() => el.remove(), 260);
      if (pick === 'simple' && !store.get('cl-toured', false)) { const t = $('#btnTour'); if (t) setTimeout(() => t.click(), 420); }
    };
    el.addEventListener('click', ev => { const b = ev.target.closest('[data-pick]'); if (b) done(b.dataset.pick); });
    el.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); done(level.name); }
      if (ev.key === 'Tab') { const bs = $$('.chooser-opt', el), i = bs.indexOf(document.activeElement); ev.preventDefault(); bs[(i + (ev.shiftKey ? bs.length - 1 : 1)) % bs.length].focus(); }
    });
    requestAnimationFrame(() => { el.classList.add('is-on'); $('.chooser-opt', el).focus(); });
  }
  CL.guide = { init, chooser };
})();
