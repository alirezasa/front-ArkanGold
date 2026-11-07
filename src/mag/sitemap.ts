/**
 * sitemap مجله: /mag/sitemap.xml — فهرست مجله، مطالب، برگه‌ها و آرشیوها با تاریخ آخرین تغییر.
 * صفحه‌هایی که در Yoast روی noindex گذاشته شده‌اند حذف می‌شوند. آدرس‌های قدیمی sitemap افزونه‌ی
 * سئوی وردپرس (sitemap_index.xml، post-sitemap.xml و ...) به اینجا هدایت می‌شوند (src/mag/MagPage.astro).
 */
import type { APIRoute } from 'astro';
import { sitemapEntries } from '../lib/magazine';
import { magUrl } from '../lib/wp';

export const prerender = false;

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  try {
    const entries = await sitemapEntries();
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url><loc>${xml(magUrl(e.path))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
    return new Response(body, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
    });
  } catch (err) {
    console.error('[mag] sitemap:', err);
    return new Response('Service Unavailable', { status: 503, headers: { 'Retry-After': '300' } });
  }
};
