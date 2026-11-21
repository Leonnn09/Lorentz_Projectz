/* =====================================================================
   Project Lorentz — a small 3-D renderer on the 2-D canvas (CL.V3).
   Orbit camera, perspective projection with near-plane clipping, flat
   shading, painter's algorithm (far to near), lines, spheres, glows and
   labels, plus the 3D key and the orbit controls every screen shares.
   World axes: x and y on the floor, z up. Units are whatever the screen
   uses (metres everywhere in this app).
   ===================================================================== */
(() => {
  'use strict';
  const { clamp, TAU, haloText, reduceMotion, store } = CL;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const LIGHT = norm([-0.35, -0.55, 0.76]);           // a lamp above, a little in front and to the left
  function perp(ax) {                                  // two unit vectors at right angles to ax
    const t = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = norm(cross(ax, t)); return [u, cross(ax, u)];
  }
  // clip a camera-space polygon to z ≥ near (Sutherland–Hodgman, one plane)
  function clipPoly(c, near) {
    let inside = true; for (const q of c) if (q[2] < near) { inside = false; break; }
    if (inside) return c;
    const out = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length], ia = a[2] >= near, ib = b[2] >= near;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (near - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]); }
    }
    return out;
  }
  function clipSeg(a, b, near) {
    if (a[2] < near && b[2] < near) return null;
    if (a[2] >= near && b[2] >= near) return [a, b];
    const t = (near - a[2]) / (b[2] - a[2]), m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near];
    return a[2] < near ? [m, b] : [a, m];
  }
  const rgbStr = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const toRGB = c => Array.isArray(c) ? c : c[0] === '#' ? (n => [(n >> 16) & 255, (n >> 8) & 255, n & 255])(parseInt(c.slice(1), 16)) : c.split(',').map(Number);

  class Scene {
    constructor(home) {
      this.home = Object.assign({ yaw: -0.9, pitch: 0.45, dist: 4, target: [0, 0, 0], fov: 46, minDist: 0.05, maxDist: 100 }, home);
      this.back = []; this.items = []; this.front = []; this.labels = []; this.groups = {}; this.order = null;
      this.fog = null; this.bg = [7, 10, 9];
      this.reset();
    }
    reset() { const h = this.home; this.yaw = h.yaw; this.pitch = h.pitch; this.zoom = 1; this.pan = [0, 0, 0]; this.spin = false; this.lastT = 0; this.intro = 0; this.look = [0, 0]; this.rc = null; }
    // tilt in from straight above (the flat view) to the 3-D angle
    tiltIn() { if (reduceMotion) return; this.intro = 1e-6; this.yaw0 = -Math.PI / 2; this.pitch0 = 1.5; }
    setHome(h) { Object.assign(this.home, h); }
    // the screen's camera target and distance can move every frame (e.g. to follow a projectile)
    begin(ctx, W, H, o = {}) {
      this.ctx = ctx; this.W = W; this.H = H;
      this.back.length = 0; this.items.length = 0; this.front.length = 0; this.labels.length = 0; for (const k in this.groups) this.groups[k].length = 0; this.order = null;
      const now = performance.now(), dt = this.lastT ? Math.min(0.05, (now - this.lastT) / 1000) : 0; this.lastT = now;
      if (this.spin && !this.dragging) this.yaw += dt * 0.16;
      let yaw = this.yaw, pitch = this.pitch;
      let tgt = add(o.target || this.home.target, this.pan), dist = clamp((o.dist || this.home.dist) / this.zoom, this.home.minDist, this.home.maxDist);
      this.driven = o.yaw !== undefined;
      if (this.driven) {                      // a chase camera the screen drives; dragging looks around and springs back
        if (!this.dragging) { const k = Math.exp(-dt * 2.4); this.look[0] *= k; this.look[1] *= k; }
        if (!this.rc) this.rc = { yaw: this.yawNow ?? this.yaw, pitch: this.pitchNow ?? this.pitch, dist: this.dist || dist, tgt: (this.tgt || tgt).slice(), t: 0 };
        const rc = this.rc; rc.t += dt;
        const ease = rc.t < 1.1, k = 1 - Math.exp(-dt / (ease ? 0.32 : (o.smooth ?? 0.12)));
        rc.yaw += Math.atan2(Math.sin(o.yaw - rc.yaw), Math.cos(o.yaw - rc.yaw)) * k; rc.pitch += (o.pitch - rc.pitch) * k; rc.dist += (dist - rc.dist) * k;
        rc.tgt = ease ? rc.tgt.map((v, i) => v + (tgt[i] - v) * k) : tgt;
        yaw = rc.yaw + this.look[0]; pitch = clamp(rc.pitch + this.look[1], -1.3, 1.5); dist = rc.dist; tgt = rc.tgt;
      } else this.rc = null;
      if (!this.driven && this.intro > 0) {
        this.intro = this.dragging ? 0 : Math.min(1, this.intro + dt / 1.3);
        const u = 1 - Math.pow(1 - this.intro, 3);
        let dy = Math.atan2(Math.sin(this.yaw - this.yaw0), Math.cos(this.yaw - this.yaw0));
        yaw = this.yaw0 + dy * u; pitch = this.pitch0 + (this.pitch - this.pitch0) * u;
        if (this.intro >= 1) this.intro = 0;
      }
      this.yawNow = yaw; this.pitchNow = pitch;
      const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
      this.eye = [tgt[0] + cp * cy * dist, tgt[1] + cp * sy * dist, tgt[2] + sp * dist];
      this.Fw = [-cp * cy, -cp * sy, -sp]; this.Rw = [-sy, cy, 0]; this.Uw = cross(this.Rw, this.Fw);
      this.f = 0.5 * Math.min(W * 0.85, H * 1.05) / Math.tan((o.fov || this.home.fov) * Math.PI / 360);
      this.cx = W / 2; this.cy = H / 2 + (o.lift || 0) * H;
      this.near = Math.max(1e-5, dist * 0.02); this.dist = dist; this.tgt = tgt;
      this.lightS = [dot(LIGHT, this.Rw), -dot(LIGHT, this.Uw)];
      this.fog = o.fog === false ? null : { near: dist * (o.fogNear || 0.7), far: dist * (o.fogFar || 3.2), max: o.fogMax ?? 0.75 };
      // backdrop: a dark studio with a soft glow where the horizon is, and a vignette
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a100d'); g.addColorStop(0.5, '#0c1310'); g.addColorStop(1, '#040605');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const hy = clamp(this.cy - this.f * Math.tan(pitch), -H, 2 * H);
      const hz = ctx.createLinearGradient(0, hy - H * 0.35, 0, hy + H * 0.2);
      hz.addColorStop(0, 'rgba(70,96,84,0)'); hz.addColorStop(0.7, 'rgba(70,96,84,0.10)'); hz.addColorStop(1, 'rgba(70,96,84,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H);
      this.vignette = true;
      return this;
    }
    cam(p) { const d = sub(p, this.eye); return [dot(d, this.Rw), dot(d, this.Uw), dot(d, this.Fw)]; }
    scr(q) { return [this.cx + this.f * q[0] / q[2], this.cy - this.f * q[1] / q[2]]; }
    project(p) { const q = this.cam(p); if (q[2] <= this.near) return null; const s = this.scr(q); return { x: s[0], y: s[1], z: q[2], k: this.f / q[2] }; }
    fogK(z) { const f = this.fog; return f ? clamp((z - f.near) / (f.far - f.near), 0, 1) * f.max : 0; }
    shadeRGB(rgb, n, st, z, P) {
      let k = 1, sp = 0;
      if (st.shade !== false && n) {
        const amb = st.amb ?? 0.36; k = amb + (1 - amb) * Math.max(0, dot(n, LIGHT));
        const spec = st.spec ?? 0.1;
        if (spec > 0 && P) { const Hh = norm(add(LIGHT, norm(sub(this.eye, P)))); sp = spec * Math.pow(Math.max(0, dot(n, Hh)), st.shin ?? 22) * 255; }
      }
      let r = rgb[0] * k + sp, g = rgb[1] * k + sp, b = rgb[2] * k + sp;
      if (st.emit) { const e = toRGB(st.emit), a = st.emitA ?? 1; r += e[0] * a; g += e[1] * a; b += e[2] * a; }
      const fk = st.noFog ? 0 : this.fogK(z);
      if (fk > 0) { r += (this.bg[0] - r) * fk; g += (this.bg[1] - g) * fk; b += (this.bg[2] - b) * fk; }
      return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
    }
    list(st) { return st.layer === 'back' ? this.back : st.layer === 'front' ? this.front : st.group ? (this.groups[st.group] || (this.groups[st.group] = [])) : this.items; }

    /* ---- primitives ---- */
    poly(pts, st = {}) {
      let n = null;
      if (st.shade !== false || st.cull) {
        n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
        if (st.out) { if (dot(n, st.out) < 0) n = mul(n, -1); }
        const toEye = sub(this.eye, pts[0]), facing = dot(n, toEye) > 0;
        if (st.cull && !facing) return;
        if (!facing) n = mul(n, -1);
      }
      const raw = pts.map(p => this.cam(p)), c = clipPoly(raw, this.near); if (c.length < 3) return;
      let z = 0; for (const q of c) z += q[2]; z /= c.length;
      const sp = c.map(q => this.scr(q)), a = st.a ?? 1, P = pts[0];
      let fill = null, grad = null;
      if (st.rgb) {
        const rgb = toRGB(st.rgb);
        if (st.sn && c === raw && n) {
          // smooth shading: the two side edges carry their own normals, blended across the face
          const n0 = dot(n, st.sn[0]) < 0 ? mul(st.sn[0], -1) : st.sn[0], n1 = dot(n, st.sn[1]) < 0 ? mul(st.sn[1], -1) : st.sn[1];
          const c0 = this.shadeRGB(rgb, n0, st, z, pts[0]), c1 = this.shadeRGB(rgb, n1, st, z, pts[1]);
          grad = { x0: (sp[0][0] + sp[3][0]) / 2, y0: (sp[0][1] + sp[3][1]) / 2, x1: (sp[1][0] + sp[2][0]) / 2, y1: (sp[1][1] + sp[2][1]) / 2, c0: rgbStr(c0, a), c1: rgbStr(c1, a) };
          fill = rgbStr(c0.map((v, i) => (v + c1[i]) / 2), a);
        } else fill = rgbStr(this.shadeRGB(rgb, n, st, z, P), a);
      } else fill = st.fill || null;
      // opaque faces get a hairline in their own colour so neighbouring faces meet without a seam
      this.list(st).push({ t: 0, z: z + (st.bias || 0), sp, fill, grad, stroke: st.stroke || (a >= 1 && fill ? fill : null), lw: st.stroke ? (st.lw || 1) : 0.8, add: st.additive });
    }
    line(a, b, color, lw = 1, o = {}) {
      const r = clipSeg(this.cam(a), this.cam(b), this.near); if (!r) return;
      const z = (r[0][2] + r[1][2]) / 2;
      this.list(o).push({ t: 1, z: z + (o.bias || 0), pts: [this.scr(r[0]), this.scr(r[1])], color, lw: o.world ? Math.max(0.6, lw * this.f / z) : lw, dash: o.dash, dashOff: o.dashOff, glow: o.glow, add: o.additive, fa: 1 - this.fogK(z) * 0.8 });
    }
    path(pts, color, lw = 1, o = {}) {           // polyline, cut into short pieces so it sorts with the scene
      const n = o.chunk || 5;
      for (let i = 0; i < pts.length - 1; i += n) {
        const cam = [], scr = [];
        let z = 0, ok = true;
        for (let j = i; j <= Math.min(pts.length - 1, i + n); j++) { const q = this.cam(pts[j]); if (q[2] < this.near) { ok = false; break; } cam.push(q); }
        if (!ok) { for (let j = i; j < Math.min(pts.length - 1, i + n); j++) this.line(pts[j], pts[j + 1], color, lw, o); continue; }
        for (const q of cam) { z += q[2]; scr.push(this.scr(q)); }
        z /= cam.length;
        this.list(o).push({ t: 1, z: z + (o.bias || 0), pts: scr, color: typeof color === 'function' ? color(i / pts.length) : color, lw, dash: o.dash, dashOff: o.dashOff, glow: o.glow, add: o.additive, fa: 1 - this.fogK(z) * 0.8 });
      }
    }
    sphere(c, r, rgb, o = {}) {
      const q = this.cam(c); if (q[2] <= this.near + r * 0.5) return;
      const s = this.scr(q), rp = this.f * r / q[2];
      this.list(o).push({ t: 2, z: q[2] + (o.bias || 0), x: s[0], y: s[1], r: Math.max(o.minPx || 0.8, rp), rgb: this.shadeRGB(toRGB(rgb), null, { shade: false, noFog: o.noFog }, q[2]), a: o.a ?? 1, flat: o.flat });
    }
    glow(c, r, rgb, a = 1, o = {}) {              // additive light sprite; r in world units, or pixels with o.px
      const q = this.cam(c); if (q[2] <= this.near) return;
      const s = this.scr(q), rp = o.px ? r : this.f * r / q[2];
      if (rp < 0.5) return;
      this.list(o).push({ t: 3, z: q[2] + (o.bias ?? -1e-6), x: s[0], y: s[1], r: Math.min(rp, 4000), rgb: toRGB(rgb), a: a * (1 - this.fogK(q[2]) * 0.6), core: o.core });
      if (o.reflect !== undefined && c[2] > o.reflect) this.glow([c[0], c[1], 2 * o.reflect - c[2]], r * 1.25, rgb, a * 0.22, { layer: 'back', px: o.px });
    }
    // a soft contact shadow on the floor under an object (an ellipse rx × ry at height c[2])
    shadow(c, rx, ry, a = 0.5, o = {}) {
      if (Math.max(rx, ry) > 0.75 * Math.hypot(...sub(c, this.eye))) return;      // too close for the flat mapping: skip it
      const p0 = this.project(c), px = this.project(add(c, [rx, 0, 0])), py = this.project(add(c, [0, ry, 0]));
      if (!p0 || !px || !py) return;
      this.list({ layer: o.layer || 'back', group: o.group }).push({ t: 5, z: p0.z, m: [px.x - p0.x, px.y - p0.y, py.x - p0.x, py.y - p0.y, p0.x, p0.y], a, rgb: o.rgb || [0, 0, 0] });
    }
    // a pool of light on the floor (same mapping as a shadow, but additive)
    pool(c, rx, ry, rgb, a = 0.12) { if (Math.max(rx, ry) > 0.75 * Math.hypot(...sub(c, this.eye))) return; const p0 = this.project(c), px = this.project(add(c, [rx, 0, 0])), py = this.project(add(c, [0, ry, 0])); if (!p0 || !px || !py) return; this.back.push({ t: 5, z: p0.z, m: [px.x - p0.x, px.y - p0.y, py.x - p0.x, py.y - p0.y, p0.x, p0.y], a, rgb: toRGB(rgb), add: true }); }
    // the floor: a dark slab of the lab bench with a pool of light and a fine grid that fades into the dark
    floor(z, x0, x1, y0, y1, o = {}) {
      this.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], { rgb: o.rgb || [20, 27, 24], shade: false, layer: 'back', noFog: false });
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) * 0.42, ry = (y1 - y0) * 0.42;
      this.pool([o.cx ?? cx, o.cy ?? cy, z], o.rx ?? rx, o.ry ?? ry, o.light || [96, 140, 118], o.lightA ?? 0.16);
      if (o.step) this.grid(z, x0, x1, y0, y1, o.step, o.gridColor || 'rgba(190,225,200,0.06)');
      this.path([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]], 'rgba(190,225,200,0.12)', 1, { layer: 'back', chunk: 10 });
    }
    label(p, text, o = {}) { const q = this.cam(p); if (q[2] <= this.near) return; const s = this.scr(q); this.labels.push({ z: q[2], x: s[0] + (o.dx || 0), y: s[1] + (o.dy || 0), text, o }); }
    custom(p, fn, o = {}) { const q = this.cam(p); if (q[2] <= this.near) return; const s = this.scr(q); this.list(o).push({ t: 4, z: q[2] + (o.bias || 0), x: s[0], y: s[1], k: this.f / q[2], fn }); }

    /* ---- solids ---- */
    // box with centre c, half sizes h, optional axes (unit vectors); faces get outward normals
    box(c, h, st = {}, axes = null) {
      const [ux, uy, uz] = axes || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      const P = (sx, sy, sz) => add(add(add(c, mul(ux, sx * h[0])), mul(uy, sy * h[1])), mul(uz, sz * h[2]));
      const V = [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)];
      const F = [[[0, 3, 2, 1], mul(uz, -1)], [[4, 5, 6, 7], uz], [[0, 1, 5, 4], mul(uy, -1)], [[2, 3, 7, 6], uy], [[1, 2, 6, 5], ux], [[3, 0, 4, 7], mul(ux, -1)]];
      const solid = (st.a ?? 1) >= 1 && !st.noCull;
      for (const [f, out] of F) { if (st.skip && st.skip(out)) continue; this.poly(f.map(i => V[i]), { ...st, out, cull: solid }); }
    }
    // cylinder from p0 to p1 (radius r), closed unless o.open
    cyl(p0, p1, r, st = {}, n = 20) {
      const ax = norm(sub(p1, p0)), [u, v] = perp(ax), solid = (st.a ?? 1) >= 1 && !st.noCull;
      const ring = k => { const a = TAU * k / n; return add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)); };
      const R = Array.from({ length: n + 1 }, (_, k) => ring(k));
      for (let k = 0; k < n; k++) {
        const out = norm(add(R[k], R[k + 1]));
        this.poly([add(p0, R[k]), add(p0, R[k + 1]), add(p1, R[k + 1]), add(p1, R[k])], { ...st, out, cull: solid, sn: st.flat ? null : [norm(R[k]), norm(R[k + 1])] });
      }
      if (!st.open) {
        this.poly(R.slice(0, n).map(o => add(p0, o)), { ...st, rgb: st.capRgb || st.rgb, out: mul(ax, -1), cull: solid });
        this.poly(R.slice(0, n).map(o => add(p1, o)), { ...st, rgb: st.capRgb2 || st.capRgb || st.rgb, out: ax, cull: solid });
      }
    }
    // thick ring (a coil): inner radius r0, outer r1, from p0 to p1
    tube(p0, p1, r0, r1, st = {}, n = 24) {
      const ax = norm(sub(p1, p0)), [u, v] = perp(ax), solid = (st.a ?? 1) >= 1 && !st.noCull;
      const dir = k => { const a = TAU * k / n; return add(mul(u, Math.cos(a)), mul(v, Math.sin(a))); };
      for (let k = 0; k < n; k++) {
        const d0 = dir(k), d1 = dir(k + 1), out = norm(add(d0, d1));
        this.poly([add(p0, mul(d0, r1)), add(p0, mul(d1, r1)), add(p1, mul(d1, r1)), add(p1, mul(d0, r1))], { ...st, out, cull: solid, sn: [d0, d1] });
        if (!st.noInner) this.poly([add(p0, mul(d0, r0)), add(p0, mul(d1, r0)), add(p1, mul(d1, r0)), add(p1, mul(d0, r0))], { ...st, rgb: st.innerRgb || st.rgb, out: mul(out, -1), cull: solid, sn: [mul(d0, -1), mul(d1, -1)] });
        for (const [p, o] of [[p0, mul(ax, -1)], [p1, ax]]) this.poly([add(p, mul(d0, r0)), add(p, mul(d1, r0)), add(p, mul(d1, r1)), add(p, mul(d0, r1))], { ...st, rgb: st.endRgb || st.rgb, out: o, cull: solid });
      }
    }
    // a flat 2-D shape [[x, y], …] in the floor plane, extruded from z0 to z1
    prism(shape, z0, z1, st = {}) {
      let area = 0; for (let i = 0; i < shape.length; i++) { const a = shape[i], b = shape[(i + 1) % shape.length]; area += a[0] * b[1] - b[0] * a[1]; }
      const ccw = area > 0, solid = (st.a ?? 1) >= 1 && !st.noCull;
      if (!st.noTop) this.poly(shape.map(([x, y]) => [x, y, z1]), { ...st, rgb: st.topRgb || st.rgb, a: st.topA ?? st.a, out: [0, 0, 1], cull: solid });
      if (!st.noBottom) this.poly(shape.map(([x, y]) => [x, y, z0]), { ...st, out: [0, 0, -1], cull: solid });
      if (st.noSides) return;
      const L = shape.length, en = shape.map((a, i) => { const b = shape[(i + 1) % L], dx = b[0] - a[0], dy = b[1] - a[1]; return norm(ccw ? [dy, -dx, 0] : [-dy, dx, 0]); });
      const vn = (i, own) => { const o2 = en[(i + L) % L]; return dot(o2, own) > 0.82 ? norm(add(o2, own)) : own; };   // round corners only
      for (let i = 0; i < L; i++) {
        const a = shape[i], b = shape[(i + 1) % L], out = en[i];
        this.poly([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], { ...st, a: st.sideA ?? st.a, out, cull: solid, sn: [vn(i - 1, out), vn(i + 1, out)] });
      }
    }
    // a circle in a plane (centre c, normal ax), drawn as a closed path
    circle(c, ax, r, color, lw = 1, o = {}, n = 48) {
      const [u, v] = perp(norm(ax)), pts = [];
      for (let k = 0; k <= n; k++) { const a = TAU * k / n; pts.push(add(c, add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)))); }
      this.path(pts, color, lw, o);
    }
    arrow(a, b, color, lw = 1.5, head = 0.1, o = {}) {   // a 3-D arrow: shaft plus a head drawn as two short strokes
      this.line(a, b, color, lw, o);
      const d = norm(sub(b, a)), L = Math.hypot(...sub(b, a)) * head;
      const side = norm(cross(d, sub(this.eye, b)));
      this.line(b, add(b, add(mul(d, -L), mul(side, L * 0.55))), color, lw, o);
      this.line(b, add(b, add(mul(d, -L), mul(side, -L * 0.55))), color, lw, o);
    }
    // floor grid in the plane z (back layer: drawn first)
    grid(z, x0, x1, y0, y1, step, color = 'rgba(190,225,200,0.07)') {
      for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-9; x += step) this.line([x, y0, z], [x, y1, z], color, 1, { layer: 'back' });
      for (let y = Math.ceil(y0 / step) * step; y <= y1 + 1e-9; y += step) this.line([x0, y, z], [x1, y, z], color, 1, { layer: 'back' });
    }

    /* ---- drawing ---- */
    drawItem(it) {
      const ctx = this.ctx;
      if (it.add) ctx.globalCompositeOperation = 'lighter';
      if (it.t === 0) {
        ctx.beginPath(); ctx.moveTo(it.sp[0][0], it.sp[0][1]); for (let i = 1; i < it.sp.length; i++) ctx.lineTo(it.sp[i][0], it.sp[i][1]); ctx.closePath();
        if (it.grad) { const gr = ctx.createLinearGradient(it.grad.x0, it.grad.y0, it.grad.x1, it.grad.y1); gr.addColorStop(0, it.grad.c0); gr.addColorStop(1, it.grad.c1); ctx.fillStyle = gr; ctx.fill(); }
        else if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); }
        if (it.stroke) { ctx.strokeStyle = it.grad && it.stroke === it.fill ? ctx.fillStyle : it.stroke; ctx.lineWidth = it.lw; ctx.lineJoin = 'round'; ctx.stroke(); }
      } else if (it.t === 1) {
        ctx.globalAlpha = it.fa; ctx.strokeStyle = it.color; ctx.lineWidth = it.lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (it.dash) { ctx.setLineDash(it.dash); ctx.lineDashOffset = it.dashOff || 0; }
        if (it.glow) { ctx.shadowColor = it.glow; ctx.shadowBlur = 8; }
        ctx.beginPath(); ctx.moveTo(it.pts[0][0], it.pts[0][1]); for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i][0], it.pts[i][1]); ctx.stroke();
        if (it.dash) ctx.setLineDash([]); if (it.glow) ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      } else if (it.t === 2) {
        const [r, g, b] = it.rgb, R = it.r;
        if (it.flat) { ctx.fillStyle = rgbStr(it.rgb, it.a); }
        else {
          const hx = it.x + this.lightS[0] * R * 0.38, hy = it.y + this.lightS[1] * R * 0.38;
          const gr = ctx.createRadialGradient(hx, hy, R * 0.05, it.x, it.y, R);
          gr.addColorStop(0, rgbStr([Math.min(255, r * 0.4 + 170), Math.min(255, g * 0.4 + 170), Math.min(255, b * 0.4 + 170)], it.a));
          gr.addColorStop(0.45, rgbStr(it.rgb, it.a)); gr.addColorStop(1, rgbStr([r * 0.3, g * 0.3, b * 0.3], it.a));
          ctx.fillStyle = gr;
        }
        ctx.beginPath(); ctx.arc(it.x, it.y, R, 0, TAU); ctx.fill();
      } else if (it.t === 3) {
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, it.r);
        gr.addColorStop(0, rgbStr(it.core ? [255, 255, 255] : it.rgb, it.a)); gr.addColorStop(it.core ? 0.12 : 0.25, rgbStr(it.rgb, it.a * 0.65)); gr.addColorStop(1, rgbStr(it.rgb, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, TAU); ctx.fill();
      } else if (it.t === 4) {
        ctx.save(); it.fn(ctx, it.x, it.y, it.k); ctx.restore();
      } else if (it.t === 5) {
        const m = it.m; if (!isFinite(m[0] + m[1] + m[2] + m[3])) return;
        ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, rgbStr(it.rgb, it.a)); gr.addColorStop(0.55, rgbStr(it.rgb, it.a * 0.55)); gr.addColorStop(1, rgbStr(it.rgb, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    end() {
      for (const it of this.back) this.drawItem(it);
      // groups are drawn one after another (each sorted far to near); plain items are group 0
      for (const g of this.order || [0]) {
        const L = g === 0 ? this.items : this.groups[g]; if (!L) continue;
        L.sort((a, b) => b.z - a.z);
        for (const it of L) this.drawItem(it);
      }
      if (this.order && !this.order.includes(0)) { this.items.sort((a, b) => b.z - a.z); for (const it of this.items) this.drawItem(it); }
      for (const it of this.front) this.drawItem(it);
      if (this.vignette) {
        const W = this.W, H = this.H, v = this.ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)');
        this.ctx.fillStyle = v; this.ctx.fillRect(0, 0, W, H);
      }
      this.labels.sort((a, b) => b.z - a.z);
      for (const l of this.labels) {
        if (l.o.pill) CL.pill(this.ctx, l.text, l.x, l.y, l.o.pill, l.o.fg || '#0b0f0c', l.o.font);
        else haloText(this.ctx, l.text, l.x, l.y, { font: l.o.font || '600 13px "Barlow Condensed", "Arial Narrow", sans-serif', color: l.o.color || '#eef2ec', align: l.o.align || 'center' });
      }
    }
  }

  /* ------------------------------------------------------------------
     The 3D key and orbit controls for one screen's view
     ------------------------------------------------------------------ */
  const CUBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 20.5 7.6v8.8L12 21.2 3.5 16.4V7.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3.5 7.6 12 12.4l8.5-4.8M12 12.4v8.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  const FULL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SHRINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>';
  function attach(wrap, opts) {
    const sc = new Scene(opts.home);
    const ctl = { scene: sc, on: false };
    // keys: reuse the screen's zoom group if it has one, otherwise make a small one
    let group = wrap.querySelector('.hud-zoom');
    const own = !group;
    if (own) { group = document.createElement('div'); group.className = 'hud hud-zoom hud-3d'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', '3-D view'); wrap.appendChild(group); }
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'zbtn zbtn-3d'; key.setAttribute('aria-pressed', 'false');
    key.title = 'Show this in 3D: drag to turn it, scroll or pinch to zoom, double-click to reset';
    key.setAttribute('aria-label', 'Show in 3D');
    key.innerHTML = CUBE + '<span>3D</span>';
    group.insertBefore(key, group.firstChild);
    let extra = [];
    if (own) {
      extra = [['+', 'Zoom in', 1.25], ['−', 'Zoom out', 0.8], ['1×', 'Reset the 3-D camera', 0]].map(([t, lab, k]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'zbtn' + (k === 0 ? ' zbtn-fit' : ''); b.textContent = t; b.title = lab; b.setAttribute('aria-label', lab); b.hidden = true;
        b.addEventListener('click', () => { if (k) { sc.zoom = clamp(sc.zoom * k, 0.2, 40); sc.spin = false; } else sc.reset(); });
        group.appendChild(b); return b;
      });
    } else {
      // the screen's own + − 1× keys drive the 3-D camera while the 3-D view is on
      group.addEventListener('click', ev => {
        if (!ctl.on) return;
        const b = ev.target.closest('button'); if (!b || b === key) return;
        ev.stopPropagation(); ev.preventDefault();
        const t = b.textContent.trim();
        if (t === '+') { sc.zoom = clamp(sc.zoom * 1.25, 0.2, 40); sc.spin = false; } else if (t === '−') { sc.zoom = clamp(sc.zoom / 1.25, 0.2, 40); sc.spin = false; } else sc.reset();
      }, true);
    }
    // ---- fullscreen: the view (with its control bar) fills the screen; falls back to filling the window
    const fk = document.createElement('button');
    fk.type = 'button'; fk.className = 'zbtn zbtn-full'; fk.innerHTML = FULL; fk.title = 'Fill the screen with this view (Esc to leave)'; fk.setAttribute('aria-label', 'Full screen');
    group.insertBefore(fk, key.nextSibling);
    ctl.full = false;
    const bar = opts.full && opts.full.bar ? opts.full.bar() : null;
    let mark = null, native = false;
    const fullChanged = () => { if (opts.full && opts.full.onChange) { opts.full.onChange(ctl.full); requestAnimationFrame(() => opts.full.onChange(ctl.full)); } };
    function setFull(on) {
      on = !!on; if (on === ctl.full) return;
      ctl.full = on; native = false;
      wrap.classList.toggle('is-full', on); document.body.classList.toggle('has-full', on);
      if (bar) {
        if (on) { mark = document.createComment('bar'); bar.parentNode.insertBefore(mark, bar); wrap.appendChild(bar); bar.classList.add('is-floating'); }
        else if (mark) { mark.parentNode.insertBefore(bar, mark); mark.remove(); mark = null; bar.classList.remove('is-floating'); }
      }
      if (on) {
        const rq = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
        if (rq) { try { const pr = rq.call(wrap); if (pr && pr.catch) pr.catch(() => { /* not allowed here: the view still fills the window */ }); } catch (e) { /* ignore */ } }
      } else if ((document.fullscreenElement || document.webkitFullscreenElement) === wrap) {
        try { const ex = document.exitFullscreen || document.webkitExitFullscreen; const pr = ex.call(document); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* ignore */ }
      }
      fk.innerHTML = on ? SHRINK : FULL; fk.classList.toggle('is-on', on);
      fk.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen'); fk.title = on ? 'Leave full screen (Esc)' : 'Fill the screen with this view (Esc to leave)';
      fullChanged();
    }
    const onFs = () => {
      if (!ctl.full) return;
      const el = document.fullscreenElement || document.webkitFullscreenElement;
      if (el === wrap) { native = true; fullChanged(); } else if (native) setFull(false);
    };
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
    document.addEventListener('keydown', ev => { if (ctl.full && ev.key === 'Escape') { ev.preventDefault(); setFull(false); } });
    fk.addEventListener('click', () => setFull(!ctl.full));
    ctl.setFull = setFull;
    // the size left for the canvas when full: the whole screen minus the floating control bar
    ctl.fullBox = () => ({ W: wrap.clientWidth, H: Math.max(140, wrap.clientHeight - (bar && ctl.full ? bar.offsetHeight : 0)) });
    // ---- ride: a chase camera that follows the screen's moving object (needs the 3-D view)
    if (opts.ride) {
      let top = wrap.querySelector('.hud-top');
      if (!top) { top = document.createElement('div'); top.className = 'hud-top'; const stEl = wrap.querySelector('.hud-status'); wrap.appendChild(top); if (stEl) top.appendChild(stEl); }
      const rb = document.createElement('button');
      rb.type = 'button'; rb.className = 'ride-btn'; rb.setAttribute('aria-pressed', 'false'); rb.innerHTML = EYE + '<span></span>';
      top.insertBefore(rb, top.firstChild);
      let nb = null;
      if (opts.ride.next) { nb = document.createElement('button'); nb.type = 'button'; nb.className = 'ride-next'; nb.hidden = true; top.insertBefore(nb, rb.nextSibling); nb.addEventListener('click', () => { opts.ride.next(); sc.rc && (sc.rc.t = 0); upd(); }); }
      const upd = () => {
        const t = ctl.ride ? 'Stop riding' : opts.ride.label(), sp = rb.querySelector('span');
        if (sp.textContent !== t) sp.textContent = t;
        rb.classList.toggle('is-on', !!ctl.ride); rb.setAttribute('aria-pressed', String(!!ctl.ride));
        rb.title = ctl.ride ? 'Go back to the 3D view you can turn' : opts.ride.title || 'Ride along, seen from just behind it';
        if (nb) { nb.hidden = !ctl.ride; const nt = opts.ride.nextLabel ? opts.ride.nextLabel() : 'Next ▸'; if (nb.textContent !== nt) nb.textContent = nt; }
      };
      ctl.setRide = on => {
        on = !!on; if (on === !!ctl.ride) return;
        if (on) { ctl.wasFlat = !ctl.on; ctl.ride = true; if (!ctl.on) set(true, true); sc.rc = null; sc.look = [0, 0]; wrap.classList.add('is-ride3d'); }
        else { ctl.ride = false; sc.rc = null; wrap.classList.remove('is-ride3d'); if (ctl.wasFlat && ctl.on) set(false); }
        upd(); if (opts.ride.onToggle) opts.ride.onToggle(on);
      };
      rb.addEventListener('click', () => { if (CL.audio) CL.audio.unlock(); ctl.setRide(!ctl.ride); });
      ctl.updateRide = upd; upd();
    }
    function set(on, quiet) {
      ctl.on = !!on;
      if (!ctl.on && ctl.ride && ctl.setRide) { ctl.wasFlat = false; ctl.setRide(false); }
      key.setAttribute('aria-pressed', String(ctl.on)); key.classList.toggle('is-on', ctl.on);
      key.setAttribute('aria-label', ctl.on ? 'Back to the flat view' : 'Show in 3D');
      wrap.classList.toggle('is-3d', ctl.on);
      for (const b of extra) b.hidden = !ctl.on;
      if (opts.storeKey) store.set(opts.storeKey, ctl.on);
      if (ctl.on) { sc.lastT = 0; if (!quiet) { sc.tiltIn(); if (CL.sizeBadge) CL.sizeBadge(wrap, '3D view', 'drag to turn it · scroll or pinch to zoom · double-click to reset', 2600); } }
      if (opts.onToggle) opts.onToggle(ctl.on);
    }
    key.addEventListener('click', () => set(!ctl.on));
    group.addEventListener('keydown', ev => {
      if (!ctl.on) return;
      const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] }[ev.key];
      if (!k) return;
      ev.preventDefault(); ev.stopPropagation(); sc.spin = false; sc.yaw += k[0]; sc.pitch = clamp(sc.pitch + k[1], -0.15, 1.5);
    });
    // orbit: drag to turn, two fingers to pinch, wheel to zoom, double-click to reset
    const pts = new Map(); let pinch0 = 0, zoom0 = 1, last = null, armed = false;
    wrap.addEventListener('pointerleave', () => { armed = false; });
    const onCanvas = ev => ev.target && ev.target.tagName === 'CANVAS';
    wrap.addEventListener('pointerdown', ev => {
      if (!ctl.on || !onCanvas(ev)) return;
      ev.stopPropagation(); ev.preventDefault();
      pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      try { ev.target.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }
      sc.spin = false; sc.dragging = true; armed = true; last = [ev.clientX, ev.clientY];
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = sc.zoom; }
      wrap.classList.add('is-orbiting');
    }, true);
    wrap.addEventListener('pointermove', ev => {
      if (!ctl.on || !pts.has(ev.pointerId)) return;
      ev.stopPropagation();
      pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pts.size >= 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0 > 0) sc.zoom = clamp(zoom0 * d / pinch0, 0.2, 40); return; }
      const dx = ev.clientX - last[0], dy = ev.clientY - last[1]; last = [ev.clientX, ev.clientY];
      if (sc.driven) { sc.look[0] -= dx * 0.0085; sc.look[1] = clamp(sc.look[1] + dy * 0.0065, -1.1, 1.1); return; }
      sc.yaw -= dx * 0.0085; sc.pitch = clamp(sc.pitch + dy * 0.0065, -0.15, 1.5);
    }, true);
    const up = ev => {
      if (!pts.has(ev.pointerId)) return;
      pts.delete(ev.pointerId);
      if (pts.size === 1) { last = [...pts.values()][0]; pinch0 = 0; }
      if (!pts.size) { sc.dragging = false; wrap.classList.remove('is-orbiting'); }
    };
    wrap.addEventListener('pointerup', up, true); wrap.addEventListener('pointercancel', up, true);
    wrap.addEventListener('wheel', ev => {
      if (!ctl.on || !onCanvas(ev)) return;
      if (!armed && !ev.ctrlKey && !ev.metaKey) { if (CL.sizeBadge && !ctl.wheelHinted) { ctl.wheelHinted = true; CL.sizeBadge(wrap, 'Zoom', 'click the view first, then scroll (or hold Ctrl and scroll)', 1800); } return; }
      ev.preventDefault(); ev.stopPropagation();
      const k = ev.deltaMode === 1 ? 0.05 : ev.deltaMode === 2 ? 1 : 0.0015 * (ev.ctrlKey ? 3 : 1);
      sc.spin = false; sc.zoom = clamp(sc.zoom * Math.exp(-clamp(ev.deltaY, -300, 300) * k), 0.2, 40);
    }, { capture: true, passive: false });
    wrap.addEventListener('dblclick', ev => { if (!ctl.on || !onCanvas(ev)) return; ev.stopPropagation(); ev.preventDefault(); sc.reset(); }, true);
    ctl.set = set;
    if (opts.storeKey && store.get(opts.storeKey, false)) set(true, true);
    return ctl;
  }

  CL.V3 = { Scene, attach, LIGHT, add, sub, mul, dot, cross, norm, perp };
})();
