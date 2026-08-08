/**
 * Restore metadata from a file written by `npm run metadata:export`.
 *
 * Matches on filePath rather than fileId, so it also works after re-uploading
 * the images to a fresh ImageKit account. Only touches files that differ.
 *
 *   npm run metadata:import -- backups/metadata-2026-08-08.json
 *   npm run metadata:import -- backups/metadata-2026-08-08.json --dry
 */
import { readFile } from "node:fs/promises";

import { PAINTINGS_FOLDER } from "../lib/schema";
import { client, listAll, log } from "./_client";

type Exported = {
  paintings: Array<{
    filePath: string;
    description?: string;
    tags?: string[];
    customMetadata?: Record<string, unknown>;
  }>;
};

function sameMetadata(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

async function main() {
  const source = process.argv[2];
  const dryRun = process.argv.includes("--dry");

  if (!source) {
    console.error(
      "Usage: npm run metadata:import -- <backup.json> [--dry]",
    );
    process.exit(1);
  }

  const backup = JSON.parse(await readFile(source, "utf8")) as Exported;
  const ik = client();
  const live = await listAll(ik, PAINTINGS_FOLDER);
  const byPath = new Map(
    live.map((f) => [String(f.filePath).toLowerCase(), f]),
  );

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const record of backup.paintings) {
    const target = byPath.get(record.filePath.toLowerCase());
    if (!target) {
      missing += 1;
      log(`  not in ImageKit: ${record.filePath}`);
      continue;
    }

    const wantMeta = record.customMetadata ?? {};
    const haveMeta = (target.customMetadata ?? {}) as Record<string, unknown>;
    const wantTags = (record.tags ?? []).slice().sort();
    const haveTags = ((target.tags ?? []) as string[]).slice().sort();

    const unchanged =
      sameMetadata(wantMeta, haveMeta) &&
      wantTags.join("|") === haveTags.join("|") &&
      (record.description ?? "") === (target.description ?? "");

    if (unchanged) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await ik.files.update(String(target.fileId), {
        customMetadata: wantMeta as Record<string, string | number | boolean>,
        tags: record.tags?.length ? record.tags : null,
        description: record.description ?? "",
      });
    }
    updated += 1;
    log(`  ${dryRun ? "would update" : "updated"} ${record.filePath}`);
  }

  log(
    `\n${updated} updated, ${skipped} already matching, ${missing} not found.`,
  );
  if (dryRun) log("Dry run — nothing was written.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
