import { portfolio } from '../data/portfolio.js';

const MENUS = [
  {
    label: 'File',
    items: [
      { label: 'Resume (PDF)', action: 'resume' },
      { label: 'Print Floorplan…', action: 'print-floorplan' },
      { sep: true },
      { label: 'GitHub', action: 'github' },
      { label: 'LinkedIn', action: 'linkedin' },
      { sep: true },
      { label: 'Email', action: 'email' },
      { sep: true },
      { label: 'Exit', action: 'exit' },
    ],
  },
  {
    label: 'Navigate',
    items: [
      { label: 'Hero / About', action: 'goto-hero' },
      { label: 'Experience', action: 'goto-experience' },
      { label: 'Projects', action: 'goto-projects' },
      { label: 'Skills', action: 'goto-skills' },
      { label: 'Education', action: 'goto-education' },
      { label: 'Contact', action: 'goto-contact' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Undo navigation', action: 'nav-undo' },
      { label: 'Redo navigation', action: 'nav-redo' },
      { sep: true },
      { label: 'Zoom to Fit', action: 'fit' },
      { label: 'Reset View', action: 'fit' },
      { sep: true },
      { label: 'Toggle Standard Cells', action: 'layer-cells' },
      { label: 'Toggle Metal 1', action: 'layer-m1' },
      { label: 'Toggle Signal Animation', action: 'layer-signals' },
      { sep: true },
      { label: 'Toggle Grid', action: 'toggle-grid' },
      { label: 'Toggle Rulers', action: 'toggle-rulers' },
      { label: 'Toggle Title Block', action: 'toggle-title-block' },
      { label: 'Toggle Layer Legend', action: 'toggle-legend' },
      { sep: true },
      { label: 'Zoom In', action: 'zoom-in' },
      { label: 'Zoom Out', action: 'zoom-out' },
      { label: 'Fit All [F]', action: 'fit' },
      { sep: true },
      { label: 'Clear Selection', action: 'deselect' },
      { sep: true },
      { label: 'Focus Tcl Console', action: 'focus-console' },
      { label: 'Clear Console', action: 'clear-console' },
      { label: 'Toggle Console Height', action: 'toggle-console-dock' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'About Portfolio', action: 'show-about' },
      { label: 'Keyboard Shortcuts', action: 'show-shortcuts' },
    ],
  },
];

export class MenuBar {
  constructor(element) {
    this.el = element;
    this._onAction = null;
    this._render();
    document.addEventListener('click', () => this._closeAll());
  }

  onAction(fn) { this._onAction = fn; }

  _render() {
    this.el.innerHTML = MENUS.map(m => `
      <div class="mb-item" data-menu="${m.label}">
        ${m.label}
        <div class="mb-dropdown">
          ${m.items.map(item => item.sep
            ? '<div class="mb-dsep"></div>'
            : `<div class="mb-ditem" data-action="${item.action}">${item.label}</div>`
          ).join('')}
        </div>
      </div>
    `).join('');

    this.el.querySelectorAll('.mb-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = el.classList.contains('open');
        this._closeAll();
        if (!wasOpen && el.querySelector('.mb-dropdown')) {
          el.classList.add('open');
        }
      });
    });

    this.el.querySelectorAll('.mb-ditem').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        this._closeAll();
        this._handleAction(action);
      });
    });
  }

  _handleAction(action) {
    switch (action) {
      case 'resume':
        window.open(portfolio.resumeUrl, '_blank');
        return;
      case 'github':
        window.open('https://' + portfolio.github, '_blank');
        return;
      case 'linkedin':
        window.open('https://' + portfolio.linkedin, '_blank');
        return;
      case 'email':
        window.location.href = 'mailto:' + portfolio.email;
        return;
      case 'exit':
        return;
      default:
        break;
    }
    if (this._onAction) this._onAction(action);
  }

  _closeAll() {
    this.el.querySelectorAll('.mb-item').forEach(el => el.classList.remove('open'));
  }
}
