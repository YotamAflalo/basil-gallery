/**
 * The painting schema — shared by the read layer, the admin UI and the
 * migration scripts, so the three can never drift.
 *
 * No `server-only` import here on purpose: scripts run outside Next and need
 * these definitions too.
 *
 * WARNING: ImageKit custom metadata field *names* are permanent. Per the API
 * docs, "even after deleting a custom metadata field, you cannot create any
 * new custom metadata field with the same name." Renaming a field means
 * picking a new name and migrating values. Labels and select options can be
 * changed freely.
 */

export const PAINTINGS_TAG = "paintings";

/** Root media-library folder holding the paintings. */
export const PAINTINGS_FOLDER = "/paintings";

export const COUNTRIES = [
  "South Africa",
  "Israel",
  "Switzerland",
  "Netherlands",
  "England",
  "France",
  "Italy",
  "Greece",
  "Other",
] as const;

export const TECHNIQUES = [
  "Oil",
  "Watercolour",
  "Acrylic",
  "Chalk",
  "Pastel",
  "Ink",
  "Pencil",
  "Mixed media",
] as const;

export type Country = (typeof COUNTRIES)[number];
export type Technique = (typeof TECHNIQUES)[number];

/**
 * Custom metadata fields to create in ImageKit.
 *
 * `description` and `tags` are deliberately absent — those are native ImageKit
 * file fields, so using them keeps the ImageKit dashboard's own search and
 * editing working.
 */
export const CUSTOM_METADATA_SCHEMA = [
  {
    name: "title",
    label: "Title",
    schema: { type: "Text" as const },
  },
  {
    name: "year",
    label: "Year painted",
    schema: { type: "Number" as const, minValue: 1940, maxValue: 2035 },
  },
  {
    name: "country",
    label: "Country",
    schema: {
      type: "SingleSelect" as const,
      selectOptions: [...COUNTRIES] as Array<string | number | boolean>,
    },
  },
  {
    name: "place",
    label: "Place",
    schema: { type: "Text" as const },
  },
  {
    name: "technique",
    label: "Technique",
    schema: {
      type: "SingleSelect" as const,
      selectOptions: [...TECHNIQUES] as Array<string | number | boolean>,
    },
  },
  {
    name: "published",
    label: "Show on the site",
    schema: { type: "Boolean" as const, defaultValue: true },
  },
  {
    name: "sortOrder",
    label: "Sort order",
    schema: { type: "Number" as const, defaultValue: 0 },
  },
  {
    name: "curated",
    label: "Checked by hand",
    schema: { type: "Boolean" as const, defaultValue: false },
  },
] as const;

export type Painting = {
  /** ImageKit fileId — the join key to Supabase favourites and likes. */
  id: string;
  /** Media-library path, e.g. "/paintings/Switzerland/bridge.jpg". */
  path: string;
  width: number;
  height: number;
  title: string;
  description: string;
  year: number | null;
  country: string | null;
  /** Free text, more specific than country, e.g. "Amsterdam Canal". */
  place: string | null;
  technique: string | null;
  tags: string[];
  published: boolean;
  sortOrder: number;
  /** True once someone has confirmed the metadata by hand in /admin. */
  curated: boolean;
};

/**
 * Placeholder values inherited from the old paintings.json. There is no point
 * showing "unsorted yet" to a visitor, so they read as "not filled in".
 */
const PLACEHOLDERS = /^(unsorted|unsorted yet|unknown|unknow|ubstract|n\/a|-)$/i;

export function cleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed || PLACEHOLDERS.test(trimmed)) return null;
  return trimmed;
}

export function cleanNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const cleaned = cleanString(v);
  if (cleaned === null) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function prettifyFilename(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Untitled"
  );
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Shape of the fields we read off an ImageKit file object. */
export type ImageKitFileLike = {
  fileId: string;
  filePath: string;
  name: string;
  width?: number | null;
  height?: number | null;
  description?: string | null;
  tags?: string[] | null;
  customMetadata?: Record<string, unknown> | null;
};

export function toPainting(file: ImageKitFileLike): Painting {
  const cm = file.customMetadata ?? {};

  return {
    id: file.fileId,
    path: file.filePath,
    width: file.width ?? 0,
    height: file.height ?? 0,
    // Fall back to a readable filename so nothing ever renders blank.
    title: cleanString(cm.title) ?? prettifyFilename(file.name),
    description: cleanString(file.description) ?? "",
    year: cleanNumber(cm.year),
    country: cleanString(cm.country),
    place: cleanString(cm.place),
    technique: cleanString(cm.technique),
    tags: file.tags ?? [],
    published: cm.published !== false,
    sortOrder: cleanNumber(cm.sortOrder) ?? 0,
    curated: cm.curated === true,
  };
}
