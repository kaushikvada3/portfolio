import { SECTION_DISPLAY_NAMES } from '../data/portfolio.js';

export class StatusBar {
  constructor(element) {
    this.el = element;
    this._selection = null;
    this._scale = 1;
    this._zoomPct = 100;
    this._layerSummary = '';
    this._hint = 'Click macros to inspect · Double-click zooms · Wheel zooms · Drag pans';
    this._render();
  }

  setHint(text) {
    this._hint = text;
    this._render();
  }

  setSelection(macro) {
    this._selection = macro;
    this._render();
  }

  setScale(s) {
    this._scale = s;
    this._zoomPct = Math.round(s * 100);
    this._render();
  }

  setLayerSummary(text) {
    this._layerSummary = text;
    this._render();
  }

  _render() {
    const sel = this._selection;
    const human = sel ? (SECTION_DISPLAY_NAMES[sel.section] || sel.section) : null;
    const selText = sel
      ? `${human} · ${sel.label}`
      : 'No selection';

    this.el.innerHTML = `
      <div class="sb-left">
        <span class="sb-cursor-icon" aria-hidden="true">🖱</span>
        <span class="sb-hint">${escapeHtml(this._hint)}</span>
      </div>
      <div class="sb-right">
        <span class="sb-seg" title="Zoom">${this._zoomPct}%</span>
        <span class="sb-seg sb-seg-layers" title="Layer visibility">${escapeHtml(this._layerSummary || '—')}</span>
        <span class="sb-seg sb-seg-sel">${escapeHtml(selText)}</span>
      </div>
    `;
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
