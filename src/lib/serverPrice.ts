/**
 * قیمت طلا در HTML صفحه‌های سرور (SSR)
 * ----------------------------------------------------
 * صفحه‌هایی که روی سرور ساخته می‌شوند با Astro.locals.livePrice = true اعلام می‌کنند که قیمت
 * لحظه‌ای در HTML آن‌ها نوشته شود؛ src/middleware.ts بعد از ساخت صفحه، همه‌ی المان‌های
 * data-price-bind (نوار قیمت هدر، هیرو، ماشین‌حساب، صفحه‌ی قیمت، فروشگاه) را با قیمت فعلی پر می‌کند.
 * نتیجه: موتورهای جست‌وجو و پیش‌نمایش لینک‌ها قیمت واقعی را می‌بینند (نه «در حال دریافت...»)
 * و کاربر قیمت را بدون انتظار می‌بیند. در مرورگر priceBinding.ts مثل قبل هر ۳۰ ثانیه به‌روز می‌کند.
 */
import { cached } from './cache';
import { fetchFallback } from './endpoints';
import { GOLD_PRICE_API_URL, formatToman, normalize, type GoldPriceResponse, type NormalizedGoldPrice } from './goldPrice';

/** قیمت روی سرور حداکثر ۲۰ ثانیه کش می‌شود (API هر ۳۰ ثانیه در مرورگر هم خوانده می‌شود) */
const PRICE_TTL = 20_000;
/** صفحه نباید برای قیمت بیشتر از این منتظر بماند؛ بعد از آن با متن پیش‌فرض ساخته می‌شود */
const PRICE_TIMEOUT = 3_000;
/** قیمت قدیمی‌تر از این هرگز در HTML نوشته نمی‌شود (در قطعی API متن پیش‌فرض می‌ماند) */
const PRICE_MAX_STALE = 5 * 60_000;

export function serverGoldPrice(): Promise<NormalizedGoldPrice> {
  return cached('price:current', PRICE_TTL, async () => {
    const res = await fetchFallback(GOLD_PRICE_API_URL, {
      headers: { Accept: 'application/json' },
      timeoutMs: PRICE_TIMEOUT,
    });
    if (!res.ok) throw new Error(`${res.status} ${GOLD_PRICE_API_URL}`);
    const price = normalize((await res.json()) as GoldPriceResponse);
    if (!(price.pricePerGram > 0)) throw new Error('empty gold price');
    return price;
  }, { maxStaleMs: PRICE_MAX_STALE, swrMs: PRICE_TTL });
}

const BIND_RE =
  /(<([a-z][a-z0-9]*)\b([^>]*\bdata-price-bind="(pricePerGram|changePercent|fetchedAt)"[^>]*)>)([^<]*)(<\/\2>)/g;

/** متن اولیه‌ی المان‌های data-price-bind — همان قالبی که priceBinding.ts در مرورگر می‌سازد */
export function fillPriceBindings(html: string, price: NormalizedGoldPrice): string {
  const up = price.changePercent >= 0;
  return html.replace(BIND_RE, (_m, _open, tag: string, attrs: string, field: string, inner: string, close: string) => {
    let value = '';
    let newAttrs = attrs;
    if (field === 'pricePerGram') {
      value = /data-price-format="toman"/.test(attrs) ? formatToman(price.pricePerGram) : String(price.pricePerGram);
    } else if (field === 'changePercent') {
      value = `${up ? '▲' : '▼'} ${Math.abs(price.changePercent).toLocaleString('fa-IR')}٪`;
      const dark = /data-price-context="dark"/.test(attrs);
      const cls = up ? (dark ? 'text-success-light' : 'text-success') : dark ? 'text-danger-light' : 'text-danger';
      newAttrs = /\bclass="/.test(attrs) ? attrs.replace(/\bclass="/, `class="${cls} `) : `${attrs} class="${cls}"`;
    } else {
      value = price.fetchedAt.toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran' });
    }
    // فاصله‌های اطراف متن قبلی حفظ می‌شود تا چیدمان HTML تغییر نکند
    const lead = inner.match(/^\s*/)?.[0] ?? '';
    const trail = inner.match(/\s*$/)?.[0] ?? '';
    return `<${tag}${newAttrs}>${lead}${value}${trail}${close}`;
  });
}
