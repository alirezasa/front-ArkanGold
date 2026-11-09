/**
 * فایل‌های آپلود وردپرس روی دامنه‌ی اصلی: /wp-content/uploads/{مسیر}
 * ----------------------------------------------------
 * تصاویر و فایل‌های مطالب مجله از وردپرس (cms.arkan.gold) خوانده و روی دیسک سرور کش می‌شوند و با
 * آدرس arkan.gold سرو می‌شوند؛ پس cms.arkan.gold نه در صفحه‌ها دیده می‌شود و نه در Google Images.
 * - بار اول از وردپرس دانلود و در پوشه‌ی cache/uploads برنامه ذخیره می‌شود؛ بعد از آن مستقیم از دیسک
 *   (حتی اگر وردپرس در دسترس نباشد). مسیر کش با متغیر MEDIA_CACHE_DIR قابل تغییر است.
 * - فقط فایل‌های رسانه/سند (پسوندهای مجاز) سرو می‌شوند؛ مسیرهای نقطه‌دار و .. رد می‌شوند.
 */
import type { APIRoute } from 'astro';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { WP_API_URL } from '../config/site';
import { fetchFallback } from '../lib/endpoints';

export const prerender = false;

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
};
/** فایل‌های بزرگ‌تر از این کش نمی‌شوند (فقط عبور داده می‌شوند) */
const MAX_CACHE_BYTES = 25 * 1024 * 1024;
const CACHE_DIR = path.resolve(process.env.MEDIA_CACHE_DIR || path.join(process.cwd(), 'cache', 'uploads'));
/** آدرس پوشه‌ی uploads وردپرس: https://cms.arkan.gold/wp-json → https://cms.arkan.gold/wp-content/uploads */
const UPSTREAM = `${WP_API_URL.replace(/\/wp-json$/, '')}/wp-content/uploads`;

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });

function headersFor(type: string, size: number, mtime?: Date): HeadersInit {
  return {
    'Content-Type': type,
    'Content-Length': String(size),
    // نام فایل‌های آپلود وردپرس تغییر نمی‌کند؛ کش طولانی مرورگر
    'Cache-Control': 'public, max-age=2592000',
    ...(mtime ? { 'Last-Modified': mtime.toUTCString() } : {}),
    ...(type === 'image/svg+xml' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
  };
}

export const GET: APIRoute = async ({ params }) => {
  const file = String(params.file ?? '');
  const segments = file.split('/');
  if (!file || file.includes('\0') || segments.some((s) => !s || s.startsWith('.'))) return notFound();
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return notFound();

  const local = path.join(CACHE_DIR, ...segments);
  if (!local.startsWith(CACHE_DIR + path.sep)) return notFound();

  // ۱) از کش دیسک
  try {
    const st = await stat(local);
    if (st.isFile()) return new Response(await readFile(local), { headers: headersFor(type, st.size, st.mtime) });
  } catch {
    /* هنوز کش نشده */
  }

  // ۲) از وردپرس
  let res: Response;
  try {
    res = await fetchFallback(`${UPSTREAM}/${segments.map(encodeURIComponent).join('/')}`, { timeoutMs: 20_000 });
  } catch (err) {
    console.error(`[media] ${file}:`, (err as Error)?.message ?? err);
    return new Response('Bad gateway', { status: 502, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  }
  if (res.status === 404 || res.status === 410) return notFound();
  if (!res.ok) return new Response('Bad gateway', { status: 502, headers: { 'Cache-Control': 'no-store' } });

  const body = Buffer.from(await res.arrayBuffer());
  if (body.length <= MAX_CACHE_BYTES) {
    try {
      await mkdir(path.dirname(local), { recursive: true });
      const tmp = `${local}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, body);
      await rename(tmp, local); // نوشتن اتمی: فایل نیمه‌کاره هرگز سرو نمی‌شود
    } catch (err) {
      console.warn(`[media] ذخیره‌ی کش ${file} ناموفق بود:`, (err as Error)?.message ?? err);
    }
  }
  return new Response(body, { headers: headersFor(type, body.length) });
};
