/**
 * سرویس استعلام اصالت شمش با کد ۶ رقمی
 * ----------------------------------------------------
 * قرارداد API (پیاده‌سازی وردپرس: wordpress/arkan-bar-verify/):
 *
 *   GET {VERIFY_API_URL}?code=123456
 *
 *   200 → { "valid": true, "status": "valid", "code": "123456",
 *           "product": "شمش طلا 100 گرمی (عیار 750)", "product_code": "6260320777981",
 *           "gtin": "2041231", "dimensions": "51 × 30/40 میلی‌متر / ضخامت 3/34 میلی‌متر",
 *           "weight": "100 گرم", "purity": "۷۵۰ (۱۸ عیار)", "country": "ایران",
 *           "manufacturer": "Zarmahan Gold", "brand": "آرکان گلد / ARKAN GOLD",
 *           "owner_name": "علی رضایی", "owned_at": "2026-10-01" }
 *   200 → { "valid": false, "status": "revoked", "code": "123456" }
 *   404 → کد یافت نشد          429 → تعداد درخواست بیش از حد مجاز
 */
import { VERIFY_API_URL } from '../config/site';

export type VerifyStatus = 'valid' | 'not_found' | 'revoked' | 'rate_limited' | 'error';

export interface VerifyResult {
  status: VerifyStatus;
  code: string;
  product?: string;
  productCode?: string;
  gtin?: string;
  dimensions?: string;
  weight?: string;
  purity?: string;
  country?: string;
  manufacturer?: string;
  brand?: string;
  ownerName?: string;
  ownedAt?: string;
  message?: string;
}

/** تعداد ارقام کد اصالت */
export const VERIFY_CODE_LENGTH = 6;

/** یکسان‌سازی کد: اعداد فارسی/عربی → لاتین و حذف هر کاراکتر غیرعددی */
export function normalizeCode(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^\\d{${VERIFY_CODE_LENGTH}}$`).test(code);
}

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && String(v).trim() ? String(v).trim() : undefined;

export async function verifyBar(codeInput: string): Promise<VerifyResult> {
  const code = normalizeCode(codeInput);
  const url = new URL(VERIFY_API_URL, typeof location !== 'undefined' ? location.href : undefined);
  url.searchParams.set('code', code);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return { status: 'error', code };
  }

  if (res.status === 404) return { status: 'not_found', code };
  if (res.status === 429) return { status: 'rate_limited', code };
  if (!res.ok) return { status: 'error', code };

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    return { status: 'error', code };
  }

  const rawStatus = String(data.status ?? (data.valid ? 'valid' : 'not_found'));
  const status: VerifyStatus = (['valid', 'not_found', 'revoked'] as const).includes(rawStatus as never)
    ? (rawStatus as VerifyStatus)
    : data.valid
      ? 'valid'
      : 'not_found';

  return {
    status,
    code: str(data.code) ?? code,
    product: str(data.product),
    productCode: str(data.product_code),
    gtin: str(data.gtin),
    dimensions: str(data.dimensions),
    weight: str(data.weight),
    purity: str(data.purity),
    country: str(data.country),
    manufacturer: str(data.manufacturer),
    brand: str(data.brand),
    ownerName: str(data.owner_name),
    ownedAt: str(data.owned_at),
    message: str(data.message),
  };
}
