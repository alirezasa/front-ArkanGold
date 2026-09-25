/**
 * قیمت‌گذاری لحظه‌ای محصولات فروشگاه
 * ----------------------------------------------------
 * هر المانی با data-live-product به‌صورت خودکار با هر بروزرسانی قیمت طلا
 * (هر ۳۰ ثانیه) قیمت‌گذاری می‌شود:
 *
 *   <div data-live-product data-weight="1" data-purity="750" data-wage="0" data-fixed-price="">
 *     <span data-product-total>در حال استعلام...</span>
 *     <span data-product-gold></span>  <span data-product-wage></span>  <span data-product-fee></span>
 *   </div>
 *
 * فرمول: ارزش طلا = وزن × قیمت هر گرم ۱۸ عیار × (عیار ÷ ۷۵۰)
 *        + اجرت (درصد از ارزش طلا) + کارمزد معامله (۰٫۵٪)
 * مقدار data-qty (اختیاری) در کل مبلغ ضرب می‌شود.
 */
import { subscribeGoldPrice, calcTradeFee, formatToman, type NormalizedGoldPrice } from './goldPrice';

export interface ProductPriceInput {
  weight: number | null;
  purity: number;
  wagePercent: number;
  fixedPrice: number | null;
}

export interface ProductPriceBreakdown {
  gold: number;
  wage: number;
  fee: number;
  total: number;
}

export function calcProductPrice(input: ProductPriceInput, pricePerGram18k: number): ProductPriceBreakdown | null {
  if (input.weight && input.weight > 0 && pricePerGram18k > 0) {
    const gold = input.weight * pricePerGram18k * (input.purity / 750);
    const wage = (gold * input.wagePercent) / 100;
    const fee = calcTradeFee(gold + wage);
    return { gold, wage, fee, total: Math.round(gold + wage + fee) };
  }
  if (input.fixedPrice && input.fixedPrice > 0) {
    return { gold: input.fixedPrice, wage: 0, fee: 0, total: Math.round(input.fixedPrice) };
  }
  return null;
}

const num = (v: string | undefined) => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : null;
};

function readInput(el: HTMLElement): ProductPriceInput {
  return {
    weight: num(el.dataset.weight),
    purity: num(el.dataset.purity) ?? 750,
    wagePercent: num(el.dataset.wage) ?? 0,
    fixedPrice: num(el.dataset.fixedPrice),
  };
}

function setText(root: HTMLElement, selector: string, value: string) {
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (el.textContent === value) return;
    el.textContent = value;
    el.classList.remove('price-tick');
    void el.offsetWidth;
    el.classList.add('price-tick');
  });
}

let lastPrice: NormalizedGoldPrice | null = null;

export function renderProductPrices(root: ParentNode = document) {
  if (!lastPrice) return;
  root.querySelectorAll<HTMLElement>('[data-live-product]').forEach((el) => {
    const qty = Math.max(1, Math.floor(num(el.dataset.qty) ?? 1));
    const b = calcProductPrice(readInput(el), lastPrice!.pricePerGram);
    if (!b) {
      setText(el, '[data-product-total]', 'تماس بگیرید');
      el.dataset.price = '';
      return;
    }
    el.dataset.price = String(b.total);
    setText(el, '[data-product-gold]', formatToman(b.gold * qty));
    setText(el, '[data-product-wage]', formatToman(b.wage * qty));
    setText(el, '[data-product-fee]', formatToman(b.fee * qty));
    setText(el, '[data-product-total]', formatToman(b.total * qty));
  });
  document.dispatchEvent(new CustomEvent('product-prices-updated'));
}

if (typeof window !== 'undefined') {
  subscribeGoldPrice((price) => {
    lastPrice = price;
    renderProductPrices();
  });
}
