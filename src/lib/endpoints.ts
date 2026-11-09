/**
 * دو دامنه: arkan.gold (اصلی) و arkangold.ir (آینه برای قطعی اینترنت بین‌الملل)
 * ----------------------------------------------------
 * هر سرویس دو آدرس هم‌ارز دارد:
 *   api.arkan.gold ↔ api.arkangold.ir   (قیمت، شمش‌ها)
 *   app.arkan.gold ↔ app.arkangold.ir   (ورود، معامله، چت آنلاین)
 *   cms.arkan.gold ↔ cms.arkangold.ir   (وردپرس مجله، استعلام اصالت)
 *
 * - درخواست‌ها (fetchFallback): اول آدرس هم‌دامنه‌ی صفحه (روی arkangold.ir آدرس .ir، روی arkan.gold آدرس
 *   .gold؛ روی سرور که داخل ایران است اول .ir)، و اگر به خطای شبکه یا ۵۰۲/۵۰۳/۵۰۴ خورد، آدرس دیگر.
 *   آدرسی که جواب داد به خاطر سپرده می‌شود تا درخواست‌های بعدی معطل timeout نمانند.
 * - لینک‌ها (localUrl): روی arkangold.ir لینک‌های app.arkan.gold و ... به .ir تبدیل می‌شوند
 *   (src/lib/domainLinks.ts همه‌ی لینک‌های صفحه را هم تبدیل می‌کند).
 * - سئو: canonical، sitemap و schema همیشه arkan.gold هستند (SITE_URL)؛ arkangold.ir نسخه‌ی تکراری
 *   حساب نمی‌شود.
 * با PUBLIC_IR_MIRROR=off آینه غیرفعال می‌شود (فقط آدرس‌های اصلی).
 */

export const PRIMARY_DOMAIN = 'arkan.gold';
export const MIRROR_DOMAIN = 'arkangold.ir';
export const MIRROR_SITE_URL = `https://${MIRROR_DOMAIN}`;
export const MIRROR_ENABLED = !/^(off|false|0|no)$/i.test((import.meta.env.PUBLIC_IR_MIRROR ?? '').trim());

const isBrowser = typeof window !== 'undefined' && typeof location !== 'undefined';

/** صفحه روی دامنه‌ی ایرانی باز شده است؟ */
export const isMirrorHost = (): boolean =>
  isBrowser && (location.hostname === MIRROR_DOMAIN || location.hostname.endsWith(`.${MIRROR_DOMAIN}`));

const swapHost = (host: string, from: string, to: string): string | null =>
  host === from ? to : host.endsWith(`.${from}`) ? `${host.slice(0, -from.length)}${to}` : null;

/** آدرس هم‌ارز روی دامنه‌ی دیگر (arkan.gold ↔ arkangold.ir)، یا null اگر آدرس مال این دو دامنه نباشد */
export function otherDomainUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = swapHost(u.hostname, PRIMARY_DOMAIN, MIRROR_DOMAIN) ?? swapHost(u.hostname, MIRROR_DOMAIN, PRIMARY_DOMAIN);
    if (!host) return null;
    u.hostname = host;
    return u.toString();
  } catch {
    return null;
  }
}

const isMirrorUrl = (url: string) => {
  try {
    const h = new URL(url).hostname;
    return h === MIRROR_DOMAIN || h.endsWith(`.${MIRROR_DOMAIN}`);
  } catch {
    return false;
  }
};

/** لینک مناسب همین دامنه: روی arkangold.ir آدرس‌های arkan.gold به .ir تبدیل می‌شوند */
export function localUrl(url: string): string {
  if (!MIRROR_ENABLED || !isMirrorHost() || isMirrorUrl(url)) return url;
  return otherDomainUrl(url) ?? url;
}

/** آدرس‌های قابل‌امتحان به ترتیب ترجیح */
export function candidateUrls(url: string): string[] {
  const other = MIRROR_ENABLED ? otherDomainUrl(url) : null;
  if (!other) return [url];
  // مرورگر: اول دامنه‌ی خود صفحه؛ سرور (داخل ایران): اول .ir
  const preferMirror = isBrowser ? isMirrorHost() : true;
  const mirror = isMirrorUrl(url) ? url : other;
  const primary = isMirrorUrl(url) ? other : url;
  return preferMirror ? [mirror, primary] : [primary, mirror];
}

/** آخرین دامنه‌ای که برای هر سرویس جواب داده (origin اصلی ← origin جواب‌دهنده) */
const g = globalThis as unknown as { __arkanPreferredOrigin?: Map<string, string> };
const preferred: Map<string, string> = (g.__arkanPreferredOrigin ??= new Map());

export interface FallbackInit extends RequestInit {
  /** سقف زمان هر تلاش (میلی‌ثانیه)؛ برای هر آدرس جداگانه حساب می‌شود */
  timeoutMs?: number;
}

/**
 * fetch با جایگزین: اگر آدرس اول به خطای شبکه یا ۵۰۲/۵۰۳/۵۰۴ خورد، همان مسیر روی دامنه‌ی دیگر امتحان می‌شود.
 * پاسخ‌های عادی (حتی ۴۰۴) بدون تلاش دوباره برگردانده می‌شوند.
 */
export async function fetchFallback(url: string, init: FallbackInit = {}): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  let list = candidateUrls(url);
  const key = new URL(url).origin;
  const pref = preferred.get(key);
  if (pref) list = [...list].sort((a, b) => Number(!a.startsWith(pref)) - Number(!b.startsWith(pref)));

  let lastError: unknown;
  for (let i = 0; i < list.length; i++) {
    const target = list[i];
    try {
      const res = await fetch(target, { ...rest, signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : rest.signal });
      if (i < list.length - 1 && [502, 503, 504].includes(res.status)) {
        lastError = new Error(`${res.status} ${target}`);
        continue;
      }
      preferred.set(key, new URL(target).origin);
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
