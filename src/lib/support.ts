/**
 * پشتیبانی آنلاین — چت آنلاین آرکان گلد
 * ------------------------------------------------------------------
 * اسکریپت رسمی چت (LIVECHAT_EMBED_URL = https://app.arkan.gold/livechat-embed.js) در BaseLayout
 * روی همه‌ی صفحات بارگذاری می‌شود. این اسکریپت ویجت را در یک iframe با ویژگی data-arkan-chat
 * می‌سازد و API زیر را در اختیار می‌گذارد:
 *   ArkanChat.open()   ArkanChat.close()
 * ویجت وضعیت خود را با postMessage به صفحه اعلام می‌کند:
 *   { source: "arkan-chat", type: "layout", state: "hidden" | "closed" | "open" }
 * (مستندات: مخزن arkangold ← docs/livechat/README.md بخش ۸)
 *
 * رفتار در این سایت:
 * - دکمه‌ی شناور چت (حالت closed) روی صفحات نمایش داده نمی‌شود؛ فقط پنجره‌ی باز چت دیده می‌شود
 *   (کلاس arkan-chat-open روی <html> — CSS در src/styles/global.css).
 * - چت از آیکون پشتیبانی هدر، آیتم «پشتیبانی آنلاین» منوی موبایل و هر المان با data-support-chat
 *   باز می‌شود. باز شدن از مسیرهای دیگر (?chat=open، شروع گفتگو توسط کارشناس، باز ماندن چت در
 *   صفحه‌ی قبل) هم به‌طور خودکار نمایش داده می‌شود.
 * - اگر چت در دسترس نباشد (اسکریپت بارگذاری نشود یا چت از پنل غیرفعال باشد)، کاربر به صفحه‌ی
 *   «تماس با ما» هدایت می‌شود.
 */
import { LIVECHAT_EMBED_URL } from '../config/site';

declare global {
  interface Window {
    ArkanChat?: { open: () => void; close: () => void };
  }
}

const CHAT_ORIGIN = (() => {
  try {
    return new URL(LIVECHAT_EMBED_URL).origin;
  } catch {
    return 'https://app.arkan.gold';
  }
})();
const OPEN_CLASS = 'arkan-chat-open';
const FALLBACK_URL = '/contact';
/** حداکثر انتظار برای بارگذاری اسکریپت چت پس از کلیک */
const SCRIPT_WAIT_MS = 8000;
/** حداکثر انتظار برای باز شدن پنجره‌ی چت پس از ArkanChat.open() (اینترنت کند موبایل) */
const OPEN_WAIT_MS = 15000;

type ChatState = 'unknown' | 'hidden' | 'closed' | 'open';
let state: ChatState = 'unknown';
let fallbackTimer = 0;

function setState(next: ChatState) {
  state = next;
  document.documentElement.classList.toggle(OPEN_CLASS, next === 'open');
  if (next === 'open') window.clearTimeout(fallbackTimer);
}

// وضعیت ویجت از پیام‌های خود iframe چت خوانده می‌شود
window.addEventListener('message', (e) => {
  if (e.origin !== CHAT_ORIGIN) return;
  const d = e.data as { source?: string; type?: string; state?: string } | null;
  if (!d || d.source !== 'arkan-chat' || d.type !== 'layout') return;
  const frame = document.querySelector<HTMLIFrameElement>('iframe[data-arkan-chat]');
  if (!frame || e.source !== frame.contentWindow) return;
  if (d.state === 'open' || d.state === 'closed' || d.state === 'hidden') setState(d.state);
});

function goToContact() {
  window.clearTimeout(fallbackTimer);
  window.location.href = FALLBACK_URL;
}

/** باز کردن پشتیبانی آنلاین (از هر جای سایت) */
export function openOnlineSupport() {
  if (state === 'open') return;
  // چت از پنل مدیریت غیرفعال است یا در این صفحه نمایش داده نمی‌شود
  if (state === 'hidden') return goToContact();

  const startedAt = Date.now();
  const tryOpen = () => {
    const chat = window.ArkanChat;
    if (chat && typeof chat.open === 'function') {
      chat.open();
      window.clearTimeout(fallbackTimer);
      fallbackTimer = window.setTimeout(() => {
        if (state !== 'open') goToContact();
      }, OPEN_WAIT_MS);
      return;
    }
    // اسکریپت چت هنوز بارگذاری نشده است
    if (Date.now() - startedAt > SCRIPT_WAIT_MS) return goToContact();
    window.setTimeout(tryOpen, 200);
  };
  tryOpen();
}

document.addEventListener('click', (e) => {
  const trigger = (e.target as Element | null)?.closest?.('[data-support-chat]');
  if (!trigger) return;
  e.preventDefault();
  openOnlineSupport();
});
