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

/** Phone wallpaper presets. */
export const WALLPAPER_SIZES = {
  "iphone-pro-max": { w: 1290, h: 2796, label: "iPhone Pro Max" },
  iphone: { w: 1179, h: 2556, label: "iPhone" },
  android: { w: 1440, h: 3120, label: "Android" },
  tablet: { w: 2048, h: 2732, label: "Tablet" },
} as const;

export type WallpaperSize = keyof typeof WALLPAPER_SIZES;

/**
 * Wallpaper download URL.
 *
 * `fit: "crop"` fills the screen and trims the edges of the painting;
 * `fit: "whole"` pads instead, so nothing the artist painted is cut off.
 */
export function wallpaperUrl(
  path: string,
  size: WallpaperSize,
  fit: "crop" | "whole" = "crop",
): string {
  const { w, h } = WALLPAPER_SIZES[size];
  const tr =
    fit === "crop"
      ? `w-${w},h-${h},fo-auto,q-90,f-jpg`
      : `w-${w},h-${h},cm-pad_resize,bg-blurred,q-90,f-jpg`;
  return url(path, [`tr=${tr}`, "ik-attachment=true"]);
}
