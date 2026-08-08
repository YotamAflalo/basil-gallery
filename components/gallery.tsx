"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PaintingImage } from "@/components/painting-image";
import { lqipUrl } from "@/lib/ik-url";
import type { Painting } from "@/lib/schema";
import { slug } from "@/lib/schema";

/**
 * The gallery, in the Artsy house style: white ground, black text, artworks
 * in a masonry grid at their own aspect ratio with no card, no border and no
 * shadow. All the visual weight belongs to the paintings.
 *
 * Everything is client-side once the list arrives, so filtering and opening a
 * painting are instant — no request between a tap and the image.
 */

type Filter = { kind: "all" } | { kind: "place"; value: string } | { kind: "year"; value: number };

export function Gallery({ paintings }: { paintings: Painting[] }) {
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const places = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of paintings) {
      if (p.country) counts.set(p.country, (counts.get(p.country) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [paintings]);

  const years = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of paintings) {
      if (p.year !== null) counts.set(p.year, (counts.get(p.year) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0] - a[0]);
  }, [paintings]);

  const visible = useMemo(() => {
    if (filter.kind === "all") return paintings;
    if (filter.kind === "place") {
      return paintings.filter((p) => p.country && slug(p.country) === filter.value);
    }
    return paintings.filter((p) => p.year === filter.value);
  }, [paintings, filter]);

  return (
    <div className="min-h-dvh bg-white text-black">
      <Header />

      <FilterBar
        filter={filter}
        onChange={(f) => setFilter(f)}
        total={paintings.length}
        places={places}
        years={years}
      />

      <p className="px-4 pt-5 pb-3 text-[13px] text-[#707070] tabular-nums">
        {visible.length} {visible.length === 1 ? "work" : "works"}
      </p>

      {/* CSS columns give the staggered gallery hang at native aspect ratios. */}
      <div className="columns-2 gap-x-3 px-4 pb-24 md:columns-3 lg:columns-4">
        {visible.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="mb-6 block w-full break-inside-avoid text-left"
          >
            <PaintingImage
              path={p.path}
              alt={p.title}
              width={p.width}
              height={p.height}
              sizes="(max-width: 768px) 46vw, (max-width: 1024px) 30vw, 22vw"
              priority={i < 4}
              className="w-full"
            />
            <Caption painting={p} />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Viewer
          paintings={visible}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="pad-safe-t sticky top-0 z-20 border-b border-[#E5E5E5] bg-white/95 backdrop-blur">
      <div className="flex items-baseline justify-between px-4 pt-3 pb-3">
        <h1 className="text-[15px] font-medium tracking-tight">
          Basil Andrew Swimmer
        </h1>
        <p className="text-[11px] tracking-[0.08em] text-[#707070] uppercase">
          Paintings
        </p>
      </div>
    </header>
  );
}

function FilterBar({
  filter,
  onChange,
  total,
  places,
  years,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  total: number;
  places: Array<[string, number]>;
  years: Array<[number, number]>;
}) {
  const isAll = filter.kind === "all";

  return (
    <nav
      aria-label="Filter the collection"
      className="pager-x flex gap-2 overflow-x-auto border-b border-[#E5E5E5] px-4 py-3"
    >
      <Pill active={isAll} onClick={() => onChange({ kind: "all" })}>
        All <Count>{total}</Count>
      </Pill>

      {places.map(([place, count]) => (
        <Pill
          key={place}
          active={filter.kind === "place" && filter.value === slug(place)}
          onClick={() => onChange({ kind: "place", value: slug(place) })}
        >
          {place} <Count>{count}</Count>
        </Pill>
      ))}

      {years.map(([year, count]) => (
        <Pill
          key={year}
          active={filter.kind === "year" && filter.value === year}
          onClick={() => onChange({ kind: "year", value: year })}
        >
          {year} <Count>{count}</Count>
        </Pill>
      ))}
    </nav>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] whitespace-nowrap transition-colors ${
        active
          ? "border-black bg-black text-white"
          : "border-[#E5E5E5] bg-white text-black"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] opacity-50 tabular-nums">{children}</span>;
}

/** Artsy's card metadata: italic title, roman year, then a grey detail line. */
function Caption({ painting }: { painting: Painting }) {
  const detail = [painting.place ?? painting.country, painting.technique]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="pt-2">
      <p className="text-[13px] leading-snug">
        <span className="italic">{painting.title}</span>
        {painting.year && <span>, {painting.year}</span>}
      </p>
      {detail && (
        <p className="mt-0.5 text-[13px] leading-snug text-[#707070]">{detail}</p>
      )}
    </div>
  );
}

/**
 * Fullscreen viewer. Horizontal swipe lives only in here, so it never
 * competes with the browser's edge-swipe-back on the grid.
 */
function Viewer({
  paintings,
  startIndex,
  onClose,
}: {
  paintings: Painting[];
  startIndex: number;
  onClose: () => void;
}) {
  const [emblaRef, embla] = useEmblaCarousel({
    startIndex,
    align: "center",
    containScroll: "trimSnaps",
  });
  const [index, setIndex] = useState(startIndex);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") embla?.scrollNext();
      if (e.key === "ArrowLeft") embla?.scrollPrev();
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling while the viewer is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [embla, onClose]);

  const current = paintings[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current?.title}
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      <div className="pad-safe-t flex items-center justify-between border-b border-[#E5E5E5] px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 min-w-11 items-center justify-center text-[13px]"
          aria-label="Close"
        >
          ✕
        </button>
        <p className="text-[11px] text-[#707070] tabular-nums">
          {index + 1} / {paintings.length}
        </p>
        <span className="min-h-11 min-w-11" />
      </div>

      <div className="pager-x flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {paintings.map((p) => (
            <div
              key={p.id}
              className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-4"
            >
              <div
                className="max-h-full w-full bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${lqipUrl(p.path)})`,
                  backgroundSize: "contain",
                }}
              >
                <PaintingImage
                  path={p.path}
                  alt={p.title}
                  width={p.width}
                  height={p.height}
                  sizes="100vw"
                  className="max-h-[68dvh] w-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {current && (
        <div className="pad-safe-b border-t border-[#E5E5E5] px-4 py-4">
          <p className="text-[15px] leading-snug">
            <span className="italic">{current.title}</span>
            {current.year && <span>, {current.year}</span>}
          </p>
          {(current.place ?? current.country ?? current.technique) && (
            <p className="mt-1 text-[13px] text-[#707070]">
              {[current.place ?? current.country, current.technique]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
