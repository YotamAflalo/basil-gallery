import "dotenv/config";

import ImageKit from "@imagekit/nodejs";

/**
 * ImageKit client for the CLI scripts.
 *
 * Separate from lib/imagekit.ts because that module imports `server-only`,
 * which only resolves inside a Next.js build.
 */
export function client(): ImageKit {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("IMAGEKIT_PRIVATE_KEY is not set. See .env.example");
  }
  return new ImageKit({ privateKey });
}

export function urlEndpoint(): string {
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!endpoint) {
    throw new Error("IMAGEKIT_URL_ENDPOINT is not set. See .env.example");
  }
  return endpoint.replace(/\/$/, "");
}

/**
 * Fetch every image under a media-library folder, including subfolders.
 *
 * ImageKit's `path` parameter matches one folder level only — `/paintings`
 * returns nothing when the files live in `/paintings/Netherlands` — and
 * `filePath` is not a searchable field. So list the library and filter by
 * prefix here. One request covers the whole collection.
 */
export async function listAll(ik: ImageKit, prefix: string) {
  const pageSize = 1000;
  const wanted = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const out: Array<Record<string, unknown>> = [];

  for (let skip = 0; ; skip += pageSize) {
    const page = await ik.assets.list({
      fileType: "image",
      type: "file",
      limit: pageSize,
      skip,
      sort: "ASC_NAME",
    });
    for (const asset of page) {
      if (!("fileId" in asset) || !asset.fileId) continue;
      const filePath = String((asset as { filePath?: string }).filePath ?? "");
      if (!filePath.toLowerCase().startsWith(wanted.toLowerCase())) continue;
      out.push(asset as unknown as Record<string, unknown>);
    }
    if (page.length < pageSize) break;
  }

  return out;
}

export function log(...args: unknown[]) {
  console.log(...args);
}
