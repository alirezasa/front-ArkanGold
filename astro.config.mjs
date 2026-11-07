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
      // مجله sitemap اختصاصی خودش را دارد (/mag/sitemap.xml با lastmod هر مطلب و بدون صفحه‌های noindex)
      // صفحه‌ی /shop/item (جزئیات شمش‌های جدید در مرورگر) و /mag-live (جست‌وجو و مطالب جدید) noindex هستند
      filter: (page) => !page.includes('/mag') && !page.includes('/shop/item'),
    }),
  ],
  i18n: {
    defaultLocale: 'fa',
    locales: ['fa'],
  },
});
