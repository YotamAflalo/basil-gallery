"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PaintingImage } from "@/components/painting-image";
import type { Painting } from "@/lib/schema";

export type Section = {
  key: string;
  label: string;
  sub: string;
  paintings: Painting[];
};

/**
 * Direction C — Atlas.
 *
 * The collection as the map of a life: place is the vertical axis, and the
 * rail down the right edge is the signature — a thumb-sized index you drag to
 * move between them. Once years are tagged the same rail carries decades.
 */
export function Atlas({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.key ?? "");
  const refs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.5, 1] },
    );

    for (const el of refs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-dvh bg-[#1B2430] text-[#E7E3D8]">
      <header className="pad-safe-t px-6 pt-10 pb-8">
        <Link
          href="/design"
          className="-ml-2 inline-flex min-h-11 items-center px-2 text-xs tracking-[0.2em] text-[#E7E3D8]/45 uppercase"
        >
          ← Directions
        </Link>
        <h1 className="mt-4 font-[family-name:var(--atlas-display)] text-[2.6rem] leading-[0.95] font-extrabold tracking-tight uppercase">
          Where he
          <br />
          painted
        </h1>
        <p className="mt-4 max-w-prose font-[family-name:var(--atlas-body)] text-[15px] leading-relaxed text-[#E7E3D8]/65">
          Born in South Africa in 1941, in Israel from 1977. The collection maps
          the places he went.
        </p>
      </header>

      <div className="pr-14">
        {sections.map((section) => (
          <section
            key={section.key}
            id={section.key}
            ref={(el) => {
              if (el) refs.current.set(section.key, el);
            }}
            className="scroll-mt-6 py-8"
          >
            <div className="flex items-baseline gap-3 px-6">
              <h2 className="font-[family-name:var(--atlas-display)] text-2xl font-bold tracking-tight uppercase">
                {section.label}
              </h2>
              <span className="font-mono text-xs text-[#4E8C7D]">
                {section.paintings.length}
              </span>
            </div>
            <p className="mt-1 px-6 font-[family-name:var(--atlas-body)] text-[13px] text-[#E7E3D8]/50 italic">
              {section.sub}
            </p>

            <div className="pager-x mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2">
              {section.paintings.slice(0, 14).map((p) => (
                <figure key={p.id} className="w-[62vw] shrink-0 snap-start">
                  <PaintingImage
                    path={p.path}
                    alt={p.title}
                    width={p.width}
                    height={p.height}
                    sizes="62vw"
                    fit="cover"
                    className="aspect-[4/3] w-full"
                  />
                  <figcaption className="mt-2 font-[family-name:var(--atlas-body)] text-[13px] leading-snug text-[#E7E3D8]/70">
                    {p.title}
                    {p.year && (
                      <span className="ml-2 font-mono text-[11px] text-[#4E8C7D]">
                        {p.year}
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* The rail: the signature element. */}
      <nav
        aria-label="Jump to a place"
        className="fixed top-0 right-0 flex h-dvh w-14 flex-col items-center justify-center gap-1"
      >
        {sections.map((section) => {
          const isActive = section.key === active;
          return (
            <a
              key={section.key}
              href={`#${section.key}`}
              className="flex min-h-11 w-full items-center justify-end pr-3"
              aria-current={isActive ? "true" : undefined}
            >
              <span
                className={`origin-right text-[10px] tracking-[0.15em] whitespace-nowrap uppercase transition-all duration-200 ${
                  isActive
                    ? "font-bold text-[#A4342B]"
                    : "text-[#E7E3D8]/35"
                }`}
                style={{ writingMode: "vertical-rl" }}
              >
                {section.label}
              </span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
