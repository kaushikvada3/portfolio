// Reader: the post list at /blog/ and a single post at /blog/?p=<slug>.
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { db, configured, renderBlocks, hydrate, formatDate, readingTime, toMs, el, pressAll, pressable, rise, stickyNav } from './shared.js';

const $ = s => document.querySelector(s);
const listView = $('#list-view');
const postView = $('#post-view');
const list = $('.posts');
const listMsg = $('#list-msg');

let posts = null;

async function loadPosts() {
  if (posts) return posts;
  const snap = await getDocs(query(collection(db, 'posts'), where('status', '==', 'published')));
  posts = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMs(b.publishedAt) - toMs(a.publishedAt));
  return posts;
}

function renderList() {
  list.replaceChildren(...posts.map(p => {
    const a = el('a', 'post-row');
    a.href = `/blog/?p=${encodeURIComponent(p.slug)}`;
    a.dataset.route = '';
    a.dataset.press = '';
    a.append(
      el('p', 'meta', formatDate(p.publishedAt)),
      el('h2', 'post-row-title', p.title),
    );
    if (p.summary) a.append(el('p', 'post-row-sum', p.summary));
    pressable(a);
    const li = el('li');
    li.dataset.rise = '';
    li.append(a);
    return li;
  }));
  listMsg.hidden = posts.length > 0;
  listMsg.textContent = 'Nothing here yet.';
}

function showList() {
  postView.hidden = true;
  listView.hidden = false;
  document.title = 'Blog — Kaushik Vada';
  renderList();
  rise(listView);
}

function showPost(slug) {
  const p = posts.find(x => x.slug === slug);
  listView.hidden = true;
  postView.hidden = false;
  if (!p) {
    $('#post-meta').textContent = '';
    $('#post-title').textContent = 'This post isn’t available.';
    $('#post-body').replaceChildren();
    document.title = 'Blog — Kaushik Vada';
  } else {
    const blocks = p.content?.blocks || [];
    $('#post-meta').textContent = `${formatDate(p.publishedAt)} · ${readingTime(blocks)}`;
    $('#post-title').textContent = p.title;
    $('#post-body').replaceChildren(renderBlocks(blocks));
    hydrate($('#post-body'));
    document.title = `${p.title} — Kaushik Vada`;
  }
  rise(postView);
}

function route() {
  const slug = new URLSearchParams(location.search).get('p');
  if (slug) showPost(slug); else showList();
}

// In-page navigation between the list and a post: no reload, back button works.
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-route]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  if (a.href === location.href) return;
  history.pushState(null, '', a.href);
  route();
  scrollTo(0, 0);
  $('#main').focus({ preventScroll: true });
});
addEventListener('popstate', route);

stickyNav($('.localnav'));
pressAll();

if (!configured) {
  rise(listView);
  listMsg.hidden = false;
  listMsg.textContent = 'The blog isn’t connected yet.';
} else {
  loadPosts().then(route).catch(err => {
    console.error(err);
    listView.hidden = false;
    postView.hidden = true;
    rise(listView);
    listMsg.hidden = false;
    listMsg.textContent = 'Couldn’t load posts. Try again in a moment.';
  });
}
