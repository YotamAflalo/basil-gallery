/**
 * Download every painting's metadata to a JSON file you can keep.
 *
 * ImageKit is the source of truth, so this is your off-site backup and your
 * escape hatch if you ever move to another host.
 *
 *   npm run metadata:export
 *   npm run metadata:export -- backups/before-big-edit.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PAINTINGS_FOLDER } from "../lib/schema";
import { client, listAll, log, urlEndpoint } from "./_client";

const ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  const target =
    process.argv[2] ??
    path.join(
      ROOT,
      "backups",
      `metadata-${new Date().toISOString().slice(0, 10)}.json`,
    );

  const ik = client();
  const files = await listAll(ik, PAINTINGS_FOLDER);

  const payload = {
    exportedAt: new Date().toISOString(),
    urlEndpoint: urlEndpoint(),
    folder: PAINTINGS_FOLDER,
    count: files.length,
    paintings: files
      .map((f) => ({
        fileId: f.fileId,
        filePath: f.filePath,
        name: f.name,
        url: f.url,
        width: f.width,
        height: f.height,
        description: f.description ?? "",
        tags: f.tags ?? [],
        customMetadata: f.customMetadata ?? {},
      }))
      .sort((a, b) => String(a.filePath).localeCompare(String(b.filePath))),
  };

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(payload, null, 2), "utf8");

  log(`Wrote ${payload.count} painting(s) to ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
