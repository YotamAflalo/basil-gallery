import { connection } from "next/server";

import { Gallery } from "@/components/gallery";
import { getPublishedPaintings } from "@/lib/paintings";

export const metadata = { title: "Paintings" };

/**
 * Rendered per request rather than prerendered.
 *
 * The painting data underneath is still cached (see lib/paintings.ts), so
 * this costs a render, not an ImageKit round trip. Prerendering was tried
 * first and rejected: a static page is served straight off disk, so
 * invalidating the data — by tag, by path, or by expiring the entry — never
 * reached it and edits stayed invisible until cacheLife ran out. Rendering
 * each request is what makes "change it and it shows up" actually true.
 *
 * `connection()` is what forces it: `instant = false` only permits a blocking
 * render, it does not stop Next prerendering a page whose data is cacheable.
 * Cache Components then requires `instant = false` to allow the blocking
 * render, so the two go together.
 */
export const instant = false;

export default async function GalleryPage() {
  await connection();
  const paintings = await getPublishedPaintings();

  return <Gallery paintings={paintings} />;
}
