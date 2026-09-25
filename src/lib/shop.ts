/**
 * بارگذاری کاتالوگ فروشگاه واقعی آرکان گلد
 * ----------------------------------------------------
 * در زمان build، محصولات و دسته‌بندی‌ها از WooCommerce Store API (عمومی و
 * بدون نیاز به کلید) خوانده می‌شوند:
 *   GET {SHOP_API_URL}/products?per_page=100&page=N
 *   GET {SHOP_API_URL}/products/categories?per_page=100
 *
 * نگاشت ویژگی‌های محصول در ووکامرس (Attributes):
 *   «وزن» یا weight   ← وزن طلا به گرم (اگر نبود از نام محصول، مثلا «۱ گرمی»)
 *   «عیار» یا purity  ← عیار در هزار (پیش‌فرض ۷۵۰)
 *   «اجرت» یا wage    ← درصد اجرت ضرب/بسته‌بندی (اختیاری)
 * بقیه‌ی ویژگی‌ها همان‌طور که در فروشگاه ثبت شده‌اند در جدول مشخصات نمایش داده می‌شوند.
 *
 * اگر API در دسترس نباشد، کاتالوگ پشتیبان src/data/products.ts استفاده می‌شود.
 * با هر build جدید، محصولات تازه‌ی فروشگاه روی سایت منتشر می‌شوند؛ قیمت‌ها همیشه
 * در مرورگر با قیمت لحظه‌ای طلا محاسبه می‌شوند.
 */
import { APP_URL, BAR_PURITY, SHOP_API_URL } from '../config/site';
import {
  fallbackCategories,
  fallbackProducts,
  type Product,
  type ProductCategory,
  type ProductSpec,
  type ProductVisual,
} from '../data/products';

interface WcTerm { id: number; name: string; slug: string }
interface WcAttribute { id: number; name: string; terms: WcTerm[] }
interface WcImage { id: number; src: string; alt: string; name: string }
interface WcProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku: string;
  short_description: string;
  description: string;
  is_in_stock: boolean;
  is_purchasable: boolean;
  prices: { price: string; currency_code: string; currency_minor_unit: number };
  images: WcImage[];
  categories: WcTerm[];
  attributes: WcAttribute[];
}
interface WcCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
  image: { src: string } | null;
}

export interface Catalog {
  products: Product[];
  categories: ProductCategory[];
  source: 'store' | 'fallback';
}

const FETCH_TIMEOUT = 8000;
const UNCATEGORIZED = new Set(['uncategorized', 'دسته‌بندی-نشده', 'بدون-دسته‌بندی']);

/** تبدیل اعداد فارسی/عربی و ممیز فارسی به لاتین */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
    .replace(/[٬]/g, '');
}

function parseNumber(input: string | undefined): number | null {
  if (!input) return null;
  const match = toLatinDigits(input).match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

const stripHtml = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** پاک‌سازی حداقلی HTML توضیحات محصول (حذف اسکریپت، iframe و رویدادهای inline) */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

function safeDecode(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

/** قیمت Store API به واحد کوچک ارز برمی‌گردد؛ اینجا به تومان تبدیل می‌شود */
function priceToToman(prices: WcProduct['prices']): number | null {
  const raw = parseInt(prices?.price ?? '', 10);
  if (!raw) return null;
  const value = raw / 10 ** (prices.currency_minor_unit || 0);
  switch ((prices.currency_code || '').toUpperCase()) {
    case 'IRR':
      return value / 10;
    case 'IRHR': // هزار ریال
      return value * 100;
    case 'IRHT': // هزار تومان
      return value * 1000;
    default: // IRT
      return value;
  }
}

function visualFor(name: string): ProductVisual {
  if (name.includes('کارت')) return 'card';
  if (name.includes('هدیه')) return 'gift';
  return 'bar';
}

function findAttr(attrs: WcAttribute[], pattern: RegExp): string | undefined {
  const attr = attrs.find((a) => pattern.test(a.name));
  return attr?.terms.map((t) => t.name).join('، ');
}

function mapProduct(p: WcProduct): Product {
  const attrs = p.attributes ?? [];
  const name = decodeEntities(p.name);
  const category = p.categories.find((c) => !UNCATEGORIZED.has(safeDecode(c.slug))) ?? p.categories[0];
  const categoryName = category ? decodeEntities(category.name) : 'شمش طلا';

  const weightAttr = findAttr(attrs, /وزن|weight/i);
  const weightFromName = name.match(/([\d۰-۹.٫/]+)\s*(?:گرم|گرمی)/)?.[1];
  const weightGram = parseNumber(weightAttr) ?? parseNumber(weightFromName);
  const purity = parseNumber(findAttr(attrs, /عیار|purity|karat/i)) ?? BAR_PURITY;
  const wagePercent = parseNumber(findAttr(attrs, /اجرت|wage/i)) ?? 0;

  const specs: ProductSpec[] = [];
  if (weightGram) specs.push({ label: 'وزن', value: `${weightGram.toLocaleString('fa-IR')} گرم` });
  specs.push({ label: 'عیار', value: `${purity.toLocaleString('fa-IR')}${purity === 750 ? ' (۱۸ عیار)' : ''}` });
  for (const a of attrs) {
    if (/وزن|weight|عیار|purity|karat|اجرت|wage/i.test(a.name)) continue;
    specs.push({ label: a.name, value: a.terms.map((t) => t.name).join('، ') });
  }
  specs.push({ label: 'دسته‌بندی', value: categoryName });
  if (p.sku) specs.push({ label: 'کد محصول', value: p.sku });

  // افزودن به سبد خرید فروشگاه واقعی (ووکامرس) از طریق پارامتر add-to-cart
  const buyUrl = p.permalink
    ? `${p.permalink}${p.permalink.includes('?') ? '&' : '?'}add-to-cart=${p.id}`
    : APP_URL;

  return {
    id: String(p.id),
    slug: safeDecode(p.slug),
    name,
    categorySlug: category ? safeDecode(category.slug) : 'gold-bar',
    categoryName,
    weightGram,
    purity,
    wagePercent,
    fixedPriceToman: weightGram ? null : priceToToman(p.prices),
    images: p.images.map((img) => ({ src: img.src, alt: img.alt || name })),
    visual: visualFor(`${categoryName} ${name}`),
    shortDescription: stripHtml(p.short_description) || stripHtml(p.description).slice(0, 180),
    descriptionHtml: sanitizeHtml(p.description || p.short_description || ''),
    features: [],
    specs,
    sku: p.sku,
    inStock: p.is_in_stock,
    buyUrl,
    buyLabel: p.is_in_stock ? 'افزودن به سبد و خرید' : 'ناموجود',
    source: 'store',
  };
}

async function fetchJson<T>(url: string): Promise<{ data: T; totalPages: number }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10) || 1;
  return { data: (await res.json()) as T, totalPages };
}

async function fetchStoreCatalog(): Promise<Catalog> {
  const base = SHOP_API_URL.replace(/\/$/, '');

  const wcProducts: WcProduct[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const r = await fetchJson<WcProduct[]>(`${base}/products?per_page=100&page=${page}`);
    wcProducts.push(...r.data);
    totalPages = r.totalPages;
    page++;
  } while (page <= totalPages && page <= 10);

  if (!Array.isArray(wcProducts) || wcProducts.length === 0) throw new Error('store has no products');

  const products = wcProducts.map(mapProduct);

  let wcCategories: WcCategory[] = [];
  try {
    wcCategories = (await fetchJson<WcCategory[]>(`${base}/products/categories?per_page=100`)).data;
  } catch {
    wcCategories = [];
  }

  const used = new Set(products.map((p) => p.categorySlug));
  const categories: ProductCategory[] = wcCategories
    .filter((c) => used.has(safeDecode(c.slug)))
    .map((c) => ({
      slug: safeDecode(c.slug),
      name: decodeEntities(c.name),
      description: stripHtml(c.description || ''),
      visual: visualFor(c.name),
      image: c.image?.src,
    }));

  // دسته‌هایی که در لیست دسته‌بندی‌ها نبودند ولی محصول دارند
  for (const p of products) {
    if (!categories.some((c) => c.slug === p.categorySlug)) {
      categories.push({ slug: p.categorySlug, name: p.categoryName, description: '', visual: p.visual });
    }
  }

  return { products, categories, source: 'store' };
}

let catalogPromise: Promise<Catalog> | null = null;

/** کاتالوگ فروشگاه (یک بار در هر build خوانده و بین صفحات به اشتراک گذاشته می‌شود) */
export function loadCatalog(): Promise<Catalog> {
  if (!catalogPromise) {
    catalogPromise = fetchStoreCatalog().catch((err) => {
      console.warn(
        `[shop] فروشگاه واقعی در دسترس نبود (${err?.message ?? err}) — کاتالوگ پشتیبان src/data/products.ts استفاده شد.`
      );
      return { products: fallbackProducts, categories: fallbackCategories, source: 'fallback' as const };
    });
  }
  return catalogPromise;
}
