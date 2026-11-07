/**
 * مسیرهای مجله (SSR) — فقط وقتی PUBLIC_WP_API_URL تنظیم شده باشد به سایت اضافه می‌شوند.
 * بدون آن هیچ فایلی زیر /mag ساخته نمی‌شود و سایت دقیقاً مثل قبل (کاملاً ایستا) است.
 * مسیرهای ثابت (rss.xml، sitemap.xml، wp-revalidate) بر مسیر عمومی [...path] اولویت دارند.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default function magazine() {
  let serverDir;
  let outDir;
  return {
    name: 'arkan-magazine',
    hooks: {
      'astro:config:done': ({ config }) => {
        serverDir = fileURLToPath(config.build.server);
        outDir = fileURLToPath(config.outDir);
      },
      // بسته‌ی آماده‌ی آپلود برنامه‌ی Node.js: dist/mag-app (بدون نیاز به npm install روی هاست)
      'astro:build:done': ({ logger }) => {
        const app = `${outDir}/mag-app`;
        rmSync(app, { recursive: true, force: true });
        mkdirSync(`${app}/tmp`, { recursive: true });
        cpSync(serverDir, `${app}/entry`, { recursive: true });
        cpSync(new URL('../../server/server.mjs', import.meta.url), `${app}/server.mjs`);
        cpSync(new URL('../../server/app.cjs', import.meta.url), `${app}/app.cjs`);
        writeFileSync(
          `${app}/package.json`,
          JSON.stringify({ name: 'arkan-mag', private: true, type: 'module', main: 'app.cjs', scripts: { start: 'node server.mjs' }, engines: { node: '>=18.17' } }, null, 2) + '\n'
        );
        // تغییر این فایل به Passenger می‌گوید بعد از آپلود، برنامه را با نسخه‌ی جدید دوباره راه‌اندازی کند
        writeFileSync(`${app}/tmp/restart.txt`, new Date().toISOString() + '\n');
        logger.info('بسته‌ی سرور مجله: dist/mag-app (پوشه‌ی برنامه‌ی Node.js) — فایل‌های ایستا: dist/client (public_html)');
      },
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({ pattern: '/mag/rss.xml', entrypoint: './src/mag/rss.ts', prerender: false });
        injectRoute({ pattern: '/mag/sitemap.xml', entrypoint: './src/mag/sitemap.ts', prerender: false });
        injectRoute({ pattern: '/mag/wp-revalidate', entrypoint: './src/mag/revalidate.ts', prerender: false });
        injectRoute({ pattern: '/mag/[...path]', entrypoint: './src/mag/MagPage.astro', prerender: false });
      },
    },
  };
}
