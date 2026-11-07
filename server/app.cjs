// نقطه‌ی شروع برنامه برای Passenger (cPanel ← Setup Node.js App ← Application startup file: app.cjs)
// Passenger فایل شروع را با require بارگذاری می‌کند؛ سرور اصلی ES Module است و با import بارگذاری می‌شود.
import('./server.mjs').catch((err) => {
  console.error('[arkan] شروع سرور ناموفق بود:', err);
  process.exit(1);
});
