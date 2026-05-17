// Main toolbar (icon row) + Left toolbar (vertical strip)

const MAIN_TOOLS = [
  { id: 'select', icon: '↖', title: 'Select [S]', active: true },
  { sep: true },
  { id: 'zoom-in', icon: '⊕', title: 'Zoom In' },
  { id: 'zoom-out', icon: '⊖', title: 'Zoom Out' },
  { id: 'fit', icon: '⛶', title: 'Fit All [F]' },
  { sep: true },
  { id: 'nav-undo', icon: '↩', title: 'Undo navigation' },
  { id: 'nav-redo', icon: '↪', title: 'Redo navigation' },
];

const LEFT_TOOLS = [
  { id: 'lsel', icon: '↖', title: 'Select', active: true },
  { id: 'lpan', icon: '✋', title: 'Pan / Drag' },
  { sep: true },
  { id: 'lzi', icon: '⊕', title: 'Zoom In' },
  { id: 'lzo', icon: '⊖', title: 'Zoom Out' },
  { id: 'lfit', icon: '⛶', title: 'Fit' },
  { sep: true },
  { id: 'lscr', icon: '⌨', title: 'Focus Console' },
  { id: 'linfo', icon: '⊙', title: 'Keyboard Shortcuts' },
];

export class Toolbar {
  constructor(mainEl, leftEl) {
    this.mainEl = mainEl;
    this.leftEl = leftEl;
    this._activeTool = 'select';
    this._onAction = null;
    this._renderMain();
    this._renderLeft();
  }

  onAction(fn) { this._onAction = fn; }

  setActiveTool(id) {
    this._activeTool = id;
    this._renderMain();
    this._renderLeft();
  }

  getActiveTool() {
    return this._activeTool;
  }

  _renderMain() {
    this.mainEl.innerHTML = MAIN_TOOLS.map(t => {
      if (t.sep) return '<div class="tb-sep-v"></div><div class="tb-sep-v-light"></div>';
      const active = t.id === this._activeTool ? 'active' : '';
      return `<button type="button" class="tbtn ${active}" title="${t.title}" data-tool="${t.id}">${t.icon}</button>`;
    }).join('');

    this.mainEl.querySelectorAll('.tbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tool;
        if (id === 'nav-undo') { if (this._onAction) this._onAction('nav-undo'); return; }
        if (id === 'nav-redo') { if (this._onAction) this._onAction('nav-redo'); return; }
        this._activeTool = id;
        this._renderMain();
        if (this._onAction) this._onAction(id);
      });
    });
  }

  _renderLeft() {
    this.leftEl.innerHTML = LEFT_TOOLS.map(t => {
      if (t.sep) return '<div class="lt-sep"></div>';
      const mapSel = { lsel: 'select', lpan: 'pan', lzi: 'zoom-in', lzo: 'zoom-out', lfit: 'fit' };
      const at = mapSel[t.id] || '';
      const active = at && at === this._activeTool ? 'active' : '';
      return `<button type="button" class="lt-btn ${active}" title="${t.title}" data-tool="${t.id}">${t.icon}</button>`;
    }).join('') + `<div class="lt-bottom" title="Selection count">0</div>`;

    this.leftEl.querySelectorAll('.lt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tool;
        const actionMap = {
          lsel: 'select',
          lpan: 'pan',
          lzi: 'zoom-in',
          lzo: 'zoom-out',
          lfit: 'fit',
          lscr: 'focus-console',
          linfo: 'show-shortcuts',
        };
        const action = actionMap[id];
        if (id === 'lpan') {
          this._activeTool = 'pan';
          this._renderMain();
          this._renderLeft();
        } else if (id === 'lsel') {
          this._activeTool = 'select';
          this._renderMain();
          this._renderLeft();
        }
        if (action && this._onAction) this._onAction(action);
      });
    });
  }

  setSelectionCount(n) {
    const el = this.leftEl.querySelector('.lt-bottom');
    if (el) el.textContent = String(n);
  }
}
