import "server-only";

import ImageKit from "@imagekit/nodejs";

/**
 * Server-side ImageKit client.
 *
 * The private key never leaves the server — `server-only` makes importing this
 * from a Client Component a build error rather than a leak.
 */

let client: ImageKit | null = null;

export function imagekit(): ImageKit {
  if (client) return client;

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("IMAGEKIT_PRIVATE_KEY is not set. See .env.example");
  }
  if (!privateKey.startsWith("private_")) {
    throw new Error(
      "IMAGEKIT_PRIVATE_KEY does not start with 'private_' — the public and " +
        "private keys may be swapped in .env",
    );
  }

  client = new ImageKit({ privateKey });
  return client;
}

export function urlEndpoint(): string {
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!endpoint) {
    throw new Error("IMAGEKIT_URL_ENDPOINT is not set. See .env.example");
  }
  return endpoint.replace(/\/$/, "");
}
