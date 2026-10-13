// Receives the app's anonymous usage pings and keeps one small record per visit.
// A visit only ever rewrites its own record, so two phones can never overwrite each other.
import { getStore } from '@netlify/blobs';

const num = (x, max) => { x = Math.round(Number(x)); return Number.isFinite(x) && x > 0 ? Math.min(x, max) : 0; };
const tag = (x, re) => (typeof x === 'string' && re.test(x) ? x : '');

export function clean(b, country, now = Date.now()) {
  if (!b || typeof b !== 'object') return null;
  const s = tag(b.s, /^[a-z0-9]{8,16}$/), v = tag(b.v, /^[a-z0-9]{8,20}$/);
  const t0 = Number(b.t0);
  if (!s || !v || !Number.isFinite(t0) || t0 > now + 3600e3 || t0 < now - 2 * 86400e3) return null;
  return {
    s, v, t0: Math.round(t0),
    f: tag(b.f, /^[a-z0-9_-]{1,20}$/i).toLowerCase(),
    nv: b.nv === true, d: ['android', 'ios', 'desktop'].includes(b.d) ? b.d : 'desktop', a: b.a ? 1 : 0,
    t: num(b.t, 86400), w: num(b.w, 100000), l: num(b.l, 100000), o: b.o === 0 ? 0 : 1,
    c: tag(country, /^[A-Z]{2}$/), u: now,
  };
}

export const dayOf = t => new Date(t).toISOString().slice(0, 10);

export async function handle(req, country, store) {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  let body;
  try { body = JSON.parse((await req.text()).slice(0, 2000)); } catch (e) { return new Response(null, { status: 400 }); }
  const rec = clean(body, country);
  if (!rec) return new Response(null, { status: 400 });
  await store.setJSON(`s/${dayOf(rec.t0)}/${rec.s}`, rec);
  return new Response(null, { status: 204 });
}

export default async (req, context) =>
  handle(req, context?.geo?.country?.code, getStore('nahim-stats'));

export const config = { path: '/api/track' };
