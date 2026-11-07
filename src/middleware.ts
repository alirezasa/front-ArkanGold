/**
 * Middleware سرور — نوشتن قیمت لحظه‌ی طلا در HTML صفحه‌های پویا (src/lib/serverPrice.ts).
 * فقط صفحه‌هایی که Astro.locals.livePrice = true دارند (و روی سرور ساخته می‌شوند) تغییر می‌کنند؛
 * صفحه‌های ایستا در build این مقدار را ندارند و دست‌نخورده می‌مانند.
 */
import { defineMiddleware } from 'astro:middleware';
import { withDeadline } from './lib/cache';
import { fillPriceBindings, serverGoldPrice } from './lib/serverPrice';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const isHtml = response.headers.get('content-type') === 'text/html';
  if (isHtml) {
    try {
      response.headers.set('Content-Type', 'text/html; charset=utf-8');
    } catch {
      /* هدرهای این پاسخ قابل تغییر نیستند */
    }
  }
  if (!context.locals.livePrice || !isHtml) return response;

  // حداکثر ۱.۲ ثانیه انتظار برای قیمت؛ بعد از آن صفحه با متن پیش‌فرض می‌رود و مرورگر قیمت را پر می‌کند
  const price = await withDeadline(serverGoldPrice(), 1200, null);
  if (!price) return response; // API قیمت در دسترس نیست: متن پیش‌فرض می‌ماند و مرورگر پر می‌کند

  const html = fillPriceBindings(await response.text(), price);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
});
