import { MACROS, ROUTES, portfolio, DESIGN_LIB, DESIGN_NAME, SECTION_DISPLAY_NAMES } from '../data/portfolio.js';

const CANVAS_BG = '#0c0e14';

export const CHIP_W = 1000;
export const CHIP_H = 1260;

const ROW_H = 4;
const VTEAL_SPACING = 78;
export const RULER_STRIP = 22;
const GRID_STEP = 50;

const ROW_COLORS = [];
for (let i = 0; i < 64; i++) {
  if      (i % 16 === 0)  ROW_COLORS.push('#cc44e0');
  else if (i % 8  === 0)  ROW_COLORS.push('#a830c4');
  else if (i % 2  === 0)  ROW_COLORS.push('#881ea8');
  else                    ROW_COLORS.push('#9a2abb');
}

const GLOBAL_ROUTES = [
  { axis: 'h', pos: 155,  color: '#00ddcc', alpha: 0.55, width: 2.5 },
  { axis: 'h', pos: 618,  color: '#00ddcc', alpha: 0.55, width: 2.5 },
  { axis: 'h', pos: 860,  color: '#00ddcc', alpha: 0.40, width: 2.0 },
  { axis: 'h', pos: 960,  color: '#00ccee', alpha: 0.35, width: 1.5 },
  { axis: 'h', pos: 1060, color: '#00ccee', alpha: 0.35, width: 1.5 },
  { axis: 'h', pos: 1160, color: '#00ccee', alpha: 0.30, width: 1.5 },
  { axis: 'h', pos: 270,  color: '#e0d050', alpha: 0.30, width: 1.0 },
  { axis: 'h', pos: 370,  color: '#e0d050', alpha: 0.25, width: 1.0 },
  { axis: 'h', pos: 470,  color: '#e0d050', alpha: 0.22, width: 1.0 },
  { axis: 'h', pos: 900,  color: '#e0d050', alpha: 0.28, width: 1.0 },
  { axis: 'h', pos: 1000, color: '#e0d050', alpha: 0.22, width: 1.0 },
  { axis: 'h', pos: 1100, color: '#e0d050', alpha: 0.22, width: 1.0 },
  { axis: 'v', pos: 500,  color: '#e0b96c', alpha: 0.50, width: 2.0 },
  { axis: 'v', pos: 215,  color: '#e0c060', alpha: 0.28, width: 1.0 },
  { axis: 'v', pos: 785,  color: '#e0c060', alpha: 0.28, width: 1.0 },
  { axis: 'v', pos: 120,  color: '#00eeff', alpha: 0.20, width: 1.0 },
  { axis: 'v', pos: 880,  color: '#00eeff', alpha: 0.20, width: 1.0 },
  { axis: 'v', pos: 330,  color: '#00eeff', alpha: 0.15, width: 0.8 },
  { axis: 'v', pos: 670,  color: '#00eeff', alpha: 0.15, width: 0.8 },
];

const ALL_ROUTES = [
  ...ROUTES,
  { path: [[500, 155], [500, 618]] },
  { path: [[500, 618], [215, 618], [215, 650]] },
  { path: [[500, 618], [785, 618], [785, 650]] },
  { path: [[215, 155], [215, 270], [215, 370], [215, 610]] },
  { path: [[785, 155], [785, 270], [785, 470], [785, 610]] },
  { path: [[80,  155], [80,  900], [80, 1200]] },
  { path: [[920, 155], [920, 900], [920, 1200]] },
  { path: [[500, 860], [300, 860], [120, 860]] },
  { path: [[500, 860], [700, 860], [880, 860]] },
  { path: [[120, 155], [120, 600], [120, 1200]] },
  { path: [[880, 155], [880, 600], [880, 1200]] },
];

const _signals = ALL_ROUTES.map((route, i) => {
  const path = route.path;
  let totalLen = 0;
  const segs = [];
  for (let j = 0; j < path.length - 1; j++) {
    const dx = path[j+1][0] - path[j][0];
    const dy = path[j+1][1] - path[j][1];
    const len = Math.sqrt(dx*dx + dy*dy);
    segs.push({ x0: path[j][0], y0: path[j][1], dx, dy, len });
    totalLen += len;
  }
  return {
    path, segs, totalLen,
    baseOffset: i / ALL_ROUTES.length,
    speed: 0.12 + (i % 5) * 0.03,
    size:  i < ROUTES.length ? 5 : 3,
  };
});

const DECO_MACROS = [
  { x:  50, y:  880, w: 130, h:  80 },
  { x: 820, y:  880, w: 130, h:  80 },
  { x: 260, y:  910, w:  80, h: 120 },
  { x: 640, y:  910, w:  80, h: 120 },
  { x: 440, y:  900, w: 120, h:  60 },
  { x: 120, y: 1050, w: 160, h: 100 },
  { x: 720, y: 1050, w: 160, h: 100 },
  { x: 350, y: 1060, w: 100, h:  80 },
  { x: 550, y: 1060, w: 100, h:  80 },
  { x: 440, y: 1150, w: 120, h:  90 },
  { x:  60, y: 1180, w:  90, h:  70 },
  { x: 850, y: 1180, w:  90, h:  70 },
];

export class FloorplanRenderer {
  constructor(canvas, layerManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layerManager = layerManager;
    this.hoveredMacro = null;
    this.selectedMacro = null;
    /** @type {{ showGrid: boolean, showTitleBlock: boolean, showLegend: boolean }} */
    this.display = {
      showGrid: true,
      showTitleBlock: true,
      showLegend: true,
    };
  }

  setDisplayOptions(opts) {
    this.display = { ...this.display, ...opts };
  }

  draw(viewport, timestamp) {
    const { ctx, canvas } = this;
    const t = viewport.transform;
    const pad = viewport.getChromePad ? viewport.getChromePad() : 0;

    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (pad > 0) {
      this._drawRulerChrome(ctx, canvas.width, canvas.height, pad);
    }

    ctx.save();
    ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

    if (this.display.showGrid) this._drawGrid();
    if (this.layerManager.isVisible('cells')) this._drawStandardCells();
    this._drawPowerRing();
    if (this.layerManager.isVisible('m1'))   this._drawVerticalChannels();
    this._drawGlobalRouting();
    this._drawDecoMacros();
    this._drawMacroFills();
    this._drawMacroSelectedFill();
    this._drawMacroOutlines(timestamp);
    this._drawMacroLabels();
    if (this.hoveredMacro) this._drawHoverBadge();
    if (this.layerManager.isVisible('signals')) this._drawSignals(timestamp);
    this._drawChipBoundary();

    ctx.restore();

    if (pad > 0) this._drawRulerTicks(ctx, viewport, pad, canvas.width, canvas.height);
    if (this.display.showTitleBlock) this._drawTitleBlock(ctx, canvas.width, canvas.height, pad);
    if (this.display.showLegend) this._drawLayerLegend(ctx, canvas.width, canvas.height, pad);
  }

  _drawRulerChrome(ctx, cw, ch, pad) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = '#d6d2cc';
    const hi = '#ece8e0';
    const lo = '#a09890';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, pad);
    ctx.fillRect(0, 0, pad, ch);
    ctx.strokeStyle = lo;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, pad - 0.5);
    ctx.lineTo(cw, pad - 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad - 0.5, pad);
    ctx.lineTo(pad - 0.5, ch);
    ctx.stroke();
    ctx.strokeStyle = hi;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(cw, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, ch);
    ctx.stroke();
    ctx.restore();
  }

  _drawRulerTicks(ctx, viewport, pad, cw, ch) {
    const { scale, offsetX, offsetY } = viewport;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = '9px ui-monospace, "Cascadia Mono", "Courier New", monospace';
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 1;

    const step = scale > 2 ? 50 : scale > 0.5 ? 100 : 200;
    const x0 = (0 - offsetX) / scale;
    const x1 = (cw - offsetX) / scale;
    const y0 = (0 - offsetY) / scale;
    const y1 = (ch - offsetY) / scale;

    for (let gx = Math.floor(x0 / step) * step; gx <= x1; gx += step) {
      const sx = gx * scale + offsetX;
      if (sx < pad || sx > cw) continue;
      ctx.beginPath();
      ctx.moveTo(sx, pad - 4);
      ctx.lineTo(sx, pad);
      ctx.stroke();
      ctx.fillText(String(Math.round(gx)), sx + 2, pad - 6);
    }
    for (let gy = Math.floor(y0 / step) * step; gy <= y1; gy += step) {
      const sy = gy * scale + offsetY;
      if (sy < pad || sy > ch) continue;
      ctx.beginPath();
      ctx.moveTo(pad - 4, sy);
      ctx.lineTo(pad, sy);
      ctx.stroke();
      ctx.save();
      ctx.translate(4, sy + 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(Math.round(gy)), 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawGrid() {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 200, 200, 0.12)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 4]);
    for (let x = 0; x <= CHIP_W; x += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CHIP_H);
      ctx.stroke();
    }
    for (let y = 0; y <= CHIP_H; y += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CHIP_W, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawTitleBlock(ctx, cw, ch, pad) {
    const margin = 8;
    const w = 200;
    const h = 92;
    const x = cw - w - margin;
    const y = ch - h - margin;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8, 10, 14, 0.92)';
    ctx.strokeStyle = 'rgba(224, 185, 108, 0.55)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = '600 11px ui-sans-serif, -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillText(portfolio.name, x + 8, y + 18);
    ctx.font = '10px ui-monospace, "Cascadia Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fillText(portfolio.title, x + 8, y + 34);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(`${DESIGN_LIB}:${DESIGN_NAME}`, x + 8, y + 50);
    const rev = 'Rev 1.0';
    const date = new Date().toISOString().slice(0, 10);
    ctx.fillText(`${date}  ${rev}`, x + 8, y + 64);
    ctx.fillStyle = 'rgba(224, 185, 108, 0.85)';
    ctx.fillText('PORTFOLIO_TITLE_BLOCK', x + 8, y + 80);
    ctx.restore();
  }

  _drawLayerLegend(ctx, cw, ch, pad) {
    const layers = this.layerManager.getAll().filter(l =>
      ['cells', 'm1', 'm2', 'm3', 'm4', 'signals'].includes(l.id),
    );
    const lineH = 14;
    const box = 10;
    const legendW = 128;
    const legendH = 8 + layers.length * lineH;
    const margin = pad + 6;
    const lx = margin;
    const ly = margin;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(12, 12, 16, 0.88)';
    ctx.strokeStyle = 'rgba(0, 204, 204, 0.35)';
    ctx.fillRect(lx, ly, legendW, legendH);
    ctx.strokeRect(lx + 0.5, ly + 0.5, legendW - 1, legendH - 1);
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText('Layers', lx + 6, ly + 12);
    layers.forEach((l, i) => {
      const yy = ly + 18 + i * lineH;
      ctx.fillStyle = l.visible ? l.color : '#444444';
      ctx.fillRect(lx + 6, yy - 7, box, box);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(lx + 6, yy - 7, box, box);
      ctx.fillStyle = l.visible ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.35)';
      ctx.fillText(l.label.slice(0, 18), lx + 22, yy);
    });
    ctx.restore();
  }

  _drawStandardCells() {
    const { ctx } = this;
    const totalRows = Math.ceil(CHIP_H / ROW_H);
    const n = ROW_COLORS.length;
    for (let r = 0; r < totalRows; r++) {
      ctx.fillStyle = ROW_COLORS[r % n];
      ctx.fillRect(0, r * ROW_H, CHIP_W, ROW_H - 0.3);
    }
  }

  _drawPowerRing() {
    const { ctx } = this;
    const MARGIN = 12;
    ctx.strokeStyle = 'rgba(0, 220, 200, 0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGIN, MARGIN, CHIP_W - MARGIN*2, CHIP_H - MARGIN*2);
    ctx.strokeStyle = 'rgba(0, 200, 180, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN + 5, MARGIN + 5, CHIP_W - (MARGIN+5)*2, CHIP_H - (MARGIN+5)*2);
  }

  _drawVerticalChannels() {
    const { ctx } = this;
    ctx.strokeStyle = '#00cccc';
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= CHIP_W; x += VTEAL_SPACING) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CHIP_H);
      ctx.stroke();
    }
  }

  _drawGlobalRouting() {
    const { ctx } = this;
    for (const r of GLOBAL_ROUTES) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.alpha;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      if (r.axis === 'h') {
        ctx.moveTo(0,       r.pos);
        ctx.lineTo(CHIP_W,  r.pos);
      } else {
        ctx.moveTo(r.pos, 0);
        ctx.lineTo(r.pos, CHIP_H);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawDecoMacros() {
    const { ctx } = this;
    ctx.fillStyle = CANVAS_BG;
    for (const d of DECO_MACROS) {
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    ctx.strokeStyle = 'rgba(0, 180, 180, 0.35)';
    ctx.lineWidth = 0.8;
    for (const d of DECO_MACROS) {
      ctx.strokeRect(d.x, d.y, d.w, d.h);
    }
  }

  _drawMacroFills() {
    const { ctx } = this;
    ctx.fillStyle = CANVAS_BG;
    for (const m of MACROS) {
      ctx.fillRect(m.x - 1, m.y - 1, m.w + 2, m.h + 2);
    }
  }

  _drawMacroSelectedFill() {
    const { ctx } = this;
    const sel = this.selectedMacro;
    if (!sel) return;
    ctx.save();
    ctx.fillStyle = 'rgba(224, 185, 108, 0.08)';
    ctx.fillRect(sel.x, sel.y, sel.w, sel.h);
    ctx.restore();
  }

  _drawMacroOutlines(timestamp) {
    const { ctx } = this;
    const t = typeof timestamp === 'number' ? timestamp * 0.001 : 0;
    const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.4));

    for (const m of MACROS) {
      const isHov = this.hoveredMacro?.id === m.id;
      const isSel = this.selectedMacro?.id === m.id;

      if (isSel) {
        ctx.shadowColor = '#e0b96c';
        ctx.shadowBlur  = 10;
        ctx.strokeStyle = '#e0b96c';
        ctx.lineWidth   = 2;
      } else if (isHov) {
        const blur = 4 + pulse * 14;
        ctx.shadowColor = 'rgba(0, 212, 200, 0.95)';
        ctx.shadowBlur  = blur;
        ctx.strokeStyle = 'rgba(0, 255, 230, 0.95)';
        ctx.lineWidth   = 1.75;
      } else {
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = '#00cccc';
        ctx.lineWidth   = 1;
      }

      ctx.strokeRect(m.x, m.y, m.w, m.h);
      ctx.shadowBlur = 0;

      const color = isSel ? '#e0b96c' : isHov ? 'rgba(0, 255, 230, 0.95)' : '#00cccc';
      const TICK  = 10;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1;
      const corners = [
        [m.x,       m.y,       1,  1],
        [m.x + m.w, m.y,      -1,  1],
        [m.x,       m.y + m.h, 1, -1],
        [m.x + m.w, m.y + m.h,-1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * TICK, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * TICK);
        ctx.stroke();
      }
    }
  }

  _drawMacroLabels() {
    const { ctx } = this;
    ctx.save();
    ctx.textBaseline = 'top';

    const pad = 10;
    const humanSize = 28;
    const edaSize = 12;
    const lineGap = 30;

    for (const m of MACROS) {
      const isSel = this.selectedMacro?.id === m.id;
      const human = SECTION_DISPLAY_NAMES[m.section] || m.section;
      const x = m.x + pad;
      const y0 = m.y + pad;

      ctx.font = `600 ${humanSize}px ui-sans-serif, -apple-system, system-ui, sans-serif`;
      const wHuman = ctx.measureText(human).width;
      ctx.font = `${edaSize}px ui-monospace, "Cascadia Mono", "Courier New", monospace`;
      const wEda = ctx.measureText(m.label).width;

      const badgeW = Math.min(Math.max(wHuman, wEda) + 24, m.w - pad * 2 + 4);
      const badgeH = lineGap + edaSize + 12;
      ctx.fillStyle = 'rgba(8, 10, 20, 0.62)';
      ctx.fillRect(x - 5, y0 - 5, badgeW, Math.min(badgeH, m.h - pad));

      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.font = `600 ${humanSize}px ui-sans-serif, -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = isSel ? 'rgba(255, 230, 180, 0.98)' : 'rgba(255, 255, 255, 0.96)';
      ctx.fillText(human, x, y0);

      ctx.font = `${edaSize}px ui-monospace, "Cascadia Mono", "Courier New", monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillText(m.label, x, y0 + lineGap);

      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.restore();
  }

  _drawHoverBadge() {
    const m = this.hoveredMacro;
    if (!m || this.selectedMacro?.id === m.id) return;
    const { ctx } = this;
    const human = SECTION_DISPLAY_NAMES[m.section] || m.section;
    ctx.save();
    const pad = 8;
    const fs = 16;
    ctx.font = `600 ${fs}px ui-sans-serif, -apple-system, system-ui, sans-serif`;
    const tw = ctx.measureText(human).width;
    const bw = tw + pad * 2;
    const bh = fs + 10;
    const cx = m.x + m.w * 0.5;
    const cy = m.y - 6;
    const rx = cx - bw / 2;
    const ry = cy - bh;
    ctx.fillStyle = 'rgba(8, 12, 22, 0.92)';
    ctx.strokeStyle = 'rgba(0, 200, 190, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(rx, ry, bw, bh, 4);
    } else {
      ctx.rect(rx, ry, bw, bh);
    }
    ctx.fill();
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillText(human, rx + pad, ry + bh * 0.5);
    ctx.restore();
  }

  _drawChipBoundary() {
    const { ctx } = this;
    ctx.strokeStyle = '#00cccc';
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 0;
    ctx.strokeRect(0, 0, CHIP_W, CHIP_H);
  }

  _drawSignals(timestamp) {
    const { ctx } = this;
    const t = timestamp * 0.001;

    for (const sig of _signals) {
      if (sig.totalLen === 0) continue;
      const progress  = (t * sig.speed + sig.baseOffset) % 1;
      const targetDist = progress * sig.totalLen;

      let dist = 0, px = sig.path[0][0], py = sig.path[0][1];
      for (const seg of sig.segs) {
        if (dist + seg.len >= targetDist) {
          const f = (targetDist - dist) / seg.len;
          px = seg.x0 + seg.dx * f;
          py = seg.y0 + seg.dy * f;
          break;
        }
        dist += seg.len;
      }

      const r   = sig.size;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, r);
      grd.addColorStop(0,   'rgba(224,185,108,1)');
      grd.addColorStop(0.45,'rgba(224,185,108,0.55)');
      grd.addColorStop(1,   'rgba(224,185,108,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  hitTest(pt) {
    if (!pt) return null;
    for (let i = MACROS.length - 1; i >= 0; i--) {
      const m = MACROS[i];
      if (pt.x >= m.x && pt.x <= m.x + m.w &&
          pt.y >= m.y && pt.y <= m.y + m.h) return m;
    }
    return null;
  }
}
