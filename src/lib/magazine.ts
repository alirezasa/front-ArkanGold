/**
 * مجله آرکان گلد — خواندن محتوای وردپرس هنگام بازدید (SSR)
 * ----------------------------------------------------
 * هر درخواست /mag/... به یکی از این حالت‌ها تبدیل می‌شود و فقط داده‌ی همان صفحه از REST API
 * وردپرس خوانده می‌شود (نه کل مجله):
 *
 *   /mag، /mag/page/2                         ← فهرست مطالب
 *   /mag/{آدرس دسته/برچسب/نویسنده}[/page/n]    ← آرشیو
 *   /mag/{آدرس مطلب یا برگه}                   ← مطلب (دقیقاً همان آدرسی که وردپرس ساخته)
 *   /mag?s=...                                 ← جست‌وجو (noindex)
 *
 * همه‌ی نتیجه‌ها از کش src/lib/cache.ts (کلیدهای «mag:») می‌گذرند؛ انتشار مطلب در وردپرس کش را پاک می‌کند
 * (افزونه‌ی wordpress/arkan-headless ← /mag/wp-revalidate).
 */
import { cached } from './cache';
import {
  WP_EMBED,
  WpHttpError,
  fetchSiteInfo,
  htmlToText,
  seoFromHeadHtml,
  seoFromYoast,
  toAuthor,
  toMagPost,
  wpGet,
  wpPath,
  magHref,
  type MagPost,
  type SeoHead,
  type WpPost,
  type WpSiteInfo,
  type WpTerm,
  type WpUser,
} from './wp';

/** تعداد مطالب در هر صفحه‌ی فهرست و آرشیو */
export const MAG_PER_PAGE = 12;

/** مدت تازه ماندن کش (بعد از آن در پس‌زمینه تازه می‌شود؛ انتشار مطلب کش را فوراً پاک می‌کند) */
const TTL = {
  page: 2 * 60_000,
  lists: 10 * 60_000,
  feed: 10 * 60_000,
  search: 60_000,
};

/**
 * صفحه‌ها و فهرست‌ها: بعد از تمام شدن تازگی فقط ۳۰ ثانیه نسخه‌ی قبلی بدون انتظار نمایش داده می‌شود؛
 * بعد از آن بازدیدکننده منتظر نسخه‌ی تازه می‌ماند (حداکثر ۱۰ ثانیه) و نسخه‌ی قبلی فقط در خطا یا قطعی
 * وردپرس (تا ۲۴ ساعت) نمایش داده می‌شود. پس ویرایش مطلب حتی بدون پاک‌سازی کش، حداکثر حدود ۲.۵ دقیقه بعد دیده می‌شود.
 */
const FRESH = { swrMs: 30_000 };

export interface MagArchive {
  kind: 'category' | 'tag' | 'author';
  id: number;
  name: string;
  path: string;
  description: string;
  seo: SeoHead;
  avatar?: string;
  count?: number;
}

export interface MagListing {
  page: number;
  totalPages: number;
  posts: MagPost[];
  /** مسیر صفحه‌ی اول همین فهرست (برای لینک‌های صفحه‌بندی) */
  basePath: string;
}

export type MagRoute =
  | ({ kind: 'home' } & MagListing)
  | ({ kind: 'archive'; archive: MagArchive } & MagListing)
  | { kind: 'post'; post: MagPost; related: MagPost[] }
  | { kind: 'search'; query: string; posts: MagPost[] }
  | { kind: 'redirect'; path: string }
  | { kind: 'notfound' };

/* ------------------------------------------------------------------
 * داده‌های مشترک (کش طولانی‌تر)
 * ------------------------------------------------------------------ */

export const getSite = (): Promise<WpSiteInfo> => cached('mag:site', TTL.lists, () => fetchSiteInfo());

const POST_FIELDS = [
  'id',
  'type',
  'slug',
  'link',
  'date_gmt',
  'modified_gmt',
  'sticky',
  'title',
  'content',
  'excerpt',
  'author',
  'featured_media',
  'categories',
  'tags',
  'yoast_head_json',
  'arkan_noindex',
  '_links',
  '_embedded',
].join(',');
const TERM_FIELDS = 'id,name,slug,link,taxonomy,description,count,parent,yoast_head_json,arkan_noindex';
const USER_FIELDS = 'id,name,slug,link,description,avatar_urls,yoast_head_json,arkan_noindex';

/** همه‌ی صفحه‌های یک endpoint (۱۰۰ مورد در هر درخواست) */
async function wpAll<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 100; page++) {
    const res = await wpGet<T[]>(endpoint, { ...params, per_page: 100, page });
    out.push(...(Array.isArray(res.data) ? res.data : []));
    if (page >= res.totalPages) break;
  }
  return out;
}

/** همه‌ی دسته‌ها (معمولا چند ده مورد) — برای تشخیص آدرس آرشیو و زیردسته‌ها */
export const getCategories = (): Promise<WpTerm[]> =>
  cached('mag:categories', TTL.lists, () => wpAll<WpTerm>('wp/v2/categories', { _fields: TERM_FIELDS }));

/** پربازدیدترین دسته‌ها برای نوار دسته‌بندی بالای فهرست مجله */
export async function topCategories(limit = 10): Promise<{ name: string; path: string }[]> {
  const [site, cats] = await Promise.all([getSite(), getCategories()]);
  return cats
    .filter((c) => (c.count ?? 1) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, limit)
    .map((c) => ({ name: htmlToText(c.name), path: wpPath(c.link, site.home) ?? '' }))
    .filter((c) => c.path);
}

/* ------------------------------------------------------------------
 * سئو از Rank Math (وقتی Yoast نصب نیست)
 * ------------------------------------------------------------------ */

/**
 * سئو از Rank Math (وقتی Yoast نصب نیست) — نیازمند «Headless CMS Support» در تنظیمات Rank Math.
 * عنوان، توضیحات، robots، تصویر شبکه‌های اجتماعی و schema های Pro (FAQ، HowTo، ...) خوانده می‌شوند.
 */
async function withRankMath(site: WpSiteInfo, link: string, seo: SeoHead): Promise<SeoHead> {
  if (seo.title || seo.description || !site.namespaces?.includes('rankmath/v1')) return seo;
  try {
    const { data } = await wpGet<{ head?: string }>('rankmath/v1/getHead', { url: link });
    if (!data?.head) return seo;
    const rm = seoFromHeadHtml(data.head, site.home);
    return { ...rm, noindex: rm.noindex || seo.noindex };
  } catch {
    return seo;
  }
}

/* ------------------------------------------------------------------
 * فهرست مطالب
 * ------------------------------------------------------------------ */

async function listPosts(
  site: WpSiteInfo,
  params: Record<string, string | number>,
  page: number,
  basePath: string
): Promise<MagListing | null> {
  try {
    const res = await wpGet<WpPost[]>('wp/v2/posts', {
      per_page: MAG_PER_PAGE,
      orderby: 'date',
      order: 'desc',
      ...params,
      page,
      _embed: WP_EMBED,
      _fields: POST_FIELDS,
    });
    const posts = res.data.map((p) => toMagPost(p, site.home)).filter((p): p is MagPost => !!p);
    if (!posts.length && page > 1) return null;
    return { page, totalPages: Math.max(1, res.totalPages), posts, basePath };
  } catch (err) {
    // شماره صفحه‌ی بیشتر از تعداد صفحه‌ها
    if (err instanceof WpHttpError && err.status === 400) return null;
    throw err;
  }
}

/* ------------------------------------------------------------------
 * پیدا کردن صفحه بر اساس آدرس
 * ------------------------------------------------------------------ */

const lastSegment = (path: string) => path.split('/').pop() || '';

/** شناسه‌ی یک دسته و همه‌ی زیردسته‌هایش */
function categoryIds(cats: WpTerm[], id: number): number[] {
  const ids = [id];
  for (let i = 0; i < ids.length; i++) for (const c of cats) if (c.parent === ids[i] && !ids.includes(c.id)) ids.push(c.id);
  return ids;
}

/** دسته با همین آدرس (و شناسه‌ی زیردسته‌هایش، چون آرشیو وردپرس مطالب زیردسته‌ها را هم نشان می‌دهد) */
async function findCategory(site: WpSiteInfo, path: string): Promise<{ archive: MagArchive; ids: number[] } | null> {
  const cats = await getCategories();
  const cat = cats.find((c) => wpPath(c.link, site.home) === path);
  if (!cat) return null;
  const ids = categoryIds(cats, cat.id);
  const archive: MagArchive = {
    kind: 'category',
    id: cat.id,
    name: htmlToText(cat.name),
    path,
    description: htmlToText(cat.description || ''),
    seo: await withRankMath(site, cat.link, { ...seoFromYoast(cat.yoast_head_json), ...(cat.arkan_noindex ? { noindex: true } : {}) }),
    count: cat.count,
  };
  return { archive, ids };
}

async function findTag(site: WpSiteInfo, path: string): Promise<MagArchive | null> {
  const { data } = await wpGet<WpTerm[]>('wp/v2/tags', { slug: lastSegment(path), _fields: TERM_FIELDS });
  const tag = data.find((t) => wpPath(t.link, site.home) === path);
  if (!tag) return null;
  return {
    kind: 'tag',
    id: tag.id,
    name: htmlToText(tag.name),
    path,
    description: htmlToText(tag.description || ''),
    seo: await withRankMath(site, tag.link, { ...seoFromYoast(tag.yoast_head_json), ...(tag.arkan_noindex ? { noindex: true } : {}) }),
    count: tag.count,
  };
}

async function findAuthor(site: WpSiteInfo, path: string): Promise<MagArchive | null> {
  let users: WpUser[] = [];
  try {
    users = (await wpGet<WpUser[]>('wp/v2/users', { slug: lastSegment(path), _fields: USER_FIELDS })).data;
  } catch (err) {
    // بعضی افزونه‌های امنیتی فهرست کاربران را می‌بندند؛ در این صورت آرشیو نویسنده وجود ندارد
    if (err instanceof WpHttpError && err.status < 500) return null;
    throw err;
  }
  const user = users.find((u) => wpPath(u.link, site.home) === path);
  const author = toAuthor(user, site.home);
  if (!user || !author) return null;
  return {
    kind: 'author',
    id: author.id,
    name: author.name,
    path,
    description: author.description,
    seo: user.arkan_noindex ? { ...author.seo, noindex: true } : author.seo,
    avatar: author.avatar,
  };
}

/** مطلب یا برگه با این آدرس؛ اگر نامک پیدا شد ولی آدرس فرق داشت (مثلا تغییر دسته) آدرس درست برمی‌گردد */
async function findPost(site: WpSiteInfo, path: string): Promise<{ post: MagPost; link: string } | null> {
  const slug = lastSegment(path);
  let moved: { post: MagPost; link: string } | null = null;
  for (const type of ['posts', 'pages']) {
    const { data } = await wpGet<WpPost[]>(`wp/v2/${type}`, { slug, _embed: WP_EMBED, _fields: POST_FIELDS });
    for (const raw of data) {
      const post = toMagPost(raw, site.home);
      if (!post) continue;
      if (post.path === path) return { post, link: raw.link };
      moved ??= { post, link: raw.link };
    }
  }
  return moved;
}

async function relatedPosts(site: WpSiteInfo, post: MagPost): Promise<MagPost[]> {
  if (post.type !== 'post') return [];
  const fetchList = async (params: Record<string, string | number>) =>
    (
      await wpGet<WpPost[]>('wp/v2/posts', { ...params, per_page: 4, exclude: post.id, _embed: WP_EMBED, _fields: POST_FIELDS })
    ).data
      .map((p) => toMagPost(p, site.home))
      .filter((p): p is MagPost => !!p);
  try {
    const sameCategory = post.categories.length ? await fetchList({ categories: post.categories.map((c) => c.id).join(',') }) : [];
    if (sameCategory.length >= 4) return sameCategory;
    const latest = await fetchList({});
    return [...sameCategory, ...latest.filter((p) => !sameCategory.some((s) => s.id === p.id))].slice(0, 4);
  } catch {
    return []; // مطالب مرتبط اختیاری‌اند؛ خطای آن‌ها صفحه را خراب نمی‌کند
  }
}

/** «category/طلا/page/3» → { base: «category/طلا», page: 3 } */
function splitPaged(path: string): { base: string; page: number } {
  const m = path.match(/^(?:(.*)\/)?page\/(\d+)$/);
  if (!m) return { base: path, page: 1 };
  return { base: m[1] ?? '', page: parseInt(m[2], 10) };
}

async function resolve(path: string): Promise<MagRoute> {
  const site = await getSite();
  const { base, page } = splitPaged(path);
  if (page < 1) return { kind: 'notfound' };
  // /mag/page/1 و /category/x/page/1 تکراری صفحه‌ی اول هستند
  if (page === 1 && base !== path) return { kind: 'redirect', path: base };

  if (base === '') {
    const listing = await listPosts(site, {}, page, '');
    return listing ? { kind: 'home', ...listing } : { kind: 'notfound' };
  }

  const category = await findCategory(site, base);
  if (category) {
    const listing = await listPosts(site, { categories: category.ids.join(',') }, page, base);
    return listing ? { kind: 'archive', archive: category.archive, ...listing } : { kind: 'notfound' };
  }

  if (page === 1) {
    const found = await findPost(site, base);
    if (found) {
      if (found.post.path !== base) return { kind: 'redirect', path: found.post.path };
      const [seo, related] = await Promise.all([withRankMath(site, found.link, found.post.seo), relatedPosts(site, found.post)]);
      return { kind: 'post', post: { ...found.post, seo }, related };
    }
  }

  // آرشیو برچسب و نویسنده همیشه حداقل دو بخش دارند (tag/x، author/x)
  if (base.includes('/')) {
    const archive = (await findTag(site, base)) ?? (await findAuthor(site, base));
    if (archive) {
      const params: Record<string, number> = archive.kind === 'tag' ? { tags: archive.id } : { author: archive.id };
      const listing = await listPosts(site, params, page, base);
      return listing ? { kind: 'archive', archive, ...listing } : { kind: 'notfound' };
    }
  }

  return { kind: 'notfound' };
}

/** صفحه‌ی /mag/{path} (مسیر decode‌شده، بدون / اول و آخر) */
export function resolveMagRoute(path: string): Promise<MagRoute> {
  const clean = path.split('/').filter(Boolean).join('/');
  return cached(`mag:route:${clean}`, TTL.page, () => resolve(clean), FRESH);
}

export function searchMag(query: string): Promise<MagRoute> {
  const q = query.trim().slice(0, 100);
  return cached(`mag:search:${q.toLowerCase()}`, TTL.search, async () => {
    const site = await getSite();
    const { data } = await wpGet<WpPost[]>('wp/v2/posts', { search: q, per_page: 24, _embed: WP_EMBED, _fields: POST_FIELDS });
    return { kind: 'search', query: q, posts: data.map((p) => toMagPost(p, site.home)).filter((p): p is MagPost => !!p) };
  }, FRESH);
}

/** آخرین مطالب (RSS و بخش «مطالب مجله» صفحه‌ی اصلی) */
export function latestPosts(count = 30): Promise<MagPost[]> {
  return cached(`mag:latest:${count}`, TTL.page, latestFetcher(count), FRESH);
}

function latestFetcher(count: number) {
  return async () => {
    const site = await getSite();
    const listing = await listPosts(site, { per_page: count }, 1, '');
    return listing?.posts.slice(0, count) ?? [];
  };
}

/* ------------------------------------------------------------------
 * ریدایرکت‌های Rank Math (ماژول Redirections)
 * ------------------------------------------------------------------ */

interface RankMathRedirect {
  sources: { pattern: string; comparison: 'exact' | 'contains' | 'start' | 'end' | 'regex'; ignore?: string }[];
  to: string;
  code: number;
}

export type MagRedirect = { status: 301 | 302 | 307; location: string } | { status: 410 | 451 };

/** فهرست ریدایرکت‌های فعال (افزونه‌ی arkan-headless ← /wp-json/arkan/v1/redirects) — کش ۵ دقیقه */
function getRedirects(): Promise<RankMathRedirect[]> {
  return cached('mag:redirects', 5 * 60_000, async () => {
    try {
      const { data } = await wpGet<RankMathRedirect[]>('arkan/v1/redirects');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      // افزونه‌ی قدیمی یا Rank Math غیرفعال: ریدایرکتی وجود ندارد
      if (err instanceof WpHttpError && err.status < 500) return [];
      throw err;
    }
  });
}

const trimSlashes = (s: string) => s.replace(/^\/+|\/+$/g, '');
const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * ریدایرکتی که Rank Math برای این آدرس مجله تعریف کرده (همان قواعد Rank Math: exact، contains، start، end،
 * regex با $1 و ...). path نسبت به ریشه‌ی وردپرس است (یعنی بدون /mag).
 */
export async function findRedirect(path: string, query = ''): Promise<MagRedirect | null> {
  const list = await getRedirects();
  if (!list.length) return null;
  const site = await getSite();
  const subject = trimSlashes(safeDecode(path));

  for (const r of list) {
    for (const src of r.sources ?? []) {
      const ci = String(src.ignore ?? '').includes('case');
      const pattern = src.comparison === 'regex' ? String(src.pattern ?? '') : trimSlashes(safeDecode(String(src.pattern ?? '')));
      if (!pattern) continue;
      const a = ci ? subject.toLowerCase() : subject;
      const b = ci ? pattern.toLowerCase() : pattern;
      let match: RegExpMatchArray | null | boolean = false;
      if (src.comparison === 'exact') match = a === b || `${a}?${query}` === b;
      else if (src.comparison === 'contains') match = a.includes(b);
      else if (src.comparison === 'start') match = a.startsWith(b);
      else if (src.comparison === 'end') match = a.endsWith(b);
      else if (src.comparison === 'regex') {
        try {
          match = subject.match(new RegExp(pattern, ci ? 'i' : ''));
        } catch {
          match = false;
        }
      }
      if (!match) continue;

      if (r.code === 410 || r.code === 451) return { status: r.code };
      const groups = Array.isArray(match) ? match : null;
      let to = String(r.to ?? '');
      if (groups) to = to.replace(/\$(\d+)/g, (_m, n: string) => groups[Number(n)] ?? '');
      if (!to) continue;
      // آدرس نسبی یا آدرس خود وردپرس ← همان صفحه روی arkan.gold/mag
      const absolute = /^https?:\/\//i.test(to) ? to : `${site.home.replace(/\/$/, '')}/${to.replace(/^\//, '')}`;
      const magPath = wpPath(absolute, site.home);
      const u = new URL(absolute);
      const location = magPath === null ? absolute : `${magHref(magPath)}${u.search}${u.hash}`;
      const status = r.code === 302 || r.code === 307 ? r.code : 301;
      return { status, location };
    }
  }
  return null;
}

/* ------------------------------------------------------------------
 * صفحه‌ی اصلی مجله
 * ------------------------------------------------------------------ */

export interface MagCategoryBlock {
  name: string;
  path: string;
  posts: MagPost[];
}

export interface MagLanding {
  /** ۵ مطلب بالای صفحه: اول مطالب سنجاق‌شده (sticky) در وردپرس، بعد جدیدترین‌ها */
  featured: MagPost[];
  /** بخش اختصاصی پرمطلب‌ترین دسته‌ها (هر کدام ۴ مطلب) */
  sections: MagCategoryBlock[];
  /** تب‌های «آخرین مطالب» به تفکیک دسته (هر کدام ۸ مطلب) */
  tabs: MagCategoryBlock[];
}

/** داده‌های صفحه‌ی اصلی مجله (/mag) — کش ۲ دقیقه‌ای، با انتشار مطلب پاک می‌شود */
export function magLanding(): Promise<MagLanding> {
  return cached('mag:landing', TTL.page, async () => {
    const site = await getSite();
    const [cats, sticky, latest] = await Promise.all([
      getCategories(),
      listPosts(site, { sticky: 'true', per_page: 5 }, 1, '').catch(() => null),
      latestPosts(12),
    ]);

    const seen = new Set<number>();
    const featured = [...(sticky?.posts ?? []), ...latest].filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, 5);

    const top = cats
      .filter((c) => (c.count ?? 1) > 0)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 6);
    const tabs = (
      await Promise.all(
        top.map(async (c): Promise<MagCategoryBlock | null> => {
          const path = wpPath(c.link, site.home);
          if (!path) return null;
          const listing = await listPosts(site, { categories: categoryIds(cats, c.id).join(','), per_page: 8 }, 1, path).catch(() => null);
          return listing?.posts.length ? { name: htmlToText(c.name), path, posts: listing.posts } : null;
        })
      )
    ).filter((t): t is MagCategoryBlock => !!t);

    const sections = tabs.slice(0, 3).map((t) => ({ ...t, posts: t.posts.slice(0, 4) }));
    return { featured, sections, tabs };
  }, FRESH);
}

/* ------------------------------------------------------------------
 * sitemap
 * ------------------------------------------------------------------ */

export interface SitemapEntry {
  path: string;
  lastmod?: string;
}

/** noindex طبق Yoast (yoast_head_json) یا Rank Math/Yoast (فیلد arkan_noindex افزونه‌ی arkan-headless) */
const isNoindex = (x: { yoast_head_json?: { robots?: { index?: string } } | null; arkan_noindex?: boolean }) =>
  x.arkan_noindex === true || x.yoast_head_json?.robots?.index === 'noindex';

/** همه‌ی صفحه‌های قابل‌ایندکس مجله با تاریخ آخرین تغییر */
export function sitemapEntries(): Promise<SitemapEntry[]> {
  return cached('mag:sitemap', TTL.lists, async () => {
    const site = await getSite();
    const fields = { _fields: 'link,modified_gmt,yoast_head_json,arkan_noindex' };
    const [posts, pages, cats, tags] = await Promise.all([
      wpAll<WpPost>('wp/v2/posts', fields),
      wpAll<WpPost>('wp/v2/pages', fields),
      getCategories(),
      wpAll<WpTerm>('wp/v2/tags', { hide_empty: 'true', _fields: TERM_FIELDS }),
    ]);
    const users = await wpAll<WpUser>('wp/v2/users', { _fields: USER_FIELDS }).catch(() => [] as WpUser[]);

    const iso = (v: string) => (v && !/[zZ]$/.test(v) ? `${v}Z` : v);
    const out: SitemapEntry[] = [];
    const latest = posts.reduce((a, p) => (p.modified_gmt > a ? p.modified_gmt : a), '');
    out.push({ path: '', lastmod: latest ? iso(latest) : undefined });
    for (const p of [...posts, ...pages]) {
      const path = wpPath(p.link, site.home);
      if (path && !isNoindex(p)) out.push({ path, lastmod: iso(p.modified_gmt) });
    }
    for (const t of [...cats.filter((c) => (c.count ?? 1) > 0), ...tags]) {
      const path = wpPath(t.link, site.home);
      if (path && !isNoindex(t)) out.push({ path });
    }
    for (const u of users) {
      const path = u.link ? wpPath(u.link, site.home) : null;
      if (path && !isNoindex(u)) out.push({ path });
    }
    return out;
  });
}
