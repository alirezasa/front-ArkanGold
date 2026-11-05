/**
 * پشتیبانی آنلاین (چت گفتینو)
 * ----------------------------------------------------
 * آیکون شناور گفتینو روی همه‌ی صفحات مخفی می‌شود و چت فقط از طریق منوها و
 * دکمه‌هایی باز می‌شود که ویژگی data-support-chat دارند.
 * اگر ویجت هنوز بارگذاری نشده باشد، پس از آماده شدن باز می‌شود و اگر اصلاً
 * بارگذاری نشود (مثلا مسدود شدن اسکریپت)، کاربر به صفحه‌ی تماس با ما می‌رود.
 */

interface GoftinoApi {
  open?: () => void;
  toggle?: () => void;
  setWidget?: (opts: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    Goftino?: GoftinoApi;
  }
}

const FALLBACK_URL = '/contact';
const WAIT_MS = 6000;

let ready = false;
let pendingOpen = false;

function hideLauncher() {
  try {
    window.Goftino?.setWidget?.({ hasIcon: false });
  } catch {
    /* ویجت در دسترس نیست */
  }
}

function openChat(): boolean {
  const g = window.Goftino;
  if (!g) return false;
  if (typeof g.open === 'function') g.open();
  else if (typeof g.toggle === 'function') g.toggle();
  else return false;
  return true;
}

window.addEventListener('goftino_ready', () => {
  ready = true;
  hideLauncher();
  if (pendingOpen) {
    pendingOpen = false;
    openChat();
  }
});

/** باز کردن پشتیبانی آنلاین */
export function openOnlineSupport() {
  if (ready && openChat()) return;
  pendingOpen = true;
  window.setTimeout(() => {
    if (pendingOpen) {
      pendingOpen = false;
      if (!openChat()) window.location.href = FALLBACK_URL;
    }
  }, WAIT_MS);
}

document.addEventListener('click', (e) => {
  const trigger = (e.target as Element | null)?.closest?.('[data-support-chat]');
  if (!trigger) return;
  e.preventDefault();
  openOnlineSupport();
});
