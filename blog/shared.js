// Shared by the reader (/blog/) and the editor (/blog/write/).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { initializeFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.1.7/dist/purify.es.mjs';
import { firebaseConfig } from './firebase-config.js';
import { attachViewer } from './viewer.js';

export const OWNER = 'kaushikvada3@gmail.com';
export const configured = Boolean(firebaseConfig.projectId);
export const app = configured ? initializeApp(firebaseConfig) : null;
export const db = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null;

// Links that leave the site open in a new tab.
DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener');
  }
});

// Inline formatting from the editor: bold, italic, links, code. Nothing else survives.
const INLINE = { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'code', 'mark', 'u', 's', 'br'], ALLOWED_ATTR: ['href'] };
export const sanitizeInline = html => DOMPurify.sanitize(html || '', INLINE);
const plain = html => {
  const t = document.createElement('template');
  t.innerHTML = sanitizeInline(html);
  return t.content.textContent.replace(/\s+/g, ' ').trim();
};

// Firestore timestamps arrive as Timestamp, or null while a serverTimestamp() is pending.
export const toMs = ts => (ts?.toMillis ? ts.toMillis() : ts ? +new Date(ts) : Date.now());

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const formatDate = ts => dateFmt.format(toMs(ts));

export function slugify(title) {
  return (title || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
}

export const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ── Blocks → text (list summary, reading time) ───────────────────────── */
const listText = items => (items || []).flatMap(it =>
  typeof it === 'string' ? [plain(it)] : [plain(it.content), ...listText(it.items)]);

function blockText(b) {
  const d = b.data || {};
  switch (b.type) {
    case 'paragraph': case 'header': return plain(d.text);
    case 'list': return listText(d.items).join(' ');
    case 'quote': return plain(d.text);
    case 'image': case 'map': return d.caption || '';
    default: return '';
  }
}

export function summarize(blocks, max = 200) {
  const first = (blocks || []).find(b => b.type === 'paragraph' && plain(b.data?.text));
  const text = first ? plain(first.data.text) : '';
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

export function readingTime(blocks) {
  const words = (blocks || []).map(blockText).join(' ').split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 230))} min read`;
}

/* ── Google Maps ──────────────────────────────────────────────────────── */
const MAPS_EMBED = /^https:\/\/www\.google\.com\/maps\/embed\?/;
const embedFor = (q, z = 14) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${z}&output=embed`;
const linkFor = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

// Accepts a place or address, coordinates, a google.com/maps URL, or the
// <iframe> code from Share → Embed a map. Returns { src, link } or null.
export function parseMap(input) {
  const s = (input || '').trim();
  if (!s) return null;
  const iframe = s.match(/src=["']([^"']+)["']/);
  if (iframe) {
    const src = iframe[1].replace(/&amp;/g, '&');
    return MAPS_EMBED.test(src) ? { src, link: '' } : null;
  }
  if (MAPS_EMBED.test(s)) return { src: s, link: '' };
  if (/^https?:\/\//i.test(s)) {
    let url;
    try { url = new URL(s); } catch { return null; }
    if (!/(^|\.)google\.[a-z.]+$/.test(url.hostname) || !url.pathname.startsWith('/maps')) return null;
    const place = url.pathname.match(/\/maps\/place\/([^/]+)/);
    const at = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/);
    // A place link carries the pin's exact spot as !3d<lat>!4d<lng>; @ is only the view.
    const pin = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const coords = pin ? `${pin[1]},${pin[2]}` : at && `${at[1]},${at[2]}`;
    // Coordinates pin the exact spot; a name alone can match the wrong place.
    const q = url.searchParams.get('q') || url.searchParams.get('query') || coords
      || (place && decodeURIComponent(place[1].replace(/\+/g, ' ')));
    if (!q) return null;
    const z = at ? Math.round(+at[3]) : 15;
    return { src: embedFor(q, z), link: url.href };
  }
  return { src: embedFor(s), link: linkFor(s) };
}

/* ── Photos (stored in Firestore as bytes, cached in the browser) ─────── */
const IMG_CACHE = 'blog-images-v1';
const imgKey = id => `${location.origin}/__blog-img/${id}`;
const imgUrls = new Map();

export function loadImage(id) {
  if (!imgUrls.has(id)) {
    imgUrls.set(id, (async () => {
      let blob = null;
      try {
        const hit = await (await caches.open(IMG_CACHE)).match(imgKey(id));
        if (hit) blob = await hit.blob();
      } catch { /* no Cache Storage (private window): fetch every time */ }
      if (!blob) {
        const snap = await getDoc(doc(db, 'images', id));
        if (!snap.exists()) throw new Error(`image ${id} not found`);
        const d = snap.data();
        blob = new Blob([d.bytes.toUint8Array()], { type: d.type });
        try {
          await (await caches.open(IMG_CACHE)).put(imgKey(id), new Response(blob, { headers: { 'Content-Type': d.type } }));
        } catch { /* fine without the cache */ }
      }
      return URL.createObjectURL(blob);
    })());
    imgUrls.get(id).catch(() => imgUrls.delete(id));
  }
  return imgUrls.get(id);
}

export async function showImage(img, id) {
  try {
    img.src = await loadImage(id);
    await img.decode().catch(() => {});
    img.classList.add('is-loaded');
  } catch (err) {
    console.error(err);
    img.closest('.ph')?.classList.add('is-missing');
  }
}

/* ── Blocks → page ────────────────────────────────────────────────────── */
function renderList(items, style) {
  const list = el(style === 'ordered' ? 'ol' : 'ul', style === 'checklist' ? 'checklist' : '');
  for (const it of items || []) {
    const li = el('li');
    const content = typeof it === 'string' ? it : it.content;
    if (style === 'checklist') li.dataset.checked = String(Boolean(it.meta?.checked));
    li.innerHTML = sanitizeInline(content);
    if (it.items?.length) li.append(renderList(it.items, style));
    list.append(li);
  }
  return list;
}

export function renderFigure(d) {
  const fig = el('figure', `fig${d.wide ? ' fig-wide' : ''}`);
  const btn = el('button', 'ph');
  btn.type = 'button';
  btn.setAttribute('aria-label', d.caption ? `View photo: ${d.caption}` : 'View photo');
  if (d.lqip) btn.style.setProperty('--lqip', `url("${d.lqip}")`);
  const img = el('img');
  img.alt = d.caption || '';
  img.width = d.w;
  img.height = d.h;
  img.dataset.id = d.id;
  img.decoding = 'async';
  btn.append(img);
  fig.append(btn);
  if (d.caption) fig.append(el('figcaption', '', d.caption));
  return fig;
}

export function renderMap(d) {
  if (!MAPS_EMBED.test(d.src) && !d.src?.startsWith('https://www.google.com/maps?')) return null;
  const fig = el('figure', `fig fig-map${d.wide ? ' fig-wide' : ''}`);
  const frame = el('div', 'map-frame');
  const iframe = el('iframe');
  iframe.src = d.src;
  iframe.title = d.caption ? `Map: ${d.caption}` : 'Map';
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.allowFullscreen = true;
  frame.append(iframe);
  fig.append(frame);
  if (d.caption || d.link) {
    const cap = el('figcaption');
    if (d.caption) cap.append(el('span', '', d.caption));
    if (d.link) {
      const a = el('a', 'map-link', 'Open in Google Maps');
      a.href = d.link;
      a.target = '_blank';
      a.rel = 'noopener';
      a.insertAdjacentHTML('beforeend', '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M8 16L16 8M9.5 8H16v6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      cap.append(a);
    }
    fig.append(cap);
  }
  return fig;
}

export function renderBlocks(blocks) {
  const frag = document.createDocumentFragment();
  for (const b of blocks || []) {
    const d = b.data || {};
    let node = null;
    switch (b.type) {
      case 'paragraph':
        if (!plain(d.text)) break;
        node = el('p');
        node.innerHTML = sanitizeInline(d.text);
        break;
      case 'header':
        node = el(d.level >= 3 ? 'h3' : 'h2');
        node.innerHTML = sanitizeInline(d.text);
        break;
      case 'list':
        node = renderList(d.items, d.style);
        break;
      case 'quote': {
        node = el('blockquote');
        const p = el('p');
        p.innerHTML = sanitizeInline(d.text);
        node.append(p);
        if (plain(d.caption)) node.append(el('footer', 'meta', `— ${plain(d.caption)}`));
        break;
      }
      case 'code':
        node = el('pre');
        node.append(el('code', '', d.code || ''));
        break;
      case 'delimiter':
        node = el('hr');
        break;
      case 'image':
        if (d.id) node = renderFigure(d);
        break;
      case 'map':
        if (d.src) node = renderMap(d);
        break;
    }
    if (node) frag.append(node);
  }
  return frag;
}

// Photos load as they near the screen, then open in the viewer on tap.
const lazy = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      lazy.unobserve(e.target);
      showImage(e.target, e.target.dataset.id);
    }
  }, { rootMargin: '800px 0px' })
  : null;

export function hydrate(root) {
  root.querySelectorAll('.ph img[data-id]').forEach(img => {
    if (lazy) lazy.observe(img); else showImage(img, img.dataset.id);
  });
  attachViewer(root);
}

/* ── Motion: the portfolio's springs (js/spring.js, window.Fluid) ─────── */
const F = window.Fluid;
const reduced = () => !F || F.reducedMotion;

// Press feedback on pointer-down, spring back on release (same as index.html).
export function pressable(node) {
  if (!F || node.__press) return;
  const s = new F.Spring(1, {
    dampingRatio: 1, response: 0.3, precision: 0.0005,
    onUpdate: v => { node.style.transform = Math.abs(v - 1) < 0.0005 ? '' : `scale(${v.toFixed(4)})`; },
  });
  let held = false;
  node.addEventListener('pointerdown', e => {
    if (e.button !== 0 || reduced()) return;
    held = true;
    s.to(0.97, { response: 0.16 });
  });
  const release = () => { if (!held) return; held = false; s.to(1, { response: 0.3 }); };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => node.addEventListener(t, release));
  node.__press = s;
}
export const pressAll = (root = document) => root.querySelectorAll('[data-press]').forEach(pressable);

// Content rises in, staggered: the hero's entrance spring.
export function rise(root) {
  const nodes = [...root.querySelectorAll('[data-rise]')];
  nodes.forEach((node, i) => {
    if (!F) { node.style.opacity = '1'; return; }
    node.__rise ??= new F.Spring(0, {
      dampingRatio: 1, response: 0.6, precision: 0.001,
      onUpdate: v => {
        node.style.opacity = v.toFixed(3);
        node.style.transform = v >= 0.999 ? '' : `translate3d(0, ${((1 - v) * 1.5).toFixed(3)}rem, 0)`;
      },
    });
    node.__rise.to(0, { instant: true });
    if (reduced()) node.__rise.to(1, { instant: true });
    else setTimeout(() => node.__rise.to(1), 40 + Math.min(i, 6) * 70);
  });
}

// Scroll-edge shadow under the nav, only once content passes beneath it.
export function stickyNav(nav) {
  const update = () => nav.classList.toggle('is-stuck', scrollY > 0);
  addEventListener('scroll', update, { passive: true });
  update();
}
