/**
 * خوراک RSS مجله: /mag/rss.xml (آدرس قدیمی وردپرس /mag/feed به اینجا هدایت می‌شود) — SSR و کش‌شده
 */
import type { APIRoute } from 'astro';
import { MAG_NAME, SITE_URL } from '../config/site';
import { getSite, latestPosts } from '../lib/magazine';
import { magUrl } from '../lib/wp';

export const prerender = false;

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
/** لینک‌ها و تصاویر نسبی محتوا در خوراک‌خوان‌ها باید آدرس کامل داشته باشند */
const absolutize = (html: string) => html.replace(/\b(href|src)=(["'])\/(?!\/)/gi, `$1=$2${SITE_URL}/`);
const imageType = (src: string) => (/\.png(\?|$)/i.test(src) ? 'png' : /\.webp(\?|$)/i.test(src) ? 'webp' : 'jpeg');

export const GET: APIRoute = async () => {
  try {
    const [site, posts] = await Promise.all([getSite(), latestPosts(30)]);
    const items = posts
      .map(
        (p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(magUrl(p.path))}</link>
      <guid isPermaLink="true">${xml(magUrl(p.path))}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
${p.author ? `      <dc:creator>${xml(p.author.name)}</dc:creator>\n` : ''}${p.categories.map((c) => `      <category>${xml(c.name)}</category>\n`).join('')}      <description>${xml(p.excerpt)}</description>
      <content:encoded>${cdata(absolutize(p.contentHtml))}</content:encoded>
${p.image ? `      <enclosure url="${xml(p.image.src)}" type="image/${imageType(p.image.src)}" length="0" />\n` : ''}    </item>`
      )
      .join('\n');

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xml(MAG_NAME)}</title>
    <link>${xml(magUrl(''))}</link>
    <atom:link href="${xml(`${SITE_URL}/mag/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>${xml(site.description || 'اخبار، آموزش و تحلیل بازار طلا')}</description>
    <language>fa-IR</language>
    <lastBuildDate>${new Date(posts[0]?.modified || Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
    return new Response(body, {
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
    });
  } catch (err) {
    console.error('[mag] rss:', err);
    return new Response('Service Unavailable', { status: 503, headers: { 'Retry-After': '300' } });
  }
};
