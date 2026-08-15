"use client";

import Image from "next/image";
import { useState } from "react";

import { ikUrl, lqipUrl, sizedTransform, type Orientation } from "@/lib/ik-url";

/**
 * A painting, with its own blurred thumbnail held behind it while the full
 * image arrives. The LQIP is a few hundred bytes and already carries the
 * painting's colour, so a slide never lands on an empty frame.
 *
 * Pass `orientation` for anything out of the collection — a `Painting` has the
 * two fields it needs, so `orientation={painting}` is the call. Leaving it off
 * gives ImageKit's default handling, which is what site furniture wants.
 */
export function PaintingImage({
  path,
  alt,
  width,
  height,
  sizes,
  priority = false,
  className = "",
  fit = "contain",
  orientation,
}: {
  path: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
  className?: string;
  fit?: "contain" | "cover";
  orientation?: Orientation;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        backgroundImage: `url(${lqipUrl(path, orientation)})`,
        backgroundSize: fit === "cover" ? "cover" : "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Image
        src={path}
        // The app-wide loader in next.config.ts only receives src, width and
        // quality, and rotation is none of those. A per-image loader is the
        // supported way to get it in; it is the same builder underneath.
        loader={({ src, width: w, quality }) =>
          ikUrl(src, sizedTransform(w, quality, orientation))
        }
        alt={alt}
        width={width || 1200}
        height={height || 1600}
        sizes={sizes}
        priority={priority}
        onLoad={() => setLoaded(true)}
        className={`h-full w-full transition-opacity duration-500 ${
          fit === "cover" ? "object-cover" : "object-contain"
        } ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
