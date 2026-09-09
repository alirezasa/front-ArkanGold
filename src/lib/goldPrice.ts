/**
 * سرویس مرکزی قیمت طلا
 * ----------------------------------------------------
 * تمام بخش‌های سایت (هیرو، ماشین‌حساب، نمودار، نوار هدر، صفحه قیمت)
 * فقط از همین فایل قیمت می‌گیرند. اگر در آینده API یا ساختار پاسخ عوض شد،
 * فقط کافیست همین فایل را ویرایش کنید.
 *
 * منبع فعلی: https://api.talasea.ir/api/market/getGoldPrice
 * پاسخ نمونه:
 * {
 *   "price": "23587",        // به نظر می‌رسد واحد آن هزار تومان به ازای هر... (نیاز به تایید نهایی)
 *   "change24h": "5.46",     // درصد تغییر ۲۴ ساعته
 *   ...
 * }
 *
 * نکته مهم: عدد "price" این API واحدش با "تومان به ازای هر گرم طلای ۱۸ عیار"
 * فرق دارد و باید ضرب‌شونده (MULTIPLIER) بر اساس مستندات واقعی API تنظیم شود.
 * فعلاً یک ضریب پیش‌فرض گذاشته‌ایم که با هماهنگی بعدی قابل تغییر است.
 */

export interface GoldPriceResponse {
  price: string;
  minOrderValue: number;
  minSellOrderValue: number;
  feeTable: { min: number; fee: number }[];
  totalOrder30dayValues: number;
  minDeposit: number;
  maxDeposit: number;
  maxOrderValue: number;
  fee: number;
  percentageCreditLoan: number;
  goldInstallmentPercent: number;
  change24h: string;
  disableBuyMessage: string;
  disableSellMessage: string;
  disableSell: boolean;
  disableBuy: boolean;
  disableMargin: boolean;
  disableMarginMessage: string;
  disableLimit: boolean;
  disableLimitMessage: string;
}

export interface NormalizedGoldPrice {
  /** قیمت هر گرم طلای ۱۸ عیار به تومان */
  pricePerGram: number;
  /** درصد تغییر ۲۴ ساعته (می‌تواند منفی باشد) */
  changePercent: number;
  /** خام‌ترین پاسخ API برای استفاده‌های خاص (کارمزد، حداقل سفارش و ...) */
  raw: GoldPriceResponse;
  /** زمان دریافت داده */
  fetchedAt: Date;
}

export const GOLD_PRICE_API_URL = 'https://arkan.gold/mag/wp-json/arkan/v1/live-gold';

/** فاصله زمانی به‌روزرسانی خودکار قیمت (میلی‌ثانیه) */
export const GOLD_PRICE_POLL_INTERVAL = 30_000;

/**
 * ضریب تبدیل عدد خام API به تومان-به-ازای-هر-گرم.
 * تا زمانی که مستندات دقیق API در اختیار نباشد، این عدد باید دستی تنظیم شود.
 * مقدار فعلی صرفاً یک فرض کاری است.
 */
const RAW_PRICE_MULTIPLIER = 1000;

let cachedPrice: NormalizedGoldPrice | null = null;
const listeners = new Set<(price: NormalizedGoldPrice) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function normalize(raw: GoldPriceResponse): NormalizedGoldPrice {
  return {
    pricePerGram: Math.round(parseFloat(raw.price) * RAW_PRICE_MULTIPLIER),
    changePercent: parseFloat(raw.change24h) || 0,
    raw,
    fetchedAt: new Date(),
  };
}

/** یک بار قیمت را از API می‌گیرد و نتیجه نرمال‌شده را برمی‌گرداند */
export async function fetchGoldPrice(): Promise<NormalizedGoldPrice> {
  const res = await fetch(GOLD_PRICE_API_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Gold price API error: ${res.status}`);
  const data: GoldPriceResponse = await res.json();
  const normalized = normalize(data);
  cachedPrice = normalized;
  listeners.forEach((cb) => cb(normalized));

  // کمک‌ابزار دیباگ: برای تایید سریع صحت RAW_PRICE_MULTIPLIER در کنسول مرورگر.
  // بعد از دیپلوی، کنسول را باز کنید و "raw" را با قیمت واقعی بازار مقایسه کنید.
  if (typeof window !== 'undefined') {
    console.info(
      `[gold-price] raw="${data.price}" × ${RAW_PRICE_MULTIPLIER} = ${normalized.pricePerGram.toLocaleString('fa-IR')} تومان — اگر این عدد با نرخ واقعی بازار همخوانی ندارد، RAW_PRICE_MULTIPLIER را در src/lib/goldPrice.ts اصلاح کنید.`
    );
  }

  return normalized;
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

  fetchGoldPrice().catch((err) => console.error('[gold-price] fetch failed:', err));

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
 * تاریخچه‌ی قیمت برای نمودار.
 * چون API فعلی فقط قیمت لحظه‌ای می‌دهد (نه بازه‌ی زمانی)، این تابع با هر بار
 * دریافت قیمت جدید یک نقطه به بافر تاریخچه‌ی محلی (in-memory) اضافه می‌کند.
 * وقتی در آینده API بازه‌های زمانی واقعی (ساعتی/روزانه/هفتگی) اضافه شود،
 * فقط باید این بخش با fetch واقعی جایگزین شود؛ بقیه‌ی کامپوننت‌ها بدون تغییر می‌مانند.
 */
const HISTORY_LIMIT = 60;
const priceHistory: { time: Date; price: number }[] = [];

export function pushPriceHistoryPoint(point: NormalizedGoldPrice) {
  priceHistory.push({ time: point.fetchedAt, price: point.pricePerGram });
  if (priceHistory.length > HISTORY_LIMIT) priceHistory.shift();
}

export function getPriceHistory() {
  return [...priceHistory];
}

/**
 * فرمت‌دهنده‌ی استاندارد تومان با اعداد فارسی برای استفاده‌ی یکسان در کل سایت
 */
export const tomanFormatter = new Intl.NumberFormat('fa-IR');

export function formatToman(value: number): string {
  return `${tomanFormatter.format(Math.round(value))} تومان`;
}
