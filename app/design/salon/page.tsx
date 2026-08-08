import { Instrument_Serif, Inter_Tight } from "next/font/google";
import Link from "next/link";

import { PaintingImage } from "@/components/painting-image";
import { getPublishedPaintings } from "@/lib/paintings";

const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--salon-display",
});

const body = Inter_Tight({
  subsets: ["latin"],
  variable: "--salon-body",
});

export const metadata = { title: "Salon · Basil Swimmer" };

/**
 * Direction A — Salon.
 *
 * A wall, hung the way a real salon hangs one: works at different sizes,
 * off-centre, each with a plaster label underneath. The variation is
 * deterministic (driven by index) so the server and client agree.
 */
const HANG = [
  { width: "100%", align: "center" },
  { width: "72%", align: "flex-start" },
  { width: "86%", align: "flex-end" },
  { width: "64%", align: "center" },
  { width: "92%", align: "flex-start" },
  { width: "76%", align: "flex-end" },
] as const;

export default async function SalonPrototype() {
  const paintings = (await getPublishedPaintings()).slice(0, 30);

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-dvh bg-[#2F332E]`}
      style={{ fontFamily: "var(--salon-body)" }}
    >
      <header className="pad-safe-t px-6 pt-10 pb-12 text-center">
        <p className="text-[10px] tracking-[0.35em] text-[#B08D57] uppercase">
          The collected works of
        </p>
        <h1
          className="mt-3 text-4xl text-[#EDE9E0]"
          style={{ fontFamily: "var(--salon-display)" }}
        >
          Basil Andrew Swimmer
        </h1>
        <div className="mx-auto mt-5 h-px w-16 bg-[#B08D57]/50" />
      </header>

      <div className="flex flex-col items-center gap-14 px-5 pb-24">
        {paintings.map((p, i) => {
          const hang = HANG[i % HANG.length];
          return (
            <figure
              key={p.id}
              className="flex w-full flex-col"
              style={{ alignItems: hang.align }}
            >
              <div style={{ width: hang.width }}>
                <PaintingImage
                  path={p.path}
                  alt={p.title}
                  width={p.width}
                  height={p.height}
                  sizes="(max-width: 640px) 92vw, 480px"
                  priority={i < 2}
                  className="w-full shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]"
                />

                {/* The museum label: the signature of this direction. */}
                <figcaption className="mt-3 inline-block max-w-[19rem] bg-[#EDE9E0] px-3 py-2">
                  <p
                    className="text-[15px] leading-snug text-[#14150F] italic"
                    style={{ fontFamily: "var(--salon-display)" }}
                  >
                    {p.title}
                  </p>
                  <p className="mt-1 text-[9px] tracking-[0.18em] text-[#14150F]/60 uppercase">
                    {[p.place ?? p.country, p.year, p.technique]
                      .filter(Boolean)
                      .join(" · ") || "Basil Swimmer"}
                  </p>
                </figcaption>
              </div>
            </figure>
          );
        })}
      </div>

      <footer className="pad-safe-b px-6 pb-10 text-center">
        <Link
          href="/design"
          className="inline-block min-h-11 px-4 py-3 text-xs tracking-[0.2em] text-[#EDE9E0]/60 uppercase"
        >
          ← Back to the three directions
        </Link>
      </footer>
    </div>
  );
}
