/**
 * robots.txt — با فعال شدن مجله‌ی هدلس (PUBLIC_WP_API_URL) به‌جای sitemap افزونه‌ی سئوی وردپرس،
 * sitemap مجله که در همین پروژه ساخته می‌شود (/mag/sitemap.xml) معرفی می‌شود.
 */
import type { APIRoute } from 'astro';

import { MAG_ENABLED, SITE_URL } from '../config/site';

export const GET: APIRoute = () => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /login',
    'Disallow: /shop/item$',
    'Disallow: /shop/item?',
    '',
    `Sitemap: ${SITE_URL}/sitemap-index.xml`,
    // مجله‌ی هدلس: sitemap ساخته‌شده در همین پروژه؛ در غیر این صورت sitemap افزونه‌ی سئوی وردپرس فعلی
    `Sitemap: ${SITE_URL}/mag/${MAG_ENABLED ? 'sitemap.xml' : 'sitemap_index.xml'}`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
