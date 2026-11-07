/**
 * رفتار سمت مرورگر صفحه‌ی مطلب مجله:
 *  - دکمه‌های «کپی لینک»
 *  - نوار پیشرفت مطالعه (بالای صفحه)
 *  - برجسته شدن بخش فعلی در «فهرست مطالب» هنگام اسکرول
 */
export function initMagArticle(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>('[data-copy-link]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const original = btn.innerHTML;
      try {
        await navigator.clipboard.writeText(btn.dataset.copyLink || location.href);
        btn.innerHTML = '<span class="text-[11px] font-bold">✓</span>';
      } catch {
        btn.innerHTML = '<span class="text-[11px] font-bold">×</span>';
      }
      setTimeout(() => (btn.innerHTML = original), 1600);
    });
  });

  const article = document.querySelector<HTMLElement>('[data-mag-article]');
  const progress = document.getElementById('mag-progress');
  if (article && progress) {
    let ticking = false;
    const update = () => {
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const ratio = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      progress.style.transform = `scaleX(${ratio})`;
      ticking = false;
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) requestAnimationFrame(update), (ticking = true);
      },
      { passive: true }
    );
    update();
  }

  const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.mag-toc a[href^="#"]'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id));
        const current = tocLinks.find((a) => visible.has(decodeURIComponent(a.hash.slice(1))));
        if (current) tocLinks.forEach((a) => a.setAttribute('aria-current', String(a === current)));
      },
      { rootMargin: '-140px 0px -60% 0px' }
    );
    byId.forEach((_a, id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }
}
