"use client";

import { ikUrl, sizedTransform } from "@/lib/ik-url";

/**
 * next/image loader that hands resizing to ImageKit.
 *
 * `src` is a media-library path such as "/Switzerland/bridge.jpg". next/image
 * calls this once per entry in the srcset, so every width the browser might
 * pick is a real ImageKit transformation rather than a downscaled original.
 *
 * This is the app-wide default, configured in next.config.ts. It cannot see a
 * painting's rotation correction — a loader only receives src, width and
 * quality — so components/painting-image.tsx passes its own `loader` built on
 * the same helpers. Anything rendered through plain next/image lands here and
 * gets ImageKit's default EXIF handling, which is right for site furniture.
 */
export default function imagekitLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return ikUrl(src, sizedTransform(width, quality));
}
