// Handles pan, zoom, coordinate transforms, and mouse hit-testing
export class Viewport {
  constructor(canvas) {
    this.canvas = canvas;

    // Transform state: screen = design * scale + offset
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    /** Inset (px) on each side for ruler strips — chip draws inside inner rect */
    this._chromePad = 0;

    // Mouse state
    this._isPanning = false;
    this._lastMouse = { x: 0, y: 0 };
    this._mouseDesign = { x: 0, y: 0 };

    this._onHover = null;
    this._onClick = null;
    this._onDblClick = null;
    this._onMouseMove = null;

    this._bindEvents();
  }

  setChromePad(px) {
    this._chromePad = Math.max(0, px | 0);
  }

  getChromePad() {
    return this._chromePad;
  }

  _innerSize() {
    const p = this._chromePad;
    return {
      w: Math.max(1, this.canvas.width - 2 * p),
      h: Math.max(1, this.canvas.height - 2 * p),
    };
  }

  // Fit design rect [0,0,dw,dh] into inner canvas with padding
  fitToDesign(dw, dh, padding = 40) {
    const { w: iw, h: ih } = this._innerSize();
    const p = this._chromePad;
    const scaleX = (iw - padding * 2) / dw;
    const scaleY = (ih - padding * 2) / dh;
    this.scale = Math.min(scaleX, scaleY);
    this.offsetX = p + (iw - dw * this.scale) / 2;
    this.offsetY = p + (ih - dh * this.scale) / 2;
  }

  // Smoothly zoom to fit a macro (design-space rect)
  zoomToRect(x, y, w, h, padding = 60, duration = 400) {
    const { w: iw, h: ih } = this._innerSize();
    const p = this._chromePad;
    const targetScale = Math.min(
      (iw - padding * 2) / w,
      (ih - padding * 2) / h,
    );
    const targetOffX = p + (iw - w * targetScale) / 2 - x * targetScale;
    const targetOffY = p + (ih - h * targetScale) / 2 - y * targetScale;
    this._animateTo(targetScale, targetOffX, targetOffY, duration);
  }

  // Smoothly reset to fit-all view
  resetView(dw, dh, padding = 40, duration = 400) {
    const { w: iw, h: ih } = this._innerSize();
    const p = this._chromePad;
    const scaleX = (iw - padding * 2) / dw;
    const scaleY = (ih - padding * 2) / dh;
    const targetScale = Math.min(scaleX, scaleY);
    const targetOffX = p + (iw - dw * targetScale) / 2;
    const targetOffY = p + (ih - dh * targetScale) / 2;
    this._animateTo(targetScale, targetOffX, targetOffY, duration);
  }

  _animateTo(targetScale, targetOffX, targetOffY, duration) {
    const startScale = this.scale;
    const startOffX = this.offsetX;
    const startOffY = this.offsetY;
    const start = performance.now();

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
      this.scale = startScale + (targetScale - startScale) * e;
      this.offsetX = startOffX + (targetOffX - startOffX) * e;
      this.offsetY = startOffY + (targetOffY - startOffY) * e;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  get transform() {
    return {
      a: this.scale, b: 0,
      c: 0,          d: this.scale,
      e: this.offsetX,
      f: this.offsetY,
    };
  }

  // Convert canvas pixel → design unit
  toDesign(px, py) {
    return {
      x: (px - this.offsetX) / this.scale,
      y: (py - this.offsetY) / this.scale,
    };
  }

  getMouseDesign() {
    return this._mouseDesign;
  }

  getScale() {
    return this.scale;
  }

  /**
   * Zoom in/out keeping the full chip centered in the inner area (used by toolbar).
   * @param {number} dw design width
   * @param {number} dh design height
   * @param {number} factor multiply current scale (e.g. 1.5 or 1/1.5)
   */
  zoomChipCenter(dw, dh, factor, duration = 220) {
    const s = Math.min(Math.max(this.scale * factor, 0.15), 20);
    const { w: iw, h: ih } = this._innerSize();
    const p = this._chromePad;
    const targetOffX = p + (iw - dw * s) / 2;
    const targetOffY = p + (ih - dh * s) / 2;
    this._animateTo(s, targetOffX, targetOffY, duration);
  }

  onHover(fn)    { this._onHover = fn; }
  onClick(fn)    { this._onClick = fn; }
  onDblClick(fn) { this._onDblClick = fn; }
  onMouseMove(fn){ this._onMouseMove = fn; }

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
        this._isPanning = true;
        this._lastMouse = { x: e.clientX, y: e.clientY };
        c.style.cursor = 'grabbing';
        e.preventDefault();
      } else if (e.button === 0) {
        this._isPanning = false;
        this._lastMouse = { x: e.clientX, y: e.clientY };
        this._maybeStartPan = true;
      }
    });

    c.addEventListener('mousemove', (e) => {
      const rect = c.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      this._mouseDesign = this.toDesign(px, py);

      if (this._onMouseMove) this._onMouseMove(this._mouseDesign);

      if (this._isPanning) {
        const dx = e.clientX - this._lastMouse.x;
        const dy = e.clientY - this._lastMouse.y;
        this.offsetX += dx;
        this.offsetY += dy;
        this._lastMouse = { x: e.clientX, y: e.clientY };
      } else if (this._maybeStartPan) {
        const dx = e.clientX - this._lastMouse.x;
        const dy = e.clientY - this._lastMouse.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          this._isPanning = true;
          this._maybeStartPan = false;
          c.style.cursor = 'grabbing';
          this.offsetX += dx;
          this.offsetY += dy;
          this._lastMouse = { x: e.clientX, y: e.clientY };
        }
      } else {
        if (this._onHover) this._onHover(this._mouseDesign);
      }
    });

    c.addEventListener('mouseup', (e) => {
      if (this._isPanning) {
        this._isPanning = false;
        c.style.cursor = '';
      } else if (this._maybeStartPan && e.button === 0) {
        this._maybeStartPan = false;
        const rect = c.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        if (this._onClick) this._onClick(this.toDesign(px, py), e);
      }
      this._maybeStartPan = false;
    });

    c.addEventListener('dblclick', (e) => {
      const rect = c.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (this._onDblClick) this._onDblClick(this.toDesign(px, py));
    });

    // Wheel zoom: exponential in deltaY (gentler than a fixed multiplier per event).
    // Trackpads emit many events; capping |dy| stops runaway zoom from gesture spikes.
    const WHEEL_ZOOM_K = 0.00014;
    const WHEEL_DY_CAP = 28;

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 120;

      dy = Math.sign(dy) * Math.min(Math.abs(dy), WHEEL_DY_CAP);

      let factor = Math.exp(-dy * WHEEL_ZOOM_K);
      factor = Math.max(0.997, Math.min(1.003, factor));

      this.offsetX = px - (px - this.offsetX) * factor;
      this.offsetY = py - (py - this.offsetY) * factor;
      this.scale *= factor;
      this.scale = Math.max(0.15, Math.min(20, this.scale));
    }, { passive: false });

    c.addEventListener('mouseleave', () => {
      this._isPanning = false;
      this._maybeStartPan = false;
      c.style.cursor = '';
      if (this._onHover) this._onHover(null);
    });

    c.addEventListener('contextmenu', e => e.preventDefault());
  }
}
