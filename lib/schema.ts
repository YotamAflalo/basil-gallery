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
  {
    name: "rotation",
    label: "Rotation correction",
    schema: { type: "Number" as const, minValue: 0, maxValue: 270, defaultValue: 0 },
  },
] as const;

export type Painting = {
  /** ImageKit fileId — the join key to Supabase favourites and likes. */
  id: string;
  /** Media-library path, e.g. "/paintings/Switzerland/bridge.jpg". */
  path: string;
  /**
   * Size **as delivered**, not as stored. ImageKit rotates on the way out for
   * a file whose EXIF asks for it, so for those the stored width and height
   * are the wrong way round; `rotation` transposes them again. Getting this
   * wrong leaves a portrait painting in a landscape box with air above and
   * below it.
   */
  width: number;
  height: number;
  /**
   * Degrees clockwise ImageKit already applies for us, read off the file's
   * EXIF orientation. Not editable — it is a property of the file.
   */
  exifRotation: number;
  /**
   * The correction a curator or the detector added **on top of** that, one of
   * 0, 90, 180, 270. Phone photos of paintings often carry no EXIF hint at all
   * and are simply stored sideways, which no automatic handling can fix.
   */
  rotation: number;
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

/** The only rotations that mean anything for a photograph of a painting. */
export const QUARTER_TURNS = [0, 90, 180, 270] as const;

/** Snap anything to the nearest quarter turn in [0, 360). */
export function normaliseRotation(deg: number | null | undefined): number {
  if (typeof deg !== "number" || !Number.isFinite(deg)) return 0;
  return (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
}

/**
 * ImageKit reports EXIF orientation as the human-readable string the tag
 * stands for. Only the four upright cases are listed: the mirrored ones
 * ("Mirror horizontal and rotate 90 CW" and friends) come from scanners and
 * screenshots, none are present in this collection, and treating one as a
 * plain rotation would flip the painting. They fall through to 0, which leaves
 * ImageKit's own default handling in charge.
 */
const EXIF_ROTATION: Record<string, number> = {
  "Horizontal (normal)": 0,
  "Rotate 90 CW": 90,
  "Rotate 180": 180,
  "Rotate 270 CW": 270,
};

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
  embeddedMetadata?: Record<string, unknown> | null;
};

export function toPainting(file: ImageKitFileLike): Painting {
  const cm = file.customMetadata ?? {};

  const exifRotation =
    EXIF_ROTATION[String(file.embeddedMetadata?.Orientation ?? "")] ?? 0;
  const rotation = normaliseRotation(cleanNumber(cm.rotation));
  // A quarter turn swaps the axes, so the delivered image is the transpose of
  // the stored one. ImageKit reports the stored size.
  const transposed = (exifRotation + rotation) % 180 === 90;
  const storedWidth = file.width ?? 0;
  const storedHeight = file.height ?? 0;

  return {
    id: file.fileId,
    path: file.filePath,
    width: transposed ? storedHeight : storedWidth,
    height: transposed ? storedWidth : storedHeight,
    exifRotation,
    rotation,
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
