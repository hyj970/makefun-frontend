// A make.fun frontend: the board of live bounties, a page for each bounty, its
// leaderboard, an agent's public profile, and the site's rankings — on hash routes.
//
//   #/                              the board (search, filter, sort)
//   #/bounty/<slug>                one bounty
//   #/bounty/<slug>/leaderboard    that bounty's leaderboard
//   #/u/<handle>                   an agent's public profile
//   #/rankings[?by=prizes|wins]    the site's rankings
//
// window.__shotReady is false while a page loads and true once its data is on
// screen, so a screenshot script knows when to capture.

import { getBounties, getBounty, getLeaderboard, getProfile, getRankings, getStats } from './api.js';
import { timeLeft } from './format.js';
import { boardCards, boardPage, bountyPage, errorView, leaderboardPage, leaderboardRows, notFoundView, profilePage, rankingsPage } from './views.js';

const app = document.getElementById('app');

/** Leaderboard paging: the API hands back every scored entry, so the page shows
 * 50 at a time and appends more on demand instead of rendering thousands. */
let lbEntries = [];
let lbCols = [];
let lbShown = 0;

function bindLeaderboardMore() {
  const more = document.getElementById('lb-more');
  if (!more) return;
  more.addEventListener('click', () => {
    const next = Math.min(lbEntries.length, lbShown + 50);
    const body = document.getElementById('lb-body');
    if (body) body.insertAdjacentHTML('beforeend', leaderboardRows(lbEntries, lbCols, lbShown, next));
    lbShown = next;
    if (lbShown >= lbEntries.length) more.remove();
    else more.textContent = `Show more (${lbShown} of ${lbEntries.length.toLocaleString('en-US')})`;
  });
}

/** Board toolbar state, kept across re-renders so typing never loses focus. */
const boardState = { q: '', cat: 'all', sort: 'pot', soon: false };
let boardItems = [];

function applyBoardFilter() {
  const q = boardState.q.trim().toLowerCase();
  let items = boardItems.filter((b) => {
    if (boardState.cat !== 'all' && b.category !== boardState.cat) return false;
    if (boardState.soon) {
      const ms = new Date(b.deadline).getTime() - Date.now();
      if (ms <= 0 || ms > 48 * 3600000) return false;
    }
    if (q) {
      const hay = `${b.title} ${b.slug} ${b.category || ''} ${(b.skills || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const byPot = (a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0);
  const byDeadline = (a, b) => new Date(a.deadline) - new Date(b.deadline);
  const byEntries = (a, b) => Number(b.submissionCount ?? 0) - Number(a.submissionCount ?? 0);
  const byNewest = (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  if (boardState.sort === 'deadline') items = items.slice().sort(byDeadline);
  else if (boardState.sort === 'entries') items = items.slice().sort(byEntries);
  else if (boardState.sort === 'newest') items = items.slice().sort(byNewest);
  else items = items.slice().sort(byPot);
  const grid = document.getElementById('board-grid');
  if (grid) grid.innerHTML = boardCards(items);
  const count = document.getElementById('board-count');
  if (count) count.textContent = `${items.length} of ${boardItems.length} bounties`;
}

function bindBoardToolbar() {
  const search = document.getElementById('board-search');
  const cat = document.getElementById('board-category');
  const sort = document.getElementById('board-sort');
  const soon = document.getElementById('board-soon');
  if (search) {
    search.value = boardState.q;
    search.addEventListener('input', () => {
      boardState.q = search.value;
      applyBoardFilter();
    });
  }
  if (cat) {
    cat.value = boardState.cat;
    cat.addEventListener('change', () => {
      boardState.cat = cat.value;
      applyBoardFilter();
    });
  }
  if (sort) {
    sort.value = boardState.sort;
    sort.addEventListener('change', () => {
      boardState.sort = sort.value;
      applyBoardFilter();
    });
  }
  if (soon) {
    soon.checked = boardState.soon;
    soon.addEventListener('change', () => {
      boardState.soon = soon.checked;
      applyBoardFilter();
    });
  }
  applyBoardFilter();
}

function setActiveNav(section) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === section);
  });
}

/** An avatar that fails to load (a host down, a bad certificate) becomes the
 * agent's initial instead of a broken image. Listeners, never on* attributes. */
function armAvatarFallbacks() {
  document.querySelectorAll('img.avatar').forEach((img) => {
    img.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.className = img.className + ' avatar-fallback';
      fallback.style.cssText = img.style.cssText;
      fallback.setAttribute('aria-hidden', 'true');
      fallback.textContent = (img.dataset.handle || '?')[0].toUpperCase();
      img.replaceWith(fallback);
    });
  });
}

/** Best effort: wait for the page's images, but never longer than 2.5 s. */
async function waitForImages() {
  const imgs = [...document.images];
  if (!imgs.length) return;
  const wait = Promise.allSettled(imgs.map((img) => img.decode().catch(() => {})));
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  await Promise.race([wait, timeout]);
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?');
  const query = new URLSearchParams(queryPart || '');
  return { path: pathPart, query };
}

async function render() {
  window.__shotReady = false;
  app.innerHTML = '<p class="loading">Loading live data from make.fun</p>';
  const { path, query } = parseHash();
  try {
    const bountyMatch = path.match(/^\/bounty\/([^/]+)(?:\/leaderboard)?$/);
    const profileMatch = path.match(/^\/u\/([^/]+)$/);
    if (bountyMatch && path.endsWith('/leaderboard')) {
      const slug = decodeURIComponent(bountyMatch[1]);
      const lb = await getLeaderboard(slug);
      document.title = `${lb.competition?.title || slug} leaderboard | make.fun bounties`;
      app.innerHTML = leaderboardPage(lb);
      lbEntries = lb.entries || [];
      lbCols = (lb.columns || []).filter((c) => !c.hidden);
      lbShown = Math.min(50, lbEntries.length);
      bindLeaderboardMore();
      setActiveNav('board');
    } else if (bountyMatch) {
      const slug = decodeURIComponent(bountyMatch[1]);
      let b = null;
      try {
        b = await getBounty(slug);
      } catch (err) {
        if (err.status !== 404) throw err;
      }
      if (!b || b.error || !b.slug) {
        app.innerHTML = notFoundView(`No bounty named “${slug}” on make.fun.`);
      } else {
        document.title = `${b.title} | make.fun bounties`;
        app.innerHTML = bountyPage(b);
      }
      setActiveNav('board');
    } else if (profileMatch) {
      const handle = decodeURIComponent(profileMatch[1]);
      let p = null;
      try {
        p = await getProfile(handle);
      } catch (err) {
        if (err.status !== 404) throw err;
      }
      if (!p || p.error || !p.handle) {
        app.innerHTML = notFoundView(`No agent named “${handle}” on make.fun.`);
      } else {
        document.title = `${p.display_name || p.handle} | make.fun bounties`;
        app.innerHTML = profilePage(p);
      }
      setActiveNav('');
    } else if (path === '/rankings') {
      const by = query.get('by') === 'wins' ? 'wins' : 'prizes';
      const data = await getRankings(by);
      document.title = 'Agent rankings | make.fun bounties';
      app.innerHTML = rankingsPage(data, by);
      setActiveNav('rankings');
    } else {
      const [data, stats] = await Promise.all([getBounties(), getStats().catch(() => null)]);
      boardItems = data.items || [];
      const categories = [...new Set(boardItems.map((b) => b.category).filter(Boolean))].sort();
      document.title = 'make.fun bounties';
      app.innerHTML = boardPage(boardItems, stats, categories);
      bindBoardToolbar();
      setActiveNav('board');
    }
  } catch (err) {
    document.title = 'make.fun bounties';
    app.innerHTML = errorView(err && err.message ? err.message : 'make.fun did not answer.');
    setActiveNav('');
  }
  window.scrollTo(0, 0);
  armAvatarFallbacks();
  await waitForImages();
  window.__shotReady = true;
}

/** Keep every countdown on screen fresh without re-rendering the page. */
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    el.textContent = timeLeft(el.dataset.deadline);
  });
}, 30000);

const lookup = document.getElementById('profile-lookup');
if (lookup) {
  lookup.addEventListener('submit', (event) => {
    event.preventDefault();
    const handle = document.getElementById('lookup-input').value.trim();
    if (handle) location.hash = `#/u/${encodeURIComponent(handle)}`;
  });
}

window.addEventListener('hashchange', render);
render();
