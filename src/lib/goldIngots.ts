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
 * در زمان build صفحه‌ی فروشگاه و صفحه‌ی هر شمش ساخته می‌شود؛ در مرورگر همین API
 * با هر بروزرسانی قیمت طلا (هر ۳۰ ثانیه) دوباره خوانده می‌شود تا قیمت نهایی و
 * موجودی همیشه لحظه‌ای باشند. دکمه‌ی خرید کاربر را به buyUrl همان وزن (variant) می‌برد.
 *
 * این فایل هم در build (Node) و هم در مرورگر استفاده می‌شود.
 */
import { ARKAN_API_URL } from '../config/site';

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
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
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
 * بارگذاری در زمان build
 * ------------------------------------------------------------------ */

export interface IngotCatalog extends IngotList {
  source: 'api' | 'unavailable';
}

let catalogPromise: Promise<IngotCatalog> | null = null;

/**
 * کاتالوگ شمش‌ها برای build (یک بار خوانده و بین صفحات به اشتراک گذاشته می‌شود).
 * برای هر شمش جزئیات کامل هم خوانده می‌شود. اگر API در دسترس نباشد build شکست
 * نمی‌خورد؛ صفحه‌ی فروشگاه محصولات را در مرورگر مستقیماً از API بارگذاری می‌کند.
 */
export function loadIngotCatalog(): Promise<IngotCatalog> {
  if (!catalogPromise) {
    catalogPromise = (async (): Promise<IngotCatalog> => {
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
      return { ...list, products: detailed, source: 'api' as const };
    })().catch((err) => {
      console.warn(
        `[shop] API شمش‌ها (${GOLD_INGOTS_API_URL}) در دسترس نبود (${err?.message ?? err}) — محصولات در مرورگر بارگذاری می‌شوند.`
      );
      return { serviceEnabled: true, generatedAt: '', products: [], source: 'unavailable' as const };
    });
  }
  return catalogPromise;
}
