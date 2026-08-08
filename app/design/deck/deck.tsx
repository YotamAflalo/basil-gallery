"use client";

import useEmblaCarousel from "embla-carousel-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PaintingImage } from "@/components/painting-image";
import { lqipUrl } from "@/lib/ik-url";
import type { Painting } from "@/lib/schema";

/**
 * Direction B — Deck.
 *
 * One painting at a time, edge to edge. The signature is the backdrop: the
 * current painting's own 40px thumbnail, blown up and blurred, so the whole
 * screen takes its colour from the work and shifts as you swipe. No fixed
 * accent colour anywhere in the design.
 */
export function Deck({ paintings }: { paintings: Painting[] }) {
  const [emblaRef, embla] = useEmblaCarousel({
    align: "center",
    containScroll: "trimSnaps",
  });
  const [index, setIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const onSelect = useCallback(() => {
    if (embla) setIndex(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla, onSelect]);

  const current = paintings[index];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-black">
      {/* Ambient wash, straight off the painting on screen. */}
      {current && (
        <div
          aria-hidden
          key={current.id}
          className="pointer-events-none absolute inset-0 scale-150 opacity-45 blur-3xl transition-opacity duration-700"
          style={{
            backgroundImage: `url(${lqipUrl(current.path)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80"
      />

      <div className="relative flex min-h-dvh flex-col">
        <header className="pad-safe-t flex items-center justify-between px-5 pb-2">
          <Link
            href="/design"
            className="-ml-2 flex min-h-11 min-w-11 items-center px-2 text-sm text-[#F5F2EC]/60"
          >
            ←
          </Link>
          <p className="font-mono text-[11px] tracking-widest text-[#F5F2EC]/50 tabular-nums">
            {String(index + 1).padStart(3, "0")} / {paintings.length}
          </p>
        </header>

        {/* Horizontal swipe lives here and nowhere else, so it never fights
            the browser's edge-swipe-back gesture. */}
        <div className="pager-x flex-1 overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {paintings.map((p, i) => (
              <div
                key={p.id}
                className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center px-5"
              >
                <PaintingImage
                  path={p.path}
                  alt={p.title}
                  width={p.width}
                  height={p.height}
                  sizes="92vw"
                  priority={i < 2}
                  className="max-h-[62dvh] w-full shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]"
                />
              </div>
            ))}
          </div>
        </div>

        {current && (
          <div className="pad-safe-b px-6 pt-6 pb-4">
            <h2 className="font-[family-name:var(--deck-display)] text-2xl leading-tight text-[#F5F2EC]">
              {current.title}
            </h2>

            <p className="mt-1.5 text-[11px] tracking-[0.18em] text-[#F5F2EC]/45 uppercase">
              {[current.place ?? current.country, current.year, current.technique]
                .filter(Boolean)
                .join("  ·  ") || "Undated"}
            </p>

            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              className="mt-4 min-h-11 text-[11px] tracking-[0.2em] text-[#F5F2EC]/60 uppercase"
            >
              {detailsOpen ? "Hide" : "About this painting"}
            </button>

            {detailsOpen && (
              <p className="mt-1 max-w-prose text-[15px] leading-relaxed text-[#F5F2EC]/75">
                {current.description || "No description yet."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
