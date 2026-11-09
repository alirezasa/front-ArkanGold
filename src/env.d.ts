/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GA4_ID?: string;
  readonly PUBLIC_YEKTANET_ID?: string;
  readonly PUBLIC_ARKAN_API_URL?: string;
  readonly PUBLIC_VERIFY_API_URL?: string;
  readonly PUBLIC_WP_API_URL?: string;
  readonly PUBLIC_IR_MIRROR?: string;
  readonly PUBLIC_ENAMAD_ID?: string;
  readonly PUBLIC_ENAMAD_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    /** صفحه‌ی سرور (SSR) که قیمت لحظه‌ای طلا باید در HTML آن نوشته شود — src/middleware.ts */
    livePrice?: boolean;
  }
}
