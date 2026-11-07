/**
 * کش حافظه‌ی سرور (SSR) — مجله (وردپرس)، فروشگاه (API شمش‌ها) و قیمت طلا
 * ----------------------------------------------------
 * صفحه‌های پویا هنگام بازدید از API ها ساخته می‌شوند؛ این کش جلوی ارسال درخواست تکراری را
 * می‌گیرد و سایت را در برابر کندی یا قطعی API ها مقاوم می‌کند:
 *
 *  - تازه (تا ttl):           مستقیم از کش
 *  - کهنه (تا maxStaleMs):    همان نسخه‌ی کهنه فوراً برگردانده و در پس‌زمینه تازه می‌شود
 *  - خطای منبع:               تا maxStaleMs آخرین نسخه‌ی سالم نمایش داده می‌شود
 *                              (مجله ۲۴ ساعت، فروشگاه ۱ ساعت، قیمت طلا ۵ دقیقه)
 *  - درخواست‌های هم‌زمان:      برای یک کلید فقط یک درخواست به منبع فرستاده می‌شود
 *  - purge (بعد از انتشار):    درخواست بعدی حتما نسخه‌ی تازه را می‌گیرد، ولی اگر منبع
 *                              در دسترس نباشد باز هم نسخه‌ی قبلی نمایش داده می‌شود
 *
 * کش روی globalThis است تا همه‌ی ماژول‌های باندل سرور یک نمونه را ببینند.
 */

interface Entry {
  value?: unknown;
  hasValue: boolean;
  /** تا این زمان تازه است */
  freshUntil: number;
  /** تا این زمان نسخه‌ی کهنه فوراً نمایش داده و در پس‌زمینه تازه می‌شود */
  swrUntil: number;
  /** تا این زمان در خطای منبع قابل نمایش است */
  staleUntil: number;
  /** بعد از purge: نسخه‌ی کهنه فقط در صورت خطا نمایش داده شود */
  mustRevalidate?: boolean;
  pending?: Promise<unknown>;
}

/** حداکثر مدتی که نسخه‌ی قدیمی در قطعی وردپرس نمایش داده می‌شود */
const STALE_MS = 24 * 60 * 60 * 1000;
/** سقف تعداد کلیدها (حدود چند ده مگابایت در بدترین حالت) */
const MAX_ENTRIES = 600;

const g = globalThis as unknown as { __arkanCache?: Map<string, Entry> };
const store: Map<string, Entry> = (g.__arkanCache ??= new Map());

export interface CacheOptions {
  /** حداکثر عمر نسخه‌ی قدیمی که در خطای منبع نمایش داده می‌شود (پیش‌فرض ۲۴ ساعت) */
  maxStaleMs?: number;
  /**
   * تا چه مدت بعد از تمام شدن تازگی، نسخه‌ی قبلی بدون انتظار نمایش داده و در پس‌زمینه تازه شود
   * (پیش‌فرض: همان maxStaleMs). برای داده‌ی حساس مثل قیمت کوتاه است؛ بعد از آن بازدیدکننده منتظر
   * داده‌ی تازه می‌ماند و نسخه‌ی قبلی فقط در خطای منبع استفاده می‌شود.
   */
  swrMs?: number;
}

function save(key: string, value: unknown, ttlMs: number, swrMs: number, maxStaleMs: number) {
  const now = Date.now();
  store.delete(key); // جابه‌جایی به انتهای Map (جدیدترین)
  store.set(key, {
    value,
    hasValue: true,
    freshUntil: now + ttlMs,
    swrUntil: now + ttlMs + swrMs,
    staleUntil: now + Math.max(ttlMs, maxStaleMs),
  });
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
}

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>, opts: CacheOptions = {}): Promise<T> {
  const maxStaleMs = opts.maxStaleMs ?? STALE_MS;
  const swrMs = Math.min(opts.swrMs ?? maxStaleMs, maxStaleMs);
  const now = Date.now();
  const entry = store.get(key);
  const usable = !!entry?.hasValue && entry.swrUntil > now && entry.staleUntil > now;

  if (entry?.hasValue && entry.freshUntil > now && !entry.mustRevalidate) return entry.value as T;
  if (entry?.pending) return (usable && !entry.mustRevalidate ? entry.value : entry.pending) as Promise<T> | T;

  const pending = fetcher().then(
    (value) => {
      save(key, value, ttlMs, swrMs, maxStaleMs);
      return value;
    },
    (err) => {
      const cur = store.get(key);
      if (cur) cur.pending = undefined;
      if (cur?.hasValue && cur.staleUntil > Date.now()) {
        // تا ۳۰ ثانیه دوباره به منبعِ از دسترس خارج‌شده درخواست نزن (بازدیدکننده منتظر timeout نماند)
        cur.freshUntil = Math.min(Date.now() + 30_000, cur.staleUntil);
        cur.swrUntil = Math.max(cur.swrUntil, cur.freshUntil);
        cur.mustRevalidate = false;
        console.warn(`[cache] منبع داده در دسترس نیست؛ نسخه‌ی کش‌شده‌ی «${key}» نمایش داده شد:`, (err as Error)?.message ?? err);
        return cur.value as T;
      }
      throw err;
    }
  );

  if (entry) entry.pending = pending;
  else store.set(key, { hasValue: false, freshUntil: 0, swrUntil: 0, staleUntil: 0, pending });

  // نسخه‌ی کهنه فوراً، نسخه‌ی تازه در پس‌زمینه
  if (usable && !entry!.mustRevalidate) {
    pending.catch(() => {});
    return entry!.value as T;
  }
  return pending;
}

/**
 * بعد از انتشار/ویرایش (مثلا مطلب وردپرس): کلیدهایی که با prefix شروع می‌شوند در بازدید بعدی
 * حتما از نو خوانده می‌شوند. نسخه‌ی قبلی فقط در صورت خطای منبع نمایش داده می‌شود.
 */
export function purgeCache(prefix = ''): number {
  let n = 0;
  for (const [key, entry] of store) {
    if (!key.startsWith(prefix)) continue;
    entry.freshUntil = 0;
    entry.mustRevalidate = true;
    n++;
  }
  return n;
}

/**
 * داده‌ی اختیاری صفحه با سقف انتظار: اگر تا ms میلی‌ثانیه آماده نشد، fallback برمی‌گردد و صفحه بدون
 * معطلی ساخته می‌شود؛ درخواست در پس‌زمینه ادامه پیدا می‌کند و نتیجه‌اش برای بازدید بعدی در کش می‌ماند.
 * (صفحه‌ی اصلی هرگز به‌خاطر کندی وردپرس یا API قیمت دیر بالا نمی‌آید — health check پلتفرم هم رد نمی‌شود.)
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const guarded = promise.catch(() => fallback);
  return Promise.race([guarded, new Promise<T>((resolve) => (timer = setTimeout(() => resolve(fallback), ms)))]).finally(() =>
    clearTimeout(timer)
  );
}
