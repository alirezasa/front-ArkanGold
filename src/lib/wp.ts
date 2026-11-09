/**
 * مجله آرکان گلد — اتصال به وردپرس هدلس (منبع مشترک build و مرورگر)
 * ----------------------------------------------------
 * نویسنده‌ها در پنل وردپرس مطلب می‌نویسند؛ این فایل پاسخ REST API وردپرس را به
 * مدل ساده‌ی MagPost تبدیل می‌کند و HTML کارت مطلب، صفحه‌ی مطلب و داده‌های سئو را
 * می‌سازد. صفحه‌های /mag روی سرور (SSR) با همین تابع‌ها ساخته می‌شوند؛ کارت‌های
 * «مطالب مجله» صفحه‌ی اصلی هم در مرورگر با همین تابع‌ها به‌روز می‌شوند.
 *
 *   GET {WP_API_URL}/?_fields=name,description,home,namespaces
 *   GET {WP_API_URL}/wp/v2/posts?_embed=author,wp:featuredmedia,wp:term
 *   GET {WP_API_URL}/wp/v2/pages | categories | tags
 *
 * آدرس هر صفحه دقیقاً از فیلد link وردپرس گرفته می‌شود (هر ساختار پیوند یکتایی که در
 * «تنظیمات ← پیوندهای یکتا» انتخاب شده باشد)، پس آدرس‌های قبلی مجله حفظ می‌شوند.
 */
import { MAG_NAME, MAG_PATH, SITE_URL, WP_API_URL } from '../config/site';
import { esc, safeHref } from './ingotCard';
import { fetchFallback } from './endpoints';

const SITE = SITE_URL;
/** آدرس عمومی مجله؛ لینک‌هایی که در محتوای قدیمی به این آدرس اشاره می‌کنند هم داخلی حساب می‌شوند */
export const MAG_PUBLIC_URL = `${SITE}${MAG_PATH}`;
/** سقف انتظار برای پاسخ وردپرس؛ بعد از آن نسخه‌ی کش‌شده نمایش داده می‌شود (src/lib/cache.ts) */
const FETCH_TIMEOUT = 10_000;
/** فیلدهای embed موردنیاز هر مطلب (نویسنده، تصویر شاخص، دسته‌ها و برچسب‌ها) */
export const WP_EMBED = 'author,wp:featuredmedia,wp:term';

/* ------------------------------------------------------------------
 * انواع داده‌ی REST API وردپرس (فقط فیلدهای استفاده‌شده)
 * ------------------------------------------------------------------ */

export interface YoastHeadJson {
  title?: string;
  description?: string;
  robots?: { index?: string; follow?: string };
  og_title?: string;
  og_description?: string;
  og_image?: { url: string; width?: number; height?: number }[];
}

export interface WpTerm {
  id: number;
  name: string;
  slug: string;
  link: string;
  taxonomy?: string;
  description?: string;
  count?: number;
  parent?: number;
  yoast_head_json?: YoastHeadJson | null;
  /** noindex بودن طبق Rank Math / Yoast (افزونه‌ی arkan-headless) */
  arkan_noindex?: boolean;
}

export interface WpUser {
  id: number;
  name: string;
  slug: string;
  link: string;
  description?: string;
  avatar_urls?: Record<string, string>;
  yoast_head_json?: YoastHeadJson | null;
  /** noindex بودن طبق Rank Math / Yoast (افزونه‌ی arkan-headless) */
  arkan_noindex?: boolean;
  code?: string;
}

export interface WpMedia {
  source_url?: string;
  alt_text?: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, { source_url: string; width: number; height: number }>;
  };
  code?: string;
}

export interface WpPost {
  id: number;
  type: string;
  slug: string;
  link: string;
  status?: string;
  date_gmt: string;
  modified_gmt: string;
  sticky?: boolean;
  title: { rendered: string };
  content: { rendered: string; protected?: boolean };
  excerpt: { rendered: string };
  author: number;
  featured_media: number;
  categories?: number[];
  tags?: number[];
  yoast_head_json?: YoastHeadJson | null;
  /** noindex بودن طبق Rank Math / Yoast (افزونه‌ی arkan-headless) */
  arkan_noindex?: boolean;
  _embedded?: {
    author?: WpUser[];
    'wp:featuredmedia'?: WpMedia[];
    'wp:term'?: WpTerm[][];
  };
}

export interface WpSiteInfo {
  name: string;
  description: string;
  home: string;
  namespaces?: string[];
}

/* ------------------------------------------------------------------
 * مدل ساده‌شده‌ی مجله
 * ------------------------------------------------------------------ */

/** داده‌های سئوی هر صفحه که نویسنده در Yoast / Rank Math وارد کرده است */
export interface SeoHead {
  title?: string;
  description?: string;
  noindex?: boolean;
  image?: string;
  /** schema های تکمیلی که نویسنده در Rank Math Pro ساخته (FAQ، HowTo، ویدیو و ...) با آدرس‌های سایت اصلی */
  schemas?: Record<string, unknown>[];
}

export interface MagImage {
  src: string;
  width?: number;
  height?: number;
  alt: string;
  srcset?: string;
}

export interface MagTermRef {
  id: number;
  name: string;
  path: string;
}

export interface MagAuthor {
  id: number;
  name: string;
  path: string | null;
  description: string;
  avatar?: string;
  seo: SeoHead;
}

export interface MagPost {
  id: number;
  type: 'post' | 'page';
  slug: string;
  /** مسیر نسبت به /mag، مثلا «قیمت-طلا» یا «1403/05/قیمت-طلا» */
  path: string;
  title: string;
  titleHtml: string;
  excerpt: string;
  contentHtml: string;
  /** تاریخ‌ها به‌صورت ISO با منطقه‌ی زمانی UTC */
  date: string;
  modified: string;
  sticky: boolean;
  readingMinutes: number;
  author?: MagAuthor;
  image?: MagImage;
  categories: MagTermRef[];
  tags: MagTermRef[];
  seo: SeoHead;
}

/* ------------------------------------------------------------------
 * کمک‌تابع‌های متن
 * ------------------------------------------------------------------ */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  zwnj: '‌',
  zwj: '‍',
};

/** تبدیل موجودیت‌های HTML (مثل &#8211; یا &amp;) به متن ساده — بدون DOM، برای build */
export function decodeEntities(text: string): string {
  return (text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** متن ساده از HTML */
export function htmlToText(html: string): string {
  return decodeEntities(
    (html ?? '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** کوتاه کردن متن روی مرز کلمه (برای meta description) */
export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** تاریخ شمسی، مثلا «۱۷ آبان ۱۴۰۵» */
export function faDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** تاریخ GMT وردپرس («2026-11-07T08:30:00») بدون منطقه‌ی زمانی است */
const gmtIso = (value: string) => (value && !/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? `${value}Z` : value);

/* ------------------------------------------------------------------
 * آدرس‌ها
 * ------------------------------------------------------------------ */

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** مسیرهای فنی وردپرس که هرگز صفحه‌ی مجله نیستند (تصاویر، API، پنل) */
const WP_SYSTEM_PATH = /^wp-(content|json|admin|includes)(\/|$)|^wp-login\.php|^xmlrpc\.php/;

function stripBase(url: URL, base: string): string | null {
  let basePath: URL;
  try {
    basePath = new URL(base);
  } catch {
    return null;
  }
  if (url.host !== basePath.host) return null;
  const prefix = basePath.pathname.replace(/\/+$/, '');
  if (prefix && url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return null;
  return url.pathname.slice(prefix.length);
}

/**
 * مسیر یک لینک وردپرس نسبت به ریشه‌ی مجله («a/b»)، یا null اگر لینک بیرونی باشد.
 * هم آدرس خود وردپرس (home) و هم آدرس عمومی مجله (arkan.gold/mag) پذیرفته می‌شود.
 */
export function wpPath(link: string, home: string): string | null {
  let url: URL;
  try {
    url = new URL(link, home);
  } catch {
    return null;
  }
  const rest = stripBase(url, home) ?? stripBase(url, MAG_PUBLIC_URL);
  if (rest === null) return null;
  const path = rest.split('/').filter(Boolean).map(safeDecode).join('/');
  return WP_SYSTEM_PATH.test(path) ? null : path;
}

/** لینک صفحه‌ای از مجله روی سایت اصلی، مثلا «/mag/قیمت-طلا» */
export function magHref(path: string): string {
  if (!path) return MAG_PATH;
  return `${MAG_PATH}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** آدرس کامل (برای canonical، RSS و schema) */
export const magUrl = (path: string) => `${SITE}${magHref(path)}`;

/** صفحه‌ی n ام یک آرشیو: «category/طلا» + 2 → «category/طلا/page/2» (مثل وردپرس) */
export const pagedPath = (base: string, page: number) =>
  page > 1 ? [base, 'page', String(page)].filter(Boolean).join('/') : base;

/* ------------------------------------------------------------------
 * محتوا
 * ------------------------------------------------------------------ */

/** مسیر فایل‌های آپلود وردپرس روی سایت اصلی (از وردپرس پروکسی و کش می‌شوند — src/mag/media.ts) */
export const MEDIA_PATH = '/wp-content/uploads';

/**
 * آدرس فایل آپلود وردپرس (تصویر، PDF و ...) روی سایت اصلی:
 *   https://cms.arkan.gold/wp-content/uploads/2026/10/a.jpg  →  /wp-content/uploads/2026/10/a.jpg
 * آدرس‌های قدیمی https://arkan.gold/mag/wp-content/uploads/... هم تبدیل می‌شوند. این‌طوری هیچ آدرسی
 * از cms.arkan.gold در صفحه‌ها و نتایج گوگل (از جمله Google Images) دیده نمی‌شود.
 */
export function localMedia(url: string | undefined, home: string): string | undefined {
  if (!url) return url;
  let u: URL;
  try {
    u = new URL(url, home);
  } catch {
    return url;
  }
  let homeHost = '';
  try {
    homeHost = new URL(home).host;
  } catch {
    /* home نامعتبر */
  }
  const hosts = new Set([homeHost, new URL(SITE).host, `www.${new URL(SITE).host}`]);
  const m = u.pathname.match(/\/wp-content\/uploads\/(.+)$/);
  if (!hosts.has(u.host) || !m) return url;
  return `${MEDIA_PATH}/${m[1]}${u.search}`;
}

/** srcset: هر آدرس جداگانه به آدرس سایت اصلی تبدیل می‌شود */
const localSrcset = (srcset: string, home: string) =>
  srcset
    .split(',')
    .map((part) => {
      const [url, ...rest] = part.trim().split(/\s+/);
      return [localMedia(url, home), ...rest].join(' ');
    })
    .join(', ');

/**
 * آماده‌سازی HTML محتوای وردپرس برای نمایش روی سایت اصلی:
 * - لینک‌های داخلی مجله (چه به آدرس وردپرس، چه به arkan.gold/mag) به /mag/... تبدیل می‌شوند
 * - تصاویر و فایل‌های آپلود از آدرس سایت اصلی (/wp-content/uploads/...) سرو می‌شوند
 * - اسکریپت‌ها و رویدادهای inline حذف می‌شوند (embed ها با iframe باقی می‌مانند)
 */
export function prepareContent(html: string, home: string): string {
  return (html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/\b(src|href|poster|data-src|data-lazy-src|srcset|data-srcset|data-lazy-srcset)\s*=\s*("|')([^"']*)\2/gi, (m, attr: string, q: string, value: string) => {
      const decoded = decodeEntities(value);
      const local = /srcset$/i.test(attr) ? localSrcset(decoded, home) : localMedia(decoded, home);
      return local === decoded ? m : `${attr}=${q}${esc(local ?? '')}${q}`;
    })
    .replace(/\bhref\s*=\s*("|')([^"']*)\1/gi, (m, q: string, url: string) => {
      const decoded = decodeEntities(url);
      if (!/^https?:\/\//i.test(decoded)) return m;
      const path = wpPath(decoded, home);
      if (path === null) return m;
      const u = new URL(decoded);
      return `href=${q}${esc(magHref(path) + u.search + u.hash)}${q}`;
    });
}

/** تصویر شاخص با srcset (فقط اندازه‌های هم‌نسبت با تصویر اصلی، نه برش‌های مربعی) */
export function mediaToImage(media: WpMedia | undefined, fallbackAlt: string, home: string): MagImage | undefined {
  if (!media || media.code || !media.source_url) return undefined;
  const d = media.media_details ?? {};
  const ratio = d.width && d.height ? d.width / d.height : 0;
  const sizes = Object.values(d.sizes ?? {}).filter(
    (s) => s?.source_url && s.width && s.height && (!ratio || Math.abs(s.width / s.height - ratio) < 0.03)
  );
  const unique = new Map<number, string>();
  for (const s of sizes) unique.set(s.width, localMedia(s.source_url, home)!);
  if (d.width) unique.set(d.width, localMedia(media.source_url, home)!);
  const srcset = [...unique.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([w, url]) => `${url.replace(/ /g, '%20').replace(/,/g, '%2C')} ${w}w`)
    .join(', ');
  return {
    src: localMedia(media.source_url, home)!,
    width: d.width,
    height: d.height,
    alt: decodeEntities(media.alt_text || '') || fallbackAlt,
    srcset: unique.size > 1 ? srcset : undefined,
  };
}

/** داده‌های سئو از فیلد yoast_head_json (افزونه‌ی Yoast SEO) */
export function seoFromYoast(y: YoastHeadJson | null | undefined): SeoHead {
  if (!y) return {};
  return {
    title: y.title ? decodeEntities(y.title) : undefined,
    description: y.description ? decodeEntities(y.description) : y.og_description ? decodeEntities(y.og_description) : undefined,
    noindex: y.robots?.index === 'noindex' ? true : undefined,
    image: y.og_image?.[0]?.url,
  };
}

/** schema هایی از Rank Math Pro که سایت خودش نمی‌سازد و ارزش نمایش در نتایج گوگل دارند */
const RICH_SCHEMA_TYPES = new Set(['FAQPage', 'HowTo', 'VideoObject', 'Recipe', 'Course', 'Event', 'Review', 'Dataset', 'SoftwareApplication']);

/**
 * آدرس‌های وردپرس داخل schema به آدرس سایت اصلی تبدیل می‌شوند:
 * فایل‌ها ← https://arkan.gold/wp-content/uploads/...، صفحه‌ها ← https://arkan.gold/mag/...
 */
function rewriteWpUrl(url: string, home: string): string {
  const media = localMedia(url, home);
  if (media !== url && media) return `${SITE}${media}`;
  const path = wpPath(url, home);
  if (path === null) return url;
  const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
  return `${magUrl(path)}${hash}`;
}

export function rewriteWpUrls<T>(value: T, home: string): T {
  if (typeof value === 'string') {
    // آدرس تنها، یا آدرس‌های داخل متن/HTML (مثلا لینک داخل پاسخ FAQ)
    if (/^https?:\/\/\S+$/i.test(value)) return rewriteWpUrl(value, home) as T;
    return value.replace(/https?:\/\/[^\s"'<>]+/gi, (u) => rewriteWpUrl(u, home)) as T;
  }
  if (Array.isArray(value)) return value.map((v) => rewriteWpUrls(v, home)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewriteWpUrls(v, home)])) as T;
  }
  return value;
}

/** داده‌های سئو از HTML تگ head (پاسخ getHead افزونه‌ی Rank Math) */
export function seoFromHeadHtml(head: string, home: string): SeoHead {
  const meta = (attr: string, name: string) => {
    const tag = head.match(new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, 'i'))?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    return content ? decodeEntities(content) : undefined;
  };
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const robots = meta('name', 'robots');

  const schemas: Record<string, unknown>[] = [];
  for (const m of head.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(m[1]);
      const nodes: Record<string, unknown>[] = Array.isArray(json?.['@graph']) ? json['@graph'] : [json];
      for (const node of nodes) {
        const types = ([] as unknown[]).concat(node?.['@type'] ?? []);
        if (types.some((t) => RICH_SCHEMA_TYPES.has(String(t)))) {
          schemas.push(rewriteWpUrls({ '@context': 'https://schema.org', ...node }, home));
        }
      }
    } catch {
      /* JSON نامعتبر */
    }
  }

  const image = meta('property', 'og:image');
  return {
    title: title ? decodeEntities(title).trim() : undefined,
    description: meta('name', 'description'),
    noindex: robots ? /noindex/i.test(robots) : undefined,
    image: image ? localMedia(image, home) : undefined,
    schemas: schemas.length ? schemas : undefined,
  };
}

export function toAuthor(user: WpUser | undefined, home: string): MagAuthor | undefined {
  if (!user || user.code || !user.name) return undefined;
  const avatars = user.avatar_urls ?? {};
  const avatar = localMedia(avatars['96'] || avatars['48'] || Object.values(avatars).pop(), home);
  return {
    id: user.id,
    name: decodeEntities(user.name),
    path: user.link ? wpPath(user.link, home) : null,
    description: decodeEntities(user.description || ''),
    avatar,
    seo: seoFromYoast(user.yoast_head_json),
  };
}

const termRef = (t: WpTerm, home: string): MagTermRef | null => {
  const path = wpPath(t.link, home);
  return path ? { id: t.id, name: decodeEntities(t.name), path } : null;
};

/**
 * تبدیل یک مطلب REST وردپرس به MagPost. اگر مطلب آدرس قابل‌استفاده نداشته باشد
 * (مثلا ساختار پیوند «ساده» با ?p=123 یا صفحه‌ی اصلی وردپرس) null برمی‌گردد.
 */
export function toMagPost(raw: WpPost, home: string): MagPost | null {
  const path = wpPath(raw.link, home);
  if (!path) return null;
  const title = htmlToText(raw.title?.rendered || '') || 'بدون عنوان';
  const contentHtml = raw.content?.protected ? '' : prepareContent(raw.content?.rendered || '', home);
  const contentText = htmlToText(contentHtml);
  const excerpt =
    htmlToText(raw.excerpt?.rendered || '')
      .replace(/\s*(\[\s*(…|\.\.\.)\s*\]|ادامه مطلب.*|Continue reading.*)$/i, '')
      .trim() || truncate(contentText, 220);
  const words = contentText ? contentText.split(/\s+/).length : 0;
  const terms = (raw._embedded?.['wp:term'] ?? []).flat().filter((t) => t && !('code' in t));
  const refs = (taxonomy: string) =>
    terms
      .filter((t) => t.taxonomy === taxonomy)
      .map((t) => termRef(t, home))
      .filter((t): t is MagTermRef => !!t);

  const seo = seoFromYoast(raw.yoast_head_json);
  if (raw.arkan_noindex) seo.noindex = true;
  return {
    id: raw.id,
    type: raw.type === 'page' ? 'page' : 'post',
    slug: safeDecode(raw.slug),
    path,
    title,
    titleHtml: raw.title?.rendered || esc(title),
    excerpt,
    contentHtml,
    date: gmtIso(raw.date_gmt),
    modified: gmtIso(raw.modified_gmt || raw.date_gmt),
    sticky: !!raw.sticky,
    // فهرست‌ها متن کامل را نمی‌گیرند (سبک‌تر)؛ آنجا زمان مطالعه ۰ است و نمایش داده نمی‌شود
    readingMinutes: words ? Math.max(1, Math.round(words / 200)) : 0,
    author: toAuthor(raw._embedded?.author?.[0], home),
    image: mediaToImage(raw._embedded?.['wp:featuredmedia']?.[0], title, home),
    categories: refs('category'),
    tags: refs('post_tag'),
    seo: { ...seo, image: localMedia(seo.image, home) },
  };
}

/* ------------------------------------------------------------------
 * فراخوانی API (build و مرورگر)
 * ------------------------------------------------------------------ */

/** خطای HTTP از وردپرس (مثلا 400 برای شماره صفحه‌ی خارج از محدوده) */
export class WpHttpError extends Error {
  constructor(
    public status: number,
    url: string
  ) {
    super(`${status} ${url}`);
  }
}

export interface WpResponse<T> {
  data: T;
  total: number;
  totalPages: number;
}

export async function wpGet<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
  base = WP_API_URL
): Promise<WpResponse<T>> {
  const url = new URL(`${base}/${endpoint.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetchFallback(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    timeoutMs: FETCH_TIMEOUT,
  });
  if (!res.ok) throw new WpHttpError(res.status, url.toString());
  return {
    data: (await res.json()) as T,
    total: Number(res.headers.get('X-WP-Total')) || 0,
    totalPages: Number(res.headers.get('X-WP-TotalPages')) || 1,
  };
}

export async function fetchSiteInfo(base = WP_API_URL): Promise<WpSiteInfo> {
  const { data } = await wpGet<WpSiteInfo>('', { _fields: 'name,description,home,namespaces' }, base);
  if (!data?.home) throw new Error(`پاسخ نامعتبر از ${base} — آیا آدرس REST API وردپرس درست است؟`);
  return { ...data, name: decodeEntities(data.name || ''), description: decodeEntities(data.description || '') };
}

/* ------------------------------------------------------------------
 * داده‌های نمایش (کامپوننت‌های src/components/mag)
 * ------------------------------------------------------------------ */

export const faNum = (n: number) => n.toLocaleString('fa-IR');

export interface Crumb {
  name: string;
  href: string;
}

export function postCrumbs(post: MagPost): Crumb[] {
  const crumbs: Crumb[] = [
    { name: 'آرکان گلد', href: '/' },
    { name: MAG_NAME, href: MAG_PATH },
  ];
  const cat = post.categories[0];
  if (post.type === 'post' && cat) crumbs.push({ name: cat.name, href: magHref(cat.path) });
  crumbs.push({ name: post.title, href: magHref(post.path) });
  return crumbs;
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** شناسه‌ی خوانا برای لینک مستقیم به هر بخش (فارسی حفظ می‌شود): «عیار طلا چیست؟» → «عیار-طلا-چیست» */
function headingId(text: string): string {
  return (
    text
      .replace(/[\u200c\s]+/g, '-')
      .replace(/[^\p{L}\p{N}-]+/gu, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'section'
  );
}

/**
 * فهرست مطالب: به همه‌ی h2 و h3 متن مطلب شناسه داده می‌شود (اگر نداشته باشند) و فهرست
 * عنوان‌ها برای جعبه‌ی «فهرست مطالب» برگردانده می‌شود.
 */
export function buildToc(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (m, lvl: string, attrs = '', inner: string) => {
    const text = htmlToText(inner);
    if (!text) return m;
    let id = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!id) {
      const base = headingId(text);
      id = base;
      for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
      attrs = `${attrs} id="${esc(id)}"`;
    }
    used.add(id);
    toc.push({ id, text, level: lvl === '2' ? 2 : 3 });
    return `<h${lvl}${attrs}>${inner}</h${lvl}>`;
  });
  return { html: out, toc };
}

/** لینک‌های اشتراک‌گذاری مطلب */
export function shareLinks(post: MagPost): { label: string; href: string; icon: 'telegram' | 'whatsapp' | 'x' | 'linkedin' }[] {
  const url = encodeURIComponent(magUrl(post.path));
  const text = encodeURIComponent(post.title);
  return [
    { label: 'تلگرام', icon: 'telegram', href: `https://t.me/share/url?url=${url}&text=${text}` },
    { label: 'واتس‌اپ', icon: 'whatsapp', href: `https://wa.me/?text=${text}%20${url}` },
    { label: 'ایکس', icon: 'x', href: `https://x.com/intent/post?url=${url}&text=${text}` },
    { label: 'لینکدین', icon: 'linkedin', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
  ];
}

/* ------------------------------------------------------------------
 * سئو
 * ------------------------------------------------------------------ */

export const MAG_PUBLISHER = {
  '@type': 'Organization',
  name: 'آرکان گلد | Arkan Gold',
  url: SITE,
  logo: { '@type': 'ImageObject', url: `${SITE}/images/arkan-gold-logo.png` },
};

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.href, SITE).toString(),
    })),
  };
}

export interface PageSeo {
  title: string;
  description: string;
  path: string;
  url: string;
  image?: string;
  imageAlt?: string;
  noindex: boolean;
  ogType: string;
  meta: { property: string; content: string }[];
  schemas: Record<string, unknown>[];
}

/** title، description، متاتگ‌های article و JSON-LD صفحه‌ی مطلب */
export function magPostSeo(post: MagPost): PageSeo {
  const isPost = post.type === 'post';
  const url = magUrl(post.path);
  const description = truncate(post.seo.description || post.excerpt || post.title, 160);
  const rawImage = post.seo.image || post.image?.src;
  // og:image و schema آدرس کامل لازم دارند (تصاویر مجله از /wp-content/uploads سایت اصلی سرو می‌شوند)
  const image = rawImage ? new URL(rawImage, SITE).toString() : undefined;
  const meta: PageSeo['meta'] = [];
  if (isPost) {
    meta.push({ property: 'article:published_time', content: post.date });
    meta.push({ property: 'article:modified_time', content: post.modified });
    if (post.categories[0]) meta.push({ property: 'article:section', content: post.categories[0].name });
    for (const t of post.tags) meta.push({ property: 'article:tag', content: t.name });
  }

  const author = post.author
    ? { '@type': 'Person', name: post.author.name, ...(post.author.path ? { url: magUrl(post.author.path) } : {}) }
    : MAG_PUBLISHER;
  const article = {
    '@context': 'https://schema.org',
    '@type': isPost ? 'BlogPosting' : 'WebPage',
    ...(isPost ? { headline: post.title.slice(0, 110) } : { name: post.title }),
    description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'fa-IR',
    ...(image ? { image: [image] } : {}),
    datePublished: post.date,
    dateModified: post.modified,
    ...(isPost
      ? {
          author,
          publisher: MAG_PUBLISHER,
          isPartOf: { '@type': 'Blog', name: MAG_NAME, url: magUrl('') },
          ...(post.categories[0] ? { articleSection: post.categories[0].name } : {}),
          ...(post.tags.length ? { keywords: post.tags.map((t) => t.name).join('، ') } : {}),
          wordCount: htmlToText(post.contentHtml).split(/\s+/).filter(Boolean).length,
        }
      : {}),
  };

  return {
    title: post.seo.title || `${post.title} | ${MAG_NAME}`,
    description,
    path: magHref(post.path),
    url,
    image,
    imageAlt: post.image?.alt || post.title,
    noindex: !!post.seo.noindex,
    ogType: isPost ? 'article' : 'website',
    meta,
    schemas: [article, breadcrumbSchema(postCrumbs(post)), ...(post.seo.schemas ?? [])],
  };
}
