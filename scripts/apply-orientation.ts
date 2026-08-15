/**
 * Step 3 of straightening the collection: write the detector's suggestions
 * into ImageKit.
 *
 *   npm run orientation:apply -- backups/orientation-2026-08-15.json --dry
 *   npm run orientation:apply -- backups/orientation-2026-08-15.json
 *
 * Nothing is re-encoded. The correction is a number in custom metadata that
 * the site turns into an `rt-` step on the delivery URL, so this is reversible
 * in full: rotate back to 0 in /admin, or re-run with a manifest of zeroes,
 * and the original file is what gets served again. The original bytes are
 * never touched either way.
 *
 * Suggestions are absolute, not deltas — `suggested.rotation` is the value to
 * store — so running this twice does the same thing as running it once.
 */
import { readFile } from "node:fs/promises";

import { normaliseRotation } from "../lib/schema";
import { client, log } from "./_client";

type Entry = {
  fileId: string;
  filePath: string;
  title: string;
  rotation: number;
  suggested: { turn: number; rotation: number; confidence: number } | null;
};

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const file = args.find((a) => !a.startsWith("--"));

  if (!file) {
    console.error(
      "Usage: npm run orientation:apply -- <manifest.json> [--dry]\n" +
        "Produce the manifest with `npm run orientation:scan`, then fill in\n" +
        "suggestions with `python scripts/detect_orientation.py <manifest>`.",
    );
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(file, "utf8")) as {
    paintings: Entry[];
  };

  const changes = manifest.paintings.filter(
    (p) =>
      p.suggested !== null &&
      normaliseRotation(p.suggested.rotation) !== normaliseRotation(p.rotation),
  );

  if (changes.length === 0) {
    log("Nothing to change. Either the detector has not run yet, or it agrees");
    log("with every rotation already stored.");
    return;
  }

  log(`${changes.length} painting(s) to straighten:\n`);
  for (const p of changes) {
    const to = normaliseRotation(p.suggested!.rotation);
    log(
      `  ${String(p.rotation).padStart(3)}° -> ${String(to).padStart(3)}°  ` +
        `(${(p.suggested!.confidence * 100).toFixed(0)}% sure)  ${p.filePath}`,
    );
  }

  if (dry) {
    log("\n--dry, so nothing was written.");
    return;
  }

  const ik = client();
  let done = 0;

  for (const p of changes) {
    // Read first: files.update replaces custom metadata wholesale, so a blind
    // write would erase every title and year in the collection.
    let existing: Record<string, string | number | boolean>;
    try {
      const current = await ik.files.get(p.fileId);
      existing = (current.customMetadata ?? {}) as Record<
        string,
        string | number | boolean
      >;
    } catch (err) {
      console.error(`\nCould not read ${p.filePath}: ${(err as Error).message}`);
      process.exit(1);
    }

    try {
      await ik.files.update(p.fileId, {
        customMetadata: {
          ...existing,
          rotation: normaliseRotation(p.suggested!.rotation),
        },
      });
      done += 1;
    } catch (err) {
      console.error(`\nFailed on ${p.filePath}: ${(err as Error).message}`);
      console.error(`${done} painting(s) were already updated.`);
      process.exit(1);
    }
  }

  log(`\nStraightened ${done} painting(s). Live within ten seconds.`);
  log("Anything the model got wrong: fix it in /admin with the rotate buttons.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
