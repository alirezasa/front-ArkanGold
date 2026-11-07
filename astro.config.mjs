import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import { loadEnv } from 'vite';
import magazine from './src/mag/integration.mjs';

// آدرس اصلی سایت — برای ساخت لینک‌های canonical، sitemap و og:url استفاده می‌شود
// (کد سایت همین مقدار را از src/config/site.ts می‌خواند)
export const SITE_URL = 'https://arkan.gold';

// مجله (وردپرس هدلس): با تنظیم PUBLIC_WP_API_URL صفحه‌های /mag روی سرور Node.js هنگام هر بازدید
// از وردپرس ساخته می‌شوند (SSR) و بقیه‌ی سایت مثل قبل ایستا می‌ماند. بدون آن، خروجی دقیقاً مثل قبل است.
const mode = process.argv.includes('dev') ? 'development' : 'production';
const env = loadEnv(mode, process.cwd(), '');
const MAG_SSR = Boolean((env.PUBLIC_WP_API_URL ?? '').trim());

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  ...(MAG_SSR
    ? {
        // hybrid: همه‌ی صفحه‌ها مثل قبل در build ساخته می‌شوند (dist/client)، فقط /mag روی سرور (dist/server)
        output: 'hybrid',
        adapter: node({ mode: 'middleware' }),
        // همه‌ی وابستگی‌ها داخل dist/server باندل می‌شوند تا روی هاست npm install لازم نباشد
        vite: { ssr: { noExternal: true } },
      }
    : {}),
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      // مجله sitemap اختصاصی خودش را دارد (/mag/sitemap.xml با lastmod هر مطلب و بدون صفحه‌های noindex)
      // صفحه‌ی /shop/item (جزئیات شمش‌های جدید در مرورگر) noindex است
      filter: (page) => !page.includes('/mag') && !page.includes('/shop/item'),
    }),
    ...(MAG_SSR ? [magazine()] : []),
  ],
  i18n: {
    defaultLocale: 'fa',
    locales: ['fa'],
  },
});
