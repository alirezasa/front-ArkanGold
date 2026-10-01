/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GA4_ID?: string;
  readonly PUBLIC_YEKTANET_ID?: string;
  readonly PUBLIC_ARKAN_API_URL?: string;
  readonly PUBLIC_VERIFY_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
