import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const res = await fetch('https://api.talasea.ir/api/market/getGoldPrice');
  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};