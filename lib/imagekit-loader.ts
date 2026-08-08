"use client";

/**
 * next/image loader that hands resizing to ImageKit.
 *
 * `src` is a media-library path such as "/Switzerland/bridge.jpg". next/image
 * calls this once per entry in the srcset, so every width the browser might
 * pick is a real ImageKit transformation rather than a downscaled original.
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
  const endpoint = (
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? ""
  ).replace(/\/$/, "");

  const path = src.startsWith("/") ? src : `/${src}`;

  // f-auto lets ImageKit negotiate AVIF/WebP per browser.
  const transformation = [`w-${width}`, `q-${quality ?? 80}`, "f-auto"].join(
    ",",
  );

  return `${endpoint}${path}?tr=${transformation}`;
}
