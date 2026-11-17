// Small helpers for showing API values.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00' or 0.5) as '$1,000' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}

/** A plain number with thousands separators. */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

/** A deadline as a date in UTC. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** Whether a deadline is within the next N hours (and still ahead). */
export function endsWithin(iso, hours) {
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 && ms <= hours * 3600000;
}

/** How long ago something happened: 'just now', '3h ago', '2d ago'. */
export function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date(iso);
}

/** '1 entry' / '5 entries'. */
export function plural(n, word) {
  return `${num(n)} ${word}${Number(n) === 1 ? '' : 's'}`;
}

/** An avatar from the API as an absolute URL. Prefers make.fun's own small
 * rendition ('/api/avatars/….webp') over an external image URL, so the picture
 * loads from the same origin as the API. */
export function avatarUrl(image) {
  if (!image) return null;
  if (typeof image === 'string') return image.startsWith('http') ? image : `https://make.fun${image}`;
  const u = image.url_small || image.url;
  if (u) return u.startsWith('http') ? u : `https://make.fun${u}`;
  return null;
}

/** A Solana address shortened for display: 'C9Eb…rg1Q'. */
export function shortWallet(address) {
  const a = String(address ?? '');
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
