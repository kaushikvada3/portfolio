import { portfolio } from '../data/portfolio.js';

export class ShortcutsOverlay {
  constructor(rootEl) {
    this._root = rootEl;
    this._render();
  }

  _render() {
    this._root.innerHTML = `
      <div class="overlay-backdrop" id="shortcuts-overlay" hidden>
        <div class="overlay-panel overlay-panel--shortcuts" role="dialog" aria-labelledby="sh-title">
          <div class="overlay-header">
            <h2 id="sh-title">Keyboard shortcuts</h2>
            <button type="button" class="overlay-close" data-close-shortcuts aria-label="Close">✕</button>
          </div>
          <div class="overlay-body">
            <table class="shortcut-table">
              <tr><td><kbd>1</kbd> – <kbd>6</kbd></td><td>Jump to portfolio sections (Hero → Contact)</td></tr>
              <tr><td><kbd>F</kbd></td><td>Zoom to fit floorplan</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Clear selection &amp; fit</td></tr>
              <tr><td><kbd>G</kbd></td><td>Toggle design grid</td></tr>
              <tr><td><kbd>R</kbd></td><td>Toggle rulers</td></tr>
              <tr><td><kbd>T</kbd></td><td>Toggle title block overlay</td></tr>
              <tr><td><kbd>?</kbd> or <kbd>H</kbd></td><td>This panel</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>L</kbd></td><td>Focus Tcl console</td></tr>
            </table>
            <p class="overlay-hint">Zoom out: click empty space on the chip, or press F · Pan: drag · Zoom: wheel</p>
          </div>
        </div>
      </div>
      <div class="overlay-backdrop" id="about-overlay" hidden>
        <div class="overlay-panel overlay-panel--about" role="dialog" aria-labelledby="ab-title">
          <div class="overlay-header">
            <h2 id="ab-title">About this portfolio</h2>
            <button type="button" class="overlay-close" data-close-about aria-label="Close">✕</button>
          </div>
          <div class="overlay-body">
            <p class="about-name">${escapeHtml(portfolio.name)}</p>
            <p class="about-title">${escapeHtml(portfolio.title)}</p>
            <p class="about-summary">${escapeHtml(portfolio.summary)}</p>
            <p class="about-meta">Fusion Compiler–inspired UI · RTL / VLSI focus · Built with Vite + Canvas</p>
          </div>
        </div>
      </div>
    `;

    this._shortcutsEl = this._root.querySelector('#shortcuts-overlay');
    this._aboutEl = this._root.querySelector('#about-overlay');

    this._shortcutsEl.querySelector('[data-close-shortcuts]').addEventListener('click', () => this.hideShortcuts());
    this._aboutEl.querySelector('[data-close-about]').addEventListener('click', () => this.hideAbout());

    this._shortcutsEl.addEventListener('click', (e) => {
      if (e.target === this._shortcutsEl) this.hideShortcuts();
    });
    this._aboutEl.addEventListener('click', (e) => {
      if (e.target === this._aboutEl) this.hideAbout();
    });
  }

  showShortcuts() {
    this._shortcutsEl.hidden = false;
  }

  hideShortcuts() {
    this._shortcutsEl.hidden = true;
  }

  toggleShortcuts() {
    this._shortcutsEl.hidden = !this._shortcutsEl.hidden;
  }

  showAbout() {
    this._aboutEl.hidden = false;
  }

  hideAbout() {
    this._aboutEl.hidden = true;
  }

  hideAll() {
    this.hideShortcuts();
    this.hideAbout();
  }

  isAnyOpen() {
    return !this._shortcutsEl.hidden || !this._aboutEl.hidden;
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
