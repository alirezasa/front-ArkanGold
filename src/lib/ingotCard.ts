/**
 * کارت محصول (شمش طلا) — یک منبع مشترک برای HTML کارت
 * ----------------------------------------------------
 * همین تابع هم در build (ProductCard.astro) و هم در مرورگر (افزودن شمش‌های جدیدی
 * که بعد از آخرین build به API اضافه شده‌اند) استفاده می‌شود تا ظاهر کارت‌ها یکسان بماند.
 * کارت همیشه کاربر را به صفحه‌ی جزئیات محصول می‌برد؛ دکمه‌ی خرید نهایی فقط در آن صفحه است.
 * updateIngotCard قیمت لحظه‌ای و موجودی یک کارت موجود را به‌روز می‌کند.
 */
import { formatToman } from './goldPrice';
import {
  ingotImages,
  ingotWeights,
  karatLabel,
  priceRange,
  weightLabel,
  type GoldIngot,
} from './goldIngots';

export const INGOT_PLACEHOLDER_IMAGE = '/images/gold-ingot-placeholder.svg';

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** فقط لینک‌های http(s) یا مسیرهای داخلی سایت مجاز هستند */
export function safeHref(url: string | null | undefined): string {
  const value = (url ?? '').trim();
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
  return '';
}

export function ingotDetailPath(slug: string): string {
  return `/shop/${encodeURIComponent(slug)}`;
}

/** صفحه‌ی جزئیات شمش‌هایی که بعد از آخرین build اضافه شده‌اند (در مرورگر ساخته می‌شود) */
export function ingotLiveDetailPath(slug: string): string {
  return `/shop/item?slug=${encodeURIComponent(slug)}`;
}

export type IngotSortMode = 'price-asc' | 'price-desc' | 'weight-asc' | 'weight-desc';
/** ترتیب پیش‌فرض فروشگاه: ارزان‌ترین و در قیمت برابر، سبک‌ترین */
export const DEFAULT_SORT: IngotSortMode = 'price-asc';

/**
 * مقایسه‌گر مرتب‌سازی شمش‌ها. معیار دوم همیشه صعودی است: در مرتب‌سازی قیمت، وزن کمتر
 * و در مرتب‌سازی وزن، قیمت کمتر جلوتر می‌آید. محصولات ناموجود همیشه آخر فهرست هستند.
 */
export function compareBy(mode: IngotSortMode) {
  const [key, dir] = mode.split('-') as ['price' | 'weight', 'asc' | 'desc'];
  const other = key === 'price' ? 'weight' : 'price';
  // مقدار نامعلوم (صفر) همیشه آخر می‌آید
  const num = (x: number, y: number, sign: number) => (x > 0 && y > 0 ? sign * (x - y) : x > 0 ? -1 : y > 0 ? 1 : 0);
  type Key = { price: number; weight: number; inStock: boolean };
  return (a: Key, b: Key) =>
    Number(!a.inStock) - Number(!b.inStock) || num(a[key], b[key], dir === 'desc' ? -1 : 1) || num(a[other], b[other], 1);
}

const sortKeyOf = (p: GoldIngot) => ({ price: priceRange(p).from, weight: ingotWeights(p)[0] ?? 0, inStock: p.inStock });

/** مرتب‌سازی محصولات (build و مرورگر) */
export function compareIngots(mode: IngotSortMode = DEFAULT_SORT) {
  const cmp = compareBy(mode);
  return (a: GoldIngot, b: GoldIngot) => cmp(sortKeyOf(a), sortKeyOf(b));
}

export function ingotPriceText(p: GoldIngot): string {
  const { from, to } = priceRange(p);
  if (!from) return 'تماس بگیرید';
  return to > from ? `از ${formatToman(from)}` : formatToman(from);
}

/** متن دکمه‌ی کارت — کارت همیشه کاربر را اول به صفحه‌ی جزئیات می‌برد و خرید از آنجا انجام می‌شود */
export function ingotCardCtaLabel(p: GoldIngot | null, serviceEnabled: boolean): string {
  if (!p?.inStock) return 'ناموجود — مشاهده جزئیات';
  if (!serviceEnabled) return 'مشاهده جزئیات';
  return 'مشاهده جزئیات و خرید';
}

interface CardOptions {
  /** صفحه‌ی جزئیات ایستای این محصول در build ساخته شده است؟ (وگرنه صفحه‌ی /shop/item) */
  hasPage: boolean;
  serviceEnabled: boolean;
  headingTag?: 'h2' | 'h3';
}

export function ingotCardHtml(p: GoldIngot, { hasPage, serviceEnabled, headingTag = 'h2' }: CardOptions): string {
  const image = ingotImages(p)[0];
  const weights = ingotWeights(p);
  const detailHref = hasPage ? ingotDetailPath(p.slug) : ingotLiveDetailPath(p.slug);
  const h = headingTag;

  return `<article class="product-card group relative flex flex-col rounded-card bg-white border border-brand-100/40 shadow-card overflow-hidden card-lift" data-slug="${esc(p.slug)}" data-weight="${weights[0] ?? ''}" data-price="${priceRange(p).from || ''}" data-in-stock="${p.inStock}">
  <div class="relative block aspect-[4/3] bg-canvas-100 overflow-hidden">
    <img src="${esc(image?.src || INGOT_PLACEHOLDER_IMAGE)}" alt="${esc(image?.alt || p.name)}" loading="lazy" width="400" height="300" class="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" onerror="this.onerror=null;this.src='${INGOT_PLACEHOLDER_IMAGE}'" />
    <span class="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand shadow-sm tnum">${esc(karatLabel(p.purityKarat))}</span>
    <span data-ingot-stock-badge class="${p.inStock ? 'hidden ' : ''}absolute top-3 left-3 rounded-full bg-danger px-2.5 py-1 text-[11px] font-semibold text-white">ناموجود</span>
  </div>
  <div class="flex flex-1 flex-col p-4 sm:p-5">
    <p class="text-[11px] text-brand-300 mb-1">${esc(p.category?.name || 'شمش طلا')}</p>
    <${h} class="font-semibold text-brand mb-2 leading-7"><a href="${esc(detailHref)}" class="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">${esc(p.name)}</a></${h}>
    ${p.shortDescription ? `<p class="text-xs leading-6 text-ink-soft line-clamp-2 mb-3">${esc(p.shortDescription)}</p>` : ''}
    <div class="mt-auto flex items-end justify-between gap-3 border-t border-brand-100/30 pt-3 mb-4">
      <div class="text-xs text-ink-soft">${weights.length ? `وزن: <span class="tnum font-medium text-ink">${esc(weightLabel(p))}</span>` : '&nbsp;'}</div>
      <div class="text-left">
        <p class="text-[11px] text-ink-soft flex items-center gap-1 justify-end"><span class="live-dot scale-75"></span> قیمت لحظه‌ای</p>
        <p class="font-bold text-brand tnum" data-ingot-price>${esc(ingotPriceText(p))}</p>
      </div>
    </div>
    <span data-ingot-cta class="btn-primary !py-2.5 text-xs group-hover:shadow-card-hover" aria-hidden="true">${esc(ingotCardCtaLabel(p, serviceEnabled))}</span>
  </div>
</article>`;
}

function tick(el: HTMLElement) {
  el.classList.remove('price-tick');
  void el.offsetWidth;
  el.classList.add('price-tick');
}

/** به‌روزرسانی قیمت و موجودی یک کارت (در مرورگر) */
export function updateIngotCard(card: HTMLElement, p: GoldIngot | null, serviceEnabled: boolean) {
  // محصولی که دیگر در فهرست «موجود» API نیست، ناموجود نمایش داده می‌شود
  const inStock = !!p?.inStock;
  const priceEl = card.querySelector<HTMLElement>('[data-ingot-price]');
  if (p && priceEl) {
    const text = ingotPriceText(p);
    if (priceEl.textContent !== text) {
      priceEl.textContent = text;
      tick(priceEl);
    }
    card.dataset.price = String(priceRange(p).from || '');
  }
  card.dataset.inStock = String(inStock);
  card.querySelector('[data-ingot-stock-badge]')?.classList.toggle('hidden', inStock);
  const cta = card.querySelector<HTMLElement>('[data-ingot-cta]');
  if (cta) cta.textContent = ingotCardCtaLabel(p, serviceEnabled);
}
