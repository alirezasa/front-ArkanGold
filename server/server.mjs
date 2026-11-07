/**
 * سرور Node.js سایت آرکان گلد — روی هاست با cPanel «Setup Node.js App» (Passenger) اجرا می‌شود.
 * در build همراه باندل سرور در dist/app کپی می‌شود؛ راهنما: README ← «اجرا روی Node.js».
 *
 * ترتیب پاسخ به هر درخواست:
 *   ۱. آدرس با / در انتها (مثل آدرس‌های قدیمی وردپرس) ← ۳۰۱ به نسخه‌ی بدون /
 *   ۲. فایل ایستا از client/ (صفحه‌های ساخته‌شده در build، CSS/JS، تصاویر، فونت‌ها) — با نسخه‌ی
 *      فشرده‌ی br/gz، ETag و کش طولانی برای فایل‌های hash‌دار /_astro
 *   ۳. صفحه‌های پویای Astro (صفحه‌ی اصلی، قیمت، خرید/فروش، فروشگاه، تحویل، مجله)
 *   ۴. صفحه‌ی ۴۰۴ سایت
 * (/healthz برای مانیتورینگ: src/pages/healthz.ts)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handler } from './entry/entry.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client');
const port = Number(process.env.PORT) || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function cacheControl(file) {
  if (file.includes(`${path.sep}_astro${path.sep}`)) return 'public, max-age=31536000, immutable';
  if (/\.(woff2?|png|jpe?g|webp|avif|gif|svg|ico)$/i.test(file)) return 'public, max-age=2592000';
  if (/\.html$/i.test(file)) return 'public, max-age=0, must-revalidate';
  return 'public, max-age=3600';
}

/** فایل ایستای متناظر با آدرس (یا null) — مسیرهای نقطه‌دار (‎.htaccess، ‎..) هرگز سرو نمی‌شوند */
function resolveStatic(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.split('/').some((s) => s.startsWith('.'))) return null;
  const base = path.join(ROOT, decoded);
  if (base !== ROOT && !base.startsWith(ROOT + path.sep)) return null;
  for (const file of [base, path.join(base, 'index.html')]) {
    try {
      const st = fs.statSync(file);
      if (st.isFile()) return { file, st };
    } catch {
      /* وجود ندارد */
    }
  }
  return null;
}

function sendFile(req, res, { file, st }, status = 200) {
  const headers = {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': status === 200 ? cacheControl(file) : 'no-store',
    ...SECURITY_HEADERS,
  };
  let body = file;
  const accept = String(req.headers['accept-encoding'] || '');
  for (const [enc, ext] of [['br', '.br'], ['gzip', '.gz']]) {
    if (accept.includes(enc) && fs.existsSync(file + ext)) {
      body = file + ext;
      headers['Content-Encoding'] = enc;
      break;
    }
  }
  if (TYPES[path.extname(file).toLowerCase()]?.startsWith('text') || headers['Content-Encoding']) headers.Vary = 'Accept-Encoding';

  if (status === 200) {
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    headers.ETag = etag;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
  }
  headers['Content-Length'] = fs.statSync(body).size;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(body).on('error', () => res.destroy()).pipe(res);
}

function notFound(req, res) {
  const page = resolveStatic('/404.html');
  if (page) return sendFile(req, res, page, 404);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  const raw = req.url || '/';
  const q = raw.indexOf('?');
  const pathname = (q === -1 ? raw : raw.slice(0, q)).replace(/\/{2,}/g, '/');
  const search = q === -1 ? '' : raw.slice(q);

  if (pathname.length > 1 && pathname.endsWith('/')) {
    res.writeHead(301, { Location: pathname.replace(/\/+$/, '') + search, 'Cache-Control': 'public, max-age=86400' });
    res.end();
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    const found = resolveStatic(pathname);
    if (found) return sendFile(req, res, found);
  }

  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  req.url = pathname + search;
  handler(req, res, () => notFound(req, res));
});

server.keepAliveTimeout = 65_000;
server.listen(port, () => console.log(`[arkan] سایت روی پورت ${port} آماده است`));
