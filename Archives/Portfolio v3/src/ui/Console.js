import { DESIGN_LIB, DESIGN_NAME, portfolio, SECTION_TO_TCL } from '../data/portfolio.js';

/**
 * Tcl-style fusion console: log, startup banner, command input.
 */
export class Console {
  /**
   * @param {HTMLElement} container - #console-dock
   * @param {(cmd: string, args: string[]) => void} onCommand
   */
  constructor(container, onCommand) {
    this._onCommand = onCommand;
    this._el = container;
    this._logEl = null;
    this._inputEl = null;
    this._maxLines = 400;
    this._render();
    this._bind();
  }

  focusInput() {
    this._inputEl?.focus();
  }

  _render() {
    this._el.innerHTML = `
      <div class="console-inner">
        <div class="console-log" id="console-log" role="log" aria-live="polite"></div>
        <div class="console-input-row">
          <span class="console-prompt" aria-hidden="true">fusion&gt;</span>
          <input type="text" class="console-input" id="console-input" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Tcl command…" />
        </div>
      </div>
    `;
    this._logEl = this._el.querySelector('#console-log');
    this._inputEl = this._el.querySelector('#console-input');
  }

  _bind() {
    this._inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const raw = this._inputEl.value.trim();
        if (!raw) return;
        this.appendLine(`fusion> ${raw}`, 'cmd');
        this._inputEl.value = '';
        this._dispatch(raw);
      }
    });
  }

  _dispatch(raw) {
    const tokens = raw.split(/\s+/).filter(Boolean);
    const cmd = tokens[0]?.toLowerCase() || '';
    const rest = tokens.slice(1);

    if (this._onCommand) {
      this._onCommand(cmd, rest);
      return;
    }
    this.appendLine(`Error: unknown command '${cmd}'`, 'err');
  }

  /** Public API for external logging (matches Tcl tone) */
  log(line, type = 'out') {
    this.appendLine(line, type);
  }

  appendLine(text, type = 'out') {
    if (!this._logEl) return;
    const div = document.createElement('div');
    div.className = `console-line console-line--${type}`;
    div.textContent = text;
    this._logEl.appendChild(div);
    while (this._logEl.children.length > this._maxLines) {
      this._logEl.removeChild(this._logEl.firstChild);
    }
    this._logEl.scrollTop = this._logEl.scrollHeight;
  }

  clearLog() {
    if (this._logEl) this._logEl.innerHTML = '';
  }

  printBanner() {
    const d = new Date().toISOString().slice(0, 19).replace('T', ' ');
    this.appendLine('################################################################', 'banner');
    this.appendLine('#  Synopsys Fusion Compiler (portfolio shell)', 'banner');
    this.appendLine(`#  Version: portfolio-ui 1.0  |  ${d}`, 'banner');
    this.appendLine(`#  current_design: ${DESIGN_LIB}:${DESIGN_NAME}`, 'banner');
    this.appendLine(`#  Owner: ${portfolio.name}  <${portfolio.email}>`, 'banner');
    this.appendLine('################################################################', 'banner');
    this.appendLine(`#  Type "help" for navigation commands.`, 'banner');
    this.appendLine('', 'out');
  }

  /** Echo a user action as if it were a Tcl command */
  logAction(tclLine) {
    this.appendLine(`# ${tclLine}`, 'action');
  }

  /** Map section id to Tcl macro name for logging */
  static sectionToTcl(section) {
    return SECTION_TO_TCL[section] || section;
  }
}

/** Built-in help text (shown in console) */
export const CONSOLE_HELP_LINES = [
  'help                          — this help',
  'report_area -section <name>   — zoom & select (hero|experience|projects|skills|education|contact)',
  'set_selection <MACRO>         — e.g. set_selection HERO_MACRO',
  'zoom_to_fit                   — fit entire floorplan',
  'fit                           — same as zoom_to_fit',
  'clear                         — clear console log',
];
