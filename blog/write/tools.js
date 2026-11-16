// Editor.js blocks for photos and Google Maps.
import { addDoc, collection, serverTimestamp, Bytes } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { db, el, parseMap, renderMap, showImage } from '../shared.js';

const MAX_BYTES = 950_000;   // a Firestore document tops out at 1 MiB
const ICON_PHOTO = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/></svg>';
const ICON_MAP = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/></svg>';
const ICON_WIDE = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>';

const toBlob = (canvas, type, q) => new Promise(r => canvas.toBlob(r, type, q));

// Shrink a photo until it fits in one Firestore document: WebP where the
// browser can encode it, JPEG otherwise. Quality steps down before size does.
export async function encode(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let edge = 2048, q = 0.86;
  for (let i = 0; i < 10; i++) {
    const k = Math.min(1, edge / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    let blob = await toBlob(canvas, 'image/webp', q);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', q);
    if (blob.size <= MAX_BYTES) {
      // A 24px copy, blurred on the page while the real one loads.
      const tiny = Object.assign(document.createElement('canvas'), { width: 24, height: Math.max(1, Math.round(24 * h / w)) });
      tiny.getContext('2d').drawImage(bmp, 0, 0, tiny.width, tiny.height);
      bmp.close();
      return { blob, w, h, lqip: tiny.toDataURL('image/jpeg', 0.5) };
    }
    if (q > 0.7) q -= 0.08; else edge = Math.round(edge * 0.8);
  }
  bmp.close();
  throw new Error('too-large');
}

export async function uploadPhoto(file) {
  const { blob, w, h, lqip } = await encode(file);
  const bytes = Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer()));
  const ref = await addDoc(collection(db, 'images'), { bytes, type: blob.type, w, h, createdAt: serverTimestamp() });
  return { id: ref.id, w, h, lqip };
}

function caption(text, placeholder, onInput) {
  const c = el('div', 'ed-caption');
  c.contentEditable = 'true';
  c.dataset.placeholder = placeholder;
  c.textContent = text || '';
  c.addEventListener('input', onInput);
  return c;
}

function wideTune(tool) {
  return [{
    icon: ICON_WIDE,
    label: 'Wide',
    toggle: true,
    isActive: tool.data.wide,
    closeOnActivate: true,
    onActivate: () => {
      tool.data.wide = !tool.data.wide;
      tool.wrap.classList.toggle('is-wide', tool.data.wide);
      tool.block?.dispatchChange();
    },
  }];
}

/* ── Photo ────────────────────────────────────────────────────────────── */
export class PhotoTool {
  static get toolbox() { return { title: 'Photo', icon: ICON_PHOTO }; }
  static get pasteConfig() { return { files: { mimeTypes: ['image/*'] } }; }

  constructor({ data, block }) {
    this.data = { id: '', w: 0, h: 0, lqip: '', caption: '', wide: false, ...data };
    this.block = block;
  }

  render() {
    this.wrap = el('div', `ed-fig${this.data.wide ? ' is-wide' : ''}`);
    if (this.data.id) this.drawPhoto(); else this.drawPicker();
    return this.wrap;
  }

  drawPicker(message) {
    const zone = el('div', 'ed-drop');
    const input = el('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    const btn = el('button', 'pill pill-sm', 'Choose a photo');
    btn.type = 'button';
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => input.files[0] && this.upload(input.files[0]));
    const hint = el('p', 'meta', message || 'or drop one here. You can also paste a photo anywhere in the post.');
    if (message) hint.classList.add('is-error');
    zone.append(btn, hint, input);
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('is-over');
      const f = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
      if (f) this.upload(f);
    });
    this.wrap.replaceChildren(zone);
  }

  drawPhoto(localUrl) {
    const frame = el('div', 'ph ed-ph');
    if (this.data.lqip) frame.style.setProperty('--lqip', `url("${this.data.lqip}")`);
    const img = el('img');
    img.alt = '';
    if (this.data.w) { img.width = this.data.w; img.height = this.data.h; }
    frame.append(img);
    if (localUrl) {
      img.src = localUrl;
      img.classList.add('is-loaded');
      frame.classList.add('is-uploading');
      frame.append(el('span', 'ed-progress meta', 'Uploading…'));
    } else {
      showImage(img, this.data.id);
    }
    this.cap = caption(this.data.caption, 'Add a caption', () => this.block?.dispatchChange());
    this.wrap.replaceChildren(frame, this.cap);
  }

  async upload(file) {
    const local = URL.createObjectURL(file);
    this.drawPhoto(local);
    try {
      Object.assign(this.data, await uploadPhoto(file));
      this.drawPhoto();
      this.block?.dispatchChange();
    } catch (err) {
      console.error(err);
      this.drawPicker(err.message === 'too-large'
        ? 'That photo couldn’t be made small enough. Try a smaller one.'
        : /decode|source image/i.test(err.message) || err.name === 'InvalidStateError'
          ? 'This browser can’t open that format (HEIC?). Export it as JPEG and try again.'
          : 'Upload failed. Check your connection and try again.');
    } finally {
      URL.revokeObjectURL(local);
    }
  }

  onPaste(e) {
    if (e.type === 'file') this.upload(e.detail.file);
  }

  renderSettings() { return wideTune(this); }

  save() {
    return { ...this.data, caption: this.cap ? this.cap.textContent.trim() : this.data.caption };
  }

  validate(data) { return Boolean(data.id); }
}

/* ── Map ──────────────────────────────────────────────────────────────── */
export class MapTool {
  static get toolbox() { return { title: 'Map', icon: ICON_MAP }; }

  constructor({ data, block }) {
    this.data = { input: '', src: '', link: '', caption: '', wide: false, ...data };
    this.block = block;
  }

  render() {
    this.wrap = el('div', `ed-fig${this.data.wide ? ' is-wide' : ''}`);
    if (this.data.src) this.drawMap(); else this.drawInput();
    return this.wrap;
  }

  drawInput(message) {
    const box = el('div', 'ed-drop ed-map-input');
    const input = el('input');
    input.type = 'text';
    input.placeholder = 'Place, address, Google Maps link, or embed code';
    input.value = this.data.input;
    input.setAttribute('aria-label', 'Place or Google Maps link');
    const hint = el('p', 'meta', message || 'Press Return to show the map.');
    if (message) hint.classList.add('is-error');
    const apply = () => {
      const v = input.value.trim();
      if (!v) return;
      if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(v)) {
        this.drawInput('Short share links can’t be read. Open it, then copy the full address bar URL, or use Share → Embed a map.');
        return;
      }
      const m = parseMap(v);
      if (!m) { this.drawInput('That doesn’t look like a Google Maps link. A place name or address works too.'); return; }
      Object.assign(this.data, m, { input: v });
      this.drawMap();
      this.block?.dispatchChange();
    };
    // Keep Return and Backspace from reaching the editor (new block / delete block).
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); apply(); }
    });
    input.addEventListener('paste', e => {
      e.stopPropagation();
      setTimeout(apply);
    });
    box.append(input, hint);
    this.wrap.replaceChildren(box);
    setTimeout(() => input.focus());
  }

  drawMap() {
    const fig = renderMap({ src: this.data.src });
    const frame = fig ? fig.querySelector('.map-frame') : el('div', 'map-frame');
    const change = el('button', 'meta text-btn ed-change', 'Change place');
    change.type = 'button';
    change.addEventListener('click', () => this.drawInput());
    this.cap = caption(this.data.caption, 'Add a caption', () => this.block?.dispatchChange());
    this.wrap.replaceChildren(frame, this.cap, change);
  }

  renderSettings() { return wideTune(this); }

  save() {
    return { ...this.data, caption: this.cap ? this.cap.textContent.trim() : this.data.caption };
  }

  validate(data) { return Boolean(data.src); }
}
