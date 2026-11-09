/**
 * محصولات فروشگاه آرکان گلد — شمش طلا
 * ----------------------------------------------------
 * تنها نوع محصول فروشگاه «شمش طلا» است و همه‌ی اطلاعات (نام، تصاویر، مشخصات،
 * وزن‌ها، قیمت نهایی، موجودی، بسته‌بندی و لینک خرید) از API آرکان گلد خوانده می‌شود:
 *
 *   GET {ARKAN_API_URL}/public/gold-ingots?page=1&limit=50&inStock=true   ← فهرست (حداکثر ۵۰ در هر صفحه)
 *   GET {ARKAN_API_URL}/public/gold-ingots/{slug}                         ← جزئیات یک شمش
 *
 *   { "serviceEnabled": true, "currency": "TOMAN", "generatedAt": "...", "data": {...} | [...] }
 *
 * صفحه‌ی فروشگاه و صفحه‌ی هر شمش هنگام بازدید روی سرور ساخته می‌شوند (شمش جدید فوراً صفحه‌ی
 * کامل با سئو دارد)؛ در مرورگر همین API با هر بروزرسانی قیمت طلا (هر ۳۰ ثانیه) دوباره خوانده
 * می‌شود تا قیمت نهایی و موجودی همیشه لحظه‌ای باشند. دکمه‌ی خرید کاربر را به buyUrl همان وزن (variant) می‌برد.
 *
 * این فایل هم در build (Node) و هم در مرورگر استفاده می‌شود.
 */
import { ARKAN_API_URL } from '../config/site';
import { cached } from './cache';
import { fetchFallback } from './endpoints';

export interface IngotSpec {
  label: string;
  value: string;
}

export interface IngotImage {
  url: string;
  altText?: string | null;
  isPrimary?: boolean;
}

export interface IngotVariant {
  id: string;
  sku: string;
  weightGrams: string;
  finalPriceToman: string;
  inStock: boolean;
  buyUrl: string;
}

export interface IngotPackagingOption {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  priceToman: string;
  perUnit: boolean;
  isDefault: boolean;
  freeThresholdToman?: string | null;
}

export interface GoldIngot {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  specifications: IngotSpec[];
  purityKarat?: string | null;
  pricingMode?: string;
  livePricing?: boolean;
  category?: { name: string; slug: string } | null;
  primaryImageUrl?: string | null;
  images: IngotImage[];
  inStock: boolean;
  priceFromToman?: string | null;
  priceToToman?: string | null;
  weightRange?: { min?: string | number; max?: string | number } | string | null;
  variants: IngotVariant[];
  buyUrl: string;
  packagingOptions: IngotPackagingOption[];
}

export interface IngotApiResponse<T> {
  serviceEnabled: boolean;
  currency: string;
  generatedAt: string;
  data: T;
}

export const GOLD_INGOTS_API_URL = `${ARKAN_API_URL}/public/gold-ingots`;
/** حداکثر تعداد مجاز در هر صفحه‌ی API فهرست */
export const GOLD_INGOTS_PAGE_LIMIT = 50;
const MAX_PAGES = 20;
const FETCH_TIMEOUT = 12_000;

/* ------------------------------------------------------------------
 * کمک‌تابع‌ها
 * ------------------------------------------------------------------ */

export const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** آدرس‌های نسبی تصاویر/لینک‌ها نسبت به دامنه‌ی API کامل می‌شوند */
export function absoluteUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url, `${ARKAN_API_URL}/`).toString();
  } catch {
    return url;
  }
}

/** «K18» → ۱۸ عیار (۷۵۰) */
export function karatLabel(purityKarat: string | null | undefined): string {
  const karat = parseInt(String(purityKarat ?? '').replace(/\D/g, ''), 10);
  if (!karat) return '۱۸ عیار (۷۵۰)';
  const millesimal = Math.round((karat / 24) * 1000);
  return `${karat.toLocaleString('fa-IR')} عیار (${millesimal.toLocaleString('fa-IR')})`;
}

export function formatGrams(grams: number): string {
  return `${grams.toLocaleString('fa-IR', { maximumFractionDigits: 3 })} گرم`;
}

/** تصاویر محصول؛ تصویر اصلی همیشه اول است */
export function ingotImages(p: GoldIngot): { src: string; alt: string }[] {
  const list = [...(p.images ?? [])].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  const out = list.map((img) => ({ src: absoluteUrl(img.url), alt: img.altText || p.name })).filter((i) => i.src);
  const primary = absoluteUrl(p.primaryImageUrl);
  if (primary && !out.some((i) => i.src === primary)) out.unshift({ src: primary, alt: p.name });
  return out;
}

/** وزن‌های قابل خرید (گرم) به ترتیب صعودی */
export function ingotWeights(p: GoldIngot): number[] {
  return [...new Set((p.variants ?? []).map((v) => toNumber(v.weightGrams)).filter((w) => w > 0))].sort((a, b) => a - b);
}

export function weightLabel(p: GoldIngot): string {
  const w = ingotWeights(p);
  if (w.length === 0) return '';
  if (w.length === 1) return formatGrams(w[0]);
  return `${w[0].toLocaleString('fa-IR', { maximumFractionDigits: 3 })} تا ${formatGrams(w[w.length - 1])}`;
}

/** کمترین / بیشترین قیمت نهایی (تومان) */
export function priceRange(p: GoldIngot): { from: number; to: number } {
  const prices = (p.variants ?? []).map((v) => toNumber(v.finalPriceToman)).filter((x) => x > 0);
  const from = toNumber(p.priceFromToman) || (prices.length ? Math.min(...prices) : 0);
  const to = toNumber(p.priceToToman) || (prices.length ? Math.max(...prices) : 0) || from;
  return { from, to };
}

export function specValue(p: GoldIngot, label: string): string | undefined {
  return p.specifications?.find((s) => s.label.trim() === label)?.value;
}

/** پاک‌سازی حداقلی HTML توضیحات (حذف اسکریپت، iframe و رویدادهای inline) */
export function sanitizeDescription(text: string | null | undefined): string {
  const value = (text ?? '').trim();
  if (!value) return '';
  if (!/<[a-z][\s\S]*>/i.test(value)) {
    // متن ساده: هر پاراگراف در یک <p>
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return value
      .split(/\n{2,}/)
      .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
  return value
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

/* ------------------------------------------------------------------
 * فراخوانی API
 * ------------------------------------------------------------------ */

async function getJson<T>(url: string): Promise<T> {
  const res = await fetchFallback(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    timeoutMs: FETCH_TIMEOUT,
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

function totalPagesOf(body: Record<string, any>): number | null {
  const meta = body.meta ?? body.pagination ?? body;
  const n = toNumber(meta?.totalPages ?? meta?.pages ?? meta?.lastPage);
  return n > 0 ? n : null;
}

export interface IngotList {
  serviceEnabled: boolean;
  generatedAt: string;
  products: GoldIngot[];
}

/** فهرست کامل شمش‌ها (همه‌ی صفحات) */
export async function fetchIngotList(inStock = true): Promise<IngotList> {
  const products: GoldIngot[] = [];
  let serviceEnabled = true;
  let generatedAt = '';

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ page: String(page), limit: String(GOLD_INGOTS_PAGE_LIMIT) });
    if (inStock) params.set('inStock', 'true');
    const body = await getJson<IngotApiResponse<GoldIngot[] | GoldIngot | null> & Record<string, any>>(
      `${GOLD_INGOTS_API_URL}?${params}`
    );
    serviceEnabled = body.serviceEnabled !== false;
    generatedAt = body.generatedAt || generatedAt;
    const rows = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
    products.push(...rows);

    const totalPages = totalPagesOf(body);
    if (totalPages ? page >= totalPages : rows.length < GOLD_INGOTS_PAGE_LIMIT) break;
  }

  // حذف موارد تکراری احتمالی بین صفحات
  const seen = new Set<string>();
  return {
    serviceEnabled,
    generatedAt,
    products: products.filter((p) => p?.slug && !seen.has(p.slug) && seen.add(p.slug)),
  };
}

/** جزئیات یک شمش با slug */
export async function fetchIngot(slug: string): Promise<IngotApiResponse<GoldIngot>> {
  return getJson<IngotApiResponse<GoldIngot>>(`${GOLD_INGOTS_API_URL}/${encodeURIComponent(slug)}`);
}

/* ------------------------------------------------------------------
 * بارگذاری روی سرور (SSR) — با کش src/lib/cache.ts
 * ------------------------------------------------------------------ */

export interface IngotCatalog extends IngotList {
  source: 'api' | 'unavailable';
}

/** مدت تازه ماندن داده‌ی فروشگاه روی سرور؛ قیمت و موجودی در مرورگر هم هر ۳۰ ثانیه به‌روز می‌شوند */
const SHOP_TTL = 60_000;
/** قیمت‌های قدیمی‌تر از ۱ ساعت در قطعی API نمایش داده نمی‌شوند */
const SHOP_MAX_STALE = 60 * 60_000;
/** تا ۵ دقیقه بعد از تازگی، نسخه‌ی قبلی بدون انتظار نمایش داده و در پس‌زمینه تازه می‌شود */
const SHOP_SWR = 5 * 60_000;

async function fetchCatalog(): Promise<IngotCatalog> {
  const list = await fetchIngotList(true);
  const detailed = await Promise.all(
    list.products.map(async (p) => {
      try {
        const res = await fetchIngot(p.slug);
        return res.data?.slug ? { ...p, ...res.data } : p;
      } catch {
        return p;
      }
    })
  );
  return { ...list, products: detailed, source: 'api' };
}

/**
 * کاتالوگ کامل شمش‌ها (فهرست + جزئیات هر شمش) — هنگام بازدید روی سرور، با کش ۶۰ ثانیه‌ای.
 * اگر API در دسترس نباشد آخرین نسخه‌ی سالم نمایش داده می‌شود؛ اگر آن هم نباشد صفحه خطا نمی‌دهد
 * و محصولات در مرورگر مستقیماً از API بارگذاری می‌شوند.
 */
export async function loadIngotCatalog(): Promise<IngotCatalog> {
  try {
    return await cached('shop:catalog', SHOP_TTL, fetchCatalog, { maxStaleMs: SHOP_MAX_STALE, swrMs: SHOP_SWR });
  } catch (err) {
    console.warn(`[shop] API شمش‌ها (${GOLD_INGOTS_API_URL}) در دسترس نبود: ${(err as Error)?.message ?? err}`);
    return UNAVAILABLE_CATALOG;
  }
}

/** کاتالوگ خالی وقتی API در دسترس نیست (صفحه‌ی فروشگاه محصولات را در مرورگر بارگذاری می‌کند) */
export const UNAVAILABLE_CATALOG: IngotCatalog = { serviceEnabled: true, generatedAt: '', products: [], source: 'unavailable' };

/** جزئیات یک شمش برای صفحه‌ی /shop/{slug}؛ null یعنی چنین شمشی وجود ندارد (۴۰۴) */
export function loadIngot(slug: string): Promise<{ product: GoldIngot | null; serviceEnabled: boolean }> {
  return cached(`shop:item:${slug}`, SHOP_TTL, async () => {
    try {
      const res = await fetchIngot(slug);
      return { product: res.data?.slug ? res.data : null, serviceEnabled: res.serviceEnabled !== false };
    } catch (err) {
      if (/^404\b/.test(String((err as Error)?.message))) return { product: null, serviceEnabled: true };
      throw err;
    }
  }, { maxStaleMs: SHOP_MAX_STALE, swrMs: SHOP_SWR }).catch(async (err) => {
    // API جزئیات در دسترس نیست و این شمش کش نشده: از کاتالوگ کش‌شده (اگر هست)
    const catalog = await loadIngotCatalog();
    const product = catalog.products.find((p) => p.slug === slug);
    if (product) return { product, serviceEnabled: catalog.serviceEnabled };
    throw err;
  });
}
