import "server-only";

import { imagekit } from "./imagekit";
import {
  PAINTINGS_FOLDER,
  type ImageKitFileLike,
  type Painting,
  slug,
  toPainting,
} from "./schema";

/**
 * Read layer for painting data.
 *
 * The data lives in ImageKit custom metadata, not in this repo — that is what
 * lets the family add and correct work without a deploy.
 *
 * ## The caching contract: an edit is live within TTL_MS
 *
 * Two designs were built and measured before this one.
 *
 * `use cache` + `cacheTag`, invalidated by `revalidateTag`, did not hold up:
 * after invalidation /gallery kept serving old data. Tagging the page as well
 * as the data, `{ expire: 0 }`, and `revalidatePath` all failed the same
 * end-to-end test (scripts/verify-live-update.ts).
 *
 * A hand-rolled cache with explicit invalidation on write was then flaky —
 * passing roughly one run in three. That is the giveaway: `next start` runs a
 * pool of worker processes, so the webhook and the page render usually land
 * in different ones. Vercel is the same story with more instances.
 *
 * So no in-process cache can promise instant invalidation, and this one does
 * not pretend to. What it promises is a short, bounded staleness: a 10 second
 * TTL, which at ~250ms per ImageKit list call costs at most a handful of
 * requests a minute per worker. Writes still clear the cache eagerly, which
 * makes the change immediate whenever the write and the read share a worker.
 *
 * The requirement — no restart, no redeploy, the site picks the change up on
 * its own — holds. "Instant" would need a shared cache such as Redis, which
 * is not worth a dependency at this size.
 */

const TTL_MS = 10_000;

type Entry = { paintings: Painting[]; loadedAt: number };

/**
 * Held on globalThis, not in a module variable.
 *
 * Next bundles route handlers separately from pages, so `lib/paintings.ts`
 * is instantiated more than once in the same process and a plain module-level
 * cache is not shared between them. That was measured, not assumed: the
 * webhook cleared its own copy while /gallery kept serving from another, and
 * scripts/verify-live-update.ts failed every run until the store moved here.
 */
const store = globalThis as unknown as {
  __paintings?: Entry | null;
  __paintingsInFlight?: Promise<Painting[]> | null;
};

/**
 * ImageKit's `path` parameter matches a single folder level — asking for
 * `/paintings` returns nothing when the files live in `/paintings/Netherlands`
 * — and `filePath` is not a searchable field. So list the library and filter
 * by prefix, which also keeps site furniture in `/site` out of the gallery.
 */
async function fetchAllPaintings(): Promise<Painting[]> {
  const ik = imagekit();
  const pageSize = 1000;
  const prefix = `${PAINTINGS_FOLDER}/`.toLowerCase();
  const out: Painting[] = [];

  for (let skip = 0; ; skip += pageSize) {
    const page = await ik.assets.list({
      fileType: "image",
      type: "file",
      limit: pageSize,
      skip,
      sort: "ASC_NAME",
    });

    for (const asset of page) {
      // assets.list can return folders too; only files carry a fileId.
      if (!("fileId" in asset) || !asset.fileId) continue;
      const file = asset as unknown as ImageKitFileLike;
      if (!file.filePath?.toLowerCase().startsWith(prefix)) continue;
      out.push(toPainting(file));
    }

    if (page.length < pageSize) break;
  }

  return out;
}

/** Every painting, from cache when it is warm. */
export async function getPaintings(): Promise<Painting[]> {
  const cached = store.__paintings;
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.paintings;

  // Collapse concurrent misses into one ImageKit call.
  store.__paintingsInFlight ??= fetchAllPaintings()
    .then((paintings) => {
      store.__paintings = { paintings, loadedAt: Date.now() };
      return paintings;
    })
    .finally(() => {
      store.__paintingsInFlight = null;
    });

  try {
    return await store.__paintingsInFlight;
  } catch (err) {
    // Serving yesterday's collection beats serving an error page.
    if (cached) return cached.paintings;
    throw err;
  }
}

/** Drop the cache so the next read goes back to ImageKit. */
export function invalidatePaintings() {
  store.__paintings = null;
}

export * from "./schema";

export async function getPublishedPaintings(): Promise<Painting[]> {
  const all = await getPaintings();
  return all
    .filter((p) => p.published)
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
    );
}

export async function getPainting(id: string): Promise<Painting | undefined> {
  const all = await getPaintings();
  return all.find((p) => p.id === id);
}

export type Gallery = {
  key: string;
  label: string;
  count: number;
  /** Path of a representative painting, used as the gallery's cover. */
  cover: string;
};

function groupBy(
  paintings: Painting[],
  key: (p: Painting) => string | null,
): Map<string, Painting[]> {
  const buckets = new Map<string, Painting[]>();
  for (const p of paintings) {
    const value = key(p);
    if (!value) continue;
    const bucket = buckets.get(value) ?? [];
    bucket.push(p);
    buckets.set(value, bucket);
  }
  return buckets;
}

function toGalleries(
  buckets: Map<string, Painting[]>,
  sort: (a: Gallery, b: Gallery) => number,
): Gallery[] {
  return [...buckets.entries()]
    .map(([label, works]) => ({
      key: slug(label),
      label,
      count: works.length,
      cover: works[0].path,
    }))
    .sort(sort);
}

/** Galleries by the place a painting was made — the primary way in. */
export async function getCountryGalleries(): Promise<Gallery[]> {
  const paintings = await getPublishedPaintings();
  return toGalleries(
    groupBy(paintings, (p) => p.country),
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}

export async function getYearGalleries(): Promise<Gallery[]> {
  const paintings = await getPublishedPaintings();
  return toGalleries(
    groupBy(paintings, (p) => (p.year === null ? null : String(p.year))),
    (a, b) => Number(b.label) - Number(a.label),
  );
}

/** How much of the collection still needs tagging — shown in /admin. */
export async function getCurationProgress() {
  const all = await getPaintings();
  return {
    total: all.length,
    curated: all.filter((p) => p.curated).length,
    missingCountry: all.filter((p) => !p.country).length,
    missingYear: all.filter((p) => p.year === null).length,
  };
}
