/**
 * کش حافظه‌ی سرور برای مجله (SSR)
 * ----------------------------------------------------
 * هر صفحه‌ی /mag هنگام بازدید از REST API وردپرس ساخته می‌شود؛ این کش جلوی ارسال درخواست
 * تکراری به وردپرس را می‌گیرد و سایت را در برابر کندی یا قطعی وردپرس مقاوم می‌کند:
 *
 *  - تازه (تا ttl):           مستقیم از کش
 *  - کهنه (تا STALE_MS):      همان نسخه‌ی کهنه فوراً برگردانده و در پس‌زمینه تازه می‌شود
 *  - خطای وردپرس:             تا STALE_MS آخرین نسخه‌ی سالم نمایش داده می‌شود
 *  - درخواست‌های هم‌زمان:      برای یک کلید فقط یک درخواست به وردپرس فرستاده می‌شود
 *  - purge (بعد از انتشار):    درخواست بعدی حتما نسخه‌ی تازه را می‌گیرد، ولی اگر وردپرس
 *                              در دسترس نباشد باز هم نسخه‌ی قبلی نمایش داده می‌شود
 *
 * کش روی globalThis است تا همه‌ی ماژول‌های باندل سرور یک نمونه را ببینند.
 */

interface Entry {
  value?: unknown;
  hasValue: boolean;
  /** تا این زمان تازه است */
  freshUntil: number;
  /** تا این زمان در صورت نیاز (خطا/بازسازی) قابل نمایش است */
  staleUntil: number;
  /** بعد از purge: نسخه‌ی کهنه فقط در صورت خطا نمایش داده شود */
  mustRevalidate?: boolean;
  pending?: Promise<unknown>;
}

/** حداکثر مدتی که نسخه‌ی قدیمی در قطعی وردپرس نمایش داده می‌شود */
const STALE_MS = 24 * 60 * 60 * 1000;
/** سقف تعداد کلیدها (حدود چند ده مگابایت در بدترین حالت) */
const MAX_ENTRIES = 600;

const g = globalThis as unknown as { __arkanMagCache?: Map<string, Entry> };
const store: Map<string, Entry> = (g.__arkanMagCache ??= new Map());

function save(key: string, value: unknown, ttlMs: number) {
  const now = Date.now();
  store.delete(key); // جابه‌جایی به انتهای Map (جدیدترین)
  store.set(key, { value, hasValue: true, freshUntil: now + ttlMs, staleUntil: now + Math.max(ttlMs, STALE_MS) });
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
}

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);
  const usable = !!entry?.hasValue && entry.staleUntil > now;

  if (entry?.hasValue && entry.freshUntil > now && !entry.mustRevalidate) return entry.value as T;
  if (entry?.pending) return (usable && !entry.mustRevalidate ? entry.value : entry.pending) as Promise<T> | T;

  const pending = fetcher().then(
    (value) => {
      save(key, value, ttlMs);
      return value;
    },
    (err) => {
      const cur = store.get(key);
      if (cur) cur.pending = undefined;
      if (cur?.hasValue && cur.staleUntil > Date.now()) {
        // تا ۳۰ ثانیه دوباره به وردپرسِ از دسترس خارج‌شده درخواست نزن (بازدیدکننده منتظر timeout نماند)
        cur.freshUntil = Date.now() + 30_000;
        cur.mustRevalidate = false;
        console.warn(`[mag] وردپرس در دسترس نیست؛ نسخه‌ی کش‌شده‌ی «${key}» نمایش داده شد:`, (err as Error)?.message ?? err);
        return cur.value as T;
      }
      throw err;
    }
  );

  if (entry) entry.pending = pending;
  else store.set(key, { hasValue: false, freshUntil: 0, staleUntil: 0, pending });

  // نسخه‌ی کهنه فوراً، نسخه‌ی تازه در پس‌زمینه
  if (usable && !entry!.mustRevalidate) {
    pending.catch(() => {});
    return entry!.value as T;
  }
  return pending;
}

/** بعد از انتشار/ویرایش در وردپرس: همه‌ی صفحه‌ها در بازدید بعدی از نو ساخته می‌شوند */
export function purgeMagCache(): number {
  for (const entry of store.values()) {
    entry.freshUntil = 0;
    entry.mustRevalidate = true;
  }
  return store.size;
}
