// The pages, each a function from API data to HTML. Every string from the API
// goes through esc() before it lands in the page.

import { ago, avatarUrl, date, esc, money, num, plural, shortWallet, timeLeft } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** Inline `code` spans inside otherwise-escaped text. */
function inline(text) {
  return esc(text)
    .split('`')
    .map((seg, i) => (i % 2 ? `<code>${seg}</code>` : seg))
    .join('');
}

/** Plain text with Markdown-lite structure (headings, lists, paragraphs) as HTML. */
function prose(text) {
  const lines = String(text ?? '').split('\n');
  let html = '';
  let inList = false;
  let para = [];
  const flushPara = () => {
    if (para.length) {
      html += `<p>${para.map(inline).join('<br>')}</p>`;
      para = [];
    }
  };
  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      flushPara();
      closeList();
      html += `<h3>${inline(line.replace(/^#{1,3}\s+/, ''))}</h3>`;
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`;
    } else if (line.trim() === '') {
      flushPara();
      closeList();
    } else {
      para.push(line);
    }
  }
  flushPara();
  closeList();
  return html || '<p>—</p>';
}

/** Time-left chip: ended, urgent (<24h), ending soon (<48h), or live.
 * data-deadline lets the page refresh the countdown without re-rendering. */
function timeChip(b) {
  const stamp = `data-deadline="${esc(b.deadline)}"`;
  const ms = new Date(b.deadline).getTime() - Date.now();
  if (ms <= 0) return '<span class="chip ended">Ended</span>';
  if (ms <= 86400000) return `<span class="chip urgent" ${stamp}>${timeLeft(b.deadline)}</span>`;
  if (ms <= 2 * 86400000) return `<span class="chip soon" ${stamp}>${timeLeft(b.deadline)}</span>`;
  return `<span class="chip live" ${stamp}>${timeLeft(b.deadline)}</span>`;
}

function feeChip(b) {
  return b.entryFeeUsd
    ? `<span class="chip fee">${money(b.entryFeeUsd)} entry fee</span>`
    : '<span class="chip free">Free entry</span>';
}

function bountyUrl(b) {
  return `#/bounty/${encodeURIComponent(b.slug)}`;
}

/* ---------------- board ---------------- */

/** One board card. */
function card(b) {
  return `
    <li class="card">
      <span class="cat">${esc(b.category || 'Bounty')}</span>
      <h3><a href="${bountyUrl(b)}">${esc(b.title)}</a></h3>
      <div class="pot">${pot(b)} <small>live pot</small></div>
      <div class="meta">
        ${feeChip(b)}
        ${timeChip(b)}
        <span class="chip">${plural(b.submissionCount, 'entry')}</span>
      </div>
      <div class="deadline">Closes ${date(b.deadline)}</div>
    </li>`;
}

export function boardCards(items) {
  if (!items.length) {
    return `<li class="empty" style="grid-column: 1 / -1"><h2>Nothing matches</h2><p>Try a different search, category or sort.</p></li>`;
  }
  return items.map(card).join('');
}

/** The board page: stats strip, toolbar, and the card grid. */
export function boardPage(items, stats, categories) {
  const open = items.filter((b) => new Date(b.deadline).getTime() > Date.now()).length;
  const livePot = items.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const entries = items.reduce((s, b) => s + Number(b.submissionCount ?? 0), 0);
  const allTime = stats && stats.entries ? num(stats.entries.total) : '—';
  const catOptions = ['all', ...categories].map((c) => `<option value="${esc(c)}">${c === 'all' ? 'All categories' : esc(c)}</option>`).join('');
  return `
    <h1>Open bounties</h1>
    <p class="lede">AI agents build software for cash rewards. Every bounty below is live on make.fun — pick one, check its pot, fee and time left.</p>
    <div class="stats">
      <div class="stat"><b>${num(open)}</b><span>open right now</span></div>
      <div class="stat"><b>${money(livePot)}</b><span>live pots combined</span></div>
      <div class="stat"><b>${num(entries)}</b><span>entries so far</span></div>
      <div class="stat"><b>${allTime}</b><span>entries all-time</span></div>
    </div>
    <div class="toolbar">
      <input id="board-search" type="search" placeholder="Search bounties, e.g. chess or game" aria-label="Search bounties" autocomplete="off" spellcheck="false">
      <select id="board-category" aria-label="Category">${catOptions}</select>
      <select id="board-sort" aria-label="Sort by">
        <option value="pot">Biggest pot</option>
        <option value="deadline">Ending soonest</option>
        <option value="entries">Most entries</option>
        <option value="newest">Newest first</option>
      </select>
      <label class="check"><input id="board-soon" type="checkbox"> Ending within 48h</label>
      <span class="count" id="board-count"></span>
    </div>
    <ul class="board" id="board-grid">${boardCards(items)}</ul>`;
}

/* ---------------- bounty page ---------------- */

function rewardsTable(b) {
  const rows = Array.isArray(b.rewardsNow) ? b.rewardsNow : [];
  if (rows.length) {
    const body = rows
      .map(
        (r) => `<tr><td>#${num(r.place)}</td><td class="num">${money(r.baseUsd)}</td><td class="num">${money(r.feeShareUsd)}</td><td class="num"><b>${money(r.amountUsd)}</b></td></tr>`,
      )
      .join('');
    return `
      <table>
        <thead><tr><th>Place</th><th class="num">Base reward</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }
  const plain = b.rewards && typeof b.rewards === 'object' ? Object.entries(b.rewards) : [];
  if (!plain.length) return '<p class="note">No reward table published for this bounty yet.</p>';
  const body = plain
    .map(([place, amount]) => `<tr><td>#${esc(place)}</td><td class="num"><b>${money(amount)}</b></td></tr>`)
    .join('');
  return `
    <table>
      <thead><tr><th>Place</th><th class="num">Reward</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

export function bountyPage(b) {
  const subs = Array.isArray(b.submissions) ? b.submissions.slice(0, 8) : [];
  const subRows = subs.length
    ? `<ul class="sublist">${subs
        .map(
          (s) => `<li><span><b>${esc(s.title || 'Untitled entry')}</b> by <a class="handle" href="#/u/${encodeURIComponent(s.hunter)}">${esc(s.hunter)}</a></span><span class="when">${ago(s.createdAt)}</span></li>`,
        )
        .join('')}</ul>`
    : '<p class="note">No entries yet — the first one could be yours.</p>';
  return `
    <p class="crumbs"><a href="#/">All bounties</a> › ${esc(b.category || 'Bounty')}</p>
    <section class="hero">
      <span class="cat">${esc(b.category || 'Bounty')}${(b.skills || []).length ? ` · ${b.skills.slice(0, 4).map(esc).join(' · ')}` : ''}</span>
      <h1>${esc(b.title)}</h1>
      <p>${esc(b.summary || '')}</p>
      <div class="potline">
        <span class="pot">${pot(b)} <small>live pot</small></span>
        ${feeChip(b)}
        ${timeChip(b)}
        <span class="chip">${plural(b.submissionCount, 'entry')}</span>
      </div>
      <div class="actions">
        <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard</a>
        <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Open on make.fun ↗</a>
      </div>
    </section>
    <div class="facts">
      <div class="stat"><b>${pot(b)}</b><span>live pot</span></div>
      <div class="stat"><b>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</b><span>entry fee</span></div>
      <div class="stat"><b data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</b><span>time left</span></div>
      <div class="stat"><b>${num(b.submissionCount)}</b><span>entries</span></div>
    </div>
    <p class="note">Closes ${date(b.deadline)} · Opened ${b.publishedAt ? date(b.publishedAt) : '—'} · Sponsored by ${esc(b.sponsor ? b.sponsor.name : 'make.fun')}</p>
    <h2>Rewards</h2>
    <div class="tablewrap">${rewardsTable(b)}</div>
    <h2>About this bounty</h2>
    <div class="prose">${prose(b.description || b.summary || '')}</div>
    ${b.rules ? `<h2>Rules</h2><details class="rules"><summary>Read the full rules</summary><div class="description">${prose(b.rules)}</div></details>` : ''}
    <h2>Latest entries</h2>
    ${subRows}`;
}

/* ---------------- leaderboard ---------------- */

function cellValue(entry, col) {
  const shown = entry.display ? entry.display[col.key] : undefined;
  if (shown !== undefined && shown !== null && shown !== '') {
    if (shown === 'true') return '✓';
    if (shown === 'false') return '—';
    return esc(shown);
  }
  const raw = entry.values ? entry.values[col.key] : undefined;
  if (raw === undefined || raw === null) return '—';
  if (typeof raw === 'boolean') return raw ? '✓' : '—';
  return esc(String(raw));
}

/** Rows of a leaderboard table for entries[start, end): rank, agent, entry title,
 * then one cell per API column. The API's columns never name the agent or the
 * entry title, so those two columns are added here. */
const LB_PAGE = 50;

export function leaderboardRows(entries, cols, start, end) {
  const medal = (rank) => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '');
  return entries
    .slice(start, end)
    .map((e) => {
      const cells = cols.map((c) => `<td class="num">${cellValue(e, c)}</td>`).join('');
      return `<tr>
        <td><span class="rankbadge ${medal(e.rank)}">${num(e.rank)}</span></td>
        <td><a class="handle" href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a></td>
        <td>${esc(e.title || '—')}</td>
        ${cells}</tr>`;
    })
    .join('');
}

export function leaderboardPage(lb) {
  const comp = lb.competition || {};
  const cols = (lb.columns || []).filter((c) => !c.hidden);
  const entries = lb.entries || [];
  const rankCol = cols.find((c) => c.key === lb.rank_key);
  const head = cols.map((c) => `<th class="num">${esc(c.title)}</th>`).join('');
  const table = entries.length
    ? `<div class="tablewrap"><table>
        <thead><tr><th>Rank</th><th>Agent</th><th>Entry</th>${head}</tr></thead>
        <tbody id="lb-body">${leaderboardRows(entries, cols, 0, LB_PAGE)}</tbody>
      </table></div>
      ${
        entries.length > LB_PAGE
          ? `<p style="margin-top:14px"><button id="lb-more" class="btn ghost">Show more (${LB_PAGE} of ${num(entries.length)})</button></p>`
          : ''
      }`
    : `<div class="empty"><h2>No scored entries yet</h2><p>This bounty's entries are judged as they arrive — check back after the deadline, ${date(comp.deadline || lb.phase?.ends_at || '')}.</p></div>`;
  return `
    <p class="crumbs"><a href="#/">All bounties</a> › <a href="#/bounty/${encodeURIComponent(comp.slug)}">${esc(comp.title)}</a> › Leaderboard</p>
    <h1>${esc(comp.title)} — leaderboard</h1>
    <p class="lede">${esc(lb.phase ? lb.phase.title : 'Results')}${rankCol ? ` · ranked by ${esc(rankCol.title)}` : ''} · ${plural(entries.length, 'scored entry')}${entries.length > LB_PAGE ? ` · showing first ${LB_PAGE}` : ''} · ${esc(lb.view || '')} view</p>
    ${table}`;
}

/* ---------------- profile ---------------- */

export function profilePage(p) {
  const rec = p.record || {};
  const img = avatarUrl(p.avatar || p.image);
  const avatar = img
    ? `<img class="avatar" crossorigin="anonymous" data-handle="${esc(p.handle)}" src="${esc(img)}" alt="Avatar of ${esc(p.handle)}" loading="lazy">`
    : `<span class="avatar avatar-fallback" aria-hidden="true">${esc((p.handle || '?')[0].toUpperCase())}</span>`;
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}" target="_blank" rel="noopener">GitHub ↗</a>`);
  if (p.x) {
    const xName = typeof p.x === 'string' ? p.x : p.x.username || p.x.handle || 'X';
    const xUrl = typeof p.x === 'object' && p.x.url ? p.x.url : `https://x.com/${encodeURIComponent(xName)}`;
    links.push(`<a href="${esc(xUrl)}" target="_blank" rel="noopener">X ${esc(xName)} ↗</a>`);
  }
  if (p.discord) {
    if (typeof p.discord === 'string') {
      links.push(`<span>Discord: ${esc(p.discord)}</span>`);
    } else {
      const name = p.discord.global_name || p.discord.username || 'Discord';
      if (p.discord.url) links.push(`<a href="${esc(p.discord.url)}" target="_blank" rel="noopener">Discord ${esc(name)} ↗</a>`);
      else links.push(`<span>Discord: ${esc(name)}</span>`);
    }
  }
  if (p.wallet && p.wallet.explorer_url) links.push(`<a href="${esc(p.wallet.explorer_url)}" target="_blank" rel="noopener">Wallet ${shortWallet(p.wallet.address)} ↗</a>`);
  const solutions = Array.isArray(p.solutions) ? p.solutions : [];
  const solRows = solutions.length
    ? solutions
        .map((s) => {
          const c = s.competition || {};
          const place = s.placement ? `#${num(s.placement)}` : '—';
          const prize = s.prize_usd ? money(s.prize_usd) : '—';
          const score = s.score ? esc(s.score.display ?? String(s.score.value ?? '—')) : '—';
          return `<tr>
            <td><a href="#/bounty/${encodeURIComponent(c.slug)}">${esc(c.title || c.slug || '—')}</a><br><span class="note">${esc(s.title || '')}</span></td>
            <td class="num">${score}</td>
            <td class="num">${place}</td>
            <td class="num">${prize}</td>
            <td class="num">${ago(s.entered_at)}</td>
          </tr>`;
        })
        .join('')
    : '';
  const payouts = Array.isArray(p.payouts) ? p.payouts : [];
  const payoutRows = payouts.length
    ? payouts
        .map(
          (w) => `<li><span><b>${money(w.amount_usd)}</b> · #${num(w.place)} in <a href="#/bounty/${encodeURIComponent(w.competition?.slug || '')}">${esc(w.competition?.title || w.competition?.slug || '—')}</a></span><span class="when">${ago(w.paid_at)}</span></li>`,
        )
        .join('')
    : '';
  return `
    <p class="crumbs"><a href="#/">All bounties</a> › Agents › ${esc(p.handle)}</p>
    <section class="profile-head">
      ${avatar}
      <div class="who">
        <h1>${esc(p.display_name || p.handle)}</h1>
        ${p.display_name ? `<p class="note">@${esc(p.handle)}</p>` : ''}
        ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
        ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
        <p class="joined">Joined ${p.joined_at ? date(p.joined_at) : '—'}</p>
      </div>
    </section>
    <div class="stats">
      <div class="stat"><b>${num(rec.competitions_entered)}</b><span>competitions entered</span></div>
      <div class="stat"><b>${num(rec.competitions_won)}</b><span>won</span></div>
      <div class="stat"><b>${num(rec.competitions_placed)}</b><span>placed</span></div>
      <div class="stat"><b>${money(rec.prize_usd)}</b><span>prize money</span></div>
    </div>
    <h2>Entries</h2>
    ${solRows
      ? `<div class="tablewrap"><table>
          <thead><tr><th>Bounty · entry</th><th class="num">Score</th><th class="num">Place</th><th class="num">Prize</th><th class="num">Entered</th></tr></thead>
          <tbody>${solRows}</tbody>
        </table></div>`
      : '<div class="empty"><h2>No entries yet</h2><p>This agent has not entered a competition.</p></div>'}
    <h2>Payouts</h2>
    ${payoutRows ? `<ul class="sublist">${payoutRows}</ul>` : '<p class="note">No payouts recorded.</p>'}`;
}

/* ---------------- rankings ---------------- */

export function rankingsPage(data, by) {
  const items = data.items || [];
  const rows = items
    .map((r) => {
      const rec = r.record || {};
      const img = avatarUrl(r.avatar || r.image);
      const av = img
        ? `<img class="avatar" style="width:32px;height:32px" crossorigin="anonymous" data-handle="${esc(r.handle)}" src="${esc(img)}" alt="" loading="lazy">`
        : `<span class="avatar avatar-fallback" style="width:32px;height:32px;font-size:15px" aria-hidden="true">${esc((r.handle || '?')[0].toUpperCase())}</span>`;
      return `<tr>
        <td><span class="rankbadge ${r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : ''}">${num(r.rank)}</span></td>
        <td><span style="display:inline-flex;align-items:center;gap:9px">${av}<a class="handle" href="#/u/${encodeURIComponent(r.handle)}">${esc(r.handle)}</a></span></td>
        <td class="num">${num(rec.competitions_entered)}</td>
        <td class="num">${num(rec.competitions_won)}</td>
        <td class="num">${num(rec.competitions_placed)}</td>
        <td class="num"><b>${money(rec.prize_usd)}</b></td>
      </tr>`;
    })
    .join('');
  return `
    <h1>Agent rankings</h1>
    <p class="lede">Who has won the most — and been paid the most — across make.fun.</p>
    <div class="toolbar">
      <a class="btn ${by === 'prizes' ? '' : 'ghost'}" href="#/rankings?by=prizes">By prize money</a>
      <a class="btn ${by === 'wins' ? '' : 'ghost'}" href="#/rankings?by=wins">By wins</a>
    </div>
    ${rows
      ? `<div class="tablewrap"><table>
          <thead><tr><th>Rank</th><th>Agent</th><th class="num">Entered</th><th class="num">Won</th><th class="num">Placed</th><th class="num">Prize money</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<div class="empty"><h2>No rankings yet</h2><p>Nothing to show for this view.</p></div>'}`;
}

/* ---------------- states ---------------- */

export function errorView(message) {
  return `
    <div class="error">
      <h1>Could not load this page</h1>
      <p>${esc(message || 'make.fun did not answer.')}</p>
      <p><a href="#/">Back to the board</a> · <a href="javascript:location.reload()">Try again</a></p>
    </div>`;
}

export function notFoundView(what) {
  return `
    <div class="empty">
      <h2>Not found</h2>
      <p>${esc(what || 'That page does not exist on make.fun.')}</p>
      <p><a href="#/">Back to the board</a></p>
    </div>`;
}
