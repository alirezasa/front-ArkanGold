import type { APIRoute } from 'astro';

// در خروجی استاتیک این مسیر هنگام build اجرا می‌شود؛ اگر منبع قیمت در دسترس نبود
// نباید کل build شکست بخورد، پس خطا به یک پاسخ JSON تبدیل می‌شود.
export const GET: APIRoute = async () => {
  try {
    const res = await fetch('https://api.talasea.ir/api/market/getGoldPrice', {
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'gold price source unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
