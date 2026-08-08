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

/** Transformed delivery URL. `tr` is raw ImageKit syntax, e.g. "w-800,f-auto". */
export function ikUrl(path: string, tr?: string): string {
  return url(path, tr ? [`tr=${tr}`] : []);
}

/**
 * Low-quality image placeholder — a 40px blurred version, a few hundred bytes.
 * Painted as a CSS background behind the real image so swiping never lands on
 * an empty frame.
 */
export function lqipUrl(path: string): string {
  return ikUrl(path, "w-40,bl-30,q-20,f-auto");
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
  { width, height, fit }: { width: number; height: number; fit: WallpaperFit },
): string {
  const size = `w-${Math.round(width)},h-${Math.round(height)}`;
  const tr =
    fit === "fill"
      ? `${size},fo-auto,q-90,f-jpg`
      : `${size},cm-pad_resize,bg-blurred,q-90,f-jpg`;

  // ik-attachment makes the browser save the file rather than navigate to it,
  // which is the difference between "downloaded a wallpaper" and "opened a
  // picture in a new tab".
  return url(path, [`tr=${tr}`, "ik-attachment=true"]);
}
