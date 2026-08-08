"use server";

import { imagekit } from "@/lib/imagekit";
import { refreshPaintings } from "@/lib/refresh";

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

  // Custom metadata is all-or-nothing per update, so send every field. An
  // empty select must be omitted entirely — ImageKit rejects "" as a
  // SingleSelect value rather than treating it as "unset".
  const customMetadata: Record<string, string | number | boolean> = {
    title: edit.title.trim(),
    place: edit.place.trim(),
    published: edit.published,
    curated: true,
  };
  if (year !== null) customMetadata.year = year;
  if (edit.country) customMetadata.country = edit.country;
  if (edit.technique) customMetadata.technique = edit.technique;

  try {
    await imagekit().files.update(edit.id, {
      customMetadata,
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
    // Read first: a bulk update must not blank the fields it is not setting.
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
