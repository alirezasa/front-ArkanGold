/**
 * sitemap شمش‌ها: /sitemap-shop.xml — صفحه‌ی همه‌ی شمش‌ها، هنگام درخواست از API (با کش).
 * شمش تازه بدون build در sitemap می‌آید. (بقیه‌ی صفحه‌ها از جمله /shop در sitemap-index.xml هستند.)
 */
import type { APIRoute } from 'astro';
import { SITE_URL } from '../config/site';
import { loadIngotCatalog } from '../lib/goldIngots';
import { ingotDetailPath } from '../lib/ingotCard';

export const prerender = false;

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  const { products, source, generatedAt } = await loadIngotCatalog();
  if (source === 'unavailable') return new Response('Service Unavailable', { status: 503, headers: { 'Retry-After': '300' } });
  const lastmod = generatedAt ? `<lastmod>${new Date(generatedAt).toISOString()}</lastmod>` : '';
  const urls = [...products.map((p) => new URL(ingotDetailPath(p.slug), SITE_URL).toString())];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${xml(u)}</loc>${lastmod}</url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
};
