/**
 * Pure ImageKit URL builders. No SDK, no private key — safe in Client
 * Components, which is why these live apart from lib/imagekit.ts.
 */

const ENDPOINT = (process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? "").replace(
  /\/$/,
  "",
);

function url(path: string, params: string[] = []): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const query = params.length ? `?${params.join("&")}` : "";
  return `${ENDPOINT}${p}${query}`;
}

/** Everything needed to know which way up a painting should be served. */
export type Orientation = { exifRotation: number; rotation: number };

/**
 * The `rt-` step for a painting, ready to prefix a transformation chain.
 *
 * Three ImageKit behaviours, each established by asking the CDN rather than
 * the docs, decide the shape of this:
 *
 * 1. Without `rt`, ImageKit already rotates by the file's EXIF orientation.
 *    18 of the 258 works rely on that, so the safe default is to emit nothing.
 * 2. `rt-<n>` is absolute from the **stored** pixels and *overrides* EXIF
 *    rather than adding to it — hence `exifRotation + rotation`, not
 *    `rotation` on its own. Miss that and the eighteen come out sideways the
 *    moment anyone corrects one of them.
 * 3. `rt-0` is a no-op that leaves EXIF in charge; `rt-360` is how you say
 *    "no rotation, and ignore EXIF". They are not the same value.
 *
 * The trailing colon is ImageKit's chain separator: `rt-90:w-400` rotates and
 * then resizes, so the width asked for applies to the corrected image.
 */
export function turn(orientation?: Orientation): string {
  if (!orientation || orientation.rotation === 0) return "";
  const total = (orientation.exifRotation + orientation.rotation) % 360;
  return `rt-${total === 0 ? 360 : total}:`;
}

/** Transformed delivery URL. `tr` is raw ImageKit syntax, e.g. "w-800,f-auto". */
export function ikUrl(path: string, tr?: string): string {
  return url(path, tr ? [`tr=${tr}`] : []);
}

/**
 * Low-quality image placeholder — a 40px blurred version, a few hundred bytes.
 * Painted as a CSS background behind the real image so swiping never lands on
 * an empty frame.
 */
export function lqipUrl(path: string, orientation?: Orientation): string {
  return ikUrl(path, `${turn(orientation)}w-40,bl-30,q-20,f-auto`);
}

/** Common phone and tablet screens, in real pixels. */
export const WALLPAPER_PRESETS = [
  { id: "iphone-pro-max", label: "iPhone Pro Max", width: 1290, height: 2796 },
  { id: "iphone", label: "iPhone", width: 1179, height: 2556 },
  { id: "android", label: "Android", width: 1440, height: 3120 },
  { id: "ipad", label: "iPad", width: 2048, height: 2732 },
] as const;

/**
 * How the painting meets a screen that is a different shape.
 *
 * "fill"  — smart-crops to the screen. Fills it edge to edge, but trims the
 *           sides of the painting, which for a landscape work is most of it.
 * "whole" — pads instead, so nothing Basil painted is cut off. The gap is
 *           filled with a blur of the painting itself.
 */
export type WallpaperFit = "fill" | "whole";

export function wallpaperUrl(
  path: string,
  {
    width,
    height,
    fit,
    orientation,
  }: {
    width: number;
    height: number;
    fit: WallpaperFit;
    orientation?: Orientation;
  },
): string {
  const size = `w-${Math.round(width)},h-${Math.round(height)}`;
  // Rotate first: the crop and the padding have to work on the upright
  // painting, or "fill" trims the top and bottom of a sideways one.
  const tr =
    turn(orientation) +
    (fit === "fill"
      ? `${size},fo-auto,q-90,f-jpg`
      : `${size},cm-pad_resize,bg-blurred,q-90,f-jpg`);

  // ik-attachment makes the browser save the file rather than navigate to it,
  // which is the difference between "downloaded a wallpaper" and "opened a
  // picture in a new tab".
  return url(path, [`tr=${tr}`, "ik-attachment=true"]);
}

/**
 * The transformation next/image asks for, at one srcset width.
 *
 * Shared by lib/imagekit-loader.ts (the app-wide default) and by the per-image
 * loader in components/painting-image.tsx, which is the only way to get a
 * painting's rotation into a URL that next/image builds for us.
 */
export function sizedTransform(
  width: number,
  quality?: number,
  orientation?: Orientation,
): string {
  // f-auto lets ImageKit negotiate AVIF/WebP per browser.
  return `${turn(orientation)}w-${width},q-${quality ?? 80},f-auto`;
}
