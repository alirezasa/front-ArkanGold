/**
 * اسکریپت مشترک اتصال المان‌های صفحه به سرویس قیمت زنده.
 * هر المانی با data-price-bind="pricePerGram" یا data-price-bind="changePercent"
 * به‌صورت خودکار با هر بروزرسانی قیمت (هر ۳۰ ثانیه) آپدیت می‌شود.
 *
 * استفاده در هر کامپوننت:
 *   <span data-price-bind="pricePerGram" data-price-format="toman">--</span>
 *   <script>import '../../lib/priceBinding';</script>
 */
import { subscribeGoldPrice, formatToman, pushPriceHistoryPoint, type NormalizedGoldPrice } from './goldPrice';

function applyBindings(price: NormalizedGoldPrice) {
  document.querySelectorAll<HTMLElement>('[data-price-bind]').forEach((el) => {
    const field = el.dataset.priceBind;
    const format = el.dataset.priceFormat;
    let value: string = '';

    if (field === 'pricePerGram') {
      value = format === 'toman' ? formatToman(price.pricePerGram) : String(price.pricePerGram);
    } else if (field === 'changePercent') {
      const isPositive = price.changePercent >= 0;
      value = `${isPositive ? '▲' : '▼'} ${Math.abs(price.changePercent).toLocaleString('fa-IR')}٪`;
      const isDark = el.dataset.priceContext === 'dark';
      el.classList.toggle(isDark ? 'text-success-light' : 'text-success', isPositive);
      el.classList.toggle(isDark ? 'text-danger-light' : 'text-danger', !isPositive);
    } else if (field === 'fetchedAt') {
      value = price.fetchedAt.toLocaleTimeString('fa-IR');
    }

    if (value && el.textContent !== value) {
      el.textContent = value;
      el.classList.remove('price-tick');
      // ری‌فلو اجباری برای اجرای دوباره‌ی انیمیشن
      void el.offsetWidth;
      el.classList.add('price-tick');
    }
  });

  document.dispatchEvent(new CustomEvent('gold-price-updated', { detail: price }));
}

if (typeof window !== 'undefined') {
  subscribeGoldPrice((price) => {
    pushPriceHistoryPoint(price);
    applyBindings(price);
  });
}
