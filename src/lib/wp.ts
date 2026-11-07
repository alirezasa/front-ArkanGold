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

const SITE = SITE_URL;
/** آدرس عمومی مجله؛ لینک‌هایی که در محتوای قدیمی به این آدرس اشاره می‌کنند هم داخلی حساب می‌شوند */
export const MAG_PUBLIC_URL = `${SITE}${MAG_PATH}`;
/** سقف انتظار برای پاسخ وردپرس؛ بعد از آن نسخه‌ی کش‌شده نمایش داده می‌شود (src/lib/magCache.ts) */
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
}

export interface WpUser {
  id: number;
  name: string;
  slug: string;
  link: string;
  description?: string;
  avatar_urls?: Record<string, string>;
  yoast_head_json?: YoastHeadJson | null;
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

const faNum = (n: number) => n.toLocaleString('fa-IR');

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

/**
 * آماده‌سازی HTML محتوای وردپرس برای نمایش روی سایت اصلی:
 * - لینک‌های داخلی مجله (چه به آدرس وردپرس، چه به arkan.gold/mag) به /mag/... تبدیل می‌شوند
 * - اسکریپت‌ها و رویدادهای inline حذف می‌شوند (embed ها با iframe باقی می‌مانند)
 */
export function prepareContent(html: string, home: string): string {
  return (html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
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
export function mediaToImage(media: WpMedia | undefined, fallbackAlt: string): MagImage | undefined {
  if (!media || media.code || !media.source_url) return undefined;
  const d = media.media_details ?? {};
  const ratio = d.width && d.height ? d.width / d.height : 0;
  const sizes = Object.values(d.sizes ?? {}).filter(
    (s) => s?.source_url && s.width && s.height && (!ratio || Math.abs(s.width / s.height - ratio) < 0.03)
  );
  const unique = new Map<number, string>();
  for (const s of sizes) unique.set(s.width, s.source_url);
  if (d.width) unique.set(d.width, media.source_url);
  const srcset = [...unique.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([w, url]) => `${url.replace(/ /g, '%20').replace(/,/g, '%2C')} ${w}w`)
    .join(', ');
  return {
    src: media.source_url,
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

/** داده‌های سئو از HTML تگ head (پاسخ getHead افزونه‌ی Rank Math) */
export function seoFromHeadHtml(head: string): SeoHead {
  const meta = (attr: string, name: string) => {
    const tag = head.match(new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, 'i'))?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    return content ? decodeEntities(content) : undefined;
  };
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const robots = meta('name', 'robots');
  return {
    title: title ? decodeEntities(title).trim() : undefined,
    description: meta('name', 'description'),
    noindex: robots ? /noindex/i.test(robots) : undefined,
    image: meta('property', 'og:image'),
  };
}

export function toAuthor(user: WpUser | undefined, home: string): MagAuthor | undefined {
  if (!user || user.code || !user.name) return undefined;
  const avatars = user.avatar_urls ?? {};
  const avatar = avatars['96'] || avatars['48'] || Object.values(avatars).pop();
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
    readingMinutes: Math.max(1, Math.round(words / 200)),
    author: toAuthor(raw._embedded?.author?.[0], home),
    image: mediaToImage(raw._embedded?.['wp:featuredmedia']?.[0], title),
    categories: refs('category'),
    tags: refs('post_tag'),
    seo: seoFromYoast(raw.yoast_head_json),
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
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
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
 * HTML (کارت و صفحه‌ی مطلب)
 * ------------------------------------------------------------------ */

const imgTag = (img: MagImage, cls: string, sizes: string, eager = false) =>
  `<img src="${esc(img.src)}"${img.srcset ? ` srcset="${esc(img.srcset)}" sizes="${esc(sizes)}"` : ''}${
    img.width && img.height ? ` width="${img.width}" height="${img.height}"` : ''
  } alt="${esc(img.alt)}" class="${cls}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;

const placeholder = `<div class="flex h-full w-full items-center justify-center bg-brand-solid">
  <img src="/images/logo-mark.png" alt="" class="h-14 w-14 opacity-80" loading="lazy" decoding="async">
</div>`;

/** کارت مطلب در فهرست‌ها */
export function magCardHtml(post: MagPost, opts: { headingTag?: 'h2' | 'h3'; eager?: boolean } = {}): string {
  const h = opts.headingTag ?? 'h2';
  const href = esc(magHref(post.path));
  const cat = post.categories[0];
  return `<article class="group flex flex-col overflow-hidden rounded-card bg-white border border-brand-100/40 shadow-card card-lift">
  <a href="${href}" class="block aspect-[16/9] overflow-hidden bg-canvas-200" tabindex="-1" aria-hidden="true">
    ${post.image ? imgTag(post.image, 'h-full w-full object-cover transition-transform duration-500 group-hover:scale-105', '(min-width: 1024px) 420px, (min-width: 640px) 50vw, 100vw', opts.eager) : placeholder}
  </a>
  <div class="flex flex-1 flex-col p-5">
    ${cat ? `<a href="${esc(magHref(cat.path))}" class="mb-2 self-start rounded-full bg-brand-50 px-3 py-0.5 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors">${esc(cat.name)}</a>` : ''}
    <${h} class="font-bold text-brand leading-8 line-clamp-2"><a href="${href}" class="hover:underline">${esc(post.title)}</a></${h}>
    <p class="mt-2 text-sm leading-7 text-ink-soft line-clamp-3">${esc(post.excerpt)}</p>
    <div class="mt-auto pt-4 flex items-center gap-2 text-xs text-ink-soft/80">
      <time datetime="${esc(post.date)}">${faDate(post.date)}</time>
      <span aria-hidden="true">·</span>
      <span>${faNum(post.readingMinutes)} دقیقه مطالعه</span>
    </div>
  </div>
</article>`;
}

export interface Crumb {
  name: string;
  href: string;
}

export function breadcrumbHtml(crumbs: Crumb[]): string {
  return `<nav aria-label="مسیر صفحه" class="mb-6 text-xs text-ink-soft">
  <ol class="flex flex-wrap items-center gap-1.5">
    ${crumbs
      .map((c, i) =>
        i === crumbs.length - 1
          ? `<li aria-current="page" class="text-brand font-semibold line-clamp-1">${esc(c.name)}</li>`
          : `<li><a href="${esc(c.href)}" class="hover:text-brand hover:underline">${esc(c.name)}</a></li><li aria-hidden="true">/</li>`
      )
      .join('')}
  </ol>
</nav>`;
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

function shareHtml(post: MagPost): string {
  const url = encodeURIComponent(magUrl(post.path));
  const text = encodeURIComponent(post.title);
  const links = [
    { label: 'تلگرام', href: `https://t.me/share/url?url=${url}&text=${text}` },
    { label: 'واتس‌اپ', href: `https://wa.me/?text=${text}%20${url}` },
    { label: 'ایکس', href: `https://x.com/intent/post?url=${url}&text=${text}` },
    { label: 'لینکدین', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
  ];
  return `<div class="flex flex-wrap items-center gap-2 text-xs">
  <span class="text-ink-soft">اشتراک‌گذاری:</span>
  ${links
    .map(
      (l) =>
        `<a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer nofollow" class="rounded-full border border-brand-100 px-3 py-1 text-brand hover:bg-brand hover:text-white transition-colors">${l.label}</a>`
    )
    .join('')}
  <button type="button" data-copy-link="${esc(magUrl(post.path))}" class="rounded-full border border-brand-100 px-3 py-1 text-brand hover:bg-brand hover:text-white transition-colors">کپی لینک</button>
</div>`;
}

function authorBoxHtml(author: MagAuthor): string {
  const name = author.path
    ? `<a href="${esc(magHref(author.path))}" class="hover:underline">${esc(author.name)}</a>`
    : esc(author.name);
  return `<aside class="mt-10 flex gap-4 rounded-card bg-white border border-brand-100/40 p-5 shadow-card">
  ${author.avatar ? `<img src="${esc(author.avatar)}" alt="${esc(author.name)}" width="64" height="64" class="h-16 w-16 shrink-0 rounded-full object-cover" loading="lazy" decoding="async">` : ''}
  <div>
    <p class="text-xs text-ink-soft">نویسنده</p>
    <p class="font-bold text-brand">${name}</p>
    ${author.description ? `<p class="mt-1 text-sm leading-7 text-ink-soft">${esc(author.description)}</p>` : ''}
  </div>
</aside>`;
}

/** صفحه‌ی کامل یک مطلب یا برگه */
export function magArticleHtml(post: MagPost): string {
  const isPost = post.type === 'post';
  const updated = isPost && post.modified.slice(0, 10) !== post.date.slice(0, 10);
  const author = post.author;
  return `<article class="container-page py-10" data-mag-article>
  <div class="mx-auto max-w-3xl">
    ${breadcrumbHtml(postCrumbs(post))}
    <header class="mb-8">
      ${
        isPost && post.categories.length
          ? `<div class="mb-3 flex flex-wrap gap-2">${post.categories
              .map(
                (c) =>
                  `<a href="${esc(magHref(c.path))}" class="rounded-full bg-brand-50 px-3 py-0.5 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors">${esc(c.name)}</a>`
              )
              .join('')}</div>`
          : ''
      }
      <h1 class="text-2xl md:text-3xl font-bold leading-[1.6] text-brand">${esc(post.title)}</h1>
      ${
        isPost
          ? `<div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        ${author ? `<span class="flex items-center gap-2">${author.avatar ? `<img src="${esc(author.avatar)}" alt="" width="28" height="28" class="h-7 w-7 rounded-full object-cover" decoding="async">` : ''}${author.path ? `<a href="${esc(magHref(author.path))}" class="font-semibold text-brand hover:underline">${esc(author.name)}</a>` : `<span class="font-semibold text-brand">${esc(author.name)}</span>`}</span><span aria-hidden="true">·</span>` : ''}
        <time datetime="${esc(post.date)}">${faDate(post.date)}</time>
        ${updated ? `<span aria-hidden="true">·</span><span>به‌روزرسانی: <time datetime="${esc(post.modified)}">${faDate(post.modified)}</time></span>` : ''}
        <span aria-hidden="true">·</span>
        <span>${faNum(post.readingMinutes)} دقیقه مطالعه</span>
      </div>`
          : ''
      }
    </header>
  </div>
  ${
    post.image
      ? `<figure class="mx-auto mb-10 max-w-4xl overflow-hidden rounded-xl2 bg-canvas-200 shadow-card">${imgTag(
          post.image,
          'w-full h-auto',
          '(min-width: 1024px) 896px, 100vw',
          true
        )}</figure>`
      : ''
  }
  <div class="mx-auto max-w-3xl">
    <div class="mag-content">${post.contentHtml || '<p>محتوای این مطلب محافظت‌شده است.</p>'}</div>
    ${
      isPost && post.tags.length
        ? `<div class="mt-10 flex flex-wrap items-center gap-2 text-xs"><span class="text-ink-soft">برچسب‌ها:</span>${post.tags
            .map((t) => `<a href="${esc(magHref(t.path))}" class="rounded-full bg-canvas-200 px-3 py-1 text-ink hover:bg-brand hover:text-white transition-colors">#${esc(t.name)}</a>`)
            .join('')}</div>`
        : ''
    }
    ${isPost ? `<div class="mt-6 border-t border-brand-100/50 pt-6">${shareHtml(post)}</div>` : ''}
    ${isPost && author && (author.description || author.avatar) ? authorBoxHtml(author) : ''}
  </div>
</article>`;
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
  const image = post.seo.image || post.image?.src;
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
    schemas: [article, breadcrumbSchema(postCrumbs(post))],
  };
}
