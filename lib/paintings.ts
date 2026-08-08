import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { imagekit } from "./imagekit";
import {
  PAINTINGS_FOLDER,
  PAINTINGS_TAG,
  type ImageKitFileLike,
  type Painting,
  slug,
  toPainting,
} from "./schema";

/**
 * Read layer for painting data.
 *
 * The data lives in ImageKit custom metadata, not in this repo — that is what
 * lets the family add and correct work without a deploy. Reads are cached
 * under the `paintings` tag and invalidated by the admin save action
 * (updateTag) and by ImageKit's file.created / file.updated webhook
 * (revalidateTag).
 */

export * from "./schema";

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

/**
 * Every painting, cached until something invalidates the `paintings` tag.
 *
 * 258 works is small enough that filtering by place and year happens in
 * memory — no per-request API calls, so moving between galleries is instant.
 */
export async function getPaintings(): Promise<Painting[]> {
  "use cache";
  cacheTag(PAINTINGS_TAG);
  // Explicit invalidation is the primary path; this is the safety net for a
  // webhook that never arrives.
  cacheLife("hours");

  return fetchAllPaintings();
}

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

export async function getPaintingsByCountry(
  countrySlug: string,
): Promise<Painting[]> {
  const paintings = await getPublishedPaintings();
  return paintings.filter((p) => p.country && slug(p.country) === countrySlug);
}

export async function getPaintingsByYear(year: number): Promise<Painting[]> {
  const paintings = await getPublishedPaintings();
  return paintings.filter((p) => p.year === year);
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
