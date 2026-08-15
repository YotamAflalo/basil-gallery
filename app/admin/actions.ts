"use server";

import { imagekit } from "@/lib/imagekit";
import { refreshPaintings } from "@/lib/refresh";
import { normaliseRotation } from "@/lib/schema";

/**
 * Writes go to ImageKit, never to this repo or to a database — that is what
 * lets the collection be corrected without a deploy, and what stops a new app
 * version from overwriting anyone's work.
 *
 * After writing, refreshPaintings() drops the read cache so the change is
 * live on the next request. See lib/paintings.ts for why the cache is
 * hand-rolled rather than Next's tag-based one.
 */

export type PaintingEdit = {
  id: string;
  title: string;
  year: string;
  country: string;
  place: string;
  technique: string;
  description: string;
  published: boolean;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function savePainting(edit: PaintingEdit): Promise<SaveResult> {
  const year = edit.year.trim() === "" ? null : Number(edit.year);
  if (year !== null && (!Number.isInteger(year) || year < 1940 || year > 2035)) {
    return { ok: false, error: "Year must be a whole number between 1940 and 2035." };
  }

  // `null` clears a field; `""` is a 400 that fails the whole save, for Text
  // as well as SingleSelect ("must be non empty string with at least one
  // non-space character"). Clearing Place is how anyone finds that out.
  //
  // Fields not named here keep their stored value — update merges. `rotation`
  // is deliberately absent for that reason: the rotate buttons own it, and a
  // save must not undo them.
  const customMetadata: Record<string, string | number | boolean | null> = {
    title: edit.title.trim() || null,
    place: edit.place.trim() || null,
    year,
    country: edit.country || null,
    technique: edit.technique || null,
    published: edit.published,
    curated: true,
  };

  try {
    await imagekit().files.update(edit.id, {
      // The SDK's generated type says string | number | boolean, but the API
      // takes null to unset and there is no other way to clear a field.
      customMetadata: customMetadata as Record<string, string | number | boolean>,
      description: edit.description.trim(),
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // Read-your-own-writes: the save and the next read share a process, so the
  // curator sees the change on their very next page load.
  refreshPaintings();
  return { ok: true };
}

/**
 * Turn a painting a quarter at a time.
 *
 * Nothing is re-encoded and no pixel is touched: the correction is a number in
 * ImageKit's metadata, applied by the CDN as an `rt-` step when the URL is
 * built (see `turn` in lib/ik-url.ts). So it is instant, it costs no storage,
 * and rotating back to 0 restores the original exactly.
 *
 * One field on its own is a safe update because custom metadata merges — the
 * title and year this action knows nothing about are left alone.
 */
export async function rotatePainting(
  id: string,
  rotation: number,
): Promise<SaveResult> {
  try {
    await imagekit().files.update(id, {
      customMetadata: { rotation: normaliseRotation(rotation) },
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  refreshPaintings();
  return { ok: true };
}

/**
 * Apply one place/year/technique to many paintings at once — the common case
 * being a batch that came from a single trip.
 */
export async function bulkApply(
  ids: string[],
  fields: { country?: string; year?: string; technique?: string; place?: string },
): Promise<SaveResult & { updated?: number }> {
  const year = fields.year?.trim() ? Number(fields.year) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1940 || year > 2035)) {
    return { ok: false, error: "Year must be a whole number between 1940 and 2035." };
  }

  const ik = imagekit();
  let updated = 0;

  for (const id of ids) {
    // Reads first and merges by hand. Custom metadata merges server-side too,
    // so this is belt and braces rather than a necessity — but a bulk write
    // over the whole collection is the wrong place to lean on that.
    let existing: Record<string, unknown>;
    try {
      const file = await ik.files.get(id);
      existing = (file.customMetadata ?? {}) as Record<string, unknown>;
    } catch (err) {
      return { ok: false, error: `Could not read ${id}: ${(err as Error).message}`, updated };
    }

    const merged: Record<string, string | number | boolean> = {
      ...(existing as Record<string, string | number | boolean>),
    };
    if (fields.country) merged.country = fields.country;
    if (fields.technique) merged.technique = fields.technique;
    if (fields.place?.trim()) merged.place = fields.place.trim();
    if (year !== null) merged.year = year;

    try {
      await ik.files.update(id, { customMetadata: merged });
      updated += 1;
    } catch (err) {
      return { ok: false, error: `Failed on ${id}: ${(err as Error).message}`, updated };
    }
  }

  refreshPaintings();
  return { ok: true, updated };
}
