"use client";

import Image from "next/image";
import { useState } from "react";

import { lqipUrl } from "@/lib/ik-url";

/**
 * A painting, with its own blurred thumbnail held behind it while the full
 * image arrives. The LQIP is a few hundred bytes and already carries the
 * painting's colour, so a slide never lands on an empty frame.
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
}: {
  path: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
  className?: string;
  fit?: "contain" | "cover";
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        backgroundImage: `url(${lqipUrl(path)})`,
        backgroundSize: fit === "cover" ? "cover" : "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Image
        src={path}
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
