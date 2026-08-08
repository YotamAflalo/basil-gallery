/**
 * One-off migration: push every image in static/images into ImageKit and seed
 * its custom metadata from the old data/paintings.json.
 *
 * Idempotent — a re-run skips anything already uploaded to the same path, so
 * it is safe to interrupt and restart.
 *
 *   npm run migrate            # upload everything
 *   npm run migrate -- --dry   # show the plan, upload nothing
 *   npm run migrate -- --limit 5
 */
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { PAINTINGS_FOLDER, cleanNumber, cleanString } from "../lib/schema";
import { client, listAll, log } from "./_client";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "static", "images");
const SEED = path.join(ROOT, "data", "paintings.json");

/**
 * Local folder -> ImageKit folder. The originals use "ubstract" (a typo for
 * abstract) and "unsorted" as if they were countries; neither is a place, so
 * they become subject folders and leave `country` empty for the admin UI to
 * fill in.
 */
const FOLDER_MAP: Record<string, { folder: string; tags: string[] }> = {
  Netherlands: { folder: "Netherlands", tags: [] },
  // ImageKit rejects spaces in folder names, so the folder is hyphenated.
  // The displayed country comes from customMetadata.country, not the folder.
  "South Africa": { folder: "South-Africa", tags: [] },
  Switzerland: { folder: "Switzerland", tags: [] },
  ubstract: { folder: "Abstract", tags: ["abstract"] },
  unsorted: { folder: "Unsorted", tags: [] },
};

const REAL_COUNTRIES = new Set([
  "Netherlands",
  "South Africa",
  "Switzerland",
  "Israel",
]);

/**
 * The seed data uses American spelling; the select list in lib/schema.ts uses
 * British. ImageKit rejects a SingleSelect value that is not in the list, so
 * normalise before upload.
 */
const TECHNIQUE_ALIASES: Record<string, string> = {
  watercolor: "Watercolour",
  watercolour: "Watercolour",
  "water colour": "Watercolour",
  oil: "Oil",
  acrylic: "Acrylic",
  chalk: "Chalk",
  pastel: "Pastel",
  ink: "Ink",
  pencil: "Pencil",
};

/**
 * Two files sit at the root of static/images and are page furniture rather
 * than paintings: dubi.jpg is Basil's portrait and home_art.jpg the homepage
 * hero. They go outside the paintings folder so the gallery never lists them.
 */
const SITE_ASSETS_FOLDER = "/site";

/**
 * ImageKit rewrites anything outside [A-Za-z0-9.-_] to an underscore, so
 * "WhatsApp Image 21.20.21 (1).jpeg" lands as
 * "WhatsApp_Image_21.20.21__1_.jpeg". Mirror that here or the "already
 * uploaded?" check never matches and every re-run tries the whole library
 * again.
 */
function sanitiseFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9.\-_]/g, "_");
}

type SeedRecord = {
  title?: string;
  image_path?: string;
  year?: string;
  country?: string;
  location?: string;
  current_location?: string;
  technique?: string;
  description?: string;
};

async function loadSeed(): Promise<Map<string, SeedRecord>> {
  const raw = JSON.parse(await readFile(SEED, "utf8")) as Record<
    string,
    SeedRecord
  >;
  const byFilename = new Map<string, SeedRecord>();

  for (const record of Object.values(raw)) {
    if (!record.image_path) continue;
    byFilename.set(path.basename(record.image_path), record);
  }

  return byFilename;
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|tiff?)$/i;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry");
  const limitArg = args.indexOf("--limit");
  const limit = limitArg === -1 ? Infinity : Number(args[limitArg + 1]);

  const ik = client();
  const seed = await loadSeed();

  log("Reading what is already in ImageKit…");
  const existing = [
    ...(await listAll(ik, PAINTINGS_FOLDER)),
    ...(await listAll(ik, SITE_ASSETS_FOLDER)),
  ];
  const alreadyThere = new Set(
    existing.map((f) => String(f.filePath).toLowerCase()),
  );
  log(`  ${alreadyThere.size} file(s) already uploaded\n`);

  const jobs: Array<{
    local: string;
    fileName: string;
    folder: string;
    targetPath: string;
    tags: string[];
    description: string;
    customMetadata: Record<string, string | number | boolean>;
  }> = [];

  for await (const local of walk(SOURCE)) {
    if (!IMAGE_EXT.test(local)) continue;

    const relative = path.relative(SOURCE, local);
    const parts = relative.split(path.sep);
    const sourceFolder = parts.length > 1 ? parts[0] : "";
    // The seed is keyed by the original name; ImageKit stores the sanitised one.
    const originalName = path.basename(local);
    const fileName = sanitiseFileName(originalName);

    const isSiteAsset = sourceFolder === "";
    const mapped = FOLDER_MAP[sourceFolder] ?? {
      folder: sourceFolder || "Unsorted",
      tags: [],
    };
    const folder = isSiteAsset
      ? SITE_ASSETS_FOLDER
      : `${PAINTINGS_FOLDER}/${mapped.folder}`;
    const targetPath = `${folder}/${fileName}`;

    if (alreadyThere.has(targetPath.toLowerCase())) continue;

    const record = seed.get(originalName);
    const country = cleanString(record?.country);
    const customMetadata: Record<string, string | number | boolean> = {
      published: true,
      curated: false,
      sortOrder: 0,
    };

    const title = cleanString(record?.title);
    if (title) customMetadata.title = title;

    const year = cleanNumber(record?.year);
    if (year !== null && year >= 1940 && year <= 2035) {
      customMetadata.year = year;
    }

    if (country && REAL_COUNTRIES.has(country)) customMetadata.country = country;

    const place = cleanString(record?.location);
    if (place) customMetadata.place = place;

    const technique = cleanString(record?.technique);
    const normalisedTechnique = technique
      ? TECHNIQUE_ALIASES[technique.toLowerCase()]
      : undefined;
    if (normalisedTechnique) customMetadata.technique = normalisedTechnique;
    else if (technique) {
      log(`  note: unrecognised technique "${technique}" on ${originalName}`);
    }

    jobs.push({
      local,
      fileName,
      folder,
      targetPath,
      tags: mapped.tags,
      // The old descriptions are BLIP captions ("a painting of a waterfall").
      // Worth keeping as a starting draft for whoever curates it.
      description: cleanString(record?.description) ?? "",
      customMetadata,
    });

    if (jobs.length >= limit) break;
  }

  log(`${jobs.length} file(s) to upload.`);
  if (jobs.length === 0) {
    log("Nothing to do.");
    return;
  }

  const totalBytes = (
    await Promise.all(jobs.map((j) => stat(j.local).then((s) => s.size)))
  ).reduce((a, b) => a + b, 0);
  log(`${(totalBytes / 1024 / 1024).toFixed(0)} MB total\n`);

  if (dryRun) {
    for (const job of jobs.slice(0, 20)) {
      log(`  would upload ${job.targetPath}`, job.customMetadata);
    }
    if (jobs.length > 20) log(`  … and ${jobs.length - 20} more`);
    return;
  }

  let done = 0;
  let failed = 0;
  const CONCURRENCY = 4;

  async function worker() {
    for (;;) {
      const job = jobs.shift();
      if (!job) return;

      try {
        await ik.files.upload({
          file: createReadStream(job.local),
          fileName: job.fileName,
          folder: job.folder,
          // Keep the original filename so re-runs can detect duplicates and
          // the ImageKit path stays predictable.
          useUniqueFileName: false,
          overwriteFile: false,
          tags: job.tags.length ? job.tags : undefined,
          description: job.description || undefined,
          customMetadata: job.customMetadata,
        });
        done += 1;
      } catch (err) {
        failed += 1;
        console.error(`  FAILED ${job.targetPath}:`, (err as Error).message);
      }

      if ((done + failed) % 10 === 0) {
        log(`  ${done} uploaded, ${failed} failed, ${jobs.length} left`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  log(`\nDone. ${done} uploaded, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
