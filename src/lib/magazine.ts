/**
 * مجله آرکان گلد — بارگذاری کامل محتوای وردپرس در زمان build
 * ----------------------------------------------------
 * همه‌ی مطالب، برگه‌ها، دسته‌ها، برچسب‌ها و نویسنده‌ها یک بار از REST API وردپرس
 * خوانده می‌شوند و جدول مسیرهای /mag (فهرست، صفحه‌بندی، آرشیوها و مطالب) ساخته می‌شود.
 *
 * اگر PUBLIC_WP_API_URL تنظیم شده باشد ولی وردپرس در دسترس نباشد، build عمداً
 * شکست می‌خورد تا نسخه‌ای بدون مطالب مجله منتشر نشود (و سئوی مجله آسیب نبیند).
 *
 * فقط در build (Node) استفاده می‌شود.
 */
import { MAG_ENABLED, WP_API_URL } from '../config/site';
import {
  WP_EMBED,
  fetchSiteInfo,
  htmlToText,
  pagedPath,
  seoFromHeadHtml,
  seoFromYoast,
  toMagPost,
  wpGet,
  wpPath,
  type MagAuthor,
  type MagPost,
  type SeoHead,
  type WpPost,
  type WpSiteInfo,
  type WpTerm,
} from './wp';

/** تعداد مطالب در هر صفحه‌ی فهرست و آرشیو */
export const MAG_PER_PAGE = 12;
const MAX_API_PAGES = 200;

export interface MagArchive {
  kind: 'category' | 'tag' | 'author';
  id: number;
  name: string;
  path: string;
  description: string;
  seo: SeoHead;
  avatar?: string;
  posts: MagPost[];
}

export interface Magazine {
  site: WpSiteInfo;
  /** مطالب (نوشته‌ها) به ترتیب جدیدترین */
  posts: MagPost[];
  /** برگه‌های وردپرس (مثلا «درباره مجله») */
  pages: MagPost[];
  categories: MagArchive[];
  tags: MagArchive[];
  authors: MagArchive[];
}

/* ------------------------------------------------------------------
 * فراخوانی API
 * ------------------------------------------------------------------ */

/** همه‌ی صفحه‌های یک endpoint (۱۰۰ مورد در هر درخواست) */
async function wpAll<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_API_PAGES; page++) {
    const res = await wpGet<T[]>(endpoint, { ...params, per_page: 100, page });
    out.push(...(Array.isArray(res.data) ? res.data : []));
    if (page >= res.totalPages) break;
  }
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** سئوی یک آدرس از افزونه‌ی Rank Math (وقتی Yoast نصب نیست) — نیازمند فعال بودن «Headless CMS Support» */
async function rankMathSeo(link: string): Promise<SeoHead> {
  try {
    const { data } = await wpGet<{ success?: boolean; head?: string }>('rankmath/v1/getHead', { url: link });
    return data?.head ? seoFromHeadHtml(data.head) : {};
  } catch {
    return {};
  }
}

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
  '_links',
  '_embedded',
].join(',');

const TERM_FIELDS = 'id,name,slug,link,taxonomy,description,count,parent,yoast_head_json';

/* ------------------------------------------------------------------
 * بارگذاری
 * ------------------------------------------------------------------ */

async function load(): Promise<Magazine> {
  const site = await fetchSiteInfo();
  const home = site.home;

  const [rawPosts, rawPages, rawCategories, rawTags] = await Promise.all([
    wpAll<WpPost>('wp/v2/posts', { _embed: WP_EMBED, _fields: POST_FIELDS, orderby: 'date', order: 'desc' }),
    wpAll<WpPost>('wp/v2/pages', { _embed: WP_EMBED, _fields: POST_FIELDS }),
    wpAll<WpTerm>('wp/v2/categories', { hide_empty: 'true', _fields: TERM_FIELDS }),
    wpAll<WpTerm>('wp/v2/tags', { hide_empty: 'true', _fields: TERM_FIELDS }),
  ]);

  const skipped: string[] = [];
  const convert = (raws: WpPost[]) =>
    raws
      .map((raw) => {
        const post = toMagPost(raw, home);
        if (!post) skipped.push(raw.link);
        return post ? { post, link: raw.link } : null;
      })
      .filter((x): x is { post: MagPost; link: string } => !!x);

  const postItems = convert(rawPosts);
  const pageItems = convert(rawPages);
  if (skipped.length) {
    console.warn(
      `[mag] ${skipped.length} مطلب آدرس قابل‌استفاده نداشت و ساخته نشد (ساختار پیوند یکتای «ساده» یا صفحه‌ی اصلی وردپرس):`,
      skipped.slice(0, 5)
    );
  }

  // Rank Math: اگر Yoast نصب نیست، سئوی هر مطلب از getHead خوانده می‌شود
  if (site.namespaces?.includes('rankmath/v1')) {
    await mapLimit([...postItems, ...pageItems], 6, async ({ post, link }) => {
      if (!post.seo.title && !post.seo.description) post.seo = await rankMathSeo(link);
    });
  }

  const posts = postItems.map((x) => x.post);
  const pages = pageItems.map((x) => x.post);

  // آرشیو دسته‌ها (شامل مطالب زیردسته‌ها، مثل وردپرس) و برچسب‌ها
  const childrenOf = new Map<number, number[]>();
  for (const c of rawCategories) {
    if (c.parent) childrenOf.set(c.parent, [...(childrenOf.get(c.parent) ?? []), c.id]);
  }
  const descendants = (id: number): Set<number> => {
    const out = new Set([id]);
    const stack = [id];
    while (stack.length) for (const child of childrenOf.get(stack.pop()!) ?? []) if (!out.has(child)) out.add(child), stack.push(child);
    return out;
  };

  const toArchives = async (terms: WpTerm[], kind: 'category' | 'tag'): Promise<MagArchive[]> => {
    const list = terms
      .map((t): MagArchive | null => {
        const path = wpPath(t.link, home);
        if (!path) return null;
        const ids = kind === 'category' ? descendants(t.id) : new Set([t.id]);
        const termPosts = posts.filter((p) => (kind === 'category' ? p.categories : p.tags).some((r) => ids.has(r.id)));
        if (!termPosts.length) return null;
        return {
          kind,
          id: t.id,
          name: htmlToText(t.name),
          path,
          description: htmlToText(t.description || ''),
          seo: seoFromYoast(t.yoast_head_json),
          posts: termPosts,
        };
      })
      .filter((a): a is MagArchive => !!a);
    if (site.namespaces?.includes('rankmath/v1')) {
      const links = new Map(terms.map((t) => [t.id, t.link]));
      await mapLimit(list, 6, async (a) => {
        if (!a.seo.title && !a.seo.description) a.seo = await rankMathSeo(links.get(a.id)!);
      });
    }
    return list;
  };

  // آرشیو نویسنده‌ها از روی نویسنده‌ی مطالب
  const authorMap = new Map<number, MagAuthor>();
  for (const p of posts) if (p.author?.path && !authorMap.has(p.author.id)) authorMap.set(p.author.id, p.author);
  const authors: MagArchive[] = [...authorMap.values()].map((a) => ({
    kind: 'author',
    id: a.id,
    name: a.name,
    path: a.path!,
    description: a.description,
    seo: a.seo,
    avatar: a.avatar,
    posts: posts.filter((p) => p.author?.id === a.id),
  }));

  const [categories, tags] = await Promise.all([toArchives(rawCategories, 'category'), toArchives(rawTags, 'tag')]);

  console.log(
    `[mag] ${posts.length} مطلب، ${pages.length} برگه، ${categories.length} دسته، ${tags.length} برچسب و ${authors.length} نویسنده از ${WP_API_URL} خوانده شد.`
  );
  return { site, posts, pages, categories, tags, authors };
}

let magPromise: Promise<Magazine> | null = null;

/** محتوای کامل مجله (یک بار در هر build خوانده و بین صفحه‌ها به اشتراک گذاشته می‌شود) */
export function loadMagazine(): Promise<Magazine> {
  if (!MAG_ENABLED) throw new Error('[mag] PUBLIC_WP_API_URL تنظیم نشده است.');
  if (!magPromise) {
    magPromise = load().catch((err) => {
      throw new Error(
        `[mag] خواندن مطالب از وردپرس (${WP_API_URL}) ناموفق بود؛ build متوقف شد تا نسخه‌ای بدون مطالب مجله منتشر نشود.\n${err?.message ?? err}`
      );
    });
  }
  return magPromise;
}

/* ------------------------------------------------------------------
 * مسیرها
 * ------------------------------------------------------------------ */

export interface MagListing {
  page: number;
  totalPages: number;
  posts: MagPost[];
  /** مسیر صفحه‌ی اول همین فهرست (برای ساخت لینک صفحه‌بندی) */
  basePath: string;
}

export type MagRoute =
  | ({ kind: 'home' } & MagListing)
  | ({ kind: 'archive'; archive: MagArchive } & MagListing)
  | { kind: 'post'; post: MagPost; related: MagPost[] };

function paginate(posts: MagPost[], basePath: string): MagListing[] {
  const totalPages = Math.max(1, Math.ceil(posts.length / MAG_PER_PAGE));
  return Array.from({ length: totalPages }, (_, i) => ({
    page: i + 1,
    totalPages,
    basePath,
    posts: posts.slice(i * MAG_PER_PAGE, (i + 1) * MAG_PER_PAGE),
  }));
}

function relatedPosts(post: MagPost, all: MagPost[]): MagPost[] {
  const cats = new Set(post.categories.map((c) => c.id));
  const others = all.filter((p) => p.id !== post.id);
  return [...others.filter((p) => p.categories.some((c) => cats.has(c.id))), ...others.filter((p) => !p.categories.some((c) => cats.has(c.id)))].slice(0, 3);
}

/** همه‌ی صفحه‌های /mag؛ کلید هر مسیر نسبت به /mag است («» برای خود /mag) */
export function magRoutes(mag: Magazine): Map<string, MagRoute> {
  const routes = new Map<string, MagRoute>();
  const add = (path: string, route: MagRoute) => {
    if (routes.has(path)) {
      console.warn(`[mag] آدرس تکراری «/mag/${path}» نادیده گرفته شد.`);
      return;
    }
    routes.set(path, route);
  };

  for (const post of mag.posts) add(post.path, { kind: 'post', post, related: relatedPosts(post, mag.posts) });
  for (const page of mag.pages) add(page.path, { kind: 'post', post: page, related: [] });
  for (const archive of [...mag.categories, ...mag.tags, ...mag.authors]) {
    for (const listing of paginate(archive.posts, archive.path)) add(pagedPath(archive.path, listing.page), { kind: 'archive', archive, ...listing });
  }
  // مثل وردپرس: مطالب سنجاق‌شده (sticky) اول فهرست اصلی می‌آیند
  const homePosts = [...mag.posts.filter((p) => p.sticky), ...mag.posts.filter((p) => !p.sticky)];
  for (const listing of paginate(homePosts, '')) add(pagedPath('', listing.page), { kind: 'home', ...listing });
  return routes;
}
