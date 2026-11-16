// Photo viewer. Tap a photo and it grows out of its place in the post.
// Drag it to dismiss, pinch / double-tap / trackpad-pinch to zoom, swipe or
// use the arrow keys to move between the post's photos. Every motion is a
// spring that starts from what's on screen, so any gesture can interrupt it.
const F = window.Fluid;
const MAX_ZOOM = 4;
const TAP_ZOOM = 2.5;

let viewer = null;

export function attachViewer(root) {
  const buttons = [...root.querySelectorAll('.ph')];
  buttons.forEach((b, i) => {
    if (b.__viewer) return;
    b.__viewer = true;
    b.addEventListener('click', () => {
      if (!F) return;
      // Re-read the group at tap time: the editor's preview re-renders.
      const group = [...root.querySelectorAll('.ph')];
      (viewer ??= new Viewer()).open(group, group.indexOf(b));
    });
  });
}

const svg = d => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const make = (tag, cls, html) => {
  const n = document.createElement(tag);
  n.className = cls;
  if (html) n.innerHTML = html;
  return n;
};

class Viewer {
  constructor() {
    this.root = make('div', 'pv');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Photo');
    this.root.hidden = true;
    this.scrim = make('div', 'pv-scrim');
    this.img = make('img', 'pv-img');
    this.img.draggable = false;
    this.chrome = make('div', 'pv-chrome');
    this.closeBtn = make('button', 'pv-btn pv-close', svg('M6 6l12 12M18 6L6 18'));
    this.closeBtn.setAttribute('aria-label', 'Close');
    this.prevBtn = make('button', 'pv-btn pv-prev', svg('M15 5l-7 7 7 7'));
    this.prevBtn.setAttribute('aria-label', 'Previous photo');
    this.nextBtn = make('button', 'pv-btn pv-next', svg('M9 5l7 7-7 7'));
    this.nextBtn.setAttribute('aria-label', 'Next photo');
    for (const b of [this.closeBtn, this.prevBtn, this.nextBtn]) b.type = 'button';
    this.count = make('p', 'pv-count meta');
    this.cap = make('p', 'pv-cap');
    this.chrome.append(this.count, this.closeBtn, this.prevBtn, this.nextBtn, this.cap);
    this.root.append(this.scrim, this.img, this.chrome);
    document.body.append(this.root);

    const paint = () => {
      this.img.style.transform = `translate3d(${this.x.value.toFixed(2)}px, ${this.y.value.toFixed(2)}px, 0) scale(${this.s.value.toFixed(4)})`;
    };
    const spring = (v, precision) => new F.Spring(v, { dampingRatio: 1, response: 0.4, precision, onUpdate: paint });
    this.x = spring(0, 0.1);
    this.y = spring(0, 0.1);
    this.s = spring(1, 0.0005);
    this.o = new F.Spring(0, {
      dampingRatio: 1, response: 0.35, precision: 0.001,
      onUpdate: v => {
        this.scrim.style.opacity = v.toFixed(3);
        if (this.fading) this.img.style.opacity = v.toFixed(3);
      },
    });
    this.c = new F.Spring(0, {
      dampingRatio: 1, response: 0.3, precision: 0.001,
      onUpdate: v => {
        this.chrome.style.opacity = v.toFixed(3);
        this.chrome.style.visibility = v < 0.01 ? 'hidden' : '';
      },
    });
    this.vx = new F.VelocityTracker();
    this.vy = new F.VelocityTracker();
    this.pointers = new Map();
    this.lastTap = null;

    this.closeBtn.addEventListener('click', () => this.close());
    this.prevBtn.addEventListener('click', () => this.go(this.i - 1));
    this.nextBtn.addEventListener('click', () => this.go(this.i + 1));
    this.root.addEventListener('pointerdown', e => this.down(e));
    this.root.addEventListener('pointermove', e => this.move(e));
    this.root.addEventListener('pointerup', e => this.up(e));
    this.root.addEventListener('pointercancel', e => this.up(e, true));
    this.root.addEventListener('wheel', e => this.wheel(e), { passive: false });
    this.onKey = e => this.key(e);
    this.onResize = () => { this.layout(); this.x.set(0); this.y.set(0); this.s.set(1); };
  }

  get reduced() { return F.reducedMotion; }
  get vw() { return innerWidth; }
  get vh() { return innerHeight; }
  get zoomed() { return this.s.value > 1.01; }

  /* ── Open / close ─────────────────────────────────────────────────── */
  open(buttons, index) {
    if (!this.root.hidden) return;
    this.items = buttons.map(b => {
      const img = b.querySelector('img');
      return {
        btn: b, thumb: img,
        w: +img.getAttribute('width') || img.naturalWidth || 1,
        h: +img.getAttribute('height') || img.naturalHeight || 1,
        caption: b.closest('figure')?.querySelector('figcaption')?.textContent.trim() || '',
        lqip: getComputedStyle(b).getPropertyValue('--lqip').trim().replace(/^url\(["']?|["']?\)$/g, ''),
      };
    });
    this.closing = false;
    this.fading = false;
    this.img.style.opacity = '';
    this.root.hidden = false;
    document.documentElement.classList.add('pv-open');
    document.addEventListener('keydown', this.onKey);
    addEventListener('resize', this.onResize);
    this.show(index);

    const t = this.thumbPose();
    if (this.reduced || !t) {
      this.x.set(0); this.y.set(0); this.s.set(1);
    } else {
      this.x.set(t.x); this.y.set(t.y); this.s.set(t.s);
      this.x.to(0); this.y.to(0); this.s.to(1);
    }
    this.o.to(1);
    this.c.to(1);
    this.closeBtn.focus({ preventScroll: true });
  }

  close(vx = 0, vy = 0) {
    if (this.closing || this.root.hidden) return;
    this.closing = true;
    this.pointers.clear();
    const item = this.items[this.i];
    // Bring the photo's slot into view (behind the viewer) so it can land there.
    item.thumb.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    const t = this.thumbPose();
    this.c.to(0);
    if (this.reduced || !t) {
      this.fading = true;
      this.o.to(0);
    } else {
      this.x.to(t.x, { velocity: vx });
      this.y.to(t.y, { velocity: vy });
      this.s.to(t.s);
      this.o.to(0);
    }
    const settle = () => {
      if (this.x.animating || this.y.animating || this.s.animating || this.o.animating) {
        requestAnimationFrame(settle);
        return;
      }
      this.root.hidden = true;
      item.thumb.style.visibility = '';
      document.documentElement.classList.remove('pv-open');
      document.removeEventListener('keydown', this.onKey);
      removeEventListener('resize', this.onResize);
      item.btn.focus({ preventScroll: true });
    };
    requestAnimationFrame(settle);
  }

  // Where the open photo would sit if it were drawn over its thumbnail.
  thumbPose() {
    const r = this.items[this.i].thumb.getBoundingClientRect();
    const onScreen = r.width > 0 && r.bottom > 0 && r.top < this.vh;
    if (!onScreen) return null;
    return { x: r.left - this.F.x, y: r.top - this.F.y, s: r.width / this.F.w };
  }

  /* ── Content ──────────────────────────────────────────────────────── */
  show(i) {
    const prev = this.items[this.i];
    if (prev && prev !== this.items[i]) prev.thumb.style.visibility = '';
    this.i = i;
    const item = this.items[i];
    item.thumb.style.visibility = 'hidden';
    this.img.src = item.thumb.currentSrc || item.thumb.src || item.lqip;
    if (!item.thumb.classList.contains('is-loaded')) {
      item.thumb.addEventListener('load', () => {
        if (this.items[this.i] === item) this.img.src = item.thumb.src;
      }, { once: true });
    }
    this.img.alt = item.caption;
    this.cap.textContent = item.caption;
    this.cap.hidden = !item.caption;
    const n = this.items.length;
    this.count.textContent = n > 1 ? `${i + 1} of ${n}` : '';
    this.prevBtn.disabled = i === 0;
    this.nextBtn.disabled = i === n - 1;
    this.prevBtn.hidden = this.nextBtn.hidden = n < 2;
    this.layout();
  }

  // The fitted rect at scale 1. All motion is a transform relative to it.
  layout() {
    const item = this.items[this.i];
    const pad = this.vw >= 768 ? 48 : 0;
    const k = Math.min((this.vw - 2 * pad) / item.w, (this.vh - 2 * pad) / item.h);
    const w = item.w * k, h = item.h * k;
    this.F = { x: (this.vw - w) / 2, y: (this.vh - h) / 2, w, h };
    Object.assign(this.img.style, {
      left: `${this.F.x}px`, top: `${this.F.y}px`, width: `${w}px`, height: `${h}px`,
    });
  }

  go(j, velocity = 0) {
    if (j < 0 || j >= this.items.length || j === this.i || this.closing) return;
    const dir = Math.sign(j - this.i);
    if (this.reduced) {
      this.show(j);
      this.x.set(0); this.y.set(0); this.s.set(1);
      return;
    }
    // Throw the current photo off one side, bring the next in from the other.
    this.y.to(0); this.s.to(1);
    this.x.to(-dir * (this.vw + 40), { velocity, response: 0.3 });
    const swap = () => {
      const left = this.F.x + this.x.value;
      const gone = dir > 0 ? left + this.F.w < 0 : left > this.vw;
      if (!gone && this.x.animating) { requestAnimationFrame(swap); return; }
      this.show(j);
      this.x.set(dir * (this.vw - this.F.x));
      this.x.to(0, { velocity, response: 0.35 });
    };
    requestAnimationFrame(swap);
  }

  /* ── Zoom geometry ────────────────────────────────────────────────── */
  bounds(s) {
    const W = this.F.w * s, H = this.F.h * s;
    const ax = W <= this.vw ? [(this.vw - W) / 2 - this.F.x, (this.vw - W) / 2 - this.F.x] : [this.vw - W - this.F.x, -this.F.x];
    const ay = H <= this.vh ? [(this.vh - H) / 2 - this.F.y, (this.vh - H) / 2 - this.F.y] : [this.vh - H - this.F.y, -this.F.y];
    return { minX: ax[0], maxX: ax[1], minY: ay[0], maxY: ay[1] };
  }

  // Past an edge the photo follows with growing resistance.
  rubber(v, lo, hi, dim) {
    if (v < lo) return lo - F.rubberband(lo - v, dim);
    if (v > hi) return hi + F.rubberband(v - hi, dim);
    return v;
  }

  // Keep the point under (px, py) fixed while the scale changes to s.
  zoomAbout(px, py, s, from = { x: this.x.value, y: this.y.value, s: this.s.value }) {
    const lx = (px - this.F.x - from.x) / from.s;
    const ly = (py - this.F.y - from.y) / from.s;
    return { x: px - this.F.x - lx * s, y: py - this.F.y - ly * s };
  }

  settle(vx = 0, vy = 0) {
    const s = F.clamp(this.s.value, 1, MAX_ZOOM);
    if (s <= 1.01) {
      this.x.to(0, { velocity: vx }); this.y.to(0, { velocity: vy }); this.s.to(1);
      this.o.to(1);
      return;
    }
    const b = this.bounds(s);
    let x = this.x.value, y = this.y.value;
    if (s !== this.s.value) ({ x, y } = this.zoomAbout(this.vw / 2, this.vh / 2, s));
    // Momentum carries a pan on, then it settles inside the edges.
    x = F.clamp(x + F.project(vx, 0.995), b.minX, b.maxX);
    y = F.clamp(y + F.project(vy, 0.995), b.minY, b.maxY);
    this.x.to(x, { velocity: vx }); this.y.to(y, { velocity: vy }); this.s.to(s);
  }

  toggleZoom(px, py) {
    if (this.zoomed) { this.settleTo(0, 0, 1); this.c.to(1); return; }
    const p = this.zoomAbout(px, py, TAP_ZOOM);
    const b = this.bounds(TAP_ZOOM);
    this.settleTo(F.clamp(p.x, b.minX, b.maxX), F.clamp(p.y, b.minY, b.maxY), TAP_ZOOM);
    this.c.to(0);
  }

  settleTo(x, y, s) {
    if (this.reduced) { this.x.set(x); this.y.set(y); this.s.set(s); return; }
    this.x.to(x); this.y.to(y); this.s.to(s);
  }

  /* ── Gestures ─────────────────────────────────────────────────────── */
  down(e) {
    if (this.closing || e.target.closest('.pv-btn')) return;
    this.root.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Catch the photo wherever it is mid-flight.
    for (const sp of [this.x, this.y, this.s, this.o]) sp.set(sp.value);
    if (this.pointers.size === 1) {
      this.mode = null;
      this.start = { px: e.clientX, py: e.clientY, x: this.x.value, y: this.y.value, s: this.s.value, onImg: e.target === this.img };
      this.vx.reset(); this.vy.reset();
    } else if (this.pointers.size === 2) {
      this.mode = 'pinch';
      const [a, b] = [...this.pointers.values()];
      this.pinch = {
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
        x: this.x.value, y: this.y.value, s: this.s.value,
      };
      this.c.to(0);
    }
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p || this.closing) return;
    p.x = e.clientX; p.y = e.clientY;

    if (this.mode === 'pinch') {
      if (this.pointers.size < 2) return;
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const raw = this.pinch.s * d / this.pinch.d;
      const s = raw < 1 ? 1 - F.rubberband(1 - raw, 1, 0.4) : raw > MAX_ZOOM ? MAX_ZOOM + F.rubberband(raw - MAX_ZOOM, MAX_ZOOM, 0.4) : raw;
      const lx = (this.pinch.mx - this.F.x - this.pinch.x) / this.pinch.s;
      const ly = (this.pinch.my - this.F.y - this.pinch.y) / this.pinch.s;
      this.x.set(mx - this.F.x - lx * s);
      this.y.set(my - this.F.y - ly * s);
      this.s.set(s);
      this.o.set(Math.min(1, s));
      return;
    }
    if (this.pointers.size !== 1 || this.mode === 'done') return;

    const dx = e.clientX - this.start.px, dy = e.clientY - this.start.py;
    if (!this.mode) {
      if (Math.hypot(dx, dy) < 10) return;   // hysteresis: a tap stays a tap
      if (this.start.s > 1.01) this.mode = 'pan';
      else if (Math.abs(dx) > Math.abs(dy)) this.mode = 'page';
      else this.mode = 'dismiss';
      this.c.to(this.mode === 'page' ? 1 : 0);
    }
    this.vx.add(dx); this.vy.add(dy);

    if (this.mode === 'pan') {
      const b = this.bounds(this.s.value);
      this.x.set(this.rubber(this.start.x + dx, b.minX, b.maxX, this.vw));
      this.y.set(this.rubber(this.start.y + dy, b.minY, b.maxY, this.vh));
    } else if (this.mode === 'page') {
      const edge = (dx > 0 && this.i === 0) || (dx < 0 && this.i === this.items.length - 1);
      this.x.set(edge ? Math.sign(dx) * F.rubberband(Math.abs(dx), this.vw) : dx);
    } else {
      // Dismiss: the photo follows the finger and shrinks as it travels.
      const s = 1 - Math.min(0.4, Math.abs(dy) / this.vh * 0.6);
      this.s.set(s);
      this.x.set(dx + (1 - s) * this.F.w / 2);
      this.y.set(dy + (1 - s) * this.F.h / 2);
      this.o.set(1 - F.clamp(Math.abs(dy) / (this.vh * 0.45), 0, 1));
    }
  }

  up(e, cancelled = false) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.closing) return;

    if (this.mode === 'pinch') {
      if (this.pointers.size === 0) this.settle();
      else this.mode = 'done';   // one finger lifted: wait for the other
      return;
    }
    if (this.pointers.size > 0) return;
    const vx = this.vx.velocity(), vy = this.vy.velocity();

    if (this.mode === 'done') { this.settle(); return; }
    if (!this.mode) { if (!cancelled) this.tap(e); return; }

    if (this.mode === 'pan') {
      this.settle(vx, vy);
    } else if (this.mode === 'page') {
      const dx = e.clientX - this.start.px;
      const projected = dx + F.project(vx, 0.99);
      if (projected < -this.vw * 0.3 && this.i < this.items.length - 1) this.go(this.i + 1, vx);
      else if (projected > this.vw * 0.3 && this.i > 0) this.go(this.i - 1, vx);
      else this.x.to(0, { velocity: vx });
    } else {
      const dy = e.clientY - this.start.py;
      const projected = dy + F.project(vy);
      // Decide on where the flick is going, not where it was let go.
      if (Math.abs(projected) > this.vh * 0.18 && Math.sign(projected) === Math.sign(dy)) {
        this.close(vx, vy);
      } else {
        this.x.to(0, { velocity: vx }); this.y.to(0, { velocity: vy }); this.s.to(1);
        this.o.to(1); this.c.to(1);
      }
    }
  }

  tap(e) {
    const now = performance.now();
    const t = this.lastTap;
    // A double tap toggles the chrome twice, so it nets out to no change.
    if (t && now - t.t < 300 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) {
      this.lastTap = null;
      if (this.start.onImg || this.zoomed) this.toggleZoom(e.clientX, e.clientY);
      return;
    }
    this.lastTap = { t: now, x: e.clientX, y: e.clientY };
    if (!this.start.onImg && !this.zoomed) { this.close(); return; }
    this.c.to(this.c.target > 0.5 ? 0 : 1);
  }

  wheel(e) {
    e.preventDefault();
    if (this.closing) return;
    if (e.ctrlKey) {
      // Trackpad pinch arrives as ctrl + wheel.
      const s = F.clamp(this.s.value * Math.exp(-e.deltaY * 0.01), 1, MAX_ZOOM);
      if (s <= 1.001) { this.x.set(0); this.y.set(0); this.s.set(1); this.c.to(1); return; }
      const p = this.zoomAbout(e.clientX, e.clientY, s);
      const b = this.bounds(s);
      this.x.set(F.clamp(p.x, b.minX, b.maxX));
      this.y.set(F.clamp(p.y, b.minY, b.maxY));
      this.s.set(s);
      this.c.to(0);
    } else if (this.zoomed) {
      const b = this.bounds(this.s.value);
      this.x.set(F.clamp(this.x.value - e.deltaX, b.minX, b.maxX));
      this.y.set(F.clamp(this.y.value - e.deltaY, b.minY, b.maxY));
    }
  }

  key(e) {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.i - 1); }
    else if (e.key === 'Tab') {
      // Focus stays inside the viewer.
      const f = [this.closeBtn, this.prevBtn, this.nextBtn].filter(b => !b.hidden && !b.disabled && b.offsetParent);
      if (!f.length) return;
      const at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }
}
