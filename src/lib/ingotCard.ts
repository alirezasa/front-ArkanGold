/**
 * کارت محصول (شمش طلا) — یک منبع مشترک برای HTML کارت
 * ----------------------------------------------------
 * همین تابع هم در build (ProductCard.astro) و هم در مرورگر (افزودن شمش‌های جدیدی
 * که بعد از آخرین build به API اضافه شده‌اند) استفاده می‌شود تا ظاهر کارت‌ها یکسان بماند.
 * updateIngotCard قیمت لحظه‌ای، موجودی و لینک خرید یک کارت موجود را به‌روز می‌کند.
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

const esc = (s: string) =>
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

/** لینک خرید محصول: اگر فقط یک وزن دارد مستقیماً همان وزن، وگرنه صفحه‌ی خرید محصول */
export function ingotBuyUrl(p: GoldIngot): string {
  const variants = p.variants ?? [];
  const inStock = variants.filter((v) => v.inStock);
  if (variants.length === 1) return safeHref(variants[0].buyUrl) || safeHref(p.buyUrl);
  if (inStock.length === 1 && !safeHref(p.buyUrl)) return safeHref(inStock[0].buyUrl);
  return safeHref(p.buyUrl) || safeHref(inStock[0]?.buyUrl);
}

export function ingotPriceText(p: GoldIngot): string {
  const { from, to } = priceRange(p);
  if (!from) return 'تماس بگیرید';
  return to > from ? `از ${formatToman(from)}` : formatToman(from);
}

export function ingotBuyLabel(p: GoldIngot, serviceEnabled: boolean): string {
  if (!serviceEnabled) return 'فروش موقتاً غیرفعال است';
  return p.inStock ? 'خرید' : 'ناموجود';
}

interface CardOptions {
  /** صفحه‌ی جزئیات این محصول در build ساخته شده است؟ */
  hasPage: boolean;
  serviceEnabled: boolean;
  headingTag?: 'h2' | 'h3';
}

export function ingotCardHtml(p: GoldIngot, { hasPage, serviceEnabled, headingTag = 'h2' }: CardOptions): string {
  const image = ingotImages(p)[0];
  const weights = ingotWeights(p);
  const buyUrl = ingotBuyUrl(p);
  const canBuy = serviceEnabled && p.inStock && !!buyUrl;
  const detailHref = hasPage ? ingotDetailPath(p.slug) : buyUrl || '/shop';
  const h = headingTag;

  return `<article class="product-card group flex flex-col rounded-card bg-white border border-brand-100/40 shadow-card overflow-hidden card-lift" data-slug="${esc(p.slug)}" data-weight="${weights[0] ?? ''}" data-price="${priceRange(p).from || ''}">
  <a href="${esc(detailHref)}" class="relative block aspect-[4/3] bg-canvas-100 overflow-hidden" tabindex="-1" aria-hidden="true">
    <img src="${esc(image?.src || INGOT_PLACEHOLDER_IMAGE)}" alt="${esc(image?.alt || p.name)}" loading="lazy" width="400" height="300" class="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" onerror="this.onerror=null;this.src='${INGOT_PLACEHOLDER_IMAGE}'" />
    <span class="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand shadow-sm tnum">${esc(karatLabel(p.purityKarat))}</span>
    <span data-ingot-stock-badge class="${p.inStock ? 'hidden ' : ''}absolute top-3 left-3 rounded-full bg-danger px-2.5 py-1 text-[11px] font-semibold text-white">ناموجود</span>
  </a>
  <div class="flex flex-1 flex-col p-5">
    <p class="text-[11px] text-brand-300 mb-1">${esc(p.category?.name || 'شمش طلا')}</p>
    <${h} class="font-semibold text-brand mb-2 leading-7"><a href="${esc(detailHref)}" class="hover:underline">${esc(p.name)}</a></${h}>
    ${p.shortDescription ? `<p class="text-xs leading-6 text-ink-soft line-clamp-2 mb-3">${esc(p.shortDescription)}</p>` : ''}
    <div class="mt-auto flex items-end justify-between gap-3 border-t border-brand-100/30 pt-3 mb-4">
      <div class="text-xs text-ink-soft">${weights.length ? `وزن: <span class="tnum font-medium text-ink">${esc(weightLabel(p))}</span>` : '&nbsp;'}</div>
      <div class="text-left">
        <p class="text-[11px] text-ink-soft flex items-center gap-1 justify-end"><span class="live-dot scale-75"></span> قیمت لحظه‌ای</p>
        <p class="font-bold text-brand tnum" data-ingot-price>${esc(ingotPriceText(p))}</p>
      </div>
    </div>
    <div class="grid ${hasPage ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
      ${hasPage ? `<a href="${esc(detailHref)}" class="btn-outline !py-2.5 text-xs">جزئیات</a>` : ''}
      <a data-ingot-buy ${canBuy ? `href="${esc(buyUrl)}"` : 'aria-disabled="true"'} class="btn-primary !py-2.5 text-xs${canBuy ? '' : ' opacity-50 pointer-events-none'}">${esc(ingotBuyLabel(p, serviceEnabled))}</a>
    </div>
  </div>
</article>`;
}

function tick(el: HTMLElement) {
  el.classList.remove('price-tick');
  void el.offsetWidth;
  el.classList.add('price-tick');
}

/** به‌روزرسانی قیمت، موجودی و لینک خرید یک کارت (در مرورگر) */
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
  card.querySelector('[data-ingot-stock-badge]')?.classList.toggle('hidden', inStock);

  const buy = card.querySelector<HTMLAnchorElement>('[data-ingot-buy]');
  if (!buy) return;
  const url = p ? ingotBuyUrl(p) : '';
  const canBuy = serviceEnabled && inStock && !!url;
  if (canBuy) buy.href = url;
  else buy.removeAttribute('href');
  if (canBuy) buy.removeAttribute('aria-disabled');
  else buy.setAttribute('aria-disabled', 'true');
  buy.classList.toggle('opacity-50', !canBuy);
  buy.classList.toggle('pointer-events-none', !canBuy);
  buy.textContent = p ? ingotBuyLabel(p, serviceEnabled) : 'ناموجود';
}
