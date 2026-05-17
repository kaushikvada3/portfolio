import { portfolio, SECTION_DISPLAY_NAMES } from '../data/portfolio.js';

const VOLTAGE_LAYERS = [
  { id: 'level-shift-reg',  label: 'Level Shift... (Regular)', checked: true,  swatch: '#ffffff', count: '0' },
  { id: 'level-shift-en',   label: 'Level Shifters (Enable)',  checked: true,  swatch: '#ffffff', count: '0' },
  { id: 'always-on',        label: 'Always-On Cells',          checked: true,  swatch: '#ffffff', count: '0' },
  { id: 'isolation',        label: 'Isolation Cells',          checked: true,  swatch: '#ffffff', count: '0' },
  { id: 'tie-off',          label: 'Tie-Off Cells',            checked: true,  swatch: '#ffffff', count: '0' },
  { id: 'mtcmos',           label: 'MTCMOS Cells',             checked: true,  swatch: '#00cc00', count: '0' },
  { id: 'default-va',       label: 'DEFAULT_VA',               checked: false, swatch: '#e8e4a0', count: '1' },
  { id: 'cells-default-va', label: 'Cells of DEFAULT_VA',      checked: false, swatch: '#e8e4a0', count: '17983' },
];

export class PropertiesPanel {
  constructor(element, layerManager) {
    this.el = element;
    this.lm = layerManager;
    this._selectedMacro = null;
    this._render();
  }

  setMacro(macro) {
    this._selectedMacro = macro;
    this._render();
  }

  _render() {
    if (this._selectedMacro) {
      this._renderProperties();
    } else {
      this._renderVisualMode();
    }
  }

  _renderVisualMode() {
    this.el.innerHTML = `
      <div class="rp-header">
        <span class="rp-header-icon">⟲</span>
        <span class="rp-header-title">Visual Mode</span>
      </div>
      <div class="rp-row">
        <select class="rp-dropdown">
          <option>Voltage Areas</option>
          <option>Clock Domains</option>
          <option>Power Domains</option>
          <option>Scan Chains</option>
        </select>
        <button type="button" class="rp-icon-btn" title="Run">▶</button>
      </div>
      <div class="rp-row">
        <button type="button" class="rp-text-btn" id="rp-apply">Apply</button>
        <button type="button" class="rp-text-btn" id="rp-reload">Reload</button>
        <span style="flex:1"></span>
        <button type="button" class="rp-icon-btn" title="Help">?</button>
        <button type="button" class="rp-icon-btn" title="Settings">⚙</button>
      </div>
      <div class="rp-body">
        ${VOLTAGE_LAYERS.map(l => `
          <div class="rp-layer-row">
            <input type="checkbox" ${l.checked ? 'checked' : ''} />
            <span class="rp-layer-name">${l.label}</span>
            <span class="rp-layer-swatch" style="background:${l.swatch}; border:1px solid #808080"></span>
            <span class="rp-layer-count">${l.count}</span>
          </div>
        `).join('')}
        <div class="rp-hint-box rp-hint-box--welcome">
          <p><strong>Tip:</strong> Click a macro to inspect. Double-click zooms in. <kbd>Esc</kbd> resets the view.</p>
          <p class="rp-hint-muted">Use the Tcl console or <kbd>1</kbd>–<kbd>6</kbd> to jump between sections.</p>
        </div>
      </div>
    `;

    const checks = this.el.querySelectorAll('.rp-layer-row input[type=checkbox]');
    checks.forEach((cb, i) => {
      cb.addEventListener('change', () => {
        const id = VOLTAGE_LAYERS[i].id;
        if (id === 'mtcmos') this.lm.setVisible('cells', cb.checked);
        if (id === 'default-va') this.lm.setVisible('m1', cb.checked);
        if (id === 'cells-default-va') this.lm.setVisible('signals', cb.checked);
      });
    });
  }

  _renderProperties() {
    const m = this._selectedMacro;
    const section = m.section;

    let content = '';
    switch (section) {
      case 'hero':       content = this._heroContent(); break;
      case 'experience': content = this._expContent();  break;
      case 'projects':   content = this._projContent(); break;
      case 'skills':     content = this._skillContent(); break;
      case 'education':  content = this._eduContent(); break;
      case 'contact':    content = this._contactContent(); break;
      default: content = '';
    }

    this.el.innerHTML = `
      <div class="rp-header">
        <span class="rp-header-icon">⟲</span>
        <span class="rp-header-title">Properties</span>
      </div>
      <div class="rp-row">
        <button type="button" class="rp-text-btn" id="rp-back">← Visual Mode</button>
      </div>
      <div class="rp-body rp-body--rich">${content}</div>
    `;

    this.el.querySelector('#rp-back')?.addEventListener('click', () => {
      this._selectedMacro = null;
      this._render();
    });
  }

  _heroContent() {
    const p = portfolio;
    return `
      <div class="rp-hero">
        <p class="rp-hero-kicker">Portfolio owner</p>
        <h1 class="rp-hero-name">${p.name}</h1>
        <p class="rp-hero-title">${p.title}</p>
        <p class="rp-hero-tagline">${p.tagline}</p>
        <p class="rp-hero-sub">${p.subtitle}</p>
        <dl class="rp-dl rp-dl--contact">
          <div><dt>Location</dt><dd>${p.location}</dd></div>
          <div><dt>Email</dt><dd><a href="mailto:${p.email}">${p.email}</a></dd></div>
          <div><dt>GitHub</dt><dd><a href="https://${p.github}" target="_blank" rel="noopener">${p.github}</a></dd></div>
          <div><dt>LinkedIn</dt><dd><a href="https://${p.linkedin}" target="_blank" rel="noopener">${p.linkedin}</a></dd></div>
        </dl>
        <div class="rp-actions rp-actions--hero">
          <a href="${p.resumeUrl}" target="_blank" rel="noopener" class="rp-action-btn rp-action-btn--resume">↓ Resume PDF</a>
          <a href="https://${p.github}" target="_blank" rel="noopener" class="rp-action-btn rp-action-btn--github">GitHub ↗</a>
          <a href="https://${p.linkedin}" target="_blank" rel="noopener" class="rp-action-btn rp-action-btn--linkedin">LinkedIn</a>
        </div>
      </div>
      <div class="rp-prop-meta">
        <span class="rp-mono">${this._selectedMacro.label}</span>
        <span class="rp-mono rp-dim">${this._selectedMacro.sublabel}</span>
      </div>
    `;
  }

  _expContent() {
    const entries = portfolio.experience.map((e) => `
      <article class="rp-card">
        <h3 class="rp-card-title">${e.company}</h3>
        <p class="rp-card-role">${e.role}</p>
        <p class="rp-card-meta">${e.time} · ${e.location}</p>
        <ul class="rp-card-list">
          ${e.bullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
      </article>
    `).join('');

    const sec = this._selectedMacro.section;
    const human = SECTION_DISPLAY_NAMES[sec] || 'Experience';
    return `
      <div class="rp-section-head">
        <h2 class="rp-section-human">${human}</h2>
        <p class="rp-section-eda">${this._selectedMacro.label}</p>
        <p class="rp-section-sub">${this._selectedMacro.sublabel}</p>
        <p class="rp-badge">${portfolio.experience.length} roles · Active</p>
      </div>
      ${entries}
    `;
  }

  _projContent() {
    const items = portfolio.projects.map(proj => `
      <article class="rp-card rp-card--proj">
        <h3 class="rp-card-title">${proj.name}</h3>
        <p class="rp-card-meta">${proj.year} · ${proj.type}${proj.cells != null ? ' · ' + proj.cells.toLocaleString() + ' cells' : ''}</p>
        <p class="rp-card-desc">${proj.desc}</p>
        <div class="rp-tags">${proj.tags.map(t => `<span class="rp-tag">${t}</span>`).join('')}</div>
      </article>
    `).join('');

    const sec = this._selectedMacro.section;
    const human = SECTION_DISPLAY_NAMES[sec] || 'Projects';
    return `
      <div class="rp-section-head">
        <h2 class="rp-section-human">${human}</h2>
        <p class="rp-section-eda">${this._selectedMacro.label}</p>
        <p class="rp-section-sub">${this._selectedMacro.sublabel}</p>
        <p class="rp-badge">${portfolio.projects.length} projects</p>
      </div>
      ${items}
    `;
  }

  _skillContent() {
    const cats = portfolio.skills.map(s => `
      <div class="rp-skill-block">
        <h4 class="rp-skill-cat-label">${s.category}</h4>
        <div class="rp-skill-items">
          ${s.items.map(item => `<span class="rp-skill-item">${item}</span>`).join('')}
        </div>
      </div>
    `).join('');

    const sec = this._selectedMacro.section;
    const human = SECTION_DISPLAY_NAMES[sec] || 'Skills';
    return `
      <div class="rp-section-head">
        <h2 class="rp-section-human">${human}</h2>
        <p class="rp-section-eda">${this._selectedMacro.label}</p>
        <p class="rp-section-sub">${this._selectedMacro.sublabel}</p>
      </div>
      ${cats}
    `;
  }

  _eduContent() {
    const blocks = portfolio.education.map((ed) => `
      <article class="rp-card">
        <h3 class="rp-card-title">${ed.school}</h3>
        <p class="rp-card-role">${ed.degree}</p>
        <p class="rp-card-meta">${ed.time} · ${ed.location}</p>
        ${ed.gpa != null ? `<p class="rp-card-meta">GPA: ${ed.gpa}</p>` : ''}
        <ul class="rp-card-list">
          ${ed.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
      </article>
    `).join('');

    const sec = this._selectedMacro.section;
    const human = SECTION_DISPLAY_NAMES[sec] || 'Education';
    return `
      <div class="rp-section-head">
        <h2 class="rp-section-human">${human}</h2>
        <p class="rp-section-eda">${this._selectedMacro.label}</p>
        <p class="rp-section-sub">${this._selectedMacro.sublabel}</p>
        <p class="rp-badge">${portfolio.education.length} program</p>
      </div>
      ${blocks}
    `;
  }

  _contactContent() {
    const p = portfolio;
    const sec = this._selectedMacro.section;
    const human = SECTION_DISPLAY_NAMES[sec] || 'Contact';
    return `
      <div class="rp-section-head">
        <h2 class="rp-section-human">${human}</h2>
        <p class="rp-section-eda">${this._selectedMacro.label}</p>
        <p class="rp-section-sub">${this._selectedMacro.sublabel}</p>
      </div>
      <dl class="rp-dl">
        <div><dt>Email</dt><dd><a href="mailto:${p.email}">${p.email}</a></dd></div>
        <div><dt>GitHub</dt><dd><a href="https://${p.github}" target="_blank" rel="noopener">${p.github}</a></dd></div>
        <div><dt>LinkedIn</dt><dd><a href="https://${p.linkedin}" target="_blank" rel="noopener">${p.linkedin}</a></dd></div>
        <div><dt>Location</dt><dd>${p.location}</dd></div>
      </dl>
      <div class="rp-actions">
        <a href="mailto:${p.email}" class="rp-action-btn rp-action-btn--primary">✉ Email</a>
        <a href="${p.resumeUrl}" target="_blank" rel="noopener" class="rp-action-btn">↓ Resume</a>
      </div>
      <div class="rp-actions rp-actions--tight">
        <a href="https://${p.github}" target="_blank" rel="noopener" class="rp-action-btn">GitHub ↗</a>
        <a href="https://${p.linkedin}" target="_blank" rel="noopener" class="rp-action-btn">LinkedIn ↗</a>
      </div>
    `;
  }
}
