/**
 * سرویس استعلام اصالت شمش
 * ----------------------------------------------------
 * قرارداد API (پیاده‌سازی وردپرس: wordpress/arkan-bar-verify/):
 *
 *   GET {VERIFY_API_URL}?serial=AG750-000123&code=4821
 *
 *   200 → { "valid": true,  "status": "valid", "serial": "...", "product": "...",
 *           "weight": 1, "purity": 750, "manufactured_at": "2026-05-01", "message": "..." }
 *   200 → { "valid": false, "status": "not_found" | "code_required" | "revoked", "message": "..." }
 *   404 → سریال یافت نشد          429 → تعداد درخواست بیش از حد مجاز
 */
import { VERIFY_API_URL } from '../config/site';

export type VerifyStatus = 'valid' | 'not_found' | 'code_required' | 'revoked' | 'rate_limited' | 'error';

export interface VerifyResult {
  status: VerifyStatus;
  serial: string;
  product?: string;
  weight?: number;
  purity?: number;
  manufacturedAt?: string;
  message?: string;
}

/** یکسان‌سازی سریال: اعداد فارسی → لاتین، حروف بزرگ، حذف فاصله */
export function normalizeSerial(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s‌]+/g, '')
    .replace(/[–—_]/g, '-')
    .toUpperCase();
}

export function isValidSerialFormat(serial: string): boolean {
  return /^[A-Z0-9-]{4,32}$/.test(serial);
}

export async function verifyBar(serialInput: string, codeInput = ''): Promise<VerifyResult> {
  const serial = normalizeSerial(serialInput);
  const code = normalizeSerial(codeInput);
  const url = new URL(VERIFY_API_URL, typeof location !== 'undefined' ? location.href : undefined);
  url.searchParams.set('serial', serial);
  if (code) url.searchParams.set('code', code);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return { status: 'error', serial };
  }

  if (res.status === 404) return { status: 'not_found', serial };
  if (res.status === 429) return { status: 'rate_limited', serial };
  if (!res.ok) return { status: 'error', serial };

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    return { status: 'error', serial };
  }

  const rawStatus = String(data.status ?? (data.valid ? 'valid' : 'not_found'));
  const status: VerifyStatus = (['valid', 'not_found', 'code_required', 'revoked'] as const).includes(rawStatus as never)
    ? (rawStatus as VerifyStatus)
    : data.valid
      ? 'valid'
      : 'not_found';

  const num = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : Number(v) || undefined);

  return {
    status,
    serial: typeof data.serial === 'string' && data.serial ? data.serial : serial,
    product: typeof data.product === 'string' ? data.product : undefined,
    weight: num(data.weight),
    purity: num(data.purity),
    manufacturedAt: typeof data.manufactured_at === 'string' ? data.manufactured_at : undefined,
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}
