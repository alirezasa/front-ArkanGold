/**
 * خوراک RSS مجله: /mag/rss.xml (آدرس قدیمی وردپرس /mag/feed در public/.htaccess به اینجا می‌آید)
 * فقط وقتی مجله‌ی هدلس فعال است ساخته می‌شود (PUBLIC_WP_API_URL).
 */
import type { APIRoute } from 'astro';
import { SITE_URL } from '../../../astro.config.mjs';
import { MAG_ENABLED, MAG_NAME } from '../../config/site';
import { loadMagazine } from '../../lib/magazine';
import { magUrl } from '../../lib/wp';

export async function getStaticPaths() {
  return MAG_ENABLED ? [{ params: { feed: 'rss' } }] : [];
}

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
/** لینک‌ها و تصاویر نسبی محتوا در خوراک‌خوان‌ها باید آدرس کامل داشته باشند */
const absolutize = (html: string) => html.replace(/\b(href|src)=(["'])\/(?!\/)/gi, `$1=$2${SITE_URL}/`);

export const GET: APIRoute = async () => {
  const mag = await loadMagazine();
  const posts = mag.posts.slice(0, 30);
  const items = posts
    .map(
      (p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(magUrl(p.path))}</link>
      <guid isPermaLink="true">${xml(magUrl(p.path))}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
${p.author ? `      <dc:creator>${xml(p.author.name)}</dc:creator>\n` : ''}${p.categories.map((c) => `      <category>${xml(c.name)}</category>\n`).join('')}      <description>${xml(p.excerpt)}</description>
      <content:encoded>${cdata(absolutize(p.contentHtml))}</content:encoded>
${p.image ? `      <enclosure url="${xml(p.image.src)}" type="image/${/\.png(\?|$)/i.test(p.image.src) ? 'png' : /\.webp(\?|$)/i.test(p.image.src) ? 'webp' : 'jpeg'}" length="0" />\n` : ''}    </item>`
    )
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xml(MAG_NAME)}</title>
    <link>${xml(magUrl(''))}</link>
    <atom:link href="${xml(magUrl('rss.xml'))}" rel="self" type="application/rss+xml" />
    <description>${xml(mag.site.description || 'اخبار، آموزش و تحلیل بازار طلا')}</description>
    <language>fa-IR</language>
    <lastBuildDate>${new Date(posts[0]?.modified || Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
