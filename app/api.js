// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
// Answers are cached in memory and revalidated with ETags: the API binds an
// ETag to the minute, so an If-None-Match inside the same minute answers 304
// and costs the view nothing. A failed request falls back to a fresh-enough
// cached answer instead of showing an error for a blip.

const API = 'https://make.fun/api';
const TTL_MS = 60_000;
const STALE_MS = 5 * 60_000;

const cache = new Map();

async function get(path) {
  const url = API + path;
  const hit = cache.get(url);
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    if (hit) return hit.data;
    throw err;
  }
  if (res.status === 304 && hit) {
    hit.at = Date.now();
    return hit.data;
  }
  if (!res.ok) {
    if (hit && Date.now() - hit.at < STALE_MS) return hit.data;
    const err = new Error(`make.fun answered ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  cache.set(url, { etag: res.headers.get('ETag'), at: Date.now(), data });
  return data;
}

/** The board: open bounties with their live pots and entry counts. */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** One bounty, by its slug: summary, rules, live rewards, recent entries. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: ranked entries with the columns the API defines. */
export const getLeaderboard = (slug, limit = 50) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard?limit=${limit}`);

/** An account's public profile: record, entries, payouts. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);

/** The site's rankings: by 'prizes' (most prize money) or 'wins' (most wins). */
export const getRankings = (by = 'prizes', limit = 25) =>
  get(`/rankings?by=${encodeURIComponent(by)}&limit=${limit}`);

/** Site-wide totals: entries, lines of code, tokens burned. */
export const getStats = () => get('/activity/stats');
