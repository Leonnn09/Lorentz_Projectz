/* =====================================================================
   Project Lorentz — physics engine
   Pure functions only (no page/DOM code), so the physics can be tested
   on its own. SI units everywhere: m, s, kg, C, T, V, J.
   ===================================================================== */
const PHYS = (() => {
  'use strict';

  /* ---------- Physical constants (CODATA 2018) ---------- */
  const C = {
    c: 299792458,            // speed of light in vacuum (m/s), exact
    e: 1.602176634e-19,      // elementary charge (C), exact
    mu0: 1.25663706212e-6,   // magnetic constant μ0 (T·m/A) ≈ 4π × 10⁻⁷
    u: 1.66053906660e-27,    // atomic mass unit (kg)
    me: 9.1093837015e-31,    // electron mass (kg)
    MeV: 1.602176634e-13,    // 1 MeV in joules
    g: 9.80665,              // standard gravity (m/s²)
    rhoCu: 1.68e-8,          // resistivity of copper at 20 °C (Ω·m)
    densCu: 8960,            // density of copper (kg/m³)
    equator: 40075e3,        // Earth's equator (m)
    moon: 384400e3,          // mean Earth–Moon distance (m)
  };

  /* ---------- Particles ---------- */
  const PARTICLES = {
    proton: {
      key: 'proton', name: 'Proton', symbol: 'p⁺', mass: 1.67262192369e-27, z: +1, color: '#ff6b6b',
      note: 'The nucleus of a hydrogen atom. The particle most cyclotrons accelerate, for medical isotopes and cancer therapy.',
    },
    deuteron: {
      key: 'deuteron', name: 'Deuteron', symbol: 'd⁺', mass: 3.3435837724e-27, z: +1, color: '#ffa94d',
      note: 'A proton and a neutron bound together (heavy-hydrogen nucleus): same charge as a proton, about twice the mass.',
    },
    alpha: {
      key: 'alpha', name: 'Alpha particle', symbol: 'α²⁺', mass: 6.6446573357e-27, z: +2, color: '#ffd43b',
      note: 'A helium-4 nucleus: 2 protons + 2 neutrons. Twice the charge of a proton and about 4 times the mass.',
    },
    carbon: {
      key: 'carbon', name: 'Carbon-12 ion', symbol: '¹²C⁶⁺', mass: 1.99210032e-26, z: +6, color: '#a9e34b',
      note: 'A carbon nucleus with all 6 electrons stripped off. Carbon-ion beams are used in heavy-ion cancer therapy.',
    },
    electron: {
      key: 'electron', name: 'Electron', symbol: 'e⁻', mass: 9.1093837015e-31, z: -1, color: '#4dabf7',
      note: 'About 1/1836 of the proton mass, so it becomes relativistic at very low energy — the classic cyclotron weak spot.',
    },
    positron: {
      key: 'positron', name: 'Positron', symbol: 'e⁺', mass: 9.1093837015e-31, z: +1, color: '#f783ac',
      note: 'The antimatter partner of the electron: identical mass, opposite (positive) charge.',
    },
  };

  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺' };
  const sup = n => String(n).split('').map(ch => SUP[ch] || ch).join('');

  function particle(key, customMassU, customZ) {
    if (key === 'custom') {
      const z = Math.round(customZ) || 1;
      const mag = Math.abs(z) === 1 ? '' : sup(Math.abs(z));
      return {
        key: 'custom', name: 'Custom ion', symbol: 'X' + mag + (z > 0 ? '⁺' : '⁻'),
        mass: customMassU * C.u, z, color: '#66d9e8',
        note: 'Your own particle: mass ' + customMassU + ' u and charge ' + (z > 0 ? '+' : '−') + Math.abs(z) + 'e.',
      };
    }
    return PARTICLES[key] || PARTICLES.proton;
  }

  /* ---------- Electromagnet: iron yoke with an air gap ----------
     Ampère's circuital law around the magnetic circuit:  ∮H·dl = N·I.
     Iron has μr ≫ 1, so almost all of the "magnetic pressure" is used
     across the air gap g:  (B/μ0)·g ≈ N·I   ⇒   B = μ0·N·I / g
     with N = (number of coils) × (turns per coil), coils in series.   */
  const magnetField = (coils, turns, current, gap) => C.mu0 * coils * turns * current / gap;
  const magnetCurrent = (coils, turns, B, gap) => B * gap / (C.mu0 * coils * turns);

  /* Rough engineering estimate of the copper coils (stated assumptions). */
  function coilEngineering(coils, turns, current, R) {
    const N = coils * turns;
    const rCoil = R + 0.15;                // mean coil radius, just outside the pole (assumed)
    const area = 1.0e-4;                   // copper conductor cross-section 1 cm² (assumed)
    const length = N * 2 * Math.PI * rCoil;
    const resistance = C.rhoCu * length / area;
    return {
      N, rCoil, area, length, resistance,
      voltage: current * resistance,
      power: current * current * resistance,
      copperMass: length * area * C.densCu,
      currentDensity: current / (area * 1e6), // A/mm²
    };
  }

  function fieldRealism(B) {
    const b = Math.abs(B);
    if (b < 1e-9) return { level: 'none', label: 'No field', text: 'The coils carry no current, so there is no magnetic field and nothing bends the particle.' };
    if (b <= 2.0) return { level: 'ok', label: 'Realistic', text: 'Achievable with an ordinary iron electromagnet. The best magnetic steels saturate close to 2 T.' };
    if (b <= 6.0) return { level: 'warn', label: 'Needs superconductors', text: 'Above iron saturation (about 2 T): a real machine would need superconducting coils, like the 230 MeV S2C2 proton-therapy synchrocyclotron at about 5.7 T. Our B = μ₀NI/g formula overestimates here because it ignores saturation.' };
    return { level: 'bad', label: 'Extreme', text: 'Extremely strong. For comparison, the LHC’s superconducting bending magnets run at about 8.3 T. The simple B = μ₀NI/g model is far outside its valid range.' };
  }

  /* ---------- Kinematics helpers ---------- */
  function kin(K, m, rel) {
    const mc2 = m * C.c * C.c;
    const p = rel ? Math.sqrt(K * K + 2 * K * mc2) / C.c : Math.sqrt(2 * m * K);
    const g = rel ? 1 + K / mc2 : 1;
    const v = p / (g * m);
    return { K, p, g, v };
  }

  /* ---------- Textbook predictions for the current settings ---------- */
  function predictions(P) {
    const m = P.mass, absq = Math.abs(P.charge), absB = Math.abs(P.B), R = P.R, V = P.V;
    const mc2 = m * C.c * C.c;
    const fc = absq * absB / (2 * Math.PI * m);           // cyclotron frequency (rest mass)
    const T = fc > 0 ? 1 / fc : Infinity;
    const pmax = absq * absB * R;                          // momentum when the orbit radius = R
    const Kcl = pmax * pmax / (2 * m);                     // ½mv² with v = qBR/m
    const vcl = pmax / m;
    const Krel = Math.sqrt(pmax * pmax * C.c * C.c + mc2 * mc2) - mc2;
    const grel = 1 + Krel / mc2;
    const vrel = pmax / (grel * m);
    const rel = !!P.relativistic;
    const Kmax = rel ? Krel : Kcl;
    const vmax = rel ? vrel : vcl;
    const gainTurn = 2 * absq * V;                         // ideal energy gain per revolution
    const nRev = gainTurn > 0 ? Kmax / gainTurn : Infinity;
    const tAccClassical = absB > 0 && V > 0 ? Math.PI * absB * R * R / (2 * V) : Infinity; // = N·T
    const path = (2 / 3) * nRev * 2 * Math.PI * R;
    return {
      fc, T, omega: 2 * Math.PI * fc, pmax, Kcl, vcl, Krel, grel, vrel, Kmax, vmax, nRev,
      tAccClassical, path, gainTurn, gainCross: absq * V, mc2,
      fRF: fc * (1 + (P.detune || 0)),
    };
  }

  const wrap = a => { // wrap angle to (−π, π]
    a = (a + Math.PI) % (2 * Math.PI);
    if (a < 0) a += 2 * Math.PI;
    return a - Math.PI;
  };

  /* =====================================================================
     computeRun — follows one particle from the ion source to extraction.

     Model (the standard textbook cyclotron):
     • Uniform field B (along z) inside the dees.  Inside a dee there is no
       electric field, so the particle moves on an exact circle:
          r = p / (|q|B),   half-turn time  τ = π·γ·m / (|q|B)
       (γ = 1 when relativity is switched off).
     • The accelerating gap is the line x = 0, treated as thin. At every
       crossing the RF voltage does work  W = |q|·V·cos(ψ), where ψ is the
       RF phase measured from the ideal "crest".
     • The ion source releases the particle at rest and its first push
       across the gap gives it |q|·V·cos(ψ₀).
     • Fixed-frequency RF:  f_RF = (1 + detune)·|q|B / (2πm)   (rest mass).
       Frequency-modulated RF (synchrocyclotron): f_RF follows the particle's
       own frequency |q|B / (2πγm), so the phase advances by π(1 + detune)
       every half-turn.
     • The beam is extracted when it reaches the dee radius R.
     Because every crossing happens perpendicular to x = 0, the whole path is
     a chain of semicircles that can be computed exactly — no step errors.
     ===================================================================== */
  function computeRun(P) {
    const m = P.mass, q = P.charge, B = P.B, R = P.R, V = P.V;
    const absq = Math.abs(q), absB = Math.abs(B);
    const rel = !!P.relativistic;
    const fm = P.rfMode === 'fm';
    const detune = P.detune || 0;
    const phi0 = P.injPhase || 0;
    const qV = absq * V;
    const maxHalf = 2 * (P.maxRevs || 10000);
    const K0 = qV * Math.cos(phi0);

    const run = {
      P, rel, fm, detune, phi0, qV, m, q, absq, absB, R, V,
      rot: 0, T0: 0, wRF: 0, segs: [], kicks: [], status: '', yShift: 0, Kpeak: 0, extract: null,
    };

    if (absB < 1e-9 || K0 <= 0) {
      // No magnetic field: one push from the source, then a straight line out.
      const K = Math.max(K0, 0);
      const s = kin(K, m, rel);
      run.T0 = s.v > 0 ? 2 * Math.PI * R / s.v : 1;
      run.wRF = 2 * Math.PI / run.T0;
      run.Kpeak = K;
      if (s.v <= 0) {
        run.status = 'stuck';
        run.segs = [{ type: 'line', k: 0, t0: 0, t1: run.T0, x0: 0, y0: 0, ux: 1, uy: 0, ...s, r: Infinity, end: 'stuck' }];
        run.kicks = [{ n: 0, t: 0, W: K0, psi: wrap(phi0), K, y: 0, dir: 1 }];
        return finalize(run);
      }
      const tExt = R / s.v;
      run.segs = [
        { type: 'line', k: 0, t0: 0, t1: tExt, x0: 0, y0: 0, ux: 1, uy: 0, ...s, r: Infinity, end: 'extract' },
        { type: 'exit', k: 1, t0: tExt, t1: tExt + 0.9 * R / s.v, x0: R, y0: 0, ux: 1, uy: 0, ...s, r: Infinity, end: 'done' },
      ];
      run.kicks = [{ n: 0, t: 0, W: K0, psi: wrap(phi0), K, y: 0, dir: 1 }];
      run.status = 'nofield';
      run.extract = { t: tExt, x: R, y: 0, ux: 1, uy: 0, ...s, r: Infinity };
      return finalize(run);
    }

    // Rotation sense seen from above: +1 = anticlockwise, −1 = clockwise.
    // F = qv × B  ⇒  a positive charge in a field pointing INTO the screen
    // (B < 0 here) circulates anticlockwise.
    const rot = (q * B > 0) ? -1 : 1;
    const T0 = 2 * Math.PI * m / (absq * absB);           // non-relativistic period
    const wRF = (2 * Math.PI / T0) * (1 + detune);        // fixed-frequency RF (rad/s)
    run.rot = rot; run.T0 = T0; run.wRF = wRF;

    const generate = (yStart, withExtraction, ideal) => {
      const segs = [], kicks = [];
      let t = 0, y = yStart, dirx = 1, phi = phi0;
      let K = K0;
      kicks.push({ n: 0, t: 0, W: K0, psi: wrap(phi0), K, y, dir: 1 });
      let Kpeak = K, sincePeak = 0, status = 'limit';
      for (let k = 0; k < maxHalf; k++) {
        const s = kin(K, m, rel);
        const r = s.p / (absq * absB);
        const tau = Math.PI * s.g * m / (absq * absB);
        const s0 = -rot * dirx;          // sin of the start angle: start point is (0, yc + s0·r)
        const yc = y - s0 * r;           // centre of this semicircle lies on the gap line x = 0
        const seg = {
          type: 'arc', k, t0: t, tau, t1: t + tau, K, p: s.p, g: s.g, v: s.v, r, yc, yStart: y,
          dirx, s0, theta0: s0 * Math.PI / 2, phiStart: phi, alphaEnd: Math.PI, end: 'kick',
        };
        if (withExtraction) {
          // distance from the machine centre: d²(α) = r² + yc² + 2·yc·r·s0·cos α  (α = angle travelled),
          // monotonic along a half circle, so check the start and the end.
          const d0 = Math.abs(y), dEnd = Math.abs(yc - s0 * r);
          if (d0 >= R || dEnd >= R) {
            let a = 0;
            if (d0 < R) {
              const den = 2 * yc * r * s0;
              let ca = Math.abs(den) < 1e-300 ? -1 : (R * R - r * r - yc * yc) / den;
              ca = Math.min(1, Math.max(-1, ca));
              a = Math.acos(ca);
            }
            // A proper extraction happens on a full-size orbit. If the orbit is much smaller
            // than R, the particle only got here because its orbit drifted off-centre after
            // falling out of step with the RF: it hits the wall of the dee.
            const wall = r < 0.9 * R;
            seg.alphaEnd = a; seg.t1 = t + tau * a / Math.PI; seg.end = wall ? 'wall' : 'extract';
            segs.push(seg); status = wall ? 'wall' : 'extracted';
            break;
          }
        } else if (r >= R) { segs.push(seg); status = 'reachedR'; break; }
        segs.push(seg);

        // arrive back at the gap
        t += tau;
        y = yc - s0 * r;
        const d = -dirx;                                    // direction of the gap crossing
        const phiCross = ideal ? phi + Math.PI : fm ? phi + Math.PI * (1 + detune) : wRF * t + phi0;
        phi = phiCross;
        const W = qV * Math.cos(phiCross) * d;              // work done by the gap voltage
        const psi = wrap(phiCross + (d < 0 ? Math.PI : 0)); // phase measured from the crest
        if (K + W <= 0) {
          // The field points the wrong way and the particle is too slow to get across:
          // it is turned back into the same dee with (almost) the same energy.
          kicks.push({ n: k + 1, t, W: 0, psi, K, y, dir: d, reflected: true });
        } else {
          K += W; dirx = d;
          kicks.push({ n: k + 1, t, W, psi, K, y, dir: d });
        }
        if (K > Kpeak * (1 + 1e-12)) { Kpeak = K; sincePeak = 0; }
        else if (++sincePeak > 60) { status = 'lost'; break; }
      }
      return { segs, kicks, status, Kpeak };
    };

    // Pass 1: an ideal particle (every push perfectly timed) shows where the
    // spiral settles. The ion source is placed slightly off-centre so that the
    // ideal beam's outer orbits are centred in the machine, as in real
    // cyclotrons. A particle that falls out of step can then drift off-centre.
    const p1 = generate(0, false, true);
    const n1 = p1.segs.length;
    const yShift = n1 >= 2 ? 0.5 * (p1.segs[n1 - 1].yc + p1.segs[n1 - 2].yc) : p1.segs[0].yc;

    // Pass 2: the real run, with extraction at radius R.
    const p2 = generate(-yShift, true);
    run.segs = p2.segs; run.kicks = p2.kicks; run.status = p2.status; run.Kpeak = p2.Kpeak; run.yShift = yShift;

    if (run.status === 'extracted') {
      const s = run.segs[run.segs.length - 1];
      const th = s.theta0 + rot * s.alphaEnd;
      const x = s.r * Math.cos(th), y = s.yc + s.r * Math.sin(th);
      const ux = -rot * Math.sin(th), uy = rot * Math.cos(th);
      const len = 0.9 * R;
      run.segs.push({ type: 'exit', k: s.k + 1, t0: s.t1, t1: s.t1 + len / s.v, x0: x, y0: y, ux, uy,
        K: s.K, p: s.p, g: s.g, v: s.v, r: s.r, end: 'done' });
      run.extract = { t: s.t1, x, y, ux, uy, K: s.K, v: s.v, g: s.g, p: s.p, r: s.r };
    } else if (run.status === 'wall') {
      const s = run.segs[run.segs.length - 1];
      const th = s.theta0 + rot * s.alphaEnd;
      run.wall = { t: s.t1, x: s.r * Math.cos(th), y: s.yc + s.r * Math.sin(th), K: s.K, r: s.r };
    }
    return finalize(run);
  }

  /* Totals and graph samples. */
  function finalize(run) {
    const segs = run.segs;
    // Unified segment description shared with the live (chaos) engine:
    // arcs: centre (cx, cy), radius r, start angle th0, rotation rot, angular speed w, angle travelled span;
    // every segment: RF phase at its start (phiStart) and RF angular frequency (wRF).
    let lastW = run.wRF, phiNext = run.phi0;
    for (const s of segs) {
      if (s.type === 'arc') {
        s.cx = 0; s.cy = s.yc; s.th0 = s.theta0; s.rot = run.rot; s.w = Math.PI / s.tau; s.span = s.alphaEnd;
        s.wRF = run.fm ? Math.PI * (1 + run.detune) / s.tau : run.wRF;
        s.Bz = run.P.B;
      } else { s.wRF = lastW; s.Bz = 0; }
      if (s.phiStart === undefined) s.phiStart = phiNext;
      lastW = s.wRF;
      phiNext = s.phiStart + s.wRF * (s.t1 - s.t0);
    }
    const moving = segs.filter(s => s.type !== 'exit');
    const last = moving[moving.length - 1];
    run.tStop = last.t1;
    run.tEnd = Math.max(segs[segs.length - 1].t1, 1e-15);
    run.halfTurns = moving.filter(s => s.type === 'arc').length;
    run.revs = last.type === 'arc' ? (run.halfTurns - 1 + last.alphaEnd / Math.PI) / 2 : 0;
    run.path = moving.reduce((acc, s) => acc + s.v * (s.t1 - s.t0), 0);
    run.Kfinal = last.K; run.vfinal = last.v; run.gfinal = last.g; run.rfinal = last.r;

    // Samples for the graphs: start, apex and end of every half-turn (+ extra
    // points for smooth curves when the run is short).
    const n = moving.length;
    const per = n > 4000 ? 2 : n > 1200 ? 4 : 12;
    const N = n * (per + 1);
    const S = {
      n: N,
      t: new Float64Array(N), x: new Float64Array(N), v: new Float64Array(N),
      K: new Float64Array(N), r: new Float64Array(N), g: new Float64Array(N), seg: new Int32Array(N),
    };
    let i = 0;
    for (let k = 0; k < n; k++) {
      const s = moving[k];
      for (let j = 0; j <= per; j++) {
        const f = j / per;
        let x, tt;
        if (s.type === 'arc') {
          const a = s.alphaEnd * f;
          x = s.r * Math.cos(s.theta0 + run.rot * a);
          tt = s.t0 + s.tau * a / Math.PI;
        } else {
          tt = s.t0 + (s.t1 - s.t0) * f;
          x = s.x0 + s.ux * s.v * (tt - s.t0);
        }
        S.t[i] = tt; S.x[i] = x; S.v[i] = s.v; S.K[i] = s.K; S.r[i] = isFinite(s.r) ? s.r : 0; S.g[i] = s.g; S.seg[i] = k;
        i++;
      }
    }
    run.samples = S;
    return run;
  }

  /* =====================================================================
     LIVE ENGINE (Magnetic Field Chaos mode)
     The field can be flipped, scaled, made to flicker, or the particle can be
     nudged while it flies. Between changes the field is uniform, so motion is
     still an exact circle; every change simply starts a new arc from the
     particle's current position and velocity. Gap crossings (x = 0) and the
     edge of the dees (|r| = R) are found analytically on each arc.
     ===================================================================== */
  const TAU = 2 * Math.PI;
  const posAt = (s, t) => {
    if (s.type === 'arc') {
      const th = s.th0 + s.rot * s.w * (t - s.t0);
      const c = Math.cos(th), sn = Math.sin(th);
      return { x: s.cx + s.r * c, y: s.cy + s.r * sn, ux: -s.rot * sn, uy: s.rot * c, th };
    }
    const d = s.v * (t - s.t0);
    return { x: s.x0 + s.ux * d, y: s.y0 + s.uy * d, ux: s.ux, uy: s.uy };
  };
  const nextAngle = (thNow, rot, cands) => {
    let best = Infinity;
    for (const c of cands) {
      let d = rot * (c - thNow);
      d = ((d % TAU) + TAU) % TAU;
      if (d < 1e-9) d += TAU;
      if (d < best) best = d;
    }
    return best;
  };
  let seedState = 12345;
  const rand = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; };
  const randn = () => { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

  function createLive(P, opts = {}) {
    const m = P.mass, q = P.charge, absq = Math.abs(q), R = P.R, V = P.V, rel = !!P.relativistic;
    const detune = P.detune || 0, phi0 = P.injPhase || 0, qV = absq * V;
    const absB0 = Math.abs(P.B);
    const ref = computeRun(P);
    const pred = predictions(P);
    const T0 = absB0 > 1e-9 ? 2 * Math.PI * m / (absq * absB0) : ref.T0;
    const wFixed = (2 * Math.PI / T0) * (1 + detune);
    const L = {
      P, m, q, absq, R, V, rel, qV, detune, phi0, T0, pred, ref, yShift: ref.yShift,
      live: true, fm: P.rfMode === 'fm', mult: 1, flip: 1, flicker: opts.flicker || 0, autoRF: P.rfMode === 'fm' || !!opts.autoRF,
      noise: 0, nextFlick: Infinity, t: 0, segs: [], kicks: [], status: 'running', extract: null, wall: null,
      samples: { n: 0, t: [], x: [], v: [], K: [], r: [], g: [], B: [], w: [] }, nextSample: 0, Kpeak: 0,
      tLimit: Math.max(6 * (pred.tAccClassical || 0), 400 * T0), rot: 0, wRF: wFixed, events: [],
    };
    const fieldNow = () => P.B * L.mult * L.flip * (1 + L.flicker * L.noise);
    const sample = (t, s) => {
      const p = posAt(s, t), S = L.samples;
      S.t.push(t); S.x.push(p.x); S.v.push(s.v); S.K.push(s.K); S.r.push(isFinite(s.r) ? s.r : 0); S.g.push(s.g);
      S.B.push(Math.abs(s.Bz || 0)); S.w.push(s.wRF || 0); S.n++;
    };
    const startSeg = (x, y, ux, uy, K, t, phi) => {
      const k = kin(Math.max(K, 0), m, rel);
      const Bz = fieldNow();
      let s;
      if (Math.abs(Bz) < 1e-12 || k.v <= 0) {
        s = { type: 'line', t0: t, t1: t, x0: x, y0: y, ux, uy, K, p: k.p, g: k.g, v: k.v, r: Infinity, Bz, phiStart: phi, wRF: L.autoRF ? L.wRF : wFixed };
      } else {
        const r = k.p / (absq * Math.abs(Bz)), rot = (q * Bz > 0) ? -1 : 1, w = absq * Math.abs(Bz) / (k.g * m);
        const cx = x + rot * r * (-uy), cy = y + rot * r * ux;
        s = { type: 'arc', t0: t, t1: t, cx, cy, yc: cy, r, th0: Math.atan2(y - cy, x - cx), rot, w, span: 0, K, p: k.p, g: k.g, v: k.v, Bz,
          phiStart: phi, wRF: L.autoRF ? (1 + detune) * w : wFixed };
        L.rot = rot; L.wRF = s.wRF;
      }
      if (K > L.Kpeak) L.Kpeak = K;
      L.segs.push(s); L.cur = s;
      return s;
    };
    const phaseAt = (s, t) => s.phiStart + s.wRF * (t - s.t0);
    const restart = () => {        // field changed: new arc from the current state
      const s = L.cur, p = posAt(s, L.t);
      startSeg(p.x, p.y, p.ux, p.uy, s.K, L.t, phaseAt(s, L.t));
    };
    L.restart = restart;
    L.setField = (mult, flip) => { if (L.status !== 'running') return; if (mult !== undefined) L.mult = mult; if (flip !== undefined) L.flip = flip; restart(); };
    L.setFlicker = a => { L.flicker = a; L.nextFlick = a > 0 ? L.t + T0 / 12 : Infinity; if (L.status === 'running') restart(); };
    L.setAutoRF = on => { L.autoRF = on; if (L.status === 'running') restart(); };
    L.setVoltage = volts => { L.V = volts; L.qV = absq * volts; };      // takes effect at the next gap crossing
    L.nudge = deg => {             // turn the velocity by a small angle (a short magnetic "bump" changes direction, not speed)
      if (L.status !== 'running') return;
      const s = L.cur, p = posAt(s, L.t), a = (deg || 10) * Math.PI / 180 * (rand() < 0.5 ? -1 : 1);
      const ux = p.ux * Math.cos(a) - p.uy * Math.sin(a), uy = p.ux * Math.sin(a) + p.uy * Math.cos(a);
      startSeg(p.x, p.y, ux, uy, s.K, L.t, phaseAt(s, L.t));
      L.events.push({ type: 'nudge', t: L.t, x: p.x, y: p.y });
    };
    const gapTime = (s, t) => {
      if (s.type === 'arc') {
        const c = -s.cx / s.r;
        if (Math.abs(c) > 1) return Infinity;
        const a = Math.acos(c), thNow = s.th0 + s.rot * s.w * (t - s.t0);
        return t + nextAngle(thNow, s.rot, [a, -a]) / s.w;
      }
      const p = posAt(s, t);
      if (Math.abs(s.ux) < 1e-12 || p.x * s.ux >= -1e-15) return Infinity;
      return t + (-p.x) / (s.ux * s.v);
    };
    const edgeTime = (s, t) => {
      if (s.type === 'arc') {
        const D = Math.hypot(s.cx, s.cy);
        if (D < 1e-15) return s.r >= R ? t : Infinity;
        const rhs = (R * R - D * D - s.r * s.r) / (2 * s.r * D);
        if (rhs > 1 || rhs < -1) return Infinity;
        const pc = Math.atan2(s.cy, s.cx), a = Math.acos(rhs), thNow = s.th0 + s.rot * s.w * (t - s.t0);
        return t + nextAngle(thNow, s.rot, [pc + a, pc - a]) / s.w;
      }
      const p = posAt(s, t), b = p.x * s.ux + p.y * s.uy, c = p.x * p.x + p.y * p.y - R * R;
      const disc = b * b - c;
      if (disc < 0) return Infinity;
      const d = -b + Math.sqrt(disc);
      return d > 1e-15 ? t + d / s.v : Infinity;
    };
    const finish = (status, t) => {
      const s = L.cur, p = posAt(s, t);
      s.t1 = t; if (s.type === 'arc') s.span = s.w * (t - s.t0);
      L.status = status; L.tStop = t;
      if (status === 'extracted') {
        L.extract = { t, x: p.x, y: p.y, ux: p.ux, uy: p.uy, K: s.K, v: s.v, g: s.g, p: s.p, r: s.r };
        const len = 0.9 * R;
        L.segs.push({ type: 'exit', t0: t, t1: t + len / s.v, x0: p.x, y0: p.y, ux: p.ux, uy: p.uy, K: s.K, p: s.p, g: s.g, v: s.v, r: s.r,
          phiStart: phaseAt(s, t), wRF: s.wRF });
      } else L.wall = { t, x: p.x, y: p.y, K: s.K, r: s.r };
      const last = L.segs[L.segs.length - 1];
      L.tEnd = last.t1;
      L.Kfinal = s.K; L.vfinal = s.v; L.gfinal = s.g; L.rfinal = s.r;
    };
    L.advance = dt => {
      const tTarget = L.t + dt;
      let guard = 0;
      while (L.status === 'running' && L.t < tTarget && guard++ < 200000) {
        const s = L.cur;
        const tg = gapTime(s, L.t), te = edgeTime(s, L.t), tf = L.nextFlick;
        let tn = Math.min(tg, te, tf, tTarget, L.tLimit);
        while (L.nextSample <= tn) { sample(L.nextSample, s); L.nextSample += T0 / 24; }
        L.t = tn; s.t1 = tn; if (s.type === 'arc') s.span = s.w * (tn - s.t0);
        if (tn === te) {
          // a full-size orbit reaching the edge is extracted; a small, off-centre orbit
          // (or a particle flying straight because the field was switched off) hits the wall
          finish(s.type === 'arc' && s.r >= 0.9 * R ? 'extracted' : 'wall', tn);
        } else if (tn >= L.tLimit) {
          finish('lost', tn); L.wall = null;
        } else if (tn === tg) {
          const p = posAt(s, tn), d = Math.sign(p.ux) || 1;
          const phi = phaseAt(s, tn), W = L.qV * Math.cos(phi) * d;
          let px = s.p * p.ux, py = s.p * p.uy, Knew = s.K + W, reflected = false;
          if (Knew <= 0) { reflected = true; Knew = s.K; px = -px; }
          else {
            const pn = kin(Knew, m, rel).p;
            if (pn * pn < py * py) { reflected = true; Knew = s.K; px = -px; }
            else px = Math.sign(px || d) * Math.sqrt(pn * pn - py * py);
          }
          const pm = Math.hypot(px, py);
          sample(tn, s);
          L.kicks.push({ n: L.kicks.length, t: tn, W: reflected ? 0 : W, psi: wrap(phi + (d < 0 ? Math.PI : 0)), K: Knew, y: p.y, dir: d, reflected });
          const ns = startSeg(0, p.y, px / pm, py / pm, Knew, tn, phi);
          sample(tn, ns);
        } else if (tn === tf) {
          L.noise = 0.8 * L.noise + 0.6 * randn();
          L.nextFlick = tn + T0 / 12;
          restart();
        }
      }
      return L;
    };
    // first push from the ion source (as in computeRun)
    const K0 = Math.max(qV * Math.cos(phi0), 0);
    L.kicks.push({ n: 0, t: 0, W: K0, psi: wrap(phi0), K: K0, y: -ref.yShift, dir: 1 });
    const s0 = startSeg(0, -ref.yShift, 1, 0, K0, 0, phi0);
    sample(0, s0); L.nextSample = T0 / 24;
    L.tEnd = Infinity; L.tStop = Infinity;
    return L;
  }

  /* =====================================================================
     STOPPING POWER (Target Range)
     Heavy charged particles: Bethe formula (PDG form, no shell or density
     corrections), mean excitation energies and Z/A from PDG/NIST tables.
     Electrons: Katz–Penfold empirical range–energy relation.
     ===================================================================== */
  const MATERIALS = {
    water: { name: 'Water (soft tissue)', short: 'Water', rho: 1.000, ZA: 0.55509, I: 75.0, cp: 4.18, limit: 100, limitWord: 'boils', color: '#3d8bfd' },
    tumour: { name: 'Tumour (tissue-like)', short: 'Tumour', rho: 1.000, ZA: 0.55509, I: 75.0, cp: 4.18, limit: 100, limitWord: 'boils', color: '#e64980' },
    plastic: { name: 'Plastic (polystyrene)', short: 'Plastic', rho: 1.060, ZA: 0.53768, I: 68.7, cp: 1.30, limit: 240, limitWord: 'melts', color: '#63e6be' },
    paper: { name: 'Paper (approx. as plastic, 0.8 g/cm³)', short: 'Paper', rho: 0.80, ZA: 0.530, I: 70.0, cp: 1.34, limit: 233, limitWord: 'chars', color: '#f1e3c6' },
    graphite: { name: 'Graphite (carbon)', short: 'Graphite', rho: 2.210, ZA: 0.49955, I: 78.0, cp: 0.709, limit: 3640, limitWord: 'sublimates', color: '#5c636a' },
    aluminium: { name: 'Aluminium', short: 'Al', rho: 2.699, ZA: 0.48181, I: 166.0, cp: 0.897, limit: 660, limitWord: 'melts', color: '#ced4da' },
    steel: { name: 'Iron / steel', short: 'Fe', rho: 7.874, ZA: 0.46557, I: 286.0, cp: 0.449, limit: 1538, limitWord: 'melts', color: '#8f99a6' },
    copper: { name: 'Copper', short: 'Cu', rho: 8.960, ZA: 0.45636, I: 322.0, cp: 0.385, limit: 1085, limitWord: 'melts', color: '#e8590c' },
    lead: { name: 'Lead', short: 'Pb', rho: 11.35, ZA: 0.39575, I: 823.0, cp: 0.129, limit: 327, limitWord: 'melts', color: '#6c7a96' },
    gold: { name: 'Gold', short: 'Au', rho: 19.32, ZA: 0.40108, I: 790.0, cp: 0.129, limit: 1064, limitWord: 'melts', color: '#fcc419' },
    tungsten: { name: 'Tungsten', short: 'W', rho: 19.30, ZA: 0.40250, I: 727.0, cp: 0.132, limit: 3422, limitWord: 'melts', color: '#b8c0cc' },
  };
  const ME_MEV = 0.51099895;
  const restMeV = part => part.mass * C.c * C.c / C.MeV;
  /* −dE/dx in MeV/cm for a heavy charged particle of kinetic energy T (MeV). */
  function stopHeavy(T, M, z, mat) {
    const Tlow = 0.5 * M / 938.272;               // below ~0.5 MeV per nucleon Bethe fails: hold S constant
    const TT = Math.max(T, Tlow);
    const g = 1 + TT / M, b2 = 1 - 1 / (g * g);
    const Wmax = 2 * ME_MEV * b2 * g * g / (1 + 2 * g * ME_MEV / M + (ME_MEV / M) ** 2);
    const I = mat.I * 1e-6;
    const Lb = 0.5 * Math.log(2 * ME_MEV * b2 * g * g * Wmax / (I * I)) - b2;
    return 0.307075 * z * z * mat.ZA * mat.rho / b2 * Math.max(Lb, 0.05);
  }
  /* Electron CSDA-like range in g/cm² (Katz & Penfold 1952), material independent to first order. */
  function rangeElectronAreal(T) {
    if (T <= 0) return 0;
    if (T < 0.01) return 0.412 * Math.pow(0.01, 1.265 - 0.0954 * Math.log(0.01)) * Math.pow(T / 0.01, 1.7);
    if (T <= 2.5) return 0.412 * Math.pow(T, 1.265 - 0.0954 * Math.log(T));
    return 0.530 * T - 0.106;
  }
  function energyFromElectronRange(Rg) {
    if (Rg <= 0) return 0;
    let lo = 0, hi = 1e5;
    for (let i = 0; i < 80; i++) { const mid = 0.5 * (lo + hi); if (rangeElectronAreal(mid) < Rg) lo = mid; else hi = mid; }
    return 0.5 * (lo + hi);
  }
  function isLight(part) { return Math.abs(restMeV(part) - ME_MEV) < 0.01; }
  /* Range (cm) of a particle in one material. */
  function rangeIn(part, T, mat) {
    if (isLight(part)) return rangeElectronAreal(T) / mat.rho;
    const M = restMeV(part), z = Math.abs(part.z);
    const Tlow = 0.5 * M / 938.272;
    let R = Math.min(T, Tlow) / stopHeavy(Tlow, M, z, mat);
    if (T > Tlow) {
      const n = 400, a = Math.log(Tlow), b = Math.log(T);
      for (let i = 0; i < n; i++) {           // midpoint rule in log T
        const lt = a + (b - a) * (i + 0.5) / n, t = Math.exp(lt);
        R += t / stopHeavy(t, M, z, mat) * (b - a) / n;
      }
    }
    return R;
  }
  /* Send one particle of kinetic energy T0 (MeV) through a stack of slabs [{mat, thick(cm), destroyed}].
     Returns energy deposited in each slab and the depth–dose (Bragg) profile. */
  function traverse(part, T0, slabs) {
    const light = isLight(part), M = restMeV(part), z = Math.abs(part.z);
    let T = T0, x = 0, stopX = null;
    const prof = [], per = [];
    for (let i = 0; i < slabs.length; i++) {
      const sl = slabs[i], mat = MATERIALS[sl.mat], thick = sl.destroyed ? 0 : sl.thick;
      const Tin = T, xin = x;
      if (T <= 0 || thick <= 0) { per.push({ Tin, Tout: T, dE: 0, stopped: false, xin, xout: x + thick }); x += thick; continue; }
      if (light) {
        const Rres = rangeElectronAreal(T), need = mat.rho * thick;
        const nSteps = 60;
        if (Rres <= need) {
          const depth = Rres / mat.rho;
          for (let k = 0; k < nSteps; k++) {
            const xx = depth * (k + 0.5) / nSteps, Tk = energyFromElectronRange(Rres - mat.rho * xx);
            const dRdT = (rangeElectronAreal(Tk * 1.001 + 1e-6) - rangeElectronAreal(Tk)) / (Tk * 0.001 + 1e-6);
            prof.push({ x: x + xx, S: mat.rho / dRdT, T: Tk, i });
          }
          stopX = x + depth; x += thick; T = 0;
          per.push({ Tin, Tout: 0, dE: Tin, stopped: true, xin, xout: x, stopAt: stopX });
        } else {
          for (let k = 0; k < nSteps; k++) {
            const xx = thick * (k + 0.5) / nSteps, Tk = energyFromElectronRange(Rres - mat.rho * xx);
            const dRdT = (rangeElectronAreal(Tk * 1.001 + 1e-6) - rangeElectronAreal(Tk)) / (Tk * 0.001 + 1e-6);
            prof.push({ x: x + xx, S: mat.rho / dRdT, T: Tk, i });
          }
          T = energyFromElectronRange(Rres - need); x += thick;
          per.push({ Tin, Tout: T, dE: Tin - T, stopped: false, xin, xout: x });
        }
        continue;
      }
      let rem = thick, stopped = false;
      while (rem > 1e-12) {
        const S = stopHeavy(T, M, z, mat);
        let dT = Math.max(0.004 * T, 2e-4), dx = dT / S;
        if (dx > rem) { dx = rem; dT = S * dx; }
        if (dT >= T) { dx = T / S; dT = T; }
        prof.push({ x: x + dx / 2, S, T: T - dT / 2, i });
        T -= dT; x += dx; rem -= dx;
        if (T <= 1e-4) { T = 0; stopped = true; stopX = x; break; }
      }
      if (stopped) x = xin + thick;
      per.push({ Tin, Tout: T, dE: Tin - T, stopped, xin, xout: xin + thick, stopAt: stopped ? stopX : null });
    }
    return { prof, per, stopX, Texit: T, total: slabs.reduce((a, s) => a + (s.destroyed ? 0 : s.thick), 0) };
  }

  /* =====================================================================
     RACING (Race screen)
     Sprint: each racer is pushed across the same 5 cm gate (same voltage,
     same energy or same speed), then a uniform field B bends it into a half
     circle back onto the detector plate (a mass spectrometer). With B = 0
     they fly straight to the finish line.
     ===================================================================== */
  function sprint(part, mode, value, Bz, geo = {}) {
    const m = part.mass, q = part.z * C.e, absq = Math.abs(q), rel = geo.rel !== false;
    const gate = geo.gate || 0.05, Lx = geo.Lx || 1.0, Hy = geo.Hy || 0.4;
    let K;
    if (mode === 'voltage') K = absq * value;
    else if (mode === 'energy') K = value;
    else {
      const v = Math.min(value, 0.999999 * C.c);
      K = rel ? (1 / Math.sqrt(1 - v * v / (C.c * C.c)) - 1) * m * C.c * C.c : 0.5 * m * v * v;
    }
    const s = kin(K, m, rel);
    const F = K / gate;                      // constant accelerating force across the gate
    const tAcc = s.p / F;                    // dp/dt = F (exact, also relativistically)
    const out = { part, K, p: s.p, v: s.v, g: s.g, tAcc, gate, Lx, Hy, F, rel };
    const xAcc = t => rel ? (m * C.c * C.c / F) * (Math.sqrt(1 + (F * t / (m * C.c)) ** 2) - 1) : 0.5 * F / m * t * t;
    const absB = Math.abs(Bz);
    if (absB < 1e-12) {
      out.mode = 'line'; out.r = Infinity;
      out.tFin = tAcc + Lx / s.v; out.finish = 'line'; out.xEnd = Lx; out.yEnd = 0;
    } else {
      const r = s.p / (absq * absB), rot = (q * Bz > 0) ? -1 : 1, w = absq * absB / (s.g * m);
      Object.assign(out, { mode: 'arc', r, rot, w });
      let th = Math.PI, finish = 'plate';
      if (r > Lx) { const t2 = Math.asin(Lx / r); if (t2 < th) { th = t2; finish = 'wall'; } }
      if (2 * r > Hy) { const t3 = Math.acos(1 - Hy / r); if (t3 < th) { th = t3; finish = 'wall'; } }
      out.thEnd = th; out.tFin = tAcc + th / w; out.finish = finish;
      out.xEnd = r * Math.sin(th); out.yEnd = rot * r * (1 - Math.cos(th));
    }
    out.posAt = t => {
      if (t <= 0) return { x: -gate, y: 0, v: 0 };
      if (t < tAcc) {
        const p = F * t, v = rel ? p / Math.sqrt(m * m + (p / C.c) ** 2) : p / m;
        return { x: -gate + xAcc(t), y: 0, v };
      }
      const tt = Math.min(t, out.tFin) - tAcc;
      if (out.mode === 'line') return { x: s.v * tt, y: 0, v: t >= out.tFin ? 0 : s.v };
      const th2 = out.w * tt;
      return { x: out.r * Math.sin(th2), y: out.rot * out.r * (1 - Math.cos(th2)), v: t >= out.tFin ? 0 : s.v };
    };
    return out;
  }

  /* =====================================================================
     GAUSS GUN 1: multi-stage reluctance coil gun (Gauss gun screen)
     Each stage is a copper coil wound on the barrel. Switched on, its field
     magnetises the iron slug, which is pulled towards the coil's centre.
     Switched off at the right moment, the slug coasts on to the next coil;
     left on too long, the same pull drags the slug back ("suck-back").
       on-axis field of a thick solenoid (inner radius a1, outer a2, length ℓ):
         H(u) = NI/(2ℓ(a2−a1)) [ z₊ ln((a2+√(a2²+z₊²))/(a1+√(a1²+z₊²))) − z₋ ln(…z₋…) ],  z± = u ± ℓ/2
       slug magnetisation: M = min(χ_eff·H̄, M_s),  χ_eff = χ/(1 + N_d χ)  (N_d: demagnetising factor)
       force (pole model): F = μ0 M A [H(front) − H(back)]
     Electrical model: coil resistance R = ρ·(wire length)/A, Wheeler's multilayer
     inductance L, and either ideal switching or a real current rise I0(1 − e^(−t/τ)), τ = L/R.
     Not modelled: eddy currents, hysteresis, back-EMF of the moving slug, capacitor discharge shape.
     ===================================================================== */
  const SLUGS = {
    iron: { key: 'iron', name: 'Soft iron', rho: 7870, Bs: 2.15, chi: 5000, color: '#a7b0b8', note: 'Easy to magnetise and saturates at about 2.15 T: the best material for a coil gun.' },
    steel: { key: 'steel', name: 'Steel bolt', rho: 7850, Bs: 1.7, chi: 300, color: '#c4cbd2', note: 'Harder steel magnetises less easily and saturates a little lower than soft iron.' },
    ferrite: { key: 'ferrite', name: 'Ferrite', rho: 4800, Bs: 0.45, chi: 2000, color: '#55595f', note: 'A ceramic magnetic material: light and easy to magnetise, but it saturates at only about 0.45 T.' },
    aluminium: { key: 'aluminium', name: 'Aluminium', rho: 2700, Bs: 0, chi: 2.2e-5, color: '#dfe4e8', note: 'Not ferromagnetic (χ ≈ 0.00002), so a reluctance coil gun can hardly pull it.' },
  };
  const GG = {
    Lc: 0.03,          // coil length (m)
    a1: 0.0045,        // inner winding radius (m): barrel outer radius
    wireD: 0.00125,    // wire diameter with enamel (m): 1.0 mm² copper
    wireA: 1.0e-6,     // copper cross-section (m²)
    slugD: 0.006,      // slug diameter (m)
    spacing: 0.065,    // centre-to-centre distance between coils (m)
    x0: 0.06,          // centre of the first coil (m)
    lead: 0.008,       // light gate sits this far before each coil's entrance (m)
    mu: 0.2,           // sliding friction coefficient, slug in a plastic barrel
    cCu: 385,          // specific heat of copper, J/(kg·K)
    tMax: 0.25,        // simulated time limit (s)
    pulseMax: 0.02,    // safety timer: no coil stays on longer than this (s)
  };
  function demagFactor(m) {                 // prolate (m > 1) / oblate (m < 1) spheroid, aspect ratio m = length/diameter
    if (Math.abs(m - 1) < 1e-4) return 1 / 3;
    if (m > 1) { const r = Math.sqrt(m * m - 1); return (m / r * Math.log(m + r) - 1) / (m * m - 1); }
    const r = Math.sqrt(1 - m * m); return (1 - m / r * Math.acos(m)) / (1 - m * m);
  }
  function coilGeometry(turns) {
    const perLayer = Math.max(1, Math.floor(GG.Lc / GG.wireD));
    const layers = Math.ceil(turns / perLayer);
    const a2 = GG.a1 + layers * GG.wireD, am = (GG.a1 + a2) / 2, depth = a2 - GG.a1;
    const wireLen = turns * 2 * Math.PI * am;
    const R = C.rhoCu * wireLen / GG.wireA;
    const L = 31.6e-6 * turns * turns * am * am / (6 * am + 9 * GG.Lc + 10 * depth);   // Wheeler, multilayer (H)
    const mCu = C.densCu * wireLen * GG.wireA;
    return { turns, perLayer, layers, a1: GG.a1, a2, am, depth, wireLen, R, L, tau: L / R, mCu, heatCap: mCu * GG.cCu, Lc: GG.Lc };
  }
  // on-axis H per ampere at distance u (m) from the coil centre
  function coilH1(geo, u) {
    const { a1, a2, Lc, turns } = geo;
    const f = z => z * Math.log((a2 + Math.hypot(a2, z)) / (a1 + Math.hypot(a1, z)));
    return turns / (2 * Lc * (a2 - a1)) * (f(u + Lc / 2) - f(u - Lc / 2));
  }
  function coilTable(geo) {                  // H per ampere tabulated every 0.1 mm out to ±40 cm
    const du = 1e-4, n = 4000, tab = new Float64Array(2 * n + 1);
    for (let i = -n; i <= n; i++) tab[i + n] = coilH1(geo, i * du);
    return u => { const s = u / du + n; if (s <= 0 || s >= 2 * n) return 0; const i = Math.floor(s), f = s - i; return tab[i] * (1 - f) + tab[i + 1] * f; };
  }
  function coilgun(o) {
    const stages = Math.max(1, Math.min(12, Math.round(o.stages || 4)));
    const geo = coilGeometry(o.turns || 200), hh = coilTable(geo);
    const mat = SLUGS[o.material] || SLUGS.iron;
    const Ls = o.slugLen || 0.025, d = GG.slugD, A = Math.PI * d * d / 4, m = mat.rho * A * Ls;
    const Nd = demagFactor(Ls / d), chiEff = mat.chi / (1 + Nd * mat.chi), Ms = mat.Bs / C.mu0;
    const I0 = o.current || 0, real = !!o.real, tauOff = geo.tau / 6;
    const cut = Array.from({ length: stages }, (_, k) => (o.cutoff || 0) + (o.glitch ? o.glitch[k] || 0 : 0));
    const dead = o.dead || [];
    const xc = Array.from({ length: stages }, (_, k) => GG.x0 + k * GG.spacing);
    const muzzle = xc[stages - 1] + GG.Lc / 2 + 0.03;
    const st = xc.map((x, k) => ({ k, x, on: false, done: false, tOn: null, tOff: null, xOn: null, xOff: null, vOn: null, vOff: null, Ioff: 0, W: 0, Wneg: 0, Eres: 0, Ipk: 0, cutoff: cut[k], dead: !!dead[k], timedOut: false }));
    const Iof = (s, t) => {
      if (s.dead || s.tOn === null) return 0;
      if (!s.on && s.tOff === null) return 0;
      if (s.on) return real ? I0 * (1 - Math.exp(-(t - s.tOn) / geo.tau)) : I0;
      return real ? s.Ioff * Math.exp(-(t - s.tOff) / tauOff) : 0;
    };
    // magnetic force on the slug (centre x) at time t; also returns each coil's share
    const SIMP = [1, 4, 2, 4, 2, 4, 1], NS = SIMP.length - 1;
    const Ibuf = new Float64Array(stages), Fk = new Float64Array(stages);
    function force(x, t, per) {
      let any = false;
      for (let k = 0; k < stages; k++) { Ibuf[k] = Iof(st[k], t); if (Math.abs(Ibuf[k]) > 1e-9) any = true; }
      if (!any) { if (per) Fk.fill(0); return { F: 0, M: 0, Havg: 0, Hf: 0, Hb: 0 }; }
      const xb = x - Ls / 2, xf = x + Ls / 2;
      let Hs = 0;
      for (let i = 0; i <= NS; i++) {
        const xi = xb + Ls * i / NS; let H = 0;
        for (let k = 0; k < stages; k++) if (Ibuf[k]) H += Ibuf[k] * hh(xi - xc[k]);
        Hs += SIMP[i] * H;
      }
      const Havg = Hs / (3 * NS);
      const M = Math.sign(Havg) * Math.min(chiEff * Math.abs(Havg), Ms);
      let F = 0, Hf = 0, Hb = 0;
      for (let k = 0; k < stages; k++) {
        if (!Ibuf[k]) { if (per) Fk[k] = 0; continue; }
        const hf = Ibuf[k] * hh(xf - xc[k]), hb = Ibuf[k] * hh(xb - xc[k]);
        const f = C.mu0 * M * A * (hf - hb);
        if (per) Fk[k] = f;
        F += f; Hf += hf; Hb += hb;
      }
      return { F, M, Havg, Hf, Hb };
    }
    const fric = GG.mu * m * C.g;
    const acc = (x, v, t) => { const F = force(x, t, false).F; let a = F / m; if (Math.abs(v) > 1e-6) a -= Math.sign(v) * fric / m; return a; };

    let x = xc[0] - GG.Lc / 2 + 0.005 - Ls / 2, v = 0, t = 0;
    const x0 = x, samples = [], dt = o.dt || 1e-5, sampleEvery = 2;
    let step = 0, status = 'running', Fpk = 0, Fmin = 0, satMax = 0, stuckT = 0, exitT = null, exitV = null;
    const events = [];
    const switchOn = k => { const s = st[k]; if (s.on || s.done || s.dead) return; s.on = true; s.tOn = t; s.xOn = x; s.vOn = v; events.push({ t, type: 'on', k }); };
    const switchOff = (k, why) => {
      const s = st[k]; if (!s.on) return;
      s.Ioff = Iof(s, t); s.on = false; s.done = true; s.tOff = t; s.xOff = x; s.vOff = v; events.push({ t, type: 'off', k, why });
      if (why === 'timer') s.timedOut = true;
    };
    switchOn(0);
    while (status === 'running') {
      // light gates: switch on when the front passes the gate before each coil; switch off at the cut-off point
      for (let k = 0; k < stages; k++) {
        const s = st[k];
        if (!s.on && !s.done && k > 0 && x + Ls / 2 >= s.x - GG.Lc / 2 - GG.lead) switchOn(k);
        if (s.on && (x >= s.x + s.cutoff * GG.Lc / 2 || t - s.tOn >= GG.pulseMax)) switchOff(k, t - s.tOn >= GG.pulseMax ? 'timer' : 'gate');
        if (s.dead && !s.done && x >= s.x) { s.done = true; }
      }
      // RK4 step
      const k1v = acc(x, v, t), k1x = v;
      const k2v = acc(x + k1x * dt / 2, v + k1v * dt / 2, t + dt / 2), k2x = v + k1v * dt / 2;
      const k3v = acc(x + k2x * dt / 2, v + k2v * dt / 2, t + dt / 2), k3x = v + k2v * dt / 2;
      const k4v = acc(x + k3x * dt, v + k3v * dt, t + dt), k4x = v + k3v * dt;
      let nx = x + dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x), nv = v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      // friction cannot reverse the motion by itself
      const fr = force(x, t, true);
      if (Math.abs(fr.F) <= fric && ((v > 0 && nv < 0) || (v < 0 && nv > 0) || v === 0)) { nv = 0; nx = x; }
      // book-keeping: work done by each coil, resistive heating
      for (let k = 0; k < stages; k++) {
        const w = Fk[k] * (nx - x); st[k].W += w; if (w < 0) st[k].Wneg += w;
        const I = Iof(st[k], t); st[k].Eres += I * I * geo.R * dt; if (Math.abs(I) > st[k].Ipk) st[k].Ipk = Math.abs(I);
      }
      if (fr.F > Fpk) Fpk = fr.F; if (fr.F < Fmin) Fmin = fr.F;
      if (Ms > 0 && Math.abs(fr.M) / Ms > satMax) satMax = Math.abs(fr.M) / Ms;
      if (step % sampleEvery === 0) {
        const Is = []; for (let k = 0; k < stages; k++) Is.push(Iof(st[k], t));
        samples.push({ t, x, v, F: fr.F, M: fr.M, I: Is });
      }
      x = nx; v = nv; t += dt; step++;
      if (exitT === null && x - Ls / 2 >= muzzle) { exitT = t; exitV = v; }
      const anyOn = st.some(s => s.on) || (real && st.some(s => s.tOff !== null && Iof(s, t) > 1e-3 * I0));
      if (exitT !== null && !anyOn) status = 'fired';
      else if (x < x0 - 0.05) status = 'backwards';
      else if (Math.abs(v) < 1e-6 && !anyOn) { stuckT += dt; if (stuckT > 0.005 || st.every(s => s.done || s.dead)) status = 'stuck'; }
      else stuckT = 0;
      if (t >= GG.tMax) status = 'timeout';
    }
    for (const s of st) if (s.on) switchOff(s.k, 'end');
    const Ein = st.reduce((a, s) => a + s.Eres + 0.5 * geo.L * s.Ioff * s.Ioff + Math.max(0, s.W), 0);
    const K = 0.5 * m * v * v;
    const heat = st.map(s => s.Eres + 0.25 * geo.L * s.Ioff * s.Ioff);
    // speed gained from each stage: speed when the next coil switches on (or at the muzzle) minus speed when this coil switched on
    const vAt = xx => { if (!samples.length) return 0; let lo = 0, hi = samples.length - 1; if (xx <= samples[0].x) return samples[0].v; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].x < xx) lo = mid; else hi = mid; } return samples[hi].v; };
    for (let k = 0; k < stages; k++) {
      const s = st[k];
      s.vIn = s.vOn === null ? null : s.vOn;
      const next = st[k + 1];
      s.vOut = next && next.vOn !== null ? next.vOn : (k === stages - 1 ? (exitV !== null ? exitV : v) : null);
      s.gain = s.vIn !== null && s.vOut !== null ? s.vOut - s.vIn : null;
      s.Ein = s.Eres + 0.5 * geo.L * s.Ioff * s.Ioff + Math.max(0, s.W);
      s.heat = heat[k]; s.dT = heat[k] / geo.heatCap;
      s.suck = s.Wneg < -1e-6;
    }
    const B0 = C.mu0 * coilH1(geo, 0) * I0;
    return {
      geo, mat, m, A, Ls, d, Nd, chiEff, Ms, I0, real, tauOff, B0, stages, xc, muzzle, x0, st, samples, events, status,
      vExit: exitV !== null ? exitV : v, tExit: exitT, vEnd: v, xEnd: x, tEnd: t, K: 0.5 * m * (exitV !== null ? exitV : v) ** 2, Kend: K, Ein,
      eff: Ein > 0 ? 0.5 * m * (exitV !== null ? exitV : v) ** 2 / Ein : 0, Fpk, Fmin, satMax, vAt, hh,
      Hof: (u, I) => I * hh(u),
    };
  }

  /* =====================================================================
     GAUSS GUN 2: the classic magnet-and-steel-ball "Gauss rifle"
     Each stage: a neodymium magnet with k steel balls stuck to its far side.
     A ball rolling in is pulled into the magnet and gains the well depth U_c.
     The impact passes through the magnet and balls, and the last ball flies
     off. It only has to climb out of a shallow well, because it sits (2k−1)
     ball radii from the magnet face: U(d) = U_c (r/d)⁴.
       K_out = η (K_in + U_c) − U_c / (2k − 1)⁴,   η = 0.9 (energy passed on in the impact)
     U_c for each ball size is chosen so one stage reproduces K&J Magnetics'
     measured single-stage exit speeds.
     ===================================================================== */
  const MPH = 0.44704;
  const BALLS = [
    { key: 'b4', name: '¼ inch', inch: 0.25, magnet: 'D44 (¼ × ¼ inch)', mph: 6.2 },
    { key: 'b6', name: '⅜ inch', inch: 0.375, magnet: 'D66 (⅜ × ⅜ inch)', mph: 3.1 },
    { key: 'b8', name: '½ inch', inch: 0.5, magnet: 'D88 (½ × ½ inch)', mph: 2.9 },
    { key: 'b10', name: '⅝ inch', inch: 0.625, magnet: 'DAA (⅝ × ⅝ inch)', mph: 2.6 },
    { key: 'b12', name: '¾ inch', inch: 0.75, magnet: 'DCC (¾ × ¾ inch)', mph: 3.3 },
  ];
  const BALL_ETA = 0.9, BALL_P = 4, BALL_RHO = 7850;
  for (const b of BALLS) {
    b.r = b.inch * 0.0254 / 2; b.m = BALL_RHO * 4 / 3 * Math.PI * b.r ** 3; b.v1 = b.mph * MPH;
    b.Uc = 0.5 * b.m * b.v1 * b.v1 / (BALL_ETA - Math.pow(1 / 3, BALL_P));     // reproduces the measured speed with 2 balls
  }
  function gaussBalls(o) {
    const b = BALLS.find(x => x.key === o.ball) || BALLS[0];
    const n = Math.max(1, Math.min(10, Math.round(o.stages || 4))), k = Math.max(1, Math.min(5, Math.round(o.behind || 2)));
    const Uout = b.Uc * Math.pow(1 / (2 * k - 1), BALL_P);
    let K = 0.5 * b.m * (o.v0 || 0) ** 2;
    const stages = [];
    let status = 'fired';
    for (let i = 0; i < n; i++) {
      const Kin = K, Kimp = Kin + b.Uc, Kout = BALL_ETA * Kimp - Uout;
      const s = { i, Kin, vin: Math.sqrt(2 * Kin / b.m), Kimp, vimp: Math.sqrt(2 * Kimp / b.m), Kout: Math.max(0, Kout), stuck: Kout <= 0, lost: (1 - BALL_ETA) * Kimp, Uout };
      s.vout = Math.sqrt(2 * s.Kout / b.m); s.gain = s.vout - s.vin;
      stages.push(s);
      if (s.stuck) { status = 'stuck'; K = 0; break; }
      K = s.Kout;
    }
    const Kmax = (BALL_ETA * b.Uc - Uout) / (1 - BALL_ETA);       // the limit for infinitely many stages
    return { ball: b, n, k, Uc: b.Uc, Uout, eta: BALL_ETA, stages, status, K, v: Math.sqrt(2 * K / b.m), Kmax: Math.max(0, Kmax), vmax: Math.sqrt(2 * Math.max(0, Kmax) / b.m) };
  }
  // potential energy of a ball (radius r) whose centre is d from a magnet face: U = −U_c (r/d)⁴
  const ballU = (b, d) => -b.Uc * Math.pow(b.r / Math.max(d, b.r), BALL_P);

  /* ---------- Number formatting ---------- */
  const fixMinus = s => s.replace(/^-/, '−');
  function plain(x, sig = 3) {
    if (!isFinite(x)) return x > 0 ? '∞' : (x < 0 ? '−∞' : '—');
    if (x === 0) return '0';
    const ax = Math.abs(x);
    let mag = Math.floor(Math.log10(ax));
    let digits = Math.max(0, Math.min(8, sig - 1 - mag));
    // rounding can carry into the next power of ten (0.9999 → 1.000): drop a digit then
    if (Math.abs(parseFloat(x.toFixed(digits))) >= Math.pow(10, mag + 1)) digits = Math.max(0, digits - 1);
    if (ax >= 1000) return fixMinus(x.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }));
    return fixMinus(x.toFixed(digits));
  }
  function sci(x, sig = 3) {
    if (!isFinite(x)) return x > 0 ? '∞' : (x < 0 ? '−∞' : '—');
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e-3 && ax < 1e5) return plain(x, sig);
    let exp = Math.floor(Math.log10(ax));
    let ms = (x / Math.pow(10, exp)).toFixed(sig - 1);
    if (Math.abs(parseFloat(ms)) >= 10) { exp += 1; ms = (x / Math.pow(10, exp)).toFixed(sig - 1); }
    return fixMinus(ms) + ' × 10' + sup(exp);
  }
  const PREFIXES = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'μ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  function si(x, unit, sig = 3, allowed) {
    if (!isFinite(x)) return (x > 0 ? '∞ ' : '— ') + unit;
    if (x === 0) return '0 ' + unit;
    const list = allowed ? PREFIXES.filter(([, p]) => allowed.includes(p)) : PREFIXES;
    const ax = Math.abs(x);
    for (const [f, p] of list) {
      if (ax >= f * 0.99995) return plain(x / f, sig) + ' ' + p + unit;
    }
    const [f, p] = list[list.length - 1];
    return sci(x / f, sig) + ' ' + p + unit;
  }
  const energy = (J, sig = 3) => si(J / C.e, 'eV', sig, ['T', 'G', 'M', 'k', '']);
  function length(mtr, sig = 3) {
    const a = Math.abs(mtr);
    if (!isFinite(mtr)) return '∞';
    if (a >= 1000) return plain(mtr / 1000, sig) + ' km';
    if (a >= 1) return plain(mtr, sig) + ' m';
    if (a >= 0.01) return plain(mtr * 100, sig) + ' cm';
    if (a >= 0.001) return plain(mtr * 1000, sig) + ' mm';
    return sci(mtr * 1e6, sig) + ' μm';
  }

  return {
    C, PARTICLES, particle, sup, magnetField, magnetCurrent, coilEngineering, fieldRealism,
    kin, predictions, computeRun, wrap, posAt, createLive,
    MATERIALS, stopHeavy, rangeIn, traverse, rangeElectronAreal, restMeV, isLight,
    sprint,
    SLUGS, GG, demagFactor, coilGeometry, coilH1, coilgun, BALLS, gaussBalls, ballU, MPH,
    fmt: { plain, sci, si, energy, length },
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PHYS;
