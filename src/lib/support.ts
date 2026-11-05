/**
 * پشتیبانی آنلاین — چت آنلاین آرکان گلد (LIVECHAT_EMBED_URL = app.arkan.gold/livechat-embed.js)
 * ------------------------------------------------------------------
 * - اسکریپت چت در BaseLayout روی همه‌ی صفحات بارگذاری می‌شود.
 * - دکمه‌ی شناور (لانچر) ویجت روی صفحات مخفی می‌شود؛ چت فقط از آیکون پشتیبانی هدر،
 *   آیتم «پشتیبانی آنلاین» منوی موبایل و دکمه‌هایی که ویژگی data-support-chat دارند باز می‌شود.
 * - برای باز کردن چت، ابتدا API عمومی ویجت (مثل window.X.open()) جست‌وجو می‌شود و
 *   در نبود آن، روی لانچر خودِ ویجت کلیک می‌شود. اگر ویجت اصلاً بارگذاری نشود،
 *   کاربر به صفحه‌ی «تماس با ما» هدایت می‌شود.
 *
 * این ماژول قبل از اسکریپت ویجت اجرا می‌شود (ماژول‌ها و اسکریپت‌های defer به ترتیب سند اجرا
 * می‌شوند و این ماژول در <head> است)، پس هر چیزی که ویجت به صفحه اضافه کند شناسایی می‌شود.
 */

const FALLBACK_URL = '/contact';
/** حداکثر زمان انتظار برای آماده شدن ویجت پس از کلیک کاربر */
const WAIT_MS = 8000;
const OPEN_CLASS = 'arkan-chat-open';

/** نام‌های رایج API ویجت‌های چت (علاوه بر هر متغیر سراسری جدیدی که ویجت بسازد) */
const KNOWN_GLOBALS = [
  'ArkanLiveChat', 'ArkanLivechat', 'arkanLiveChat', 'arkanLivechat', 'ArkanChat', 'arkanChat',
  'LiveChat', 'Livechat', 'liveChat', 'livechat', 'LiveChatWidget', 'LivechatWidget', 'livechatWidget',
  'ChatWidget', 'chatWidget',
];
const OPEN_METHODS = ['open', 'openChat', 'show', 'showChat', 'maximize', 'expand', 'toggle', 'toggleChat'];
const IGNORED_GLOBALS = /^(google|gtag|dataLayer|__|webpack|Astro|astro)/;

const baseGlobals = new Set(Object.keys(window));
/** ریشه‌های DOM که ویجت به صفحه اضافه کرده است */
const widgetRoots = new Set<Element>();
let launcher: HTMLElement | null = null;

const isOurs = (el: Element) =>
  ['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName) ||
  el.id === 'mobile-menu' ||
  el.matches('header, main, footer, [data-astro-cid], [data-arkan]');

/* ---------------------------- شناسایی ویجت ---------------------------- */

/** همه‌ی عناصر یک ریشه، شامل shadow DOM باز */
function* walk(root: Element): Generator<HTMLElement> {
  const stack: Element[] = [root];
  while (stack.length) {
    const el = stack.pop()!;
    if (el instanceof HTMLElement) yield el;
    if (el.shadowRoot) stack.push(...Array.from(el.shadowRoot.children));
    stack.push(...Array.from(el.children));
  }
}

function isShown(el: HTMLElement, rect = el.getBoundingClientRect()) {
  if (rect.width < 1 || rect.height < 1) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.05;
}

function isClickable(el: HTMLElement) {
  return (
    el.tagName === 'BUTTON' ||
    el.tagName === 'A' ||
    el.tagName === 'IFRAME' ||
    el.getAttribute('role') === 'button' ||
    getComputedStyle(el).cursor === 'pointer'
  );
}

/** لانچر = کوچک‌ترین عنصر fixed و قابل کلیک (حداکثر ۱۴۰ پیکسل) در نیمه‌ی پایین صفحه */
function findLauncher(): HTMLElement | null {
  if (launcher?.isConnected) return launcher;
  let best: HTMLElement | null = null;
  let bestArea = Infinity;
  for (const root of widgetRoots) {
    if (!root.isConnected) continue;
    for (const el of walk(root)) {
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24 || r.width > 140 || r.height > 140) continue;
      if (r.top < window.innerHeight * 0.45) continue;
      const fixedEl = closestFixed(el);
      if (!fixedEl) continue;
      if (!isClickable(el) && !isClickable(fixedEl)) continue;
      const area = r.width * r.height;
      if (area < bestArea) {
        best = el;
        bestArea = area;
      }
    }
  }
  if (best) {
    // اگر عنصر fixed بیرونی هم کوچک است (فقط لانچر را در بر دارد)، همان مخفی می‌شود
    const fixedEl = closestFixed(best)!;
    const fr = fixedEl.getBoundingClientRect();
    launcher = fr.width <= 160 && fr.height <= 160 ? fixedEl : best;
    launcher.dataset.arkanLauncher = '';
  }
  return launcher;
}

function closestFixed(el: HTMLElement): HTMLElement | null {
  let cur: Node | null = el;
  while (cur) {
    if (cur instanceof HTMLElement) {
      const pos = getComputedStyle(cur).position;
      if (pos === 'fixed' || pos === 'sticky') return cur;
    }
    cur = cur.parentNode instanceof ShadowRoot ? cur.parentNode.host : cur.parentNode;
  }
  return null;
}

/** API عمومی ویجت برای باز کردن چت */
function findApi(): (() => void) | null {
  const names = new Set([...KNOWN_GLOBALS, ...Object.keys(window).filter((k) => !baseGlobals.has(k) && !IGNORED_GLOBALS.test(k))]);
  for (const name of names) {
    let v: unknown;
    try {
      v = (window as unknown as Record<string, unknown>)[name];
    } catch {
      continue;
    }
    if (!v || (typeof v !== 'object' && typeof v !== 'function') || v === window) continue;
    for (const m of OPEN_METHODS) {
      const fn = (v as Record<string, unknown>)[m];
      if (typeof fn === 'function') return () => (fn as () => void).call(v);
    }
  }
  return null;
}

/** پنل چت باز و قابل مشاهده است؟ (عنصر بزرگ‌تر از لانچر در ریشه‌های ویجت) */
function panelVisible(): boolean {
  for (const root of widgetRoots) {
    if (!root.isConnected) continue;
    for (const el of walk(root)) {
      const r = el.getBoundingClientRect();
      if (r.width >= 200 && r.height >= 220 && isShown(el, r) && closestFixed(el)) return true;
    }
  }
  return false;
}

/* --------------------- مخفی/نمایش لانچر شناور ویجت --------------------- */

function applyLauncherVisibility() {
  const el = findLauncher();
  if (!el) return;
  const open = document.documentElement.classList.contains(OPEN_CLASS);
  for (const [prop, value] of [
    ['visibility', 'hidden'],
    ['opacity', '0'],
    ['pointer-events', 'none'],
  ] as const) {
    if (open) el.style.removeProperty(prop);
    else el.style.setProperty(prop, value, 'important');
  }
}

let scanTimer = 0;
function scheduleScan() {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(applyLauncherVisibility, 60);
}

const rootObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach((n) => {
      if (n instanceof Element && !isOurs(n)) {
        widgetRoots.add(n);
        // تغییرات داخلی ویجت (رندر دیرهنگام لانچر) هم دنبال می‌شود
        new MutationObserver(scheduleScan).observe(n, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
      }
    });
  }
  scheduleScan();
});

function observeRoots() {
  // عناصری که قبل از اجرای این ماژول اضافه شده‌اند (مثلاً اگر ویجت از کش زودتر اجرا شده باشد)
  Array.from(document.body.children).forEach((el) => {
    if (!isOurs(el) && !el.matches('a[href="#main-content"]')) widgetRoots.add(el);
  });
  rootObserver.observe(document.body, { childList: true });
  rootObserver.observe(document.documentElement, { childList: true });
  scheduleScan();
}

if (document.body) observeRoots();
else document.addEventListener('DOMContentLoaded', observeRoots, { once: true });

/* ----------------------------- باز کردن چت ----------------------------- */

let closeWatch = 0;
function setOpen(open: boolean) {
  document.documentElement.classList.toggle(OPEN_CLASS, open);
  applyLauncherVisibility();
  window.clearInterval(closeWatch);
  if (open) {
    // وقتی کاربر چت را از داخل ویجت ببندد، لانچر دوباره مخفی می‌شود
    let misses = 0;
    const startedAt = Date.now();
    closeWatch = window.setInterval(() => {
      if (Date.now() - startedAt < 1500) return;
      misses = panelVisible() ? 0 : misses + 1;
      if (misses >= 2) setOpen(false);
    }, 700);
  }
}

function tryOpen(): boolean {
  const api = findApi();
  if (api) {
    setOpen(true);
    try {
      api();
      return true;
    } catch {
      /* ادامه با کلیک روی لانچر */
    }
  }
  const el = findLauncher();
  if (el) {
    setOpen(true);
    if (el.tagName !== 'IFRAME') {
      const target = el.matches('button, a, [role="button"]') ? el : (el.querySelector<HTMLElement>('button, a, [role="button"]') ?? el);
      target.click();
    }
    return true;
  }
  return false;
}

let waiting = 0;
/** باز کردن پشتیبانی آنلاین (از هر جای سایت) */
export function openOnlineSupport() {
  if (tryOpen()) return;
  // ویجت هنوز آماده نیست: تا WAIT_MS صبر می‌کنیم
  window.clearInterval(waiting);
  const startedAt = Date.now();
  waiting = window.setInterval(() => {
    if (tryOpen()) {
      window.clearInterval(waiting);
    } else if (Date.now() - startedAt > WAIT_MS) {
      window.clearInterval(waiting);
      window.location.href = FALLBACK_URL;
    }
  }, 250);
}

document.addEventListener('click', (e) => {
  const trigger = (e.target as Element | null)?.closest?.('[data-support-chat]');
  if (!trigger) return;
  e.preventDefault();
  openOnlineSupport();
});
