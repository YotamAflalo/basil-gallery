import { NextResponse } from "next/server";

import ImageKit from "@imagekit/nodejs";
import { refreshPaintings } from "@/lib/refresh";

/**
 * Refresh the gallery when the media library changes.
 *
 * The admin screen already revalidates on save, so this covers the other
 * path: someone dropping a painting straight into the ImageKit dashboard, or
 * editing metadata there. Either way the site picks it up with no deploy and
 * no restart — which is the whole point of keeping the data out of the repo.
 *
 * Point ImageKit at POST /api/webhooks/imagekit and subscribe to
 * file.created, file.updated and file.deleted.
 */

/** Events that can change what the gallery shows. */
const RELEVANT = new Set(["file.created", "file.updated", "file.deleted"]);

export async function POST(request: Request) {
  const secret = process.env.IMAGEKIT_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed: an unverified endpoint that busts caches is a free way for
    // anyone to hammer the ImageKit API on our behalf.
    return NextResponse.json(
      { error: "IMAGEKIT_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  // Signature is over the exact bytes, so read the body before parsing.
  const body = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event;
  try {
    // Verifies the Standard Webhooks signature and rejects replays.
    event = new ImageKit({ privateKey: "unused", webhookSecret: secret }).webhooks.unwrap(
      body,
      { headers, key: secret },
    );
  } catch (err) {
    console.warn("[imagekit webhook] rejected:", (err as Error).message);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (RELEVANT.has(event.type)) {
    refreshPaintings();
  }

  return NextResponse.json({ received: event.type });
}
