import { FloorplanRenderer, CHIP_W, CHIP_H, RULER_STRIP } from './canvas/FloorplanRenderer.js';
import { Viewport } from './canvas/Viewport.js';
import { LayerManager } from './canvas/LayerManager.js';
import { MenuBar } from './ui/MenuBar.js';
import { Toolbar } from './ui/Toolbar.js';
import { PropertiesPanel } from './ui/PropertiesPanel.js';
import { StatusBar } from './ui/StatusBar.js';
import { Console, CONSOLE_HELP_LINES } from './ui/Console.js';
import { ShortcutsOverlay } from './ui/ShortcutsOverlay.js';
import {
  MACROS,
  SECTION_TO_TCL,
  portfolio,
  DESIGN_NAME,
  SECTION_DISPLAY_NAMES,
  getMacroHoverConsoleLine,
  getMacroSelectionConsoleLine,
} from './data/portfolio.js';

const SECTION_ORDER = ['hero', 'experience', 'projects', 'skills', 'education', 'contact'];

const DEFAULT_HINT =
  'Click a block to zoom in · Click empty space on the chip to zoom out · F = fit all · Esc = reset';

const canvas = document.getElementById('floorplan-canvas');
const menuBarEl = document.getElementById('menu-bar');
const toolbarMain = document.getElementById('toolbar-main');
const leftToolbar = document.getElementById('left-toolbar');
const rightPanelEl = document.getElementById('right-panel');
const statusBarEl = document.getElementById('status-bar');
const consoleDock = document.getElementById('console-dock');
const overlayRoot = document.getElementById('overlay-root');
const appEl = document.getElementById('app');
const titleBarTitle = document.querySelector('#title-bar .tb-title');

const layerManager = new LayerManager();
const renderer = new FloorplanRenderer(canvas, layerManager);
const viewport = new Viewport(canvas);
const menuBar = new MenuBar(menuBarEl);
const toolbar = new Toolbar(toolbarMain, leftToolbar);
const panel = new PropertiesPanel(rightPanelEl, layerManager);
const statusBar = new StatusBar(statusBarEl);
const shortcuts = new ShortcutsOverlay(overlayRoot);

let showRulers = true;
let showTitleBlock = true;
let showLegend = true;
let showGrid = true;
let consoleExpanded = true;
/** @type {string | null} */
let lastHoverLogId = null;

/** @type {{ past: string[], future: string[] }} */
const navHistory = { past: [], future: [] };

function updateLayerSummary() {
  const layers = layerManager.getAll();
  const on = layers.filter(l => l.visible).length;
  statusBar.setLayerSummary(`Layers ${on}/${layers.length}`);
}

function syncDisplayOptions() {
  renderer.setDisplayOptions({
    showGrid,
    showTitleBlock,
    showLegend,
  });
  viewport.setChromePad(showRulers ? RULER_STRIP : 0);
}

function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
  syncDisplayOptions();
  viewport.fitToDesign(CHIP_W, CHIP_H, 20);
}

let fusionConsole = null;

function handleConsoleCommand(cmd, rest) {
  if (cmd === 'help') {
    CONSOLE_HELP_LINES.forEach((l) => fusionConsole.appendLine(l, 'out'));
    return;
  }
  if (cmd === 'clear') {
    fusionConsole.clearLog();
    fusionConsole.printBanner();
    return;
  }
  if (cmd === 'zoom_to_fit' || cmd === 'fit') {
    fusionConsole.logAction('zoom_to_fit');
    viewport.resetView(CHIP_W, CHIP_H, 20, 320);
    return;
  }
  if (cmd === 'report_area' && rest[0] === '-section' && rest[1]) {
    const sec = rest[1].toLowerCase();
    fusionConsole.logAction(`report_area -section ${sec}`);
    selectSection(sec, false);
    return;
  }
  if (cmd === 'set_selection' && rest[0]) {
    const id = rest[0].toUpperCase();
    const macro = MACROS.find((m) => m.id === id || m.label === id);
    if (macro) {
      fusionConsole.logAction(`set_selection ${macro.id}`);
      applySelection(macro, false);
    } else {
      fusionConsole.appendLine(`Error: unknown macro ${rest[0]}`, 'err');
    }
    return;
  }
  fusionConsole.appendLine(`Error: unknown command '${cmd}'. Type help.`, 'err');
}

fusionConsole = new Console(consoleDock, handleConsoleCommand);

function pushNavHistory(sectionId) {
  navHistory.past.push(sectionId);
  navHistory.future.length = 0;
  if (navHistory.past.length > 40) navHistory.past.shift();
}

function navUndo() {
  if (navHistory.past.length < 2) return;
  const cur = navHistory.past.pop();
  navHistory.future.unshift(cur);
  const prev = navHistory.past[navHistory.past.length - 1];
  const macro = MACROS.find((m) => m.section === prev);
  if (macro) applySelection(macro, false);
}

function navRedo() {
  if (!navHistory.future.length) return;
  const next = navHistory.future.shift();
  navHistory.past.push(next);
  const macro = MACROS.find((m) => m.section === next);
  if (macro) applySelection(macro, false);
}

function applySelection(macro, recordHistory) {
  renderer.selectedMacro = macro;
  panel.setMacro(macro);
  statusBar.setSelection(macro);
  toolbar.setSelectionCount(macro ? 1 : 0);
  if (recordHistory && macro) pushNavHistory(macro.section);
  if (macro && fusionConsole) {
    fusionConsole.appendLine(getMacroSelectionConsoleLine(macro), 'action');
  }
  const narrow = window.matchMedia('(max-width: 900px)').matches;
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  if (narrow && !mobile) {
    appEl.classList.toggle('panel-open', !!macro);
  }
}

function selectSection(sectionId, recordHistory = true) {
  const macro = MACROS.find((m) => m.section === sectionId);
  if (!macro) return;
  applySelection(macro, recordHistory);
  viewport.zoomToRect(macro.x, macro.y, macro.w, macro.h, 40, 400);
  const tcl = SECTION_TO_TCL[sectionId] || macro.id;
  fusionConsole?.logAction(`set_selection ${tcl}`);
}

function runWelcome() {
  fusionConsole.printBanner();
  fusionConsole.logAction('source -echo -verbose portfolio_init.tcl');
  const hero = MACROS.find((m) => m.section === 'hero');
  navHistory.past.length = 0;
  navHistory.future.length = 0;
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  if (mobile) {
    if (hero) applySelection(hero, true);
    return;
  }
  if (hero) {
    applySelection(hero, true);
    viewport.zoomToRect(hero.x, hero.y, hero.w, hero.h, 40, 400);
  }
  setTimeout(() => {
    viewport.resetView(CHIP_W, CHIP_H, 20, 400);
    fusionConsole.logAction('zoom_to_fit');
  }, 2000);
}

if (titleBarTitle) {
  titleBarTitle.textContent = `Fusion Compiler · ${DESIGN_NAME} · ${portfolio.email}`;
}

function handleMenuAction(action) {
  switch (action) {
    case 'print-floorplan':
      fusionConsole.logAction('print');
      window.print();
      return;
    case 'show-shortcuts':
      shortcuts.showShortcuts();
      return;
    case 'show-about':
      shortcuts.showAbout();
      return;
    case 'toggle-grid':
      showGrid = !showGrid;
      renderer.setDisplayOptions({ showGrid });
      fusionConsole.logAction(`set_app_var show_grid ${showGrid ? 'true' : 'false'}`);
      return;
    case 'toggle-rulers':
      showRulers = !showRulers;
      syncDisplayOptions();
      resizeCanvas();
      fusionConsole.logAction(`set_app_var show_rulers ${showRulers ? 'true' : 'false'}`);
      return;
    case 'toggle-title-block':
      showTitleBlock = !showTitleBlock;
      renderer.setDisplayOptions({ showTitleBlock });
      fusionConsole.logAction(`set_app_var title_block ${showTitleBlock ? 'true' : 'false'}`);
      return;
    case 'toggle-legend':
      showLegend = !showLegend;
      renderer.setDisplayOptions({ showLegend });
      fusionConsole.logAction(`set_app_var layer_legend ${showLegend ? 'true' : 'false'}`);
      return;
    case 'toggle-console-dock':
      consoleExpanded = !consoleExpanded;
      appEl.classList.toggle('console-collapsed', !consoleExpanded);
      resizeCanvas();
      return;
    case 'focus-console':
      fusionConsole.focusInput();
      return;
    case 'clear-console':
      fusionConsole.clearLog();
      fusionConsole.printBanner();
      return;
    case 'nav-undo':
      navUndo();
      fusionConsole.logAction('# undo_navigation');
      return;
    case 'nav-redo':
      navRedo();
      fusionConsole.logAction('# redo_navigation');
      return;
    case 'goto-hero':
      selectSection('hero');
      return;
    case 'goto-experience':
      selectSection('experience');
      return;
    case 'goto-projects':
      selectSection('projects');
      return;
    case 'goto-skills':
      selectSection('skills');
      return;
    case 'goto-education':
      selectSection('education');
      return;
    case 'goto-contact':
      selectSection('contact');
      return;
    case 'fit':
      fusionConsole.logAction('zoom_to_fit');
      viewport.resetView(CHIP_W, CHIP_H, 20, 320);
      return;
    case 'zoom-in':
      fusionConsole.logAction('zoom_in 1.5x');
      viewport.zoomChipCenter(CHIP_W, CHIP_H, 1.5, 220);
      return;
    case 'zoom-out':
      fusionConsole.logAction('zoom_out 1.5x');
      viewport.zoomChipCenter(CHIP_W, CHIP_H, 1 / 1.5, 220);
      return;
    case 'deselect':
      renderer.selectedMacro = null;
      panel.setMacro(null);
      statusBar.setSelection(null);
      toolbar.setSelectionCount(0);
      appEl.classList.remove('panel-open');
      fusionConsole.logAction('deselect_obj');
      return;
    case 'select-all':
      selectSection('hero');
      return;
    case 'layer-cells':
      layerManager.toggle('cells');
      return;
    case 'layer-m1':
      layerManager.toggle('m1');
      return;
    case 'layer-signals':
      layerManager.toggle('signals');
      return;
    default:
      break;
  }
}

menuBar.onAction(handleMenuAction);

toolbar.onAction((action) => {
  switch (action) {
    case 'zoom-in':
      fusionConsole.logAction('zoom_in 1.5x');
      viewport.zoomChipCenter(CHIP_W, CHIP_H, 1.5, 220);
      break;
    case 'zoom-out':
      fusionConsole.logAction('zoom_out 1.5x');
      viewport.zoomChipCenter(CHIP_W, CHIP_H, 1 / 1.5, 220);
      break;
    case 'fit':
      fusionConsole.logAction('zoom_to_fit');
      viewport.resetView(CHIP_W, CHIP_H, 20, 320);
      break;
    case 'select':
      statusBar.setHint(DEFAULT_HINT);
      break;
    case 'pan':
      fusionConsole.logAction('# pan_mode');
      break;
    case 'focus-console':
      fusionConsole.focusInput();
      break;
    case 'show-shortcuts':
      shortcuts.showShortcuts();
      break;
    case 'nav-undo':
      navUndo();
      break;
    case 'nav-redo':
      navRedo();
      break;
    default:
      break;
  }
});

viewport.onHover((pt) => {
  const macro = pt ? renderer.hitTest(pt) : null;
  renderer.hoveredMacro = macro;
  canvas.style.cursor = macro ? 'pointer' : '';
  if (macro && macro.id !== lastHoverLogId) {
    lastHoverLogId = macro.id;
    fusionConsole?.appendLine(getMacroHoverConsoleLine(macro), 'action');
  }
  if (!macro) lastHoverLogId = null;
  const sel = renderer.selectedMacro;
  const human = macro ? (SECTION_DISPLAY_NAMES[macro.section] || macro.label) : '';
  if (macro) {
    if (sel && sel.id !== macro.id) {
      const selHuman = SECTION_DISPLAY_NAMES[sel.section] || sel.label;
      statusBar.setHint(`Hover: ${human} · selected: ${selHuman}`);
    } else if (!sel) {
      statusBar.setHint(`Hover: ${human}`);
    } else {
      statusBar.setHint(DEFAULT_HINT);
    }
  } else {
    statusBar.setHint(DEFAULT_HINT);
  }
  statusBar.setSelection(sel);
});

viewport.onMouseMove(() => {
  statusBar.setScale(viewport.getScale());
});

viewport.onClick((pt, ev) => {
  const macro = renderer.hitTest(pt);
  if (macro) {
    applySelection(macro, true);
    fusionConsole.logAction(`set_selection ${macro.id}`);
    // Only zoom on first click of a double-click (detail 2 would fire a second zoom otherwise).
    if (!ev || ev.detail === 1) {
      fusionConsole.logAction(`zoom_obj ${macro.id}`);
      viewport.zoomToRect(macro.x, macro.y, macro.w, macro.h, 44, 420);
    }
  } else {
    renderer.selectedMacro = null;
    panel.setMacro(null);
    statusBar.setSelection(null);
    toolbar.setSelectionCount(0);
    appEl.classList.remove('panel-open');
    fusionConsole.logAction('deselect_obj');
    fusionConsole.logAction('zoom_to_fit');
    viewport.resetView(CHIP_W, CHIP_H, 20, 320);
  }
});

viewport.onDblClick((pt) => {
  const macro = renderer.hitTest(pt);
  if (macro) {
    fusionConsole.logAction(`zoom_obj -tight ${macro.id}`);
    viewport.zoomToRect(macro.x, macro.y, macro.w, macro.h, 22, 380);
  }
});

layerManager.onChange(() => {
  updateLayerSummary();
  if (!renderer.selectedMacro) panel._render();
});

document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (inField && !(e.ctrlKey && e.key.toLowerCase() === 'l')) return;

  if (e.key === '?' || (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !inField)) {
    e.preventDefault();
    shortcuts.toggleShortcuts();
    return;
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    fusionConsole.focusInput();
    return;
  }

  if (inField) return;

  switch (e.key.toUpperCase()) {
    case 'F':
      e.preventDefault();
      fusionConsole.logAction('zoom_to_fit');
      viewport.resetView(CHIP_W, CHIP_H, 20, 320);
      break;
    case 'ESCAPE':
      e.preventDefault();
      if (shortcuts.isAnyOpen()) {
        shortcuts.hideAll();
        return;
      }
      renderer.selectedMacro = null;
      panel.setMacro(null);
      statusBar.setSelection(null);
      toolbar.setSelectionCount(0);
      appEl.classList.remove('panel-open');
      viewport.resetView(CHIP_W, CHIP_H, 20, 320);
      fusionConsole.logAction('deselect_obj; zoom_to_fit');
      break;
    case 'G':
      e.preventDefault();
      showGrid = !showGrid;
      renderer.setDisplayOptions({ showGrid });
      fusionConsole.logAction(`set_app_var show_grid ${showGrid ? 'true' : 'false'}`);
      break;
    case 'R':
      e.preventDefault();
      showRulers = !showRulers;
      syncDisplayOptions();
      resizeCanvas();
      fusionConsole.logAction(`set_app_var show_rulers ${showRulers ? 'true' : 'false'}`);
      break;
    case 'T':
      e.preventDefault();
      showTitleBlock = !showTitleBlock;
      renderer.setDisplayOptions({ showTitleBlock });
      fusionConsole.logAction(`set_app_var title_block ${showTitleBlock ? 'true' : 'false'}`);
      break;
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
      e.preventDefault();
      selectSection(SECTION_ORDER[Number(e.key) - 1]);
      break;
    default:
      break;
  }
});

function animate(ts) {
  renderer.draw(viewport, ts);
  requestAnimationFrame(animate);
}

function applyNarrowMode() {
  const narrow = window.matchMedia('(max-width: 900px)').matches;
  appEl.classList.toggle('layout-narrow', narrow);
  if (!narrow) appEl.classList.remove('panel-open');
  resizeCanvas();
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderMobileFallback() {
  const el = document.getElementById('mobile-fallback');
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  const p = portfolio;
  const exp = p.experience.map(e => `
    <article class="mf-card">
      <h3>${esc(e.company)}</h3>
      <p class="mf-role">${esc(e.role)}</p>
      <p class="mf-meta">${esc(e.time)} · ${esc(e.location)}</p>
      <ul>${e.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
    </article>
  `).join('');
  const projs = p.projects.map(proj => `
    <article class="mf-card">
      <h3>${esc(proj.name)}</h3>
      <p class="mf-meta">${esc(proj.year)} · ${esc(proj.type)}</p>
      <p class="mf-desc">${esc(proj.desc)}</p>
      <div class="mf-tags">${proj.tags.map(t => `<span class="mf-tag">${esc(t)}</span>`).join('')}</div>
    </article>
  `).join('');
  const skills = p.skills.map(s => `
    <div class="mf-skill-block">
      <h4>${esc(s.category)}</h4>
      <div class="mf-skills">${s.items.map(i => `<span>${esc(i)}</span>`).join('')}</div>
    </div>
  `).join('');
  const edu = p.education.map(ed => `
    <article class="mf-card">
      <h3>${esc(ed.school)}</h3>
      <p class="mf-role">${esc(ed.degree)}</p>
      <p class="mf-meta">${esc(ed.time)} · ${esc(ed.location)}</p>
      <ul>${ed.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
    </article>
  `).join('');
  el.innerHTML = `
    <section class="mf-hero">
      <p class="mf-kicker">Portfolio</p>
      <h1 class="mf-name">${esc(p.name)}</h1>
      <p class="mf-title">${esc(p.title)}</p>
      <p class="mf-tagline">${esc(p.tagline)}</p>
      <div class="mf-actions">
        <a class="mf-btn mf-btn--primary" href="${p.resumeUrl}" target="_blank" rel="noopener">Resume PDF</a>
        <a class="mf-btn mf-btn--secondary" href="https://${p.github}" target="_blank" rel="noopener">GitHub</a>
        <a class="mf-btn mf-btn--link" href="https://${p.linkedin}" target="_blank" rel="noopener">LinkedIn</a>
      </div>
      <dl class="mf-dl">
        <div><dt>Email</dt><dd><a href="mailto:${p.email}">${esc(p.email)}</a></dd></div>
        <div><dt>Location</dt><dd>${esc(p.location)}</dd></div>
      </dl>
    </section>
    <section class="mf-section">
      <h2 class="mf-h2">${esc(SECTION_DISPLAY_NAMES.experience)}</h2>
      ${exp}
    </section>
    <section class="mf-section">
      <h2 class="mf-h2">${esc(SECTION_DISPLAY_NAMES.projects)}</h2>
      ${projs}
    </section>
    <section class="mf-section">
      <h2 class="mf-h2">${esc(SECTION_DISPLAY_NAMES.skills)}</h2>
      ${skills}
    </section>
    <section class="mf-section">
      <h2 class="mf-h2">${esc(SECTION_DISPLAY_NAMES.education)}</h2>
      ${edu}
    </section>
    <section class="mf-section mf-section--contact">
      <h2 class="mf-h2">${esc(SECTION_DISPLAY_NAMES.contact)}</h2>
      <p class="mf-contact-line"><a href="mailto:${p.email}">${esc(p.email)}</a></p>
    </section>
  `;
}

function applyMobileMode() {
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  appEl.classList.toggle('app--mobile', mobile);
  if (mobile) {
    renderMobileFallback();
  }
}

updateLayerSummary();
syncDisplayOptions();
applyMobileMode();
resizeCanvas();
window.addEventListener('resize', () => {
  applyMobileMode();
  resizeCanvas();
});
window.matchMedia('(max-width: 900px)').addEventListener('change', applyNarrowMode);
applyNarrowMode();

requestAnimationFrame(animate);
runWelcome();
