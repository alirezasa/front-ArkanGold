/**
 * بسته‌ی آماده‌ی آپلود برنامه‌ی Node.js سایت: dist/app
 * ----------------------------------------------------
 *   dist/app/client     ← فایل‌های ایستا (صفحه‌های ساخته‌شده در build، CSS/JS، تصاویر، فونت‌ها)
 *                          + نسخه‌ی فشرده‌ی .br و .gz فایل‌های متنی (بدون هزینه‌ی فشرده‌سازی در زمان اجرا)
 *   dist/app/entry      ← باندل سرور Astro (صفحه‌های پویا) — همه‌ی وابستگی‌ها داخلش؛ npm install لازم نیست
 *   dist/app/server.mjs ← سرور HTTP (server/server.mjs)
 *   dist/app/app.cjs    ← فایل شروع برای Passenger (cPanel ← Setup Node.js App)
 *   dist/app/tmp/restart.txt ← تغییرش بعد از آپلود، برنامه را با نسخه‌ی جدید راه‌اندازی می‌کند
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const COMPRESSIBLE = /\.(html|css|js|mjs|json|xml|svg|txt|webmanifest|ico)$/i;

function precompress(dir) {
  let count = 0;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const st = statSync(file);
    if (st.isDirectory()) {
      count += precompress(file);
    } else if (COMPRESSIBLE.test(name) && st.size > 1024) {
      const data = readFileSync(file);
      writeFileSync(`${file}.br`, brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
      writeFileSync(`${file}.gz`, gzipSync(data, { level: 9 }));
      count++;
    }
  }
  return count;
}

export default function nodeApp() {
  let clientDir;
  let serverDir;
  let outDir;
  return {
    name: 'arkan-node-app',
    hooks: {
      'astro:config:done': ({ config }) => {
        clientDir = fileURLToPath(config.build.client);
        serverDir = fileURLToPath(config.build.server);
        outDir = fileURLToPath(config.outDir);
      },
      'astro:build:done': ({ logger }) => {
        const app = join(outDir, 'app');
        rmSync(app, { recursive: true, force: true });
        mkdirSync(join(app, 'tmp'), { recursive: true });
        cpSync(clientDir, join(app, 'client'), { recursive: true });
        cpSync(serverDir, join(app, 'entry'), { recursive: true });
        cpSync(new URL('../../server/server.mjs', import.meta.url), join(app, 'server.mjs'));
        cpSync(new URL('../../server/app.cjs', import.meta.url), join(app, 'app.cjs'));
        writeFileSync(
          join(app, 'package.json'),
          JSON.stringify(
            { name: 'arkan-gold-site', private: true, type: 'module', main: 'app.cjs', scripts: { start: 'node server.mjs' }, engines: { node: '>=18.17' } },
            null,
            2
          ) + '\n'
        );
        writeFileSync(join(app, 'tmp', 'restart.txt'), new Date().toISOString() + '\n');
        const n = precompress(join(app, 'client'));
        logger.info(`بسته‌ی برنامه‌ی Node.js آماده است: dist/app (${n} فایل متنی فشرده شد)`);
      },
    },
  };
}
