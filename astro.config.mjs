import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import { loadEnv } from 'vite';
import magazine from './src/mag/integration.mjs';
import nodeApp from './src/integrations/node-app.mjs';

// آدرس اصلی سایت — برای ساخت لینک‌های canonical، sitemap و og:url استفاده می‌شود
// (کد سایت همین مقدار را از src/config/site.ts می‌خواند)
export const SITE_URL = 'https://arkan.gold';

// کل سایت روی یک برنامه‌ی Node.js اجرا می‌شود (README ← «اجرا روی Node.js»):
// - صفحه‌های با محتوای ثابت (درباره ما، قوانین، سوالات متداول و ...) در build ساخته می‌شوند
// - صفحه‌های با داده‌ی زنده (صفحه‌ی اصلی، قیمت، خرید/فروش، فروشگاه، تحویل، مجله) هنگام بازدید
//   روی سرور ساخته می‌شوند: `export const prerender = false` در همان صفحه
const mode = process.argv.includes('dev') ? 'development' : 'production';
const env = loadEnv(mode, process.cwd(), '');
// مجله (وردپرس هدلس روی https://cms.arkan.gold) به‌طور پیش‌فرض فعال است؛ PUBLIC_WP_API_URL=off غیرفعالش
// می‌کند (همان منطق src/config/site.ts)
const MAG_ENABLED = !/^(off|false|0|no)$/i.test((env.PUBLIC_WP_API_URL ?? '').trim());

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  output: 'hybrid',
  adapter: node({ mode: 'middleware' }),
  // همه‌ی وابستگی‌ها داخل باندل سرور قرار می‌گیرند تا روی هاست npm install لازم نباشد
  vite: { ssr: { noExternal: true } },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      // همه‌ی صفحه‌های با آدرس ثابت (ایستا و سرور). مجله (/mag/sitemap.xml) و شمش‌ها (/sitemap-shop.xml)
      // sitemap پویای خودشان را دارند؛ /login و /shop/item فقط ریدایرکت هستند
      filter: (page) => !/\/(mag|login)(\/|$)|\/shop\/item/.test(page),
    }),
    ...(MAG_ENABLED ? [magazine()] : []),
    nodeApp(),
  ],
  i18n: {
    defaultLocale: 'fa',
    locales: ['fa'],
  },
});
