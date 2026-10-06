// ─────────────────────────────────────────────────────────────
// Fluid — spring physics shared by the portfolio variations.
//
// Springs are described the way Apple describes them: a damping
// ratio (1 = critically damped, < 1 = overshoot) and a response in
// seconds (how quickly the value gets there — not a duration).
//   stiffness = (2π / response)²,  damping = 4π·ζ / response,  mass = 1
//
// Every spring integrates from its *live* value and velocity, so
// retargeting mid-flight is continuous: interruptible by default,
// no velocity brick-wall on reversal.
//
// Exposed as window.Fluid (classic script — works over file://).
// ─────────────────────────────────────────────────────────────
(() => {
  const TAU = Math.PI * 2;
  const STEP = 1 / 240;          // fixed integration substep
  const MAX_DT = 1 / 20;         // a dropped frame never explodes the sim

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  class Spring {
    constructor(value = 0, opts = {}) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.dampingRatio = opts.dampingRatio ?? 1;
      this.response = opts.response ?? 0.4;
      // Rest when within `precision` of the target and slower than
      // 10·precision per second. Use ~0.1 for px, ~0.001 for 0–1 values.
      this.precision = opts.precision ?? 0.1;
      this.onUpdate = opts.onUpdate || null;
      this.onRest = opts.onRest || null;
      this._raf = 0;
      this._last = 0;
      this._tick = this._tick.bind(this);
    }

    // Animate to `target` from wherever the value is right now.
    // opts.velocity hands off a gesture's release velocity (units/s).
    // opts.instant jumps straight there (e.g. under reduced motion).
    to(target, opts = {}) {
      if (opts.dampingRatio !== undefined) this.dampingRatio = opts.dampingRatio;
      if (opts.response !== undefined) this.response = opts.response;
      if (opts.velocity !== undefined) this.velocity = opts.velocity;
      this.target = target;
      if (opts.instant) {
        this.set(target);
        this.onRest && this.onRest(this.value);
        return this;
      }
      if (!this._raf) {
        this._last = performance.now();
        this._raf = requestAnimationFrame(this._tick);
      }
      return this;
    }

    // Track a value 1:1 (drag). Stops any motion; velocity is zeroed —
    // pass the tracked release velocity to to() when the gesture ends.
    set(value) {
      this.stop();
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.onUpdate && this.onUpdate(value);
      return this;
    }

    stop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      return this;
    }

    get animating() { return this._raf !== 0; }

    _tick(now) {
      const dt = Math.min((now - this._last) / 1000, MAX_DT);
      this._last = now;

      const k = (TAU / this.response) ** 2;
      const c = (4 * Math.PI * this.dampingRatio) / this.response;
      const steps = Math.max(1, Math.ceil(dt / STEP));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const a = -k * (this.value - this.target) - c * this.velocity;
        this.velocity += a * h;          // semi-implicit Euler: stable
        this.value += this.velocity * h; // at these stiffnesses
      }

      const rest =
        Math.abs(this.value - this.target) < this.precision &&
        Math.abs(this.velocity) < this.precision * 10;

      if (rest) {
        this.value = this.target;
        this.velocity = 0;
        this._raf = 0;
        this.onUpdate && this.onUpdate(this.value);
        this.onRest && this.onRest(this.value);
        return;
      }
      this.onUpdate && this.onUpdate(this.value);
      this._raf = requestAnimationFrame(this._tick);
    }
  }

  // 2D motion as two independent springs — X and Y keep their own
  // velocities so a diagonal throw doesn't desync.
  class Spring2D {
    constructor(x = 0, y = 0, opts = {}) {
      const user = opts.onUpdate;
      const emit = () => user && user(this.x.value, this.y.value);
      this.x = new Spring(x, { ...opts, onUpdate: emit, onRest: null });
      this.y = new Spring(y, { ...opts, onUpdate: emit, onRest: null });
    }
    to(x, y, opts = {}) {
      const { velocityX, velocityY, ...rest } = opts;
      this.x.to(x, { ...rest, velocity: velocityX ?? opts.velocity });
      this.y.to(y, { ...rest, velocity: velocityY ?? opts.velocity });
      return this;
    }
    set(x, y) { this.x.set(x); this.y.set(y); return this; }
    stop() { this.x.stop(); this.y.stop(); return this; }
    get animating() { return this.x.animating || this.y.animating; }
  }

  // Velocity from a short pointer history (last ~100 ms), in units/s.
  class VelocityTracker {
    constructor(window = 100) { this.window = window; this.samples = []; }
    reset() { this.samples.length = 0; }
    add(value, t = performance.now()) {
      this.samples.push({ value, t });
      const cutoff = t - this.window;
      while (this.samples.length > 2 && this.samples[0].t < cutoff) this.samples.shift();
    }
    velocity() {
      const s = this.samples;
      if (s.length < 2) return 0;
      const a = s[0], b = s[s.length - 1];
      const dt = (b.t - a.t) / 1000;
      // Pointer that paused before release has no momentum.
      if (dt <= 0 || performance.now() - b.t > 80) return 0;
      return (b.value - a.value) / dt;
    }
  }

  // Where a flick comes to rest — Apple's exponential-decay projection
  // (Designing Fluid Interfaces sample code). d ≈ 0.998 = scroll feel,
  // 0.99 = snappier.
  function project(velocity, decelerationRate = 0.998) {
    return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
  }

  // Progressive resistance past a boundary.
  function rubberband(overshoot, dimension, constant = 0.55) {
    if (dimension <= 0) return 0;
    return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
  }

  function nearest(value, points) {
    let best = points[0], d = Infinity;
    for (const p of points) {
      const dd = Math.abs(p - value);
      if (dd < d) { d = dd; best = p; }
    }
    return best;
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Apple's shipped presets (damping ratio, response).
  const presets = {
    default: { dampingRatio: 1.0, response: 0.4 },   // move / reposition
    snappy:  { dampingRatio: 1.0, response: 0.3 },
    sheet:   { dampingRatio: 0.8, response: 0.3 },   // drawer / sheet after a flick
    flick:   { dampingRatio: 0.8, response: 0.4 },   // momentum-carrying release
    rotate:  { dampingRatio: 0.8, response: 0.4 },
  };

  window.Fluid = {
    Spring, Spring2D, VelocityTracker,
    project, rubberband, nearest, clamp, lerp, presets,
    get reducedMotion() { return reducedMotion.matches; },
    onReducedMotionChange(fn) { reducedMotion.addEventListener('change', () => fn(reducedMotion.matches)); },
  };
})();
