/**
 * وضعیت سرور: /healthz — برای سرویس مانیتورینگ (UptimeRobot و ...) و عیب‌یابی.
 * نتیجه‌ی اتصال به وردپرس مجله، API قیمت طلا و API شمش‌ها را نشان می‌دهد (از کش سرور؛ فشار اضافه
 * به API ها نمی‌آورد). همیشه X-Robots-Tag: noindex دارد تا در نتایج جست‌وجو نیاید.
 */
import type { APIRoute } from 'astro';
import { MAG_ENABLED, WP_API_URL } from '../config/site';
import { loadIngotCatalog } from '../lib/goldIngots';
import { getSite } from '../lib/magazine';
import { serverGoldPrice } from '../lib/serverPrice';

export const prerender = false;

const check = async (fn: () => Promise<unknown>) => {
  try {
    const detail = await fn();
    return { ok: true, ...(detail && typeof detail === 'object' ? detail : {}) };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
};

export const GET: APIRoute = async () => {
  const [goldPrice, shop, magazine] = await Promise.all([
    check(async () => ({ pricePerGram: (await serverGoldPrice()).pricePerGram })),
    check(async () => {
      const c = await loadIngotCatalog();
      if (c.source === 'unavailable') throw new Error('gold-ingots API unavailable');
      return { products: c.products.length };
    }),
    MAG_ENABLED
      ? check(async () => {
          const site = await getSite();
          return { api: WP_API_URL, home: site.home, name: site.name };
        })
      : Promise.resolve({ ok: true, enabled: false }),
  ]);

  const body = { ok: true, time: new Date().toISOString(), goldPrice, shop, magazine };
  return new Response(JSON.stringify(body, null, 2), {
    // ۲۰۰ یعنی خود سایت بالاست؛ وضعیت هر API در بدنه‌ی پاسخ است
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
