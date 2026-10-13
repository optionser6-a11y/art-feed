// Gives the dashboard its numbers. Needs the secret key from Netlify (variable DASH_KEY).
import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';
import { dayOf } from './track.mjs';

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function load(store, days, now = Date.now()) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const day = dayOf(now - i * 86400e3);
    let blobs = [];
    try { blobs = (await store.list({ prefix: `s/${day}/` })).blobs; } catch (e) {}
    for (let j = 0; j < blobs.length; j += 25) {
      const part = await Promise.all(blobs.slice(j, j + 25).map(b => store.get(b.key, { type: 'json' }).catch(() => null)));
      for (const r of part) if (r) out.push(r);
    }
  }
  return out;
}

export async function wipe(store, now = Date.now()) {
  let n = 0;
  const { blobs } = await store.list({ prefix: 's/' });
  for (let j = 0; j < blobs.length; j += 25) { await Promise.all(blobs.slice(j, j + 25).map(b => store.delete(b.key))); n += Math.min(25, blobs.length - j); }
  await store.setJSON('meta/reset', { at: now });           // visits that started before this moment never come back
  return n;
}

export async function handle(req, key, store, now = Date.now()) {
  if (!key || key.length < 8) return json({ error: 'not-configured' }, 503);
  if (!same(req.headers.get('x-key') || '', key)) return json({ error: 'wrong-key' }, 401);
  if (req.method === 'POST') return json({ ok: true, removed: await wipe(store, now) });
  const days = Math.max(1, Math.min(90, Number(new URL(req.url).searchParams.get('days')) || 30));
  const reset = await store.get('meta/reset', { type: 'json' }).catch(() => null);
  const since = (reset && reset.at) || 0;
  const sessions = (await load(store, days, now)).filter(r => r.t0 >= since);
  return json({ now, days, sessions });
}

export default async (req) => handle(req, process.env.DASH_KEY, getStore('nahim-stats'));

export const config = { path: '/api/stats' };
