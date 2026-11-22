/* =====================================================================
   Project Lorentz — real-life machines: the physics only (REAL).
   Pure functions in SI units with no page code, so they can be tested
   on their own (node test/test_realsim.js).
     maglev   – a Transrapid-type train pulled by a long-stator linear
                synchronous motor (the Shanghai airport line)
     pet      – a hospital cyclotron making fluorine-18 for PET scans
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

  return {
    C,
    ML, seats, mlSetup, mlThrust, mlDecel, mlStopDist, mlFreq, mlInit, mlStep, mlTrip,
    HESS, PET, yIdeal, petRun,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = REAL;
