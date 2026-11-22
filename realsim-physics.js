/* =====================================================================
   Project Lorentz — real-life machines: the physics only (REAL).
   Pure functions in SI units with no page code, so they can be tested
   on their own (node test/test_realsim.js).
     maglev   – a Transrapid-type train pulled by a long-stator linear
                synchronous motor (the Shanghai airport line)
     catapult – an aircraft-carrier catapult (EMALS or steam) and the
                first seconds of flight after the bow
     aurora   – an electron or proton on one of Earth's dipole field
                lines: the spiral, the magnetic mirror, the loss cone
                and the auroral acceleration region
     lhc      – a proton in CERN's Large Hadron Collider: the field
                that holds it on the ring (B = p/qρ), its speed, its
                laps per second and the collision energy
   Where each number comes from is listed with it here, and in the
   sources panel of each simulation (realsim.js).
   ===================================================================== */
const REAL = (() => {
  'use strict';
  const C = {
    c: 299792458, e: 1.602176634e-19, me: 9.1093837015e-31, mp: 1.67262192369e-27, g: 9.80665,
    kn: 1852 / 3600, lbf: 4.4482216152605, lb: 0.45359237, ft: 0.3048,
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /* =====================================================================
     MAGLEV — a long-stator linear synchronous motor
     Three-phase coils in the guideway make a magnetic field that travels
     along the track at v = 2τf (τ = pole pitch, f = frequency). The
     train's own magnets lock onto it, so the train moves exactly as fast
     as the wave: speed is set by frequency.
     ===================================================================== */
  const ML = {
    rho: 1.2,               // air density near the ground (kg/m³)
    tau: 0.26,              // stator pole pitch (m): the converters reach 270 Hz (WCTR 1992) at the 505 km/h top speed, τ = v/2f
    fMax: 270,              // highest converter frequency (Hz), WCTR 1992
    secMass: 60e3,          // one section (kg), assumed: the two-section Transrapid 06 weighed 120 t (Meisinger)
    secLen: 25.6,           // one section (m): the six-section Shanghai train is 153.6 m long
    paxMass: 80,            // one passenger with luggage (kg), assumed
    thrustPerSec: 44e3,     // pull of the motor on one section (N), estimated: fitted to Shanghai's published times
    power: 20e6,            // power the converters give one train (W), estimated: same fit
    cdaNose: 3.0,           // drag area of nose and tail (m²), estimate
    cdaSec: 0.83,           // extra drag area per section, mostly skin friction (m²), estimate
    lev: 1.7e3,             // levitation and guidance power per tonne (W), Transrapid
    vAuth: 505 / 3.6,       // highest authorised speed of the Shanghai trains (m/s)
    line: 30.5e3,           // the Shanghai line, Longyang Road to Pudong Airport (m)
    gap: 0.010,             // magnet-to-stator gap (m), held by the control system
    clearance: 0.15,        // guideway top to the underside of the train (m)
  };
  const seats = n => n >= 2 ? 56 + 78 + 110 * (n - 2) : 0;   // Shanghai seat plan: two end sections (56 + 78) and middle sections of 110

  // derived numbers for one set of choices p = { sections, pax, vSet, length, brake, thrustPerSec?, power?, aMax? }
  function mlSetup(p) {
    const n = p.sections, m = n * ML.secMass + p.pax * ML.paxMass;
    const Fmax = (p.thrustPerSec || ML.thrustPerSec) * n, P = p.power || ML.power;
    const CdA = ML.cdaNose + ML.cdaSec * n, k = 0.5 * ML.rho * CdA;
    const vBal = Math.min(Math.cbrt(P / k), Math.sqrt(Fmax / k));      // where the motor's best pull equals air drag
    const d = { n, m, Fmax, P, CdA, k, vBal, trainLen: n * ML.secLen, vSet: Math.min(p.vSet, ML.vAuth), L: p.length, brake: p.brake || 1.5, aMax: p.aMax || 1.5, vKnee: P / Fmax };
    // stopping distance from each speed when braking as hard as allowed: d(v) = ∫ u du / a(u)
    const du = 0.25, V = [0], S = [0];
    for (let u = du; u <= ML.vAuth + 10; u += du) { const um = u - du / 2; V.push(u); S.push(S[S.length - 1] + um * du / mlDecel(d, um)); }
    d.stopV = V; d.stopS = S;
    return d;
  }
  const mlThrust = (d, v) => Math.min(d.Fmax, d.P / Math.max(v, 1e-6));   // current limit at low speed, power limit above v = P/F
  const mlDecel = (d, v) => Math.min(d.brake, (mlThrust(d, v) + d.k * v * v) / d.m);   // braking: the same motor limits, plus air drag
  const mlFreq = v => v / (2 * ML.tau);
  const lerpTab = (X, Y, x) => { if (x <= X[0]) return Y[0]; let lo = 0, hi = X.length - 1; if (x >= X[hi]) return Y[hi]; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] <= x) lo = m; else hi = m; } return Y[lo] + (Y[hi] - Y[lo]) * (x - X[lo]) / (X[hi] - X[lo]); };
  const mlStopDist = (d, v) => lerpTab(d.stopV, d.stopS, v);
  function mlInit() { return { t: 0, x: 0, v: 0, a: 0, F: 0, D: 0, phase: 'ready', done: false, Edrive: 0, Ebrake: 0, Edrag: 0, Elev: 0, vmax: 0, marks: {} }; }
  // one time step of the train and its control: accelerate within the limits, hold the cruise speed,
  // brake (the motor run as a generator) so as to stop exactly at the end of the line
  function mlStep(st, d, dt) {
    if (st.done) return st;
    const v = st.v, rem = d.L - st.x, D = d.k * v * v;
    let F, a;
    if (st.phase !== 'brake' && v > 0.5 && rem <= mlStopDist(d, v) + v * dt) st.phase = 'brake';
    if (st.phase === 'brake') {
      // brake as hard as allowed, easing off a little if the train would stop short of the platform
      const vIdeal = lerpTab(d.stopS, d.stopV, Math.max(rem, 0)), full = mlDecel(d, v);
      const dec = v > vIdeal ? full : full * Math.pow(v / Math.max(vIdeal, 1e-6), 2);
      const Fb = clamp(d.m * dec - D, 0, mlThrust(d, v));
      F = -Fb; a = -(Fb + D) / d.m;
    } else {
      const Fa = mlThrust(d, v);
      if (v < d.vSet - 1e-3) {
        F = Math.min(Fa, d.m * d.aMax + D);
        a = (F - D) / d.m;
        if (v + a * dt > d.vSet) { a = (d.vSet - v) / dt; F = d.m * a + D; }
        st.phase = (Fa - D) / d.m < 0.02 ? 'top' : 'accel';
      } else { F = Math.min(D, Fa); a = (F - D) / d.m; st.phase = 'cruise'; }
    }
    const v2 = Math.max(0, v + a * dt), dx = (v + v2) / 2 * dt;
    st.x += dx; st.t += dt; st.v = v2; st.a = a; st.F = F; st.D = d.k * v2 * v2;
    if (F > 0) st.Edrive += F * dx; else st.Ebrake -= F * dx;
    st.Edrag += D * dx; st.Elev += ML.lev * d.m / 1000 * dt;
    if (v2 > st.vmax) st.vmax = v2;
    for (const [key, kmh] of [['k300', 300], ['k431', 431]]) if (!st.marks[key] && v2 >= kmh / 3.6 - 1e-6) st.marks[key] = { t: st.t, x: st.x };
    if (!st.marks.top && st.phase === 'cruise') st.marks.top = { t: st.t, x: st.x };
    if (st.phase === 'brake' && (v2 <= 0.02 || st.x >= d.L)) { st.v = 0; st.a = 0; st.F = 0; st.D = 0; st.done = true; st.phase = 'stopped'; }
    return st;
  }
  // a whole trip, quickly (no drawing): used for the timetable check
  function mlTrip(p, dt = 0.05) {
    const d = mlSetup(p), st = mlInit();
    while (!st.done && st.t < 7200) mlStep(st, d, dt);
    return { d, st };
  }

  /* =====================================================================
     CATAPULT — EMALS (a linear induction motor) or steam (a piston)
     on the deck: m dv/dt = F_catapult + T − D
     in the air:  m dV/dt = T − D − mg sin γ,  mV dγ/dt = L − mg cos γ
     ===================================================================== */
  const AIRCRAFT = {
    // published data: length, span (m), wing area S (m²), empty and maximum take-off mass (kg), full thrust (N)
    t45: { key: 't45', name: 'T-45C Goshawk', kind: 'training jet', len: 11.99, span: 9.39, S: 17.66, empty: 9394 * C.lb, mtow: 13500 * C.lb, thrust: 5527 * C.lbf, ab: false },
    fa18: { key: 'fa18', name: 'F/A-18E Super Hornet', kind: 'strike fighter', len: 18.31, span: 13.62, S: 46.45, empty: 14552, mtow: 66000 * C.lb, thrust: 2 * 22000 * C.lbf, ab: true },
    f35c: { key: 'f35c', name: 'F-35C Lightning II', kind: 'stealth fighter', len: 15.7, span: 13.1, S: 62.1, empty: 34800 * C.lb, mtow: 70000 * C.lb, thrust: 40000 * C.lbf, ab: true },
  };
  const CAT = {
    rho: 1.225,             // sea-level air (kg/m³)
    clMax: 1.8,             // maximum lift coefficient with flaps down (assumed, one value for all three jets)
    cd0: 0.05,              // drag coefficient with gear and flaps down (assumed)
    oswald: 0.8,            // span efficiency for induced drag (assumed)
    deckH: 20,              // flight deck above the sea (m), approximate
    emals: { key: 'emals', name: 'EMALS', stroke: 300 * C.ft, eff: 0.90, recharge: 45 },              // Wikipedia: 300 ft track, 90 % planned efficiency, recharge within 45 s
    steam: { key: 'steam', name: 'Steam', stroke: 310 * C.ft, eff: 0.05, maxE: 95e6, steamKg: 610, X: 2.5, n: 1.3 },  // ~310 ft track; about 5 %, about 95 MJ and 610 kg of steam per launch
    design: { m: 45000, v: 130 * C.kn },   // EMALS design case: 45,000 kg to 130 kn
  };
  const stallSpeed = (ac, m, clMax = CAT.clMax) => Math.sqrt(2 * m * C.g / (CAT.rho * ac.S * clMax));
  // the steam push falls as the steam expands: p ∝ (V₀/V)^n, here with a reservoir 2.5 times the cylinder volume (assumed)
  const steamShape = (x, L) => Math.pow(CAT.steam.X * L / (CAT.steam.X * L + x), CAT.steam.n);
  const steamInt = L => { const X = CAT.steam.X * L, n = CAT.steam.n; return X / (n - 1) * (1 - Math.pow(X / (X + L), n - 1)); };   // ∫ shape dx over the stroke

  // the launch: p = { ac, m, vSet (end speed along the deck, m/s), wod (wind over the deck, m/s), sys: 'emals' | 'steam', clMax?, deckH? }
  function launch(p) {
    const ac = p.ac, m = p.m, sys = CAT[p.sys], L = sys.stroke, T = ac.thrust;
    const clMax = p.clMax || CAT.clMax, deckH = p.deckH == null ? CAT.deckH : p.deckH;
    const Ddeck = v => 0.5 * CAT.rho * (v + p.wod) * (v + p.wod) * ac.S * CAT.cd0;   // on the deck: parasite drag (lift and wheel friction neglected)
    // two ways to drive it: p.vSet (the end speed the catapult aims for) or p.push (the average push of the catapult, N)
    const pushMode = p.push != null, aStar = pushMode ? 0 : p.vSet * p.vSet / (2 * L), I = steamInt(L);
    let F0 = 0, capped = false;
    const pushAt = (x, v) => p.sys === 'emals' ? (pushMode ? p.push : Math.max(0, m * aStar - T + Ddeck(v))) : F0 * steamShape(x, L);
    const stroke = record => {
      let x = 0, v = 0, t = 0, E = 0, Wd = 0, peak = 0, peakF = 0;
      const dt = 0.001, tr = [];
      while (x < L && t < 30) {
        const D = Ddeck(v), Fc = pushAt(x, v), a = (Fc + T - D) / m;
        if (a <= 0 && v <= 0) break;                              // too weak to move the jet at all
        const v2 = Math.max(0, v + a * dt);
        let dx = (v + v2) / 2 * dt, f = 1;
        if (x + dx > L) { f = (L - x) / dx; dx = L - x; }
        E += Fc * dx; Wd += D * dx; x += dx; t += dt * f; v += (v2 - v) * f;
        if (a > peak) peak = a; if (Fc > peakF) peakF = Fc;
        if (record && (!tr.length || t - tr[tr.length - 1].t >= 0.008 || x >= L)) tr.push({ t, x, v, a, F: Fc });
      }
      return { x, v, t, E, Wd, peak, peakF, tr };
    };
    if (p.sys === 'steam') {
      if (pushMode) F0 = p.push * L / I;          // the same average push, shaped the steam way: hardest at the start
      else {
        // pick the steam charge so that ½mv² = F₀·∫shape dx + T·L − (drag work), then respect the catapult's energy limit
        let Wd = 0;
        for (let k = 0; k < 3; k++) { F0 = Math.max(0, (0.5 * m * p.vSet * p.vSet - T * L + Wd) / I); Wd = stroke(false).Wd; }
      }
      if (F0 * I > CAT.steam.maxE) { F0 = CAT.steam.maxE / I; capped = true; }
    }
    const r = stroke(true);
    const done = r.x >= L - 1e-6;
    const fl = done ? fly({ ac, m, V0: r.v + p.wod, wod: p.wod, h0: deckH, clMax }) : null;
    return {
      sys, L, T, m, ac, vSet: pushMode ? r.v : p.vSet, push: pushMode ? p.push : r.E / L, wod: p.wod, deckH, clMax, capped, done,
      vEnd: r.v, tEnd: r.t, Ecat: r.E, Edrawn: r.E / sys.eff, Wdrag: r.Wd, peakG: r.peak / C.g, meanG: done ? r.v / r.t / C.g : 0,
      peakF: r.peakF, tr: r.tr, Vbow: done ? r.v + p.wod : 0, Vs: stallSpeed(ac, m, clMax), flight: fl,
      outcome: !done ? 'stuck' : fl.outcome,
    };
  }
  // after the bow: the pilot asks for a gentle climb (6°) but the wing can give no more than C_L,max
  function fly(o) {
    const { ac, m } = o, AR = ac.span * ac.span / ac.S, kInd = 1 / (Math.PI * CAT.oswald * AR);
    let V = o.V0, gam = 0, h = o.h0, x = 0, t = 0, minH = o.h0, clMaxHit = false, sinkT = 0;
    const dt = 0.005, tr = [{ t, x, h, V, gam, CL: 0 }], gT = 6 * Math.PI / 180, K = 1.2;
    let outcome = 'climb';
    while (t < 14) {
      const q = 0.5 * CAT.rho * V * V;
      const nCmd = Math.cos(gam) + V / C.g * K * (gT - gam);
      let CL = nCmd * m * C.g / (q * ac.S);
      if (CL >= o.clMax) { CL = o.clMax; clMaxHit = true; }
      if (CL < 0) CL = 0;
      const Lift = q * ac.S * CL, D = q * ac.S * (CAT.cd0 + kInd * CL * CL);
      const dV = (ac.thrust - D) / m - C.g * Math.sin(gam), dG = (Lift - m * C.g * Math.cos(gam)) / (m * V);
      V += dV * dt; gam += dG * dt; h += V * Math.sin(gam) * dt; x += (V * Math.cos(gam) - o.wod) * dt; t += dt;
      if (h < o.h0) sinkT += dt;
      if (h < minH) minH = h;
      if (t - tr[tr.length - 1].t >= 0.04) tr.push({ t, x, h, V, gam, CL });
      if (h <= 0) { h = 0; outcome = 'splash'; tr.push({ t, x, h, V, gam, CL }); break; }
      if (h > o.h0 + 70 && t > 2.5) { tr.push({ t, x, h, V, gam, CL }); break; }
    }
    if (outcome !== 'splash' && minH < o.h0 - 1) outcome = 'sink';
    return { tr, outcome, minH, sink: o.h0 - minH, clMaxHit, AR, sinkT };
  }
  // the lowest end-speed setting for which the jet does not settle below the deck (no extra safety margin);
  // with want = 'dry' instead: the lowest setting that merely keeps it out of the water
  // the weakest average push that still flies (same test as minSafeSetting, but on the push)
  function minSafePush(p, want = 'climb', max = 1.2e6) {
    const ok = r => want === 'climb' ? r.outcome === 'climb' : r.outcome !== 'splash' && r.outcome !== 'stuck';
    let lo = 0, hi = max;
    if (!ok(launch(Object.assign({}, p, { push: hi })))) return null;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (ok(launch(Object.assign({}, p, { push: mid })))) hi = mid; else lo = mid; }
    return hi;
  }
  function minSafeSetting(p, want = 'climb') {
    const ok = r => want === 'climb' ? r.outcome === 'climb' : r.outcome !== 'splash' && r.outcome !== 'stuck';
    let lo = 0, hi = 260 * C.kn;
    if (!ok(launch(Object.assign({}, p, { vSet: hi })))) return null;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (ok(launch(Object.assign({}, p, { vSet: mid })))) hi = mid; else lo = mid; }
    return hi;
  }

  // on land, with no catapult and no wind: how far the jet must roll at full power before its wing alone can carry it (V = stall speed).
  // Wheel friction is left out, so this is the least it could need; real runways add a margin.
  function runway(p) {
    const ac = p.ac, m = p.m, Vs = stallSpeed(ac, m, p.clMax || CAT.clMax), dt = 0.002;
    let x = 0, v = 0, t = 0;
    while (v < Vs && t < 300) { const a = (ac.thrust - 0.5 * CAT.rho * v * v * ac.S * CAT.cd0) / m; if (a <= 0) return { x: Infinity, t: Infinity, Vs }; const v2 = v + a * dt; x += (v + v2) / 2 * dt; v = v2; t += dt; }
    return { x, t, Vs };
  }

  /* =====================================================================
     AURORA — guiding-centre motion on a dipole field line
     The particle spirals round the field line (frequency f = |q|B/2πγm,
     radius r = p⊥/|q|B) while its centre slides along the line.
     μ = p⊥²/(2mB) stays constant, so where B grows the spiral tightens
     and the push along the line, dp∥/dt = −(μ/γ) dB/ds, sends it back:
     a magnetic mirror. Particles with small pitch angles reach the air.
     ===================================================================== */
  const EARTH = { RE: 6.371e6, B0: 3.0e-5 };   // mean radius; field at the magnetic equator, about 30,000 nT (60,000 nT at the poles)
  const AAR = { h1: 4000e3, h2: 12000e3 };      // auroral acceleration region, typically 4,000 to 12,000 km up
  const SPECIES = {
    e: { key: 'e', m: C.me, q: -C.e, name: 'electron', sym: 'e⁻' },
    p: { key: 'p', m: C.mp, q: C.e, name: 'proton', sym: 'p⁺' },
  };
  // the field line L (in Earth radii at the equator) at magnetic latitude lat:
  // r = L·RE·cos²λ, B = (B0/L³)·√(1 + 3 sin²λ)/cos⁶λ, ds/dλ = L·RE·cosλ·√(1 + 3 sin²λ)
  function dip(L, lat) {
    const s = Math.sin(lat), c = Math.cos(lat), S = Math.sqrt(1 + 3 * s * s), c2 = c * c, c6 = c2 * c2 * c2, Beq = EARTH.B0 / (L * L * L);
    return { r: L * EARTH.RE * c2, B: Beq * S / c6, dB: Beq * s / (c6 * c) * (3 * c2 / S + 6 * S), h: L * EARTH.RE * c * S };
  }
  const dipArc = (L, lat) => { const s = Math.sin(lat), r3 = Math.sqrt(3); return L * EARTH.RE / 2 * (s * Math.sqrt(1 + 3 * s * s) + Math.asinh(r3 * s) / r3); };
  const latAtAlt = (L, alt) => { const c2 = (EARTH.RE + alt) / (L * EARTH.RE); return c2 > 1 ? null : Math.acos(Math.sqrt(c2)); };
  // where an electron stops in the air, by its energy: about 0.1 keV in the F region (above 160 km), 1–10 keV in the E region (90–160 km),
  // over 40 keV in the D region (50–90 km) — Handbook of Geophysics 1985. The values in between are interpolated (approximate).
  const STOP = [[0.1, 230], [0.3, 185], [1, 150], [3, 125], [10, 105], [40, 88], [100, 80], [300, 70], [1000, 62]];
  function stopAlt(keV) {
    const x = Math.log10(clamp(keV, 0.1, 1000));
    for (let i = 0; i < STOP.length - 1; i++) {
      const x0 = Math.log10(STOP[i][0]), x1 = Math.log10(STOP[i + 1][0]);
      if (x <= x1) return 1e3 * (STOP[i][1] + (STOP[i + 1][1] - STOP[i][1]) * (x - x0) / (x1 - x0));
    }
    return 62e3;
  }
  const absorbAlt = (sp, keV) => sp.key === 'e' ? stopAlt(keV) : 100e3;   // protons: the usual 100 km
  const kinetic = (sp, keV) => {
    const K = keV * 1e3 * C.e, mc2 = sp.m * C.c * C.c, gam = 1 + K / mc2, p = Math.sqrt(K * K + 2 * K * mc2) / C.c;
    return { K, gam, p, v: p / (gam * sp.m) };
  };
  const lossCone = (L, alt) => { const lf = latAtAlt(L, alt); return lf == null ? Math.PI / 2 : Math.asin(Math.sqrt(dip(L, 0).B / dip(L, lf).B)); };
  // where a particle with equatorial pitch angle α mirrors in a pure dipole: B(λ) = B_eq / sin²α
  function mirrorLat(L, alpha) {
    if (alpha >= Math.PI / 2 - 1e-9) return 0;
    const target = 1 / Math.pow(Math.sin(alpha), 2);
    let lo = 0, hi = Math.PI / 2 - 1e-6;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2, c = Math.cos(mid), s = Math.sin(mid); if (Math.sqrt(1 + 3 * s * s) / Math.pow(c, 6) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  // the latitude on field line L where the field has grown to B (B ≥ B_eq)
  function latOfB(L, B) {
    const target = B / dip(L, 0).B;
    if (!(target > 1)) return 0;
    let lo = 0, hi = Math.PI / 2 - 1e-9;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2, c = Math.cos(mid), s = Math.sin(mid); if (Math.sqrt(1 + 3 * s * s) / Math.pow(c, 6) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  // textbook approximations for a dipole: bounce period 4·L·RE·T(y)/v with T(y) = 1.3802 − 0.3198(y + √y), y = sin α (exact at y = 0 and 1)
  const bounceT = (L, v, alpha) => { const y = Math.sin(alpha); return 4 * L * EARTH.RE * (1.3802 - 0.3198 * (y + Math.sqrt(y))) / v; };
  // drift once round the Earth: τ ≈ π|q|B0·RE²/(3·L·W) / (0.35 + 0.15 sin α), W = γmv²/2 (electrons go east, ions west)
  const driftT = (sp, L, kin, alpha) => Math.PI * Math.abs(sp.q) * EARTH.B0 * EARTH.RE * EARTH.RE / (3 * L * (kin.gam * sp.m * kin.v * kin.v / 2)) / (0.35 + 0.15 * Math.sin(alpha));

  // o = { sp: 'e' | 'p', keV, L, pitch (radians, at the equator), kV (voltage of the acceleration region), mlt (hours), dir (+1 = northward) }
  function particle(o) {
    const sp = SPECIES[o.sp], kin = kinetic(sp, o.keV), Beq = dip(o.L, 0).B, dir = o.dir || 1;
    const ppar = kin.p * Math.cos(o.pitch) * dir, pperp = kin.p * Math.sin(o.pitch);
    let acc = null;
    const la = latAtAlt(o.L, AAR.h1), lb = latAtAlt(o.L, AAR.h2);       // la: lower edge (higher latitude), lb: top edge
    if (o.kV > 0 && la != null) {
      const lo = lb == null ? 0 : lb, len = dipArc(o.L, la) - dipArc(o.L, lo);
      if (len > 1) acc = { lo, hi: la, E: o.kV * 1e3 / len, len };
    }
    const P = { sp, L: o.L, lat: 0, ppar, mu: pperp * pperp / (2 * sp.m * Beq), t: 0, keV0: o.keV, pitch0: o.pitch, kV: o.kV || 0, mlt: o.mlt || 0, acc,
      done: false, outcome: null, mirrors: [], foot: null, gam: kin.gam, K: kin.K, B: Beq, r: o.L * EARTH.RE };
    P.hAbs = absorbAlt(sp, o.keV);
    return P;
  }
  function deriv(P, lat, ppar) {
    const d = dip(P.L, lat), m = P.sp.m, mc = m * C.c;
    const pp2 = 2 * m * P.mu * d.B, p2 = ppar * ppar + pp2, gam = Math.sqrt(1 + p2 / (mc * mc));
    let E = 0;
    if (P.acc) { const al = Math.abs(lat); if (al >= P.acc.lo && al <= P.acc.hi) E = -Math.sign(lat) * P.acc.E; }   // points up, away from the Earth
    return { dlat: ppar / (gam * m * d.h), dppar: -(P.mu / gam) * d.dB / d.h + P.sp.q * E, gam, d, pp2, p2, E };
  }
  // advance to time tEnd with RK4 steps sized to the motion; stops at the atmosphere
  function advance(P, tEnd, maxSteps = 40000) {
    let n = 0;
    while (!P.done && P.t < tEnd - 1e-12 && n++ < maxSteps) {
      const k1 = deriv(P, P.lat, P.ppar), p = Math.sqrt(k1.p2);
      let dt = Math.min(tEnd - P.t, 0.004 / Math.max(Math.abs(k1.dlat), 1e-30), 0.01 * p / Math.max(Math.abs(k1.dppar), 1e-300));
      // near the ground take small steps, so the point where it meets the air is found precisely
      const alt = k1.d.r - EARTH.RE, drdt = -2 * P.L * EARTH.RE * Math.cos(P.lat) * Math.sin(P.lat) * k1.dlat;
      if (drdt < 0 && alt - P.hAbs < 3e6) dt = Math.min(dt, Math.max(0.25 * (alt - P.hAbs), 300) / -drdt);
      // end a step on the edge of the acceleration region, so the electric field is switched on and off exactly there
      if (P.acc && k1.dlat !== 0) for (const e of [P.acc.lo, P.acc.hi, -P.acc.lo, -P.acc.hi]) {
        const tb = (e - P.lat) / k1.dlat;
        if (tb > 1e-12 && tb < dt) dt = tb * (1 + 1e-6) + 1e-12;
      }
      dt = Math.max(dt, 1e-10);
      const rPrev = k1.d.r, tPrev = P.t;
      const k2 = deriv(P, P.lat + 0.5 * dt * k1.dlat, P.ppar + 0.5 * dt * k1.dppar);
      const k3 = deriv(P, P.lat + 0.5 * dt * k2.dlat, P.ppar + 0.5 * dt * k2.dppar);
      const k4 = deriv(P, P.lat + dt * k3.dlat, P.ppar + dt * k3.dppar);
      const lat1 = P.lat + dt / 6 * (k1.dlat + 2 * k2.dlat + 2 * k3.dlat + k4.dlat);
      const pp1 = P.ppar + dt / 6 * (k1.dppar + 2 * k2.dppar + 2 * k3.dppar + k4.dppar);
      if (P.ppar !== 0 && pp1 !== 0 && Math.sign(pp1) !== Math.sign(P.ppar)) {
        // a mirror point: p∥ passed through zero. There all the momentum is across B, so B = p²/2mμ, which fixes the latitude
        const f = P.ppar / (P.ppar - pp1), Bm = k1.p2 / (2 * P.sp.m * P.mu), side = Math.sign(lat1 || P.lat) || 1;
        P.mirrors.push({ t: P.t + dt * f, lat: side * latOfB(P.L, Bm) });
      }
      P.lat = lat1; P.ppar = pp1; P.t += dt;
      const s = deriv(P, P.lat, P.ppar);
      P.gam = s.gam; P.K = (s.gam - 1) * P.sp.m * C.c * C.c; P.B = s.d.B; P.r = s.d.r; P.pp2 = s.pp2; P.E = s.E;
      P.hAbs = absorbAlt(P.sp, P.K / C.e / 1e3);
      if (s.d.r <= EARTH.RE + P.hAbs) {
        // land exactly on the absorbing height: the foot of the field line there, at the interpolated time
        const rA = EARTH.RE + P.hAbs, lf = latAtAlt(P.L, P.hAbs), f = clamp((rPrev - rA) / Math.max(rPrev - s.d.r, 1e-9), 0, 1);
        if (lf != null) P.lat = Math.sign(P.lat) * lf;
        P.t = tPrev + dt * f; P.r = rA; P.done = true; P.outcome = 'aurora';
        P.foot = { lat: P.lat, h: P.hAbs, keV: P.K / C.e / 1e3, t: P.t };
      }
    }
    return P;
  }
  // live values of a particle: speed, pitch angle, spiral radius and frequency where it is now
  function state(P) {
    const s = deriv(P, P.lat, P.ppar), m = P.sp.m, p = Math.sqrt(s.p2), pperp = Math.sqrt(s.pp2), aq = Math.abs(P.sp.q);
    return { B: s.d.B, r: s.d.r, alt: s.d.r - EARTH.RE, gam: s.gam, p, v: p / (s.gam * m), pitch: Math.atan2(pperp, P.ppar), fg: aq * s.d.B / (2 * Math.PI * s.gam * m),
      rg: pperp / (aq * s.d.B), vpar: P.ppar / (s.gam * m), vperp: pperp / (s.gam * m), keV: (s.gam - 1) * m * C.c * C.c / C.e / 1e3, E: s.E };
  }
  /* =====================================================================
     LHC — the same rule as the cyclotron, r = p/qB, with the radius fixed
     ===================================================================== */
  const LHC = {
    circ: 26658.883,        // ring circumference (m), LHC design report
    rho: 2803.95,           // bending radius inside the dipole magnets (m), design report
    mp: 0.93827208816,      // proton rest energy (GeV)
    Einj: 450,              // energy at injection from the SPS (GeV)
    Erun: 6800,             // Run 3 beam energy (GeV)
    Edesign: 7000,          // design beam energy (GeV), reached with 8.33 T
    Bnom: 8.33,             // nominal dipole field at 7 TeV (T)
    Bult: 9.0,              // "ultimate" dipole field the magnets were designed to reach (T)
    dipoles: 1232,          // main dipole magnets, each 14.3 m of field
    cavities: 8, Vcav: 2e6, frf: 400.8e6,   // RF cavities per beam, each 2 MV at about 400 MHz
    rate: 1.5e9,            // collisions per second in ATLAS and in CMS (Run 3)
    higgs: 1e-9,            // a Higgs boson is made in about one collision in a billion
  };
  const BRHO = 1e9 / C.c;   // magnetic rigidity Bρ (T·m) of a singly charged particle per GeV/c of momentum: 3.3356
  // a proton of total energy E (GeV) on a bend of radius rho (m)
  function lhcBeam(E, rho = LHC.rho) {
    const m = LHC.mp, gam = E / m, p = Math.sqrt(Math.max(E * E - m * m, 0)), beta = p / E;
    const defic = 1 / (gam * gam * (1 + beta));       // 1 − β without rounding trouble: (1 − β)(1 + β) = 1/γ²
    return {
      E, gam, p, beta, defic, slower: C.c * defic,     // how many m/s slower than light
      B: p * BRHO / rho,                                // B = p/(qρ)
      frev: beta * C.c / LHC.circ,                      // laps per second
      headOn: 2 * E,                                    // two equal beams head-on: √s = 2E
      fixed: Math.sqrt(2 * m * m + 2 * E * m),          // the same beam on a proton at rest: √s = √(2m² + 2Em)
      cycR: B0 => p * BRHO / B0,                        // radius a cyclotron magnet of field B0 would need
    };
  }

  const colourAt = alt => alt >= 200e3 ? 'red' : alt >= 150e3 ? 'redgreen' : alt >= 95e3 ? 'green' : alt >= 85e3 ? 'greenpink' : 'faint';

  /* =====================================================================
     The solar wind and the magnetosphere (aurora, version 2: "From the Sun")
     Units here: distances in Earth radii (R_E), fields in nT, speeds in km/s, density per cm³.
     Scene axes: +x away from the Sun (midnight), +y dawn, +z north; the Sun is far off along −x.
     ===================================================================== */
  const SW = { AU: 1.495978707e11, mu0: 4e-7 * Math.PI, l0: 7, ecc: 0.73 };
  // NOAA SWPC: Kp → magnetic latitude of the equatorward edge of the aurora at local midnight
  const KP_LAT = [66, 64.5, 62.4, 60.4, 58.3, 56.3, 54.2, 52.2, 50.1, 48];
  const kpLat = kp => { const k = clamp(kp, 0, 9), i = Math.min(8, Math.floor(k)), f = k - i; return KP_LAT[i] + (KP_LAT[i + 1] - KP_LAT[i]) * f; };
  function solarWind(o) {
    const v = o.v, n = o.n, bz = o.bz, by = o.by || 0;
    const Dp = C.mp * n * 1e6 * Math.pow(v * 1e3, 2) * 1e9;                                // nPa: ρv² = n·m_p·v² (n per cm³ → per m³, v km/s → m/s)
    const r0 = (10.22 + 1.29 * Math.tanh(0.184 * (bz + 8.14))) * Math.pow(Dp, -1 / 6.6);     // Shue et al. (1998)
    const alpha = (0.58 - 0.007 * bz) * (1 + 0.024 * Math.log(Dp));
    const rbs = 15.02 * Math.pow(Dp, -1 / 6.55);                                            // Jelínek et al. (2012)
    const BT = Math.hypot(by, bz), th = BT > 0 ? Math.acos(clamp(bz / BT, -1, 1)) : 0;       // clock angle: 0 north, π south
    const dphi = Math.pow(v, 4 / 3) * Math.pow(BT, 2 / 3) * Math.pow(Math.sin(th / 2), 8 / 3); // Newell et al. (2007)
    const kpRaw = 0.05 + 2.244e-4 * dphi + 2.844e-6 * Math.sqrt(n) * v * v;                   // Newell et al. (2008)
    const kp = clamp(kpRaw, 0, 9), latEq = kpLat(kp);
    const eps = 4 * Math.PI / SW.mu0 * v * 1e3 * Math.pow(BT * 1e-9, 2) * Math.pow(Math.sin(th / 2), 4) * Math.pow(SW.l0 * EARTH.RE, 2);   // Akasofu ε, W
    const rCF = Math.pow(2 * EARTH.B0 * EARTH.B0 / (SW.mu0 * Dp * 1e-9), 1 / 6);              // pressure balance, the field doubled at the nose
    const Bmp = 2 * EARTH.B0 / Math.pow(r0, 3) * 1e9;                                          // nT just inside the nose
    const rg = C.mp * v * 1e3 / (C.e * Bmp * 1e-9);                                             // m: a wind proton's circle there
    return { v, n, bz, by, Dp, r0, alpha, rbs, BT, th, dphi, kpRaw, kp, latEq, eps, rCF, Bmp, rg,
      tTravel: SW.AU / (v * 1e3), flux: n * v * 1e5, latCusp: 78 - 4 * kp / 9 };
  }
  // a monitor at L1 (NOAA's SOLAR-1 since June 2026, DSCOVR before it), about 1.5 million km towards the Sun:
  // the wind it measures reaches Earth this much later (s)
  SW.L1 = 1.5e9;
  const warnTime = v => SW.L1 / (v * 1e3);
  // a planet as big as Earth with no magnetic field of its own (Venus, Venus Express): the bow shock about 1,900 km above the
  // ground at the nose, and the wind held off only about 300 km up, by the charged top of the atmosphere
  const NOFIELD = { stop: 300e3, shock: 1900e3 };
  function noField(w) {
    const r0 = 1 + NOFIELD.stop / EARTH.RE, rbs = 1 + NOFIELD.shock / EARTH.RE;
    return Object.assign({}, w, { nofield: true, r0, rbs, alpha: 0.62, kp: 0, eps: 0 });
  }
  // the magnetopause (Shue) and the bow shock (a conic, Fairfield's average shape) at angle θ from the Sun line
  const mpR = (w, th) => w.r0 * Math.pow(2 / (1 + Math.cos(th)), w.alpha);
  const bsR = (w, th) => w.rbs * (1 + SW.ecc) / (1 + SW.ecc * Math.cos(th));
  const thetaOf = (x, y, z) => Math.acos(clamp(-x / Math.max(1e-9, Math.hypot(x, y, z)), -1, 1));
  const insideMP = (w, x, y, z) => Math.hypot(x, y, z) < mpR(w, thetaOf(x, y, z));
  // a simple model field for drawing field lines: Earth's dipole, an image dipole on the Sun side that squeezes the day side
  // (Chapman–Ferraro: it doubles the field at the nose), and a current sheet in the tail that stretches the night side
  function fieldModel(w, o = {}) {
    const B0 = EARTH.B0 * 1e9, xi = -2 * w.r0;
    const BT = (o.bt || 30) * Math.sqrt(w.Dp / 2) * (1 + 0.06 * w.kp), X0 = (o.x0 ?? 7) - 0.3 * w.kp, wd = o.wd || 2.5, D = o.d || 1;
    const dip = (x, y, z, out) => { const r2 = x * x + y * y + z * z, r5 = r2 * r2 * Math.sqrt(r2); out[0] += -3 * B0 * x * z / r5; out[1] += -3 * B0 * y * z / r5; out[2] += B0 * (r2 - 3 * z * z) / r5; };
    const B = (x, y, z) => {
      const o = [0, 0, 0];
      dip(x, y, z, o); dip(x - xi, y, z, o);
      const s = (x - X0) / wd, f = 0.5 * (1 + Math.tanh(s)), ch = Math.cosh(s), fp = 0.5 / (wd * ch * ch), zz = z / D;
      o[0] += -BT * f * Math.tanh(zz);
      o[2] += BT * fp * D * Math.log(Math.cosh(clamp(zz, -30, 30)));       // keeps div B = 0
      return o;
    };
    return { B, BT, X0, D, xi };
  }
  // follow a field line from p0, along B (dir = +1) or against it (−1); stops on the Earth, at the magnetopause or the edge
  function traceLine(w, fm, p0, dir, o = {}) {
    const xmax = o.xmax || 70, ymax = o.ymax || 45, pts = [p0.slice()];
    let p = p0.slice(), end = 'max', len = 0;
    const f = q => { const b = fm.B(q[0], q[1], q[2]), m = Math.hypot(b[0], b[1], b[2]) || 1; return [dir * b[0] / m, dir * b[1] / m, dir * b[2] / m]; };
    for (let i = 0; i < 4000; i++) {
      const r = Math.hypot(p[0], p[1], p[2]), h = clamp(0.04 * r, 0.02, 0.45);
      const k1 = f(p), k2 = f(p.map((c, j) => c + h / 2 * k1[j])), k3 = f(p.map((c, j) => c + h / 2 * k2[j])), k4 = f(p.map((c, j) => c + h * k3[j]));
      p = p.map((c, j) => c + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])); len += h;
      const rn = Math.hypot(p[0], p[1], p[2]);
      if (rn <= 1) { const t = 1 / rn; pts.push(p.map(c => c * t)); end = 'earth'; break; }
      if (rn > 1.5 && !insideMP(w, p[0], p[1], p[2])) { pts.push(p); end = 'mp'; break; }
      if (Math.abs(p[0]) > xmax || Math.abs(p[1]) > ymax || Math.abs(p[2]) > ymax) { pts.push(p); end = 'box'; break; }
      const last = pts[pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) > clamp(0.06 * rn, 0.05, 0.8)) pts.push(p);
    }
    return { pts, end, len };
  }
  // the foot of a field line: magnetic latitude lat (rad), magnetic local time h (hours: 0 midnight, 6 dawn, 12 noon)
  const footAt = (lat, h, r = 1.02) => { const a = h / 24 * 2 * Math.PI; return [r * Math.cos(lat) * Math.cos(a), r * Math.cos(lat) * Math.sin(a), r * Math.sin(lat)]; };

  /* =====================================================================
     PET medicine: a hospital cyclotron makes fluorine-18 by ¹⁸O(p,n)¹⁸F, the medicine (FDG) is made, driven to the
     hospital and given to patients, all while it decays with a 109.77-minute half-life.
     ===================================================================== */
  // ideal saturation thick-target yield of ¹⁸F from ¹⁸O-water (96.7 % ¹⁸O), MBq per µA, against proton energy in MeV:
  // Hess et al., Radiochim. Acta 89 (2001) 357, table 4 (EXFOR D4095003)
  const HESS = [[2.4, 1.07], [2.6, 3.73], [2.8, 12.7], [3.0, 19.9], [3.2, 52.7], [3.4, 71.5], [3.6, 81.3], [3.8, 124], [4.0, 164], [4.5, 471], [5.0, 836], [5.5, 1632], [6.0, 2209], [6.5, 2677], [7.0, 3036], [7.5, 3730], [8.0, 4222], [8.5, 4962], [9.0, 5513], [9.5, 6345], [10.0, 6871], [10.5, 7495], [11.0, 8080], [11.5, 8736], [12.0, 9157], [12.5, 9760], [13.0, 10140], [13.5, 10672], [14.0, 11004], [14.5, 11407], [15.0, 11765], [16.0, 12423], [17.0, 12978], [18.0, 13454], [19.0, 13871], [20.0, 14228], [21.0, 14547], [22.0, 14853], [24.0, 15532], [26.0, 16060], [28.0, 16555], [30.0, 17132]];
  const PET = { half: 109.77 * 60, eth: 2.574, dose: 370e6, synthT: 25 * 60, synthY: 0.72, slot: 20 * 60, day: 8 * 3600 };
  PET.lam = Math.LN2 / PET.half;
  function yIdeal(E) {                                   // Bq per µA at saturation
    if (E <= HESS[0][0]) return 0;
    if (E >= 30) return HESS[HESS.length - 1][1] * 1e6;
    for (let i = 1; i < HESS.length; i++) if (E <= HESS[i][0]) { const [e0, y0] = HESS[i - 1], [e1, y1] = HESS[i]; return (y0 + (y1 - y0) * (E - e0) / (e1 - e0)) * 1e6; }
    return 0;
  }
  // the whole day: o = { E (MeV), I (µA), tb (s of beam), eff (target efficiency 0–1), td (s of driving) }
  function petRun(o) {
    const lam = PET.lam, Asat = yIdeal(o.E) * o.eff * o.I;
    const Aeob = Asat * (1 - Math.exp(-lam * o.tb));
    const Asyn = Aeob * PET.synthY;                                   // reported yield, decay during synthesis included
    const t1 = o.tb, t2 = t1 + PET.synthT, t3 = t2 + o.td;
    const Aarr = Asyn * Math.exp(-lam * o.td);
    const pats = []; let A = Aarr, t = t3;
    while (pats.length < Math.floor(PET.day / PET.slot)) {
      const At = A * Math.exp(-lam * (t - (pats.length ? pats[pats.length - 1].t : t3)));
      if (At < PET.dose) break;
      pats.push({ t, before: At }); A = At - PET.dose;
      t += PET.slot;
    }
    const left = A * Math.exp(-lam * (Math.max(t3, (pats.length ? pats[pats.length - 1].t : t3)) - (pats.length ? pats[pats.length - 1].t : t3)));
    const protons = o.I * 1e-6 / C.e, perProton = Asat / Math.max(protons, 1);   // at saturation: made per second = decaying per second
    return { Asat, Aeob, Asyn, Aarr, t1, t2, t3, pats, doses: Math.floor(Aarr / PET.dose), left, protons, perProton,
      activity(tt) {                                                // Bq in the hands of whoever has it at time tt
        if (tt <= t1) return Asat * (1 - Math.exp(-lam * tt));
        if (tt <= t2) { const f = (tt - t1) / PET.synthT; return Aeob * Math.exp(-lam * (tt - t1)) * (1 - f) + Asyn * Math.exp(-lam * (tt - t2)) * f; }
        if (tt <= t3 || !pats.length) return Asyn * Math.exp(-lam * (tt - t2));
        let Ab = Aarr, tb = t3;
        for (const q of pats) { if (tt < q.t) break; Ab = q.before - PET.dose; tb = q.t; }
        return Ab * Math.exp(-lam * (tt - tb));
      } };
  }

  /* =====================================================================
     PET scanner: antimatter in the hospital. A positron from the tracer slows down within about a millimetre, meets
     an electron and both are annihilated into two 511 keV photons (E = mc² of each particle). The pair was nearly at
     rest, so the photons leave back to back; a ring of crystals catches both and the line between the two crystals
     passes (almost) through the point. Many lines cross where the tracer collects.
     Positron emitters: β⁺ fraction, maximum energy and mean range in water from J Nucl Med 62 (2021) table 1;
     the range's blur (FWHM) from Moses, Nucl Instrum Meth A 648 (2011) S236, table 1.
     Resolution (Moses 2011, eq. 2): Γ = 1.25 √((d/2)² + s² + (0.0044 R)² + b²), d crystal width, s positron range,
     R ring radius, b decoding blur (d/3 for light-shared block detectors, 0 for one crystal per sensor).
     ===================================================================== */
  const PETS = {
    mec2: 510.99895,                    // keV, the electron's rest energy (CODATA): the energy of each photon
    mu: 0.096,                          // 1/cm, 511 keV photons in water (narrow beam; Burger et al. 2002)
    acolFWHM: 0.5 * Math.PI / 180,      // the two photons are 180° ± 0.25° apart: 0.5° FWHM, which blurs a line by 0.0044 R
    recon: 1.25,                        // what reconstruction adds (Moses 2011)
    rangeXY: 0.75,                      // the mean 3-D range seen in the slice: × about π/4 for a random direction
    ISO: {
      f18: { key: 'f18', name: 'fluorine-18', sym: '¹⁸F', beta: 0.968, emax: 0.634, range: 0.66, s: 0.54, half: 109.77 * 60, use: 'FDG: the sugar that shows cancer' },
      c11: { key: 'c11', name: 'carbon-11', sym: '¹¹C', beta: 0.998, emax: 0.960, range: 1.27, s: 0.92, half: 20.4 * 60, use: 'brain and prostate tracers; needs a cyclotron next door' },
      ga68: { key: 'ga68', name: 'gallium-68', sym: '⁶⁸Ga', beta: 0.889, emax: 1.90, range: 3.56, s: 2.83, half: 67.7 * 60, use: 'from a generator: prostate and neuroendocrine tumours' },
      rb82: { key: 'rb82', name: 'rubidium-82', sym: '⁸²Rb', beta: 0.954, emax: 3.38, range: 7.49, s: 6.14, half: 1.26 * 60, use: 'blood flow in the heart muscle' },
    },
  };
  function petRes(o) {                  // o = { d (mm), R (mm), iso, block }
    const iso = PETS.ISO[o.iso] || PETS.ISO.f18;
    const det = o.d / 2, rng = iso.s, acol = 0.0044 * o.R, dec = o.block ? o.d / 3 : 0;
    return { det, rng, acol, dec, fwhm: PETS.recon * Math.sqrt(det * det + rng * rng + acol * acol + dec * dec) };
  }
  const tofDx = ps => C.c * ps * 1e-12 / 2 * 1e3;          // mm: Δx = cΔt/2, how well the arrival times place the point on its line
  const petAtt = Lcm => Math.exp(-PETS.mu * Lcm);            // both photons escape: e^(−μ·L), L the whole chord through the body
  // a chest slice (mm; x to the patient's left as on a scan, y up): body, lungs, heart, spine and a tumour in a lymph node between the lungs,
  // in front of the heart, where about 3 cm of plain tissue surrounds it (so "the tissue around it" is plain tissue)
  // up: how much FDG each part takes up, relative to soft tissue; mu: 1/cm at 511 keV (lung about 0.3 of water, bone 0.15)
  function petPhantom(o = {}) {
    const D = o.D ?? 10, U = o.U ?? 5;
    return {
      body: { x: 0, y: 0, a: 170, b: 110, up: 1, mu: 0.096 },
      parts: [
        { k: 'lung', x: -68, y: 12, a: 48, b: 68, up: 0.3, mu: 0.03 },
        { k: 'lung', x: 68, y: 12, a: 48, b: 68, up: 0.3, mu: 0.03 },
        { k: 'heart', x: 26, y: -8, a: 42, b: 36, up: 3, mu: 0.096 },
        { k: 'spine', x: 0, y: -80, a: 15, b: 15, up: 1, mu: 0.15 },
        { k: 'tumour', x: 0, y: 62, a: D / 2, b: D / 2, up: U, mu: 0.096 },
      ],
    };
  }
  const inEll = (p, x, y) => { const u = (x - p.x) / p.a, v = (y - p.y) / p.b; return u * u + v * v <= 1; };
  function petAt(ph, x, y) {            // the part at (x, y): the last listed part that contains the point
    if (!inEll(ph.body, x, y)) return null;
    let q = ph.body; for (const p of ph.parts) if (inEll(p, x, y)) q = p;
    return q;
  }
  // μ·length summed along the line from (x, y) in direction (ux, uy), for a distance L (mm), exactly: each ellipse cuts the
  // line in one stretch, and on each piece between cuts the material is the last listed part that covers it (as petAt)
  function chordMu(ph, x, y, ux, uy, L) {
    const cut = q => {
      const X = x - q.x, Y = y - q.y, a2 = q.a * q.a, b2 = q.b * q.b, A = ux * ux / a2 + uy * uy / b2, B = 2 * (X * ux / a2 + Y * uy / b2), Cc = X * X / a2 + Y * Y / b2 - 1, d = B * B - 4 * A * Cc;
      if (d <= 0) return null; const r = Math.sqrt(d), t0 = Math.max(0, (-B - r) / (2 * A)), t1 = Math.min(L, (-B + r) / (2 * A));
      return t1 > t0 ? [t0, t1] : null;
    };
    const body = cut(ph.body); if (!body) return 0;
    const segs = []; for (const q of ph.parts) { const c = cut(q); if (c) segs.push([q, c]); }
    const ts = [body[0], body[1]]; for (const [, c] of segs) for (const t of c) if (t > body[0] && t < body[1]) ts.push(t);
    ts.sort((u, v) => u - v);
    let m = 0;
    for (let k = 0; k + 1 < ts.length; k++) {
      const t0 = ts[k], t1 = ts[k + 1]; if (t1 <= t0) continue;
      const tm = (t0 + t1) / 2; let mu = ph.body.mu; for (const [q, c] of segs) if (tm >= c[0] && tm <= c[1]) mu = q.mu;
      m += mu * (t1 - t0) / 10;
    }
    return m;
  }
  // μL (dimensionless) for a photon leaving (x, y) in direction (ux, uy), until it is out of the body
  const petMuL = (ph, x, y, ux, uy) => chordMu(ph, x, y, ux, uy, 1e4);
  // μL along the whole line between two crystals (x1, y1) → (x2, y2): what the CT of a PET/CT measures for each line.
  // Both photons of a pair escape with probability e^(−μL) wherever on the line the pair met, so counting every line
  // e^(+μL) times puts back the pairs the body absorbed (attenuation correction).
  function petChordMuL(ph, x1, y1, x2, y2) { const L = Math.hypot(x2 - x1, y2 - y1); return L > 0 ? chordMu(ph, x1, y1, (x2 - x1) / L, (y2 - y1) / L, L) : 0; }
  // how much of each spatial frequency f (cycles/mm) survives the blurs this model draws, before any reconstruction:
  // the two crystals (a triangle d/2 wide at half height: sinc²(fd/2)), the 0.25° tilt (Gaussian, 0.0044R FWHM),
  // shared-light decoding (Gaussian, d/3) and the positron's trip (2-D exponential, mean m: 1/√(1 + (2πfm)²))
  function petMTF(o, f) {
    const iso = PETS.ISO[o.iso] || PETS.ISO.f18, m = PETS.rangeXY * iso.range, sa = 0.0044 * o.R / 2.3548, sb = (o.block ? o.d / 3 : 0) / 2.3548;
    const x = Math.PI * f * o.d / 2, sinc = x === 0 ? 1 : Math.sin(x) / x;
    return sinc * sinc * Math.exp(-2 * Math.PI * Math.PI * (sa * sa + sb * sb) * f * f) / Math.sqrt(1 + (2 * Math.PI * f * m) ** 2);
  }
  // one decay, followed to the ring: o = { ph, iso, R (mm), d (mm), tof (ps FWHM or 0), pairs (true: positron; false: one photon only) }
  // rnd: a function giving uniform numbers in [0, 1)
  function petEvent(o, rnd) {
    const iso = PETS.ISO[o.iso] || PETS.ISO.f18, ph = o.ph;
    let maxUp = 1; for (const p of ph.parts) maxUp = Math.max(maxUp, p.up);
    let x, y, q;
    for (let k = 0; k < 400; k++) { x = (rnd() * 2 - 1) * ph.body.a; y = (rnd() * 2 - 1) * ph.body.b; q = petAt(ph, x, y); if (q && rnd() * maxUp < q.up) break; q = null; }
    if (!q) return null;
    const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const Nc = Math.max(8, Math.round(2 * Math.PI * o.R / o.d));          // crystals around the ring, each d wide
    const crystalOf = a => { const k = Math.floor(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * Nc); return { k, a: (k + 0.5) / Nc * 2 * Math.PI }; };
    const hit = (x0, y0, ux, uy) => { const b = x0 * ux + y0 * uy, c0 = x0 * x0 + y0 * y0 - o.R * o.R, t = -b + Math.sqrt(b * b - c0); return { t, x: x0 + ux * t, y: y0 + uy * t }; };
    if (!o.pairs) {                       // no antimatter: one photon, one flash, no line
      const a = 2 * Math.PI * rnd(), ux = Math.cos(a), uy = Math.sin(a);
      const esc = Math.exp(-petMuL(ph, x, y, ux, uy)) > rnd();
      const h = hit(x, y, ux, uy), c = crystalOf(Math.atan2(h.y, h.x));
      return { single: true, x0: x, y0: y, part: q.k || 'body', esc, c1: c, h1: h };
    }
    // the positron wanders off (2-D projection of a 3-D path) before it meets an electron
    const pr = -iso.range * Math.log(1 - rnd() * 0.999) * PETS.rangeXY, pa = 2 * Math.PI * rnd();
    const ax = x + pr * Math.cos(pa), ay = y + pr * Math.sin(pa);
    const th = 2 * Math.PI * rnd(), dev = gauss() * PETS.acolFWHM / 2.3548;
    const u1 = [Math.cos(th), Math.sin(th)], u2 = [Math.cos(th + Math.PI + dev), Math.sin(th + Math.PI + dev)];
    const muL = petMuL(ph, ax, ay, u1[0], u1[1]) + petMuL(ph, ax, ay, u2[0], u2[1]);
    const esc = Math.exp(-muL) > rnd();
    const h1 = hit(ax, ay, u1[0], u1[1]), h2 = hit(ax, ay, u2[0], u2[1]);
    // shared-light blocks: the light of one crystal spreads over its neighbours and the electronics sometimes pick the wrong one.
    // Each end is misplaced by a Gaussian of FWHM d√2/3 along the ring, so the middle of the line moves by d/3 (Moses' b)
    const dec = () => (o.block ? gauss() * (o.d * Math.SQRT2 / 3) / 2.3548 / o.R : 0);
    const c1 = crystalOf(Math.atan2(h1.y, h1.x) + dec()), c2 = crystalOf(Math.atan2(h2.y, h2.x) + dec());
    // time of flight: the difference of the two arrival times, measured with a blur of `tof` ps FWHM
    let dt = (h1.t - h2.t) / 1e3 / C.c;                     // s
    if (o.tof > 0) dt += gauss() * o.tof * 1e-12 / 2.3548;
    return { single: false, x0: x, y0: y, ax, ay, pr, part: q.k || 'body', esc, muL, c1, c2, h1, h2, dt, th, dev };
  }

  /* ---- the picture: every line back-projected, then a filter (filtered back-projection) ---- */
  function fft1(re, im, n, off, stride, inv) {
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const a = off + i * stride, b = off + j * stride; let t = re[a]; re[a] = re[b]; re[b] = t; t = im[a]; im[a] = im[b]; im[b] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = off + (i + k) * stride, b = off + (i + k + len / 2) * stride;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  function fft2(re, im, M, inv) { for (let r = 0; r < M; r++) fft1(re, im, M, r * M, 1, inv); for (let c = 0; c < M; c++) fft1(re, im, M, c, M, inv); }
  // e^(−x)·I0(x) (Abramowitz & Stegun 9.8.1–2)
  function i0e(x) {
    if (x <= 3.75) { const t = (x / 3.75) ** 2; return Math.exp(-x) * (1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813)))))); }
    const t = 3.75 / x; return (0.39894228 + t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281 + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377)))))))) / Math.sqrt(x);
  }
  // o = { NG: pixels across, HW: half-width (mm), win: smoothing cut-off as a fraction of the pixels' highest frequency }
  function petImager(o = {}) {
    const NG = o.NG || 128, HW = o.HW || 200, PX = 2 * HW / NG, M = 2 * NG, WIN = o.win ?? 0.85;
    const bp = new Float32Array(NG * NG), rec = new Float32Array(NG * NG), re = new Float64Array(M * M), im = new Float64Array(M * M);
    // without time of flight a line could have come from anywhere along it, so the lines are first sorted by angle and offset
    // (a sinogram: NA angles × NT offsets DT apart), each row is filtered, then smeared back (filter, then back-project)
    const NA = 256, NT = 2 * NG, DT = PX / 2, NF = 2 * NT;
    const sino = new Float32Array(NA * NT), qf = new Float32Array(NA * NT), fr = new Float64Array(NF), fi = new Float64Array(NF), cosA = new Float64Array(NA), sinA = new Float64Array(NA);
    for (let k = 0; k < NA; k++) { cosA[k] = Math.cos(k * Math.PI / NA); sinA[k] = Math.sin(k * Math.PI / NA); }
    let cfg = null, filt = null, filtKey = '', ramp1 = null, roiT = [], roiB = [], expKey = '', expVal = null;
    // a Hann window: noise lives at the highest frequencies, so they are rolled off smoothly to zero at WIN × the pixels' limit
    const win = f => { const fc = WIN * 0.5 / PX; return f >= fc ? 0 : 0.5 * (1 + Math.cos(Math.PI * f / fc)); };
    const freq = (u, n) => (u < n / 2 ? u : u - n) / (n * PX);
    // c = { ph, R (mm), d (mm), iso, block, tof (ps) }: a new scan
    function setup(c) {
      cfg = c; bp.fill(0); rec.fill(0); sino.fill(0);
      // what a doctor compares: the cancer (a disc its own size) against plain tissue in a ring 8–22 mm beyond its edge
      const T = c.ph.parts.find(q => q.k === 'tumour'); roiT = []; roiB = [];
      for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) {
        const x = -HW + (i + 0.5) * PX, y = HW - (j + 0.5) * PX, r = Math.hypot(x - T.x, y - T.y);
        if (r <= Math.max(T.a, PX * 0.75)) roiT.push(j * NG + i);
        else if (r >= T.a + 8 && r <= T.a + 22 && petAt(c.ph, x, y) === c.ph.body) roiB.push(j * NG + i);
      }
    }
    // one line between two crystal centres, counted e^(μL) times (attenuation correction from the CT); with time of flight
    // only near where the clocks put the pair, as a Gaussian of the clocks' width
    function add(e) {
      const R0 = cfg.R, x1 = R0 * Math.cos(e.c1.a), y1 = R0 * Math.sin(e.c1.a), x2 = R0 * Math.cos(e.c2.a), y2 = R0 * Math.sin(e.c2.a);
      const L = Math.hypot(x2 - x1, y2 - y1); if (L < 1) return;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L, w = Math.exp(petChordMuL(cfg.ph, x1, y1, x2, y2));
      if (!(cfg.tof > 0)) {
        // the line's normal (−uy, ux) at angle φ in [0, π), and its signed distance t from the centre; nearest angle, shared offset
        let phi = Math.atan2(ux, -uy), t = -uy * x1 + ux * y1;
        if (phi < 0) { phi += Math.PI; t = -t; }
        let k = Math.round(phi / Math.PI * NA); if (k >= NA) { k -= NA; t = -t; }
        const u = (t + HW) / DT - 0.5, i0 = Math.floor(u), f = u - i0;
        if (i0 >= 0 && i0 < NT) sino[k * NT + i0] += w * (1 - f);
        if (i0 + 1 >= 0 && i0 + 1 < NT) sino[k * NT + i0 + 1] += w * f;
        return;
      }
      const dx = tofDx(cfg.tof), sg = dx / 2.3548;
      const sMid = L / 2 + C.c * 1e3 * e.dt / 2;               // from crystal 1; past the middle when crystal 2 fired first
      const s0 = Math.max(0, sMid - 3 * sg), s1 = Math.min(L, sMid + 3 * sg), step = PX * 0.7;
      for (let s = s0; s <= s1; s += step) {
        const x = x1 + ux * s, y = y1 + uy * s; if (x < -HW || x >= HW || y < -HW || y >= HW) continue;
        bp[(((HW - y) / PX) | 0) * NG + (((x + HW) / PX) | 0)] += w * Math.exp(-((s - sMid) ** 2) / (2 * sg * sg));
      }
    }
    // With time of flight each line's Gaussian (σ) meets the clocks' own error (also σ), so back-projection turns a point
    // into (1/r)·e^(−r²/4σ²). Its 2-D Fourier transform is πσ√(2π)·e^(−x)I0(x) with x = 2π²f²σ², and the filter divides by
    // that (at high frequency this is a ramp again). Back-projection first, then this filter on the whole picture.
    function filter() {
      const key = `${cfg.tof}`; if (filt && filtKey === key) return filt;
      filt = new Float32Array(M * M); filtKey = key;
      const sg = tofDx(cfg.tof) / 2.3548;
      for (let v = 0; v < M; v++) for (let u = 0; u < M; u++) {
        const f = Math.hypot(freq(u, M), freq(v, M));
        filt[v * M + u] = win(f) / (Math.PI * sg * Math.sqrt(2 * Math.PI) * i0e(2 * Math.PI * Math.PI * f * f * sg * sg));
      }
      return filt;
    }
    const contrast = get => { let a = 0, b = 0; for (const k of roiT) a += get(k); for (const k of roiB) b += get(k); return roiT.length && roiB.length && b > 0 ? (a / roiT.length) / (b / roiB.length) : null; };
    // without time of flight: the ramp |f| on each sinogram row, built from its sampled kernel (Kak & Slaney) so that the
    // zero frequency comes out right, times the same window; then every row is smeared back across the picture
    function fbp() {
      if (!ramp1) {
        ramp1 = new Float64Array(NF); const h = new Float64Array(NF), hi = new Float64Array(NF);
        for (let n = 0; n < NF; n++) { const m = n < NF / 2 ? n : n - NF; h[n] = m === 0 ? 1 / (4 * DT * DT) : (m % 2 ? -1 / (m * m * Math.PI * Math.PI * DT * DT) : 0); }
        fft1(h, hi, NF, 0, 1, false);
        for (let k = 0; k < NF; k++) ramp1[k] = h[k] * DT * win(Math.abs(k < NF / 2 ? k : k - NF) / (NF * DT));
      }
      for (let a = 0; a < NA; a++) {
        fr.fill(0); fi.fill(0); for (let t = 0; t < NT; t++) fr[t] = sino[a * NT + t];
        fft1(fr, fi, NF, 0, 1, false); for (let k = 0; k < NF; k++) { fr[k] *= ramp1[k]; fi[k] *= ramp1[k]; } fft1(fr, fi, NF, 0, 1, true);
        for (let t = 0; t < NT; t++) qf[a * NT + t] = fr[t] / NF;
      }
      rec.fill(0);
      for (let a = 0; a < NA; a++) {
        const ca = cosA[a], sa = sinA[a], row = a * NT, du = ca * PX / DT;
        for (let j = 0; j < NG; j++) {
          const y = HW - (j + 0.5) * PX; let u = ((-HW + 0.5 * PX) * ca + y * sa + HW) / DT - 0.5;
          for (let i = 0; i < NG; i++, u += du) { const i0 = Math.floor(u), f = u - i0; if (i0 >= 0 && i0 + 1 < NT) rec[j * NG + i] += qf[row + i0] * (1 - f) + qf[row + i0 + 1] * f; }
        }
      }
      for (let k = 0; k < NG * NG; k++) rec[k] *= Math.PI / NA;
      return contrast(k => rec[k]);
    }
    function reconstruct() {
      if (!(cfg.tof > 0)) return fbp();
      re.fill(0); im.fill(0); const o2 = (M - NG) / 2;
      for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) re[(j + o2) * M + i + o2] = bp[j * NG + i];
      fft2(re, im, M, false); const H = filter(); for (let k = 0; k < M * M; k++) { re[k] *= H[k]; im[k] *= H[k]; } fft2(re, im, M, true);
      for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) rec[j * NG + i] = re[(j + o2) * M + i + o2] / (M * M);
      return contrast(k => rec[k]);
    }
    // the blur of the picture: full width at half maximum of its line-spread function (scanner × pixel × window in frequency)
    function lsf(c) {
      const fc = WIN * 0.5 / PX, n = 400, df = fc / n;
      const prof = x => { let s = 0; for (let k = 0; k < n; k++) { const f = (k + 0.5) * df, a = Math.PI * f * PX; s += Math.sin(a) / a * petMTF(c, f) * win(f) * Math.cos(2 * Math.PI * f * x); } return s; };
      const top = prof(0); let lo = 0, hi = 40;
      for (let it = 0; it < 32; it++) { const mid = (lo + hi) / 2; if (prof(mid) > top / 2) lo = mid; else hi = mid; }
      return lo + hi;
    }
    // what this picture shows with endless pairs, so no noise: the true sugar map averaged over each pixel, blurred by the
    // scanner (petMTF) and the same window, then measured in the same two regions. A 20 cm patch round the cancer is enough.
    function expected() {
      const key = [cfg.ph.parts.map(q => `${q.x},${q.y},${q.a},${q.b},${q.up}`).join(';'), cfg.R, cfg.d, cfg.iso, cfg.block].join('|');
      if (key === expKey) return expVal;
      const NC = 64, MC = 128, SS = 4, T = cfg.ph.parts.find(q => q.k === 'tumour');
      const i0 = Math.floor((T.x + HW) / PX) - NC / 2, j0 = Math.floor((HW - T.y) / PX) - NC / 2, o2 = (MC - NC) / 2;
      const er = new Float64Array(MC * MC), ei = new Float64Array(MC * MC);
      for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
        let s = 0;
        for (let b = 0; b < SS; b++) for (let a = 0; a < SS; a++) { const q = petAt(cfg.ph, -HW + (i0 + i + (a + 0.5) / SS) * PX, HW - (j0 + j + (b + 0.5) / SS) * PX); if (q) s += q.up; }
        er[(j + o2) * MC + i + o2] = s / (SS * SS);
      }
      fft2(er, ei, MC, false);
      for (let v = 0; v < MC; v++) for (let u = 0; u < MC; u++) { const f = Math.hypot(freq(u, MC), freq(v, MC)), H = petMTF(cfg, f) * win(f), k = v * MC + u; er[k] *= H; ei[k] *= H; }
      fft2(er, ei, MC, true);
      const ratio = contrast(k => { const i = (k % NG) - i0, j = ((k / NG) | 0) - j0; return i >= 0 && i < NC && j >= 0 && j < NC ? er[(j + o2) * MC + i + o2] / (MC * MC) : 0; });
      expKey = key; expVal = { ratio, fwhm: lsf(cfg) };
      return expVal;
    }
    return { NG, HW, PX, WIN, bp, rec, setup, add, reconstruct, expected, get nT() { return roiT.length; }, get nB() { return roiB.length; } };
  }

  /* =====================================================================
     Electron microscope: the aurora's spiral, put to work. Electrons sped up through V volts have a de Broglie
     wavelength λ = h/p, about 200,000 times shorter than light's. Glass cannot bend them, but a magnetic field can.
     The simplest magnetic lens (Busch, 1926) is a long coil with a uniform field B along the axis: an electron leaving
     the axis at angle a circles with radius r = p sin a/(eB) and period T = 2πγm/(eB), whatever its sideways speed,
     while it moves along the axis at v cos a. After one turn every electron is back on the axis, a distance
     L = v cos a·T further on: a focus. For this lens the spherical aberration is Cs = L/2 (wide electrons focus early),
     and the finest detail it can show is Scherzer's d = 0.66 Cs^¼ λ^¾.
     ===================================================================== */
  const EMS = {
    h: 6.62607015e-34,
    Bmax: 2.1,                          // T: about the most an iron pole piece gives (soft iron saturates)
    eye: 0.2e-3,                        // m: about the finest detail the eye sees at reading distance (assumed)
    light: { lambda: 550e-9, NA: 1.4 }, // green light, the best oil-immersion objective
  };
  function emElectron(kV) {
    const T = kV * 1e3 * C.e, E0 = C.me * C.c * C.c, gam = 1 + T / E0;
    const p = Math.sqrt(T * T + 2 * T * E0) / C.c, v = C.c * Math.sqrt(1 - 1 / (gam * gam));
    return { T, gam, p, v, beta: v / C.c, lambda: EMS.h / p };
  }
  const emLight = (l = EMS.light) => l.lambda / (2 * l.NA);                              // Abbe: d = λ/(2 NA)
  const emFocusB = (kV, L) => 2 * Math.PI * emElectron(kV).p / (C.e * L);               // the field that brings electrons back to the axis after one turn, a distance L on
  const emCs = L => L / 2;
  const emScherzer = (kV, Cs) => 0.66 * Math.pow(Cs, 0.25) * Math.pow(emElectron(kV).lambda, 0.75);
  // an electron that leaves the axis at angle a in direction phi, after time t in the field B: { x, y, z } in metres
  function emPath(kV, B, a, phi, t) {
    const el = emElectron(kV), w = C.e * B / (el.gam * C.me), vp = el.v * Math.sin(a), vz = el.v * Math.cos(a);
    // an electron (charge −e) in B along +z turns anticlockwise seen from +z: the sideways velocity turns at +ω
    return { x: vp / w * (Math.sin(phi + w * t) - Math.sin(phi)), y: -vp / w * (Math.cos(phi + w * t) - Math.cos(phi)), z: vz * t, r: 2 * vp / w * Math.abs(Math.sin(w * t / 2)) };
  }
  function emHelix(kV, B, a) {
    const el = emElectron(kV), T = 2 * Math.PI * el.gam * C.me / (C.e * B);
    return { T, r: el.p * Math.sin(a) / (C.e * B), pitch: el.v * Math.cos(a) * T, el };
  }
  // how far from the axis electrons at angle a are when they reach a screen at distance Ld (blur radius, m)
  function emBlur(kV, B, a, Ld) { const el = emElectron(kV), w = C.e * B / (el.gam * C.me), t = Ld / (el.v * Math.cos(a)); return 2 * el.v * Math.sin(a) / w * Math.abs(Math.sin(w * t / 2)); }

  return {
    C,
    PETS, petRes, tofDx, petAtt, petPhantom, petAt, petMuL, petChordMuL, petMTF, petEvent, petImager, fft2, i0e,
    EMS, emElectron, emLight, emFocusB, emCs, emScherzer, emPath, emHelix, emBlur,
    ML, seats, mlSetup, mlThrust, mlDecel, mlStopDist, mlFreq, mlInit, mlStep, mlTrip,
    AIRCRAFT, CAT, stallSpeed, steamShape, steamInt, launch, fly, minSafeSetting, minSafePush, runway,
    LHC, BRHO, lhcBeam,
    EARTH, AAR, SPECIES, dip, dipArc, latAtAlt, stopAlt, absorbAlt, kinetic, lossCone, mirrorLat, bounceT, driftT, particle, deriv, advance, state, colourAt,
    HESS, PET, yIdeal, petRun,
    SW, KP_LAT, kpLat, solarWind, mpR, bsR, thetaOf, insideMP, fieldModel, traceLine, footAt, warnTime, NOFIELD, noField,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = REAL;
