import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// آدرس اصلی سایت — برای ساخت لینک‌های canonical، sitemap و og:url استفاده می‌شود
export const SITE_URL = 'https://arkan.gold';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      // صفحات بلاگ خارج از این پروژه (وردپرس) هستند، در sitemap این پروژه نباید بیایند
      // صفحه‌ی /shop/item (جزئیات شمش‌های جدید در مرورگر) noindex است
      filter: (page) => !page.includes('/mag') && !page.includes('/shop/item'),
    }),
  ],
  i18n: {
    defaultLocale: 'fa',
    locales: ['fa'],
  },
});
