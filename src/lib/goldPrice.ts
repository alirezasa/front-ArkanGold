/**
 * سرویس مرکزی قیمت طلا
 * ----------------------------------------------------
 * تمام بخش‌های سایت (هیرو، ماشین‌حساب، نمودار، نوار هدر، صفحه قیمت، فروشگاه)
 * فقط از همین فایل قیمت می‌گیرند. منبع قیمت فقط API آرکان گلد است:
 *
 *   GET {ARKAN_API_URL}/market/price
 *   {
 *     "metal": "GOLD",
 *     "pricePerGramRial": "255310000",
 *     "pricePerGramToman": "25531000",   // قیمت هر گرم طلای ۱۸ عیار به تومان
 *     "change24h": 0.67,                 // درصد تغییر ۲۴ ساعته
 *     "source": "talasea.ir",
 *     "fetchedAt": "2026-10-01T11:23:30.045Z",
 *     "disableBuy": false,
 *     "disableSell": false,
 *     "fromCache": true
 *   }
 *
 *   GET {ARKAN_API_URL}/market/price/history?hours=24
 *   [ { "time": "2026-09-30T11:25:00.046Z", "priceRial": "253410000", "priceToman": "25341000" }, ... ]
 */

import { ARKAN_API_URL, TRADE_FEE_PERCENT } from '../config/site';

export interface GoldPriceResponse {
  metal: string;
  pricePerGramRial: string;
  pricePerGramToman: string;
  change24h: number | string;
  source?: string;
  fetchedAt?: string;
  disableBuy?: boolean;
  disableSell?: boolean;
  disableBuyMessage?: string;
  disableSellMessage?: string;
  fromCache?: boolean;
}

export interface NormalizedGoldPrice {
  /** قیمت هر گرم طلای ۱۸ عیار به تومان */
  pricePerGram: number;
  /** درصد تغییر ۲۴ ساعته (می‌تواند منفی باشد) */
  changePercent: number;
  /** پاسخ خام API (disableBuy، disableSell و ...) */
  raw: GoldPriceResponse;
  /** زمان ثبت قیمت در منبع (fetchedAt پاسخ API) */
  fetchedAt: Date;
}

export interface PriceHistoryPoint {
  time: Date;
  /** قیمت هر گرم طلای ۱۸ عیار به تومان */
  price: number;
}

export const GOLD_PRICE_API_URL = `${ARKAN_API_URL}/market/price`;
export const GOLD_PRICE_HISTORY_API_URL = `${ARKAN_API_URL}/market/price/history`;

/** فاصله زمانی به‌روزرسانی خودکار قیمت (میلی‌ثانیه) */
export const GOLD_PRICE_POLL_INTERVAL = 30_000;

let cachedPrice: NormalizedGoldPrice | null = null;
const listeners = new Set<(price: NormalizedGoldPrice) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<NormalizedGoldPrice> | null = null;

const toNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

function normalize(raw: GoldPriceResponse): NormalizedGoldPrice {
  const toman = toNumber(raw.pricePerGramToman) || toNumber(raw.pricePerGramRial) / 10;
  const fetchedAt = raw.fetchedAt ? new Date(raw.fetchedAt) : new Date();
  return {
    pricePerGram: Math.round(toman),
    changePercent: toNumber(raw.change24h),
    raw,
    fetchedAt: Number.isNaN(fetchedAt.getTime()) ? new Date() : fetchedAt,
  };
}

/** یک بار قیمت را از API می‌گیرد و نتیجه نرمال‌شده را برمی‌گرداند */
export function fetchGoldPrice(): Promise<NormalizedGoldPrice> {
  // درخواست‌های هم‌زمان چند کامپوننت در یک درخواست شبکه ادغام می‌شوند
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const res = await fetch(GOLD_PRICE_API_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Gold price API error: ${res.status}`);
    const normalized = normalize((await res.json()) as GoldPriceResponse);
    if (!(normalized.pricePerGram > 0)) throw new Error('Gold price API returned an empty price');
    cachedPrice = normalized;
    listeners.forEach((cb) => cb(normalized));
    return normalized;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** آخرین قیمت کش‌شده (بدون فراخوانی شبکه) */
export function getCachedGoldPrice(): NormalizedGoldPrice | null {
  return cachedPrice;
}

/**
 * اشتراک در به‌روزرسانی‌های قیمت. هر بار قیمت جدید بیاید (اولین بار فوری
 * و بعد هر GOLD_PRICE_POLL_INTERVAL) تابع callback صدا زده می‌شود.
 * تابع بازگشتی برای لغو اشتراک است.
 */
export function subscribeGoldPrice(callback: (price: NormalizedGoldPrice) => void): () => void {
  listeners.add(callback);

  if (cachedPrice) callback(cachedPrice);
  else fetchGoldPrice().catch((err) => console.error('[gold-price] fetch failed:', err));

  if (!pollTimer) {
    pollTimer = setInterval(() => {
      fetchGoldPrice().catch((err) => console.error('[gold-price] poll failed:', err));
    }, GOLD_PRICE_POLL_INTERVAL);
  }

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

/**
 * تاریخچه‌ی قیمت برای نمودار — بازه بر حسب ساعت (مثلا ۲۴ = یک روز، ۱۶۸ = یک هفته).
 * خروجی بر اساس زمان مرتب شده است.
 */
export async function fetchPriceHistory(hours: number): Promise<PriceHistoryPoint[]> {
  const url = `${GOLD_PRICE_HISTORY_API_URL}?hours=${encodeURIComponent(hours)}`;
  const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Gold price history API error: ${res.status}`);
  const body = await res.json();
  const rows: { time?: string; priceRial?: string; priceToman?: string }[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : [];

  return rows
    .map((r) => ({
      time: new Date(r.time ?? ''),
      price: Math.round(toNumber(r.priceToman) || toNumber(r.priceRial) / 10),
    }))
    .filter((p) => !Number.isNaN(p.time.getTime()) && p.price > 0)
    .sort((a, b) => a.time.getTime() - b.time.getTime());
}

/**
 * کارمزد معامله (۰٫۵ درصد) — در خرید به مبلغ اضافه و در فروش از مبلغ کسر می‌شود.
 * نرخ فقط در src/config/site.ts تعریف شده است.
 */
export function calcTradeFee(value: number): number {
  return (Math.max(0, value) * TRADE_FEE_PERCENT) / 100;
}

/**
 * فرمت‌دهنده‌ی استاندارد تومان با اعداد فارسی برای استفاده‌ی یکسان در کل سایت
 */
export const tomanFormatter = new Intl.NumberFormat('fa-IR');

export function formatToman(value: number): string {
  return `${tomanFormatter.format(Math.round(value))} تومان`;
}
