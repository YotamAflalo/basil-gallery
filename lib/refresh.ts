import "server-only";

import { invalidatePaintings } from "./paintings";

/**
 * Make a change to the collection visible on the live site.
 *
 * Called by the admin save action and by the ImageKit webhook. /gallery and /
 * render per request (see app/gallery/page.tsx), so clearing the cache is
 * enough — the next request rebuilds from ImageKit. No restart, no redeploy.
 *
 * This clears the cache in the worker that handled the write. Other workers
 * pick the change up when their own TTL lapses, which bounds the delay to ten
 * seconds. See lib/paintings.ts for the measurements behind that.
 */
export function refreshPaintings() {
  invalidatePaintings();
}
