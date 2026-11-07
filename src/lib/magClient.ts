/**
 * رفتار سمت مرورگر صفحه‌ی مطلب مجله — دکمه‌ی «کپی لینک» در بخش اشتراک‌گذاری
 */
export function initMagArticle(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>('[data-copy-link]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const label = btn.textContent;
      try {
        await navigator.clipboard.writeText(btn.dataset.copyLink || location.href);
        btn.textContent = 'کپی شد ✓';
      } catch {
        btn.textContent = 'کپی نشد';
      }
      setTimeout(() => (btn.textContent = label), 2000);
    });
  });
}
