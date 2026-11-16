// Editor at /blog/write/. Only the owner's Google account can sign in to
// write; firestore.rules enforces the same thing on the server.
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {
  collection, doc, addDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, Timestamp,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import {
  app, db, configured, OWNER, renderBlocks, hydrate, slugify, summarize, formatDate, readingTime, toMs,
  el, pressAll, pressable, rise, stickyNav,
} from '../shared.js';
import { PhotoTool, MapTool } from './tools.js';

const $ = s => document.querySelector(s);
const views = { gate: $('#gate'), library: $('#library'), editor: $('#editor') };
const barMain = $('#bar-main');
const barEdit = $('#bar-edit');
const titleEl = $('#title');
const slugEl = $('#slug');
const statusEl = $('#status');
const publishBtn = $('#publish');
const unpublishBtn = $('#unpublish');

let posts = [];
let cur = null;           // the post being edited: { id, ...fields }
let editor = null;        // Editor.js instance for cur
let dirty = false;
let slugTouched = false;  // once the link is edited by hand, the title stops driving it
let saveTimer = 0;
let saving = null;
let known = new Set();    // every photo this post has referenced while open

const blocksOf = p => p?.content?.blocks || [];
const photoIds = blocks => blocks.filter(b => b.type === 'image' && b.data?.id).map(b => b.data.id);

function show(name) {
  for (const [k, v] of Object.entries(views)) v.hidden = k !== name;
  barMain.hidden = name === 'editor';
  barEdit.hidden = name !== 'editor';
  rise(views[name]);
}

/* ── Gate ─────────────────────────────────────────────────────────────── */
function gate(state) {
  const signedIn = state === 'denied';
  $('#gate-title').textContent = signedIn ? 'Not this account.' : 'Write.';
  $('#gate-sub').textContent = signedIn
    ? 'This Google account can’t write here. Sign out and use the blog’s account.'
    : 'Sign in to write and publish posts.';
  $('#sign-in').hidden = signedIn;
  $('#sign-out').hidden = !signedIn;
  show('gate');
}

/* ── Library ──────────────────────────────────────────────────────────── */
async function loadPosts() {
  const snap = await getDocs(collection(db, 'posts'));
  posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderLibrary() {
  const sorted = [...posts].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
  $('#library .posts').replaceChildren(...sorted.map(p => {
    const a = el('a', 'post-row');
    a.href = `?id=${p.id}`;
    a.dataset.press = '';
    const meta = el('p', 'meta');
    if (p.status === 'published') {
      meta.append(el('span', 'dot'), `Published · ${formatDate(p.publishedAt)}`);
    } else {
      meta.textContent = `Draft · Edited ${formatDate(p.updatedAt)}`;
    }
    a.append(meta, el('h2', 'post-row-title', p.title || 'Untitled'));
    if (p.summary) a.append(el('p', 'post-row-sum', p.summary));
    pressable(a);
    const li = el('li');
    li.dataset.rise = '';
    li.append(a);
    return li;
  }));
  const msg = $('#lib-msg');
  msg.hidden = posts.length > 0;
  msg.textContent = 'No posts yet. Start one with New post.';
}

function openLibrary() {
  cur = null;
  closeEditor();
  renderLibrary();
  show('library');
  document.title = 'Write — Kaushik Vada';
}

async function newPost() {
  const data = {
    title: '', slug: '', content: { blocks: [] }, summary: '', status: 'draft',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), publishedAt: null,
  };
  const ref = await addDoc(collection(db, 'posts'), data);
  const post = { id: ref.id, ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  posts.push(post);
  history.pushState(null, '', `?id=${ref.id}`);
  openEditor(post);
}

/* ── Editor ───────────────────────────────────────────────────────────── */
const grow = t => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; };

function closeEditor() {
  if (editor) { editor.destroy?.(); editor = null; }
  $('#blocks').replaceChildren();
}

function openEditor(post) {
  closeEditor();
  cur = post;
  dirty = false;
  known = new Set(photoIds(blocksOf(post)));
  titleEl.value = post.title;
  slugEl.value = post.slug;
  slugTouched = Boolean(post.slug) && post.slug !== slugify(post.title);
  editor = new window.EditorJS({
    holder: 'blocks',
    data: post.content?.blocks?.length ? post.content : undefined,
    placeholder: 'Start writing. Press Tab or + for photos, maps, headings and more.',
    inlineToolbar: ['bold', 'italic', 'link', 'inlineCode'],
    tools: {
      header: { class: window.Header, inlineToolbar: true, config: { levels: [2, 3], defaultLevel: 2, placeholder: 'Heading' } },
      list: { class: window.EditorjsList, inlineToolbar: true, config: { defaultStyle: 'unordered' } },
      image: PhotoTool,
      map: MapTool,
      quote: { class: window.Quote, inlineToolbar: true, config: { quotePlaceholder: 'Quote', captionPlaceholder: 'Who said it' } },
      code: { class: window.CodeTool, config: { placeholder: 'Code' } },
      delimiter: window.Delimiter,
      inlineCode: window.InlineCode,
    },
    onChange: () => onEdit(),
  });
  setMode('write');
  show('editor');
  grow(titleEl);
  refreshChrome();
  setStatus(post.status === 'published' ? 'live' : 'saved');
  document.title = `${post.title || 'Untitled'} — Write`;
  if (!post.title) titleEl.focus();
}

const isLive = () => cur?.status === 'published';

function refreshChrome() {
  publishBtn.textContent = isLive() ? 'Update' : 'Publish';
  publishBtn.disabled = isLive() && !dirty;
  unpublishBtn.hidden = !isLive();
}

function setStatus(kind, text) {
  const s = statusEl;
  s.replaceChildren();
  const live = isLive();
  if (live) s.append(el('span', 'dot'));
  const label = live ? 'Published' : 'Draft';
  switch (kind) {
    case 'saving': s.append(`${label} · Saving…`); break;
    case 'saved': s.append(`${label} · Saved`); break;
    case 'changes': s.append(`${label} · Unpublished changes`); break;
    case 'error': s.append(text); break;
    case 'live': {
      s.append(`${label} · `);
      const a = el('a', '', 'View post');
      a.href = `/blog/?p=${encodeURIComponent(cur.slug)}`;
      a.target = '_blank';
      a.rel = 'noopener';
      s.append(a);
      break;
    }
  }
}

async function fields() {
  const title = titleEl.value.trim();
  if (editor) await editor.isReady;
  const saved = editor ? await editor.save() : { blocks: [] };
  const content = { time: saved.time || Date.now(), version: saved.version || '', blocks: saved.blocks };
  photoIds(content.blocks).forEach(id => known.add(id));
  return { title, content, slug: slugEl.value.trim() || slugify(title), summary: summarize(content.blocks) };
}

function onEdit() {
  dirty = true;
  refreshChrome();
  if (isLive()) {
    // A published post changes only when Update is pressed, never mid-sentence.
    setStatus('changes');
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 800);
}

async function save() {
  clearTimeout(saveTimer);
  if (!cur || !dirty || isLive()) return saving;
  if (saving) await saving;
  dirty = false;
  setStatus('saving');
  const post = cur;
  saving = (async () => {
    try {
      const f = await fields();
      await updateDoc(doc(db, 'posts', post.id), { ...f, updatedAt: serverTimestamp() });
      Object.assign(post, f, { updatedAt: Timestamp.now() });
      if (!dirty && cur === post) setStatus('saved');
    } catch (err) {
      console.error(err);
      dirty = true;
      if (cur === post) setStatus('error', 'Couldn’t save. Check your connection; your writing is still here.');
    } finally {
      saving = null;
    }
  })();
  return saving;
}

// Photos dropped from the post are deleted once the post that kept them is saved.
async function sweepPhotos(post, keep) {
  const keepSet = new Set(keep);
  const orphans = [...known].filter(id => !keepSet.has(id));
  await Promise.all(orphans.map(id => deleteDoc(doc(db, 'images', id)).catch(console.error)));
  orphans.forEach(id => known.delete(id));
}

async function publish() {
  const f = await fields();
  if (!f.title) {
    setStatus('error', 'Add a title to publish.');
    titleEl.focus();
    return;
  }
  if (!f.slug) {
    setStatus('error', 'Add a link for this post.');
    slugEl.focus();
    return;
  }
  if (posts.some(p => p.id !== cur.id && p.status === 'published' && p.slug === f.slug)) {
    setStatus('error', `Another post already uses /blog/?p=${f.slug}. Change the link.`);
    slugEl.focus();
    return;
  }
  clearTimeout(saveTimer);
  await saving;
  const wasLive = isLive();
  setStatus('saving');
  publishBtn.disabled = true;
  try {
    const update = { ...f, status: 'published', updatedAt: serverTimestamp() };
    if (!cur.publishedAt) update.publishedAt = serverTimestamp();
    await updateDoc(doc(db, 'posts', cur.id), update);
    Object.assign(cur, f, {
      status: 'published', updatedAt: Timestamp.now(),
      publishedAt: cur.publishedAt || Timestamp.now(),
    });
    slugEl.value = f.slug;
    dirty = false;
    refreshChrome();
    setStatus('live');
    sweepPhotos(cur, photoIds(f.content.blocks));
  } catch (err) {
    console.error(err);
    refreshChrome();
    setStatus('error', wasLive ? 'Couldn’t update. Try again.' : 'Couldn’t publish. Try again.');
  }
}

async function unpublish() {
  try {
    await updateDoc(doc(db, 'posts', cur.id), { status: 'draft', updatedAt: serverTimestamp() });
    cur.status = 'draft';
    refreshChrome();
    // Edits made while it was live become an ordinary draft save.
    if (dirty) save(); else setStatus('saved');
  } catch (err) {
    console.error(err);
    setStatus('error', 'Couldn’t unpublish. Try again.');
  }
}

async function remove() {
  if (!confirm(`Delete “${titleEl.value.trim() || 'Untitled'}”? This can’t be undone.`)) return;
  clearTimeout(saveTimer);
  await saving;
  try {
    await deleteDoc(doc(db, 'posts', cur.id));
    await sweepPhotos(cur, []);
    posts = posts.filter(p => p.id !== cur.id);
    dirty = false;
    history.pushState(null, '', location.pathname);
    openLibrary();
  } catch (err) {
    console.error(err);
    setStatus('error', 'Couldn’t delete. Try again.');
  }
}

async function isEmpty() {
  if (titleEl.value.trim()) return false;
  const { content } = await fields();
  return content.blocks.length === 0;
}

// Leaving the editor: drafts save, an empty post is thrown away, and
// unpublished edits to a live post are only dropped on confirmation.
async function leave() {
  if (!cur) return true;
  clearTimeout(saveTimer);
  if (!isLive() && await isEmpty()) {
    await saving;
    await deleteDoc(doc(db, 'posts', cur.id)).catch(console.error);
    await sweepPhotos(cur, []);
    posts = posts.filter(p => p.id !== cur.id);
    dirty = false;
    return true;
  }
  if (isLive()) {
    if (dirty && !confirm('Discard changes that haven’t been published?')) return false;
    dirty = false;
    await sweepPhotos(cur, photoIds(blocksOf(cur)));
    return true;
  }
  await save();
  if (dirty) return false;
  await sweepPhotos(cur, photoIds(blocksOf(cur)));
  return true;
}

async function setMode(mode) {
  const preview = mode === 'preview';
  $('#mode-write').setAttribute('aria-pressed', String(!preview));
  $('#mode-preview').setAttribute('aria-pressed', String(preview));
  if (preview) {
    const f = await fields();
    const date = cur?.publishedAt ? formatDate(cur.publishedAt) : formatDate(null);
    $('#pv-meta').textContent = `${date} · ${readingTime(f.content.blocks)}`;
    $('#pv-title').textContent = f.title || 'Untitled';
    const body = $('#pv-body');
    body.replaceChildren(renderBlocks(f.content.blocks));
    hydrate(body);
  }
  $('#pane-write').hidden = preview;
  $('#pane-preview').hidden = !preview;
  if (!preview) requestAnimationFrame(() => grow(titleEl));
}

/* ── Routing: ?id=<post> opens the editor, so a refresh keeps your place ── */
function route() {
  const id = new URLSearchParams(location.search).get('id');
  const post = id && posts.find(p => p.id === id);
  if (post) openEditor(post);
  else openLibrary();
}

async function go(href) {
  if (!(await leave())) return;
  history.pushState(null, '', href);
  route();
  scrollTo(0, 0);
}

/* ── Wiring ───────────────────────────────────────────────────────────── */
titleEl.addEventListener('input', () => {
  grow(titleEl);
  if (!slugTouched) slugEl.value = slugify(titleEl.value);
  onEdit();
});
// Return in the title moves into the post instead of adding a line.
titleEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    editor?.caret.setToFirstBlock('start');
  }
});
slugEl.addEventListener('input', () => { slugTouched = true; onEdit(); });
slugEl.addEventListener('change', () => { slugEl.value = slugify(slugEl.value); onEdit(); });
addEventListener('resize', () => { if (!views.editor.hidden) grow(titleEl); });

$('#mode-write').addEventListener('click', () => setMode('write'));
$('#mode-preview').addEventListener('click', () => setMode('preview'));
publishBtn.addEventListener('click', publish);
unpublishBtn.addEventListener('click', unpublish);
$('#delete').addEventListener('click', remove);
$('#back').addEventListener('click', () => go(location.pathname));
$('#new-post').addEventListener('click', () => newPost().catch(err => {
  console.error(err);
  $('#lib-msg').hidden = false;
  $('#lib-msg').textContent = 'Couldn’t create a post. Try again.';
}));
$('#library .posts').addEventListener('click', e => {
  const a = e.target.closest('a.post-row');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});

addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && cur) {
    e.preventDefault();
    if (isLive()) { if (dirty) publish(); } else save();
  }
});
addEventListener('popstate', async () => {
  if (cur && !(await leave())) { history.pushState(null, '', `?id=${cur.id}`); return; }
  route();
});
addEventListener('beforeunload', e => {
  if (dirty) { save(); e.preventDefault(); }
});

stickyNav($('.localnav'));
pressAll();

if (!configured) {
  gate('signed-out');
  $('#sign-in').hidden = true;
  $('#gate-msg').textContent = 'Firebase isn’t configured yet (blog/firebase-config.js).';
} else {
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  $('#sign-in').addEventListener('click', async () => {
    $('#gate-msg').textContent = '';
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      console.error(err);
      $('#gate-msg').textContent = err.code === 'auth/popup-blocked'
        ? 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
        : 'Couldn’t sign in. Try again.';
    }
  });
  $('#sign-out').addEventListener('click', async () => {
    if (!(await leave())) return;
    cur = null;
    closeEditor();
    signOut(auth);
  });

  onAuthStateChanged(auth, async user => {
    if (!user) { $('#sign-out').hidden = true; gate('signed-out'); return; }
    if (user.email !== OWNER || !user.emailVerified) { gate('denied'); return; }
    $('#sign-out').hidden = false;
    try {
      await loadPosts();
      route();
    } catch (err) {
      console.error(err);
      gate('signed-out');
      $('#gate-msg').textContent = 'Signed in, but posts couldn’t load. Try again in a moment.';
    }
  });
}
