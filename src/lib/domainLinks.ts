/**
 * روی arkangold.ir: همه‌ی لینک‌ها به سرویس‌های arkan.gold (اپلیکیشن، خرید، ورود و ...) به آدرس هم‌ارز .ir
 * تبدیل می‌شوند تا در قطعی اینترنت بین‌الملل هم کار کنند. لینک‌هایی که بعدا با JavaScript اضافه یا عوض
 * می‌شوند (دکمه‌ی خرید شمش، ماشین‌حساب) هم با MutationObserver تبدیل می‌شوند. روی arkan.gold کاری نمی‌کند.
 * (canonical و schema عمدا دست نمی‌خورند: سئو همیشه arkan.gold است.)
 */
import { MIRROR_DOMAIN, MIRROR_ENABLED, PRIMARY_DOMAIN, isMirrorHost, localUrl } from './endpoints';

const ATTRS = ['href', 'data-app-url', 'data-buy-url'] as const;
const PRIMARY_RE = new RegExp(`(https?:)?//([a-z0-9-]+\\.)?${PRIMARY_DOMAIN.replace('.', '\\.')}`, 'gi');

function rewriteElement(el: Element) {
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value || !value.includes(PRIMARY_DOMAIN)) continue;
    // نسبی‌ها و canonical دست نمی‌خورند؛ فقط آدرس‌های کامل
    if (!/^https?:\/\//i.test(value)) continue;
    const next = localUrl(value);
    if (next !== value) el.setAttribute(attr, next);
  }
  // تصویر QR اپلیکیشن: آدرس داخل پارامتر data
  if (el instanceof HTMLImageElement && el.src.includes('qr') && el.src.includes(PRIMARY_DOMAIN)) {
    el.src = el.src.replace(PRIMARY_RE, (m) => m.replace(PRIMARY_DOMAIN, MIRROR_DOMAIN));
  }
}

function rewriteTree(root: ParentNode) {
  root.querySelectorAll('a[href], [data-app-url], [data-buy-url], img[src*="qr"]').forEach(rewriteElement);
}

if (MIRROR_ENABLED && isMirrorHost()) {
  rewriteTree(document);
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof Element) rewriteElement(m.target);
      m.addedNodes.forEach((n) => {
        if (n instanceof Element) {
          rewriteElement(n);
          rewriteTree(n);
        }
      });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: [...ATTRS] });
}
