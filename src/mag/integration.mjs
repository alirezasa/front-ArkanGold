/**
 * مسیرهای مجله (SSR) — فقط وقتی PUBLIC_WP_API_URL تنظیم شده باشد به سایت اضافه می‌شوند.
 * بدون آن هیچ صفحه‌ای زیر /mag وجود ندارد و منوها به وردپرس فعلی (arkan.gold/mag) لینک می‌دهند.
 * مسیرهای ثابت (rss.xml، sitemap.xml، wp-revalidate) بر مسیر عمومی [...path] اولویت دارند.
 */
export default function magazine() {
  return {
    name: 'arkan-magazine',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({ pattern: '/mag/rss.xml', entrypoint: './src/mag/rss.ts', prerender: false });
        injectRoute({ pattern: '/mag/sitemap.xml', entrypoint: './src/mag/sitemap.ts', prerender: false });
        injectRoute({ pattern: '/mag/wp-revalidate', entrypoint: './src/mag/revalidate.ts', prerender: false });
        injectRoute({ pattern: '/mag/[...path]', entrypoint: './src/mag/MagPage.astro', prerender: false });
      },
    },
  };
}
