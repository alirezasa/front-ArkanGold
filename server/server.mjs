/**
 * سرور Node.js مجله (/mag) — روی هاست با cPanel «Setup Node.js App» (Passenger) اجرا می‌شود.
 * این فایل در build همراه باندل سرور در dist/mag-app کپی می‌شود؛ راهنما: README ← «مجله».
 *
 * - فقط آدرس‌های /mag را پاسخ می‌دهد؛ بقیه‌ی سایت فایل ایستا روی LiteSpeed است.
 * - Passenger بسته به نسخه ممکن است پیشوند /mag را از آدرس حذف کند؛ هر دو حالت پشتیبانی می‌شود.
 * - آدرس‌های قدیمی وردپرس با / در انتها (/mag/مطلب/) با ۳۰۱ به نسخه‌ی بدون / می‌روند.
 */
import http from 'node:http';
import { handler } from './entry/entry.mjs';

const BASE = '/mag';
const port = Number(process.env.PORT) || 4322;

const server = http.createServer((req, res) => {
  const raw = req.url || '/';
  const q = raw.indexOf('?');
  let pathname = q === -1 ? raw : raw.slice(0, q);
  const search = q === -1 ? '' : raw.slice(q);

  pathname = pathname.replace(/\/{2,}/g, '/');
  if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) pathname = BASE + (pathname === '/' ? '' : pathname);

  if (pathname.length > BASE.length && pathname.endsWith('/')) {
    res.writeHead(301, { Location: pathname.replace(/\/+$/, '') + search, 'Cache-Control': 'public, max-age=86400' });
    res.end();
    return;
  }

  req.url = pathname + search;
  handler(req, res, () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
});

server.keepAliveTimeout = 65_000;
server.listen(port, () => console.log(`[mag] سرور مجله روی پورت ${port} آماده است`));
