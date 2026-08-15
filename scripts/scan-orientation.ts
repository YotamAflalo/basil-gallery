/**
 * Step 1 of straightening the collection: write down what the site currently
 * shows, so a model can be asked which of it is sideways.
 *
 *   npm run orientation:scan
 *   npm run orientation:scan -- backups/orientation.json
 *
 * The output is a manifest of every painting with a small preview URL. That
 * URL carries the rotation the site is applying *today* — EXIF and any
 * correction already saved — so whatever the detector proposes is a turn on
 * top of what a visitor sees, not on top of the stored pixels. Get that wrong
 * and every already-corrected painting gets corrected a second time.
 *
 * Next: scripts/detect_orientation.py, then npm run orientation:apply.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { turn } from "../lib/ik-url";
import {
  PAINTINGS_FOLDER,
  type ImageKitFileLike,
  toPainting,
} from "../lib/schema";
import { client, listAll, log, urlEndpoint } from "./_client";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Big enough for a vision model, small enough to be kind to the bandwidth cap. */
const PREVIEW_WIDTH = 384;

async function main() {
  const target =
    process.argv[2] ??
    path.join(
      ROOT,
      "backups",
      `orientation-${new Date().toISOString().slice(0, 10)}.json`,
    );

  const ik = client();
  const endpoint = urlEndpoint();
  const files = await listAll(ik, PAINTINGS_FOLDER);

  const paintings = files
    .map((f) => {
      const p = toPainting(f as unknown as ImageKitFileLike);
      const tr = `${turn(p)}w-${PREVIEW_WIDTH},f-jpg`;
      return {
        fileId: p.id,
        filePath: p.path,
        title: p.title,
        width: p.width,
        height: p.height,
        exifRotation: p.exifRotation,
        rotation: p.rotation,
        /** Whether a human has been through this one — the detector's selftest
         *  needs works whose orientation is known, and this is the only record
         *  of that. */
        curated: p.curated,
        previewUrl: `${endpoint}${p.path}?tr=${tr}`,
        /** Filled in by scripts/detect_orientation.py. */
        suggested: null as null | Record<string, number>,
      };
    })
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  const payload = {
    scannedAt: new Date().toISOString(),
    urlEndpoint: endpoint,
    previewWidth: PREVIEW_WIDTH,
    count: paintings.length,
    paintings,
  };

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(payload, null, 2), "utf8");

  const corrected = paintings.filter((p) => p.rotation !== 0).length;
  log(`Wrote ${payload.count} painting(s) to ${target}`);
  log(`${corrected} already carry a rotation correction.`);
  log(`\nNext:  python scripts/detect_orientation.py ${path.relative(ROOT, target)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
