/**
 * بروزرسانی لحظه‌ای محصولات در مرورگر
 * ----------------------------------------------------
 * قیمت نهایی شمش‌ها را سرور آرکان گلد بر اساس نرخ لحظه‌ای طلا محاسبه می‌کند.
 * این ماژول بلافاصله پس از بارگذاری صفحه و سپس با هر بروزرسانی قیمت طلا
 * (هر ۳۰ ثانیه) فهرست یا جزئیات شمش را دوباره از API می‌خواند و به callback می‌دهد.
 */
import { subscribeGoldPrice } from './goldPrice';
import { fetchIngot, fetchIngotList, type GoldIngot, type IngotApiResponse, type IngotList } from './goldIngots';

/** حداقل فاصله‌ی دو درخواست پشت‌سرهم (میلی‌ثانیه) */
const MIN_REFRESH_INTERVAL = 15_000;

function watch<T>(load: () => Promise<T>, onData: (data: T) => void, onError?: (err: unknown) => void) {
  let lastAt = 0;
  let busy = false;

  const refresh = async () => {
    if (busy || Date.now() - lastAt < MIN_REFRESH_INTERVAL) return;
    busy = true;
    try {
      const data = await load();
      lastAt = Date.now();
      onData(data);
    } catch (err) {
      console.error('[shop] live refresh failed:', err);
      onError?.(err);
    } finally {
      busy = false;
    }
  };

  refresh();
  subscribeGoldPrice(() => refresh());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

/** فهرست شمش‌های موجود */
export function watchIngotList(onData: (list: IngotList) => void, onError?: (err: unknown) => void) {
  watch(() => fetchIngotList(true), onData, onError);
}

/** جزئیات یک شمش */
export function watchIngot(slug: string, onData: (res: IngotApiResponse<GoldIngot>) => void, onError?: (err: unknown) => void) {
  watch(() => fetchIngot(slug), onData, onError);
}
