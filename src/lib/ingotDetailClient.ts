/**
 * رفتار تعاملی صفحه‌ی جزئیات شمش (فقط مرورگر)
 * ----------------------------------------------------
 * انتخاب وزن، قیمت و موجودی لحظه‌ای، لینک خرید وزن انتخاب‌شده، گالری تصاویر و
 * نوار خرید ثابت موبایل. HTML صفحه از ingotDetailHtml (ingotDetail.ts) می‌آید.
 */
import './priceBinding';
import { formatToman } from './goldPrice';
import { formatGrams, toNumber, type GoldIngot } from './goldIngots';
import { safeHref } from './ingotCard';
import { watchIngot } from './liveIngots';

interface InitOptions {
  slug: string;
  serviceEnabled: boolean;
  /** اگر جزئیات همین الان از API خوانده شده، اولین درخواست تکراری لازم نیست */
  product?: GoldIngot | null;
}

function setText(el: HTMLElement | null, text: string) {
  if (!el || el.textContent === text) return;
  el.textContent = text;
  el.classList.remove('price-tick');
  void el.offsetWidth;
  el.classList.add('price-tick');
}

function setBuyLink(el: HTMLAnchorElement | null, url: string, enabled: boolean) {
  if (!el) return;
  if (enabled) {
    el.href = url;
    el.removeAttribute('aria-disabled');
  } else {
    el.removeAttribute('href');
    el.setAttribute('aria-disabled', 'true');
  }
  el.classList.toggle('opacity-50', !enabled);
  el.classList.toggle('pointer-events-none', !enabled);
}

export function initIngotDetail({ slug, serviceEnabled: initialService, product: initialProduct = null }: InitOptions) {
  let serviceEnabled = initialService;
  let product: GoldIngot | null = initialProduct;

  const variantBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.variant-btn'));
  const buyBtn = document.getElementById('buy-btn') as HTMLAnchorElement | null;
  const buyLabel = buyBtn?.querySelector<HTMLElement>('[data-label]') ?? null;
  const selectedPrice = document.getElementById('selected-price');
  const selectedWeight = document.getElementById('selected-weight');
  const selectedPerGram = document.getElementById('selected-per-gram');
  const updatedEl = document.getElementById('price-updated');
  const bar = document.getElementById('mobile-buy-bar');
  const barBuy = bar?.querySelector<HTMLAnchorElement>('[data-bar-buy]') ?? null;
  const barPrice = bar?.querySelector<HTMLElement>('[data-bar-price]') ?? null;
  const barWeight = bar?.querySelector<HTMLElement>('[data-bar-weight]') ?? null;

  let selectedId = variantBtns.find((b) => b.dataset.active === 'true')?.dataset.variantId ?? '';

  // لینک مستقیم به یک وزن خاص: /shop/{slug}?variant={id}
  const preset = new URLSearchParams(location.search).get('variant');
  if (preset && variantBtns.some((b) => b.dataset.variantId === preset && !b.disabled)) selectedId = preset;

  function render() {
    const variant = product?.variants.find((v) => v.id === selectedId);
    const btn = variantBtns.find((b) => b.dataset.variantId === selectedId);
    const inStock = variant ? variant.inStock : !!btn && !btn.disabled;
    const buyUrl = variant ? safeHref(variant.buyUrl) : btn?.dataset.buyUrl ?? '';

    variantBtns.forEach((b) => {
      const active = b.dataset.variantId === selectedId;
      b.dataset.active = String(active);
      b.setAttribute('aria-checked', String(active));
    });

    let weightText = '';
    let priceText = '';
    let perGramText = '';
    if (variant) {
      const w = toNumber(variant.weightGrams);
      const price = toNumber(variant.finalPriceToman);
      weightText = formatGrams(w);
      priceText = variant.inStock ? formatToman(price) : 'ناموجود';
      perGramText = variant.inStock && w > 0 && price > 0 ? `معادل هر گرم: ${formatToman(price / w)}` : '';
    } else if (btn) {
      weightText = btn.querySelector('[data-variant-weight]')?.textContent?.trim() ?? '';
      priceText = btn.querySelector('[data-variant-price]')?.textContent?.trim() ?? '';
      perGramText = selectedPerGram?.textContent ?? '';
    }
    if (btn || variant) {
      if (selectedWeight) selectedWeight.textContent = weightText ? `(${weightText})` : '';
      if (barWeight) barWeight.textContent = weightText ? `(${weightText})` : '';
      setText(selectedPrice, priceText);
      setText(barPrice, priceText);
      if (selectedPerGram) selectedPerGram.textContent = perGramText;
    }

    const canBuy = serviceEnabled && inStock && !!buyUrl;
    const label = !serviceEnabled ? 'فروش موقتاً غیرفعال است' : inStock ? 'خرید شمش' : 'ناموجود';
    setBuyLink(buyBtn, buyUrl, canBuy);
    setBuyLink(barBuy, buyUrl, canBuy);
    if (buyLabel) buyLabel.textContent = label;
    if (barBuy) barBuy.textContent = label;
  }

  variantBtns.forEach((b) =>
    b.addEventListener('click', () => {
      if (b.disabled) return;
      selectedId = b.dataset.variantId!;
      const url = new URL(location.href);
      url.searchParams.set('variant', selectedId);
      history.replaceState(null, '', url);
      render();
    })
  );

  function applyProduct(p: GoldIngot, enabled: boolean, generatedAt?: string) {
    product = p;
    serviceEnabled = enabled;
    document.getElementById('service-off')?.classList.toggle('hidden', serviceEnabled);

    for (const b of variantBtns) {
      const v = p.variants.find((x) => x.id === b.dataset.variantId);
      b.disabled = !v?.inStock;
      if (v) b.dataset.buyUrl = safeHref(v.buyUrl);
      setText(b.querySelector<HTMLElement>('[data-variant-price]'), v?.inStock ? formatToman(toNumber(v.finalPriceToman)) : 'ناموجود');
    }
    // اگر وزن انتخاب‌شده ناموجود شد، اولین وزن موجود انتخاب می‌شود
    if (!p.variants.find((v) => v.id === selectedId)?.inStock) {
      selectedId = p.variants.find((v) => v.inStock)?.id ?? selectedId;
    }

    for (const o of p.packagingOptions ?? []) {
      const el = document.querySelector<HTMLElement>(`[data-packaging-id="${CSS.escape(o.id)}"] [data-packaging-price]`);
      if (el) el.textContent = toNumber(o.priceToman) > 0 ? formatToman(toNumber(o.priceToman)) : 'رایگان';
    }

    const stockText = p.inStock ? 'موجود' : 'ناموجود';
    const badge = document.getElementById('stock-badge');
    if (badge) {
      badge.textContent = stockText;
      badge.className = `rounded-full px-3 py-1 font-semibold ${p.inStock ? 'bg-success-50 text-success' : 'bg-danger-50 text-danger'}`;
    }
    const stockCell = document.getElementById('stock-cell');
    if (stockCell) stockCell.textContent = stockText;

    if (updatedEl) {
      const at = new Date(generatedAt ?? '');
      updatedEl.textContent = (Number.isNaN(at.getTime()) ? new Date() : at).toLocaleTimeString('fa-IR');
    }
    render();
  }

  if (product) applyProduct(product, serviceEnabled);
  watchIngot(slug, (res) => {
    if (res.data) applyProduct(res.data, res.serviceEnabled !== false, res.generatedAt);
  });

  render();

  // گالری تصاویر
  const mainImage = document.getElementById('product-main-image') as HTMLImageElement | null;
  document.querySelectorAll<HTMLButtonElement>('.gallery-thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      if (!mainImage) return;
      mainImage.src = thumb.dataset.src!;
      mainImage.alt = thumb.dataset.alt || '';
      document.querySelectorAll('.gallery-thumb').forEach((t) => t.setAttribute('data-active', 'false'));
      thumb.dataset.active = 'true';
    });
  });

  // نوار خرید موبایل: وقتی باکس قیمت اصلی از دید خارج شد (پایین‌تر از آن اسکرول شد) ظاهر می‌شود
  const priceBox = document.getElementById('product-price-box');
  if (bar && priceBox && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      bar.classList.toggle('translate-y-full', !show);
      bar.setAttribute('aria-hidden', String(!show));
      barBuy?.setAttribute('tabindex', show ? '0' : '-1');
    }).observe(priceBox);
  }
}
