/**
 * پاک کردن کش مجله بعد از انتشار/ویرایش مطلب در وردپرس: POST /mag/wp-revalidate
 * افزونه‌ی wordpress/arkan-headless این آدرس را با هدر X-Revalidate-Token صدا می‌زند.
 * توکن در متغیر محیطی MAG_REVALIDATE_TOKEN برنامه‌ی Node.js تعریف می‌شود (در زمان اجرا، نه build)؛
 * تا وقتی تعریف نشده باشد این آدرس غیرفعال است (۴۰۴).
 */
import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { purgeCache } from '../lib/cache';

export const prerender = false;

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST: APIRoute = async ({ request }) => {
  const expected = process.env.MAG_REVALIDATE_TOKEN ?? '';
  if (expected.length < 16) return new Response('Not found', { status: 404 });
  if (!tokenMatches(request.headers.get('x-revalidate-token') ?? '', expected)) {
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const entries = purgeCache('mag:');
  return new Response(JSON.stringify({ ok: true, entries }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

export const GET: APIRoute = () => new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
