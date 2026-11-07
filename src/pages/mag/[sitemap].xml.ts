/**
 * sitemap مجله: /mag/sitemap.xml — فهرست مجله، آرشیوها و همه‌ی مطالب با تاریخ آخرین ویرایش.
 * صفحه‌هایی که نویسنده در Yoast / Rank Math روی noindex گذاشته حذف می‌شوند.
 * آدرس قدیمی sitemap وردپرس (/mag/sitemap_index.xml) در public/.htaccess به اینجا هدایت می‌شود.
 */
import type { APIRoute } from 'astro';
import { MAG_ENABLED } from '../../config/site';
import { loadMagazine } from '../../lib/magazine';
import { magUrl } from '../../lib/wp';

export async function getStaticPaths() {
  return MAG_ENABLED ? [{ params: { sitemap: 'sitemap' } }] : [];
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const latest = (dates: string[]) => dates.reduce((a, b) => (b > a ? b : a), '');

export const GET: APIRoute = async () => {
  const mag = await loadMagazine();
  const entries: { loc: string; lastmod?: string }[] = [];
  entries.push({ loc: magUrl(''), lastmod: latest(mag.posts.map((p) => p.modified)) });
  for (const p of [...mag.posts, ...mag.pages]) if (!p.seo.noindex) entries.push({ loc: magUrl(p.path), lastmod: p.modified });
  for (const a of [...mag.categories, ...mag.tags, ...mag.authors]) {
    if (!a.seo.noindex) entries.push({ loc: magUrl(a.path), lastmod: latest(a.posts.map((p) => p.modified)) });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => `  <url><loc>${xml(new URL(e.loc).toString())}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
