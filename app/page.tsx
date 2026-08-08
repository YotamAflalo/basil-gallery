import Link from "next/link";
import { connection } from "next/server";

import { PaintingImage } from "@/components/painting-image";
import { getPublishedPaintings } from "@/lib/paintings";
import { BIO, SITE_IMAGES } from "@/lib/site";

/** Per request, for the reason documented in app/gallery/page.tsx. */
export const instant = false;

export default async function Home() {
  await connection();
  const paintings = await getPublishedPaintings();
  // A handful of works to preview, spread across the collection rather than
  // taken off the top so the strip is not four versions of one subject.
  const stride = Math.max(1, Math.floor(paintings.length / 6));
  const preview = Array.from({ length: 6 }, (_, i) => paintings[i * stride]).filter(
    Boolean,
  );

  return (
    <main className="mx-auto max-w-2xl">
      {/* A painting first: the work introduces the man, not the other way round. */}
      <div className="pad-safe-t">
        <PaintingImage
          path={SITE_IMAGES.hero}
          alt="Painting by Basil Swimmer"
          width={1600}
          height={1200}
          sizes="(max-width: 672px) 100vw, 672px"
          priority
          fit="cover"
          className="aspect-[4/3] w-full"
        />
      </div>

      <header className="px-5 pt-8">
        <h1 className="text-[28px] leading-tight font-medium tracking-tight">
          {BIO.name}
        </h1>
        <p className="mt-2 text-[13px] text-[#707070]">{BIO.standing}</p>
        <p className="mt-1 text-[11px] tracking-[0.08em] text-[#707070] uppercase">
          Oil · Watercolour · Acrylic · Chalk
        </p>
      </header>

      <section className="px-5 pt-8">
        <div className="float-right mt-1 mb-4 ml-5 w-[38%] max-w-[190px]">
          <PaintingImage
            path={SITE_IMAGES.portrait}
            alt={`${BIO.name}, portrait`}
            width={600}
            height={750}
            sizes="190px"
            fit="cover"
            className="aspect-[4/5] w-full"
          />
          <p className="pt-2 text-[11px] leading-snug text-[#707070]">
            Basil, photographed at home
          </p>
        </div>

        <p className="text-[17px] leading-relaxed">{BIO.born}</p>

        {BIO.work.map((line) => (
          <p key={line} className="mt-4 text-[17px] leading-relaxed">
            {line}
          </p>
        ))}

        <div className="clear-both" />

        {BIO.family.map((line) => (
          <p key={line} className="mt-4 text-[15px] leading-relaxed text-[#707070]">
            {line}
          </p>
        ))}
      </section>

      <section className="pt-12">
        <div className="flex items-baseline justify-between px-5">
          <h2 className="text-[15px] font-medium">From the collection</h2>
          <Link href="/gallery" className="py-2 text-[13px] text-[#707070] underline">
            See all {paintings.length}
          </Link>
        </div>

        <div className="pager-x mt-4 flex gap-3 overflow-x-auto px-5 pb-2">
          {preview.map((p) => (
            <Link
              key={p.id}
              href="/gallery"
              className="w-[46%] max-w-[220px] shrink-0"
            >
              <PaintingImage
                path={p.path}
                alt={p.title}
                width={p.width}
                height={p.height}
                sizes="(max-width: 672px) 46vw, 220px"
                fit="cover"
                className="aspect-square w-full"
              />
            </Link>
          ))}
        </div>
      </section>

      <div className="pad-safe-b px-5 pt-10 pb-16">
        <Link
          href="/gallery"
          className="flex min-h-12 w-full items-center justify-center border border-black text-[15px] transition-colors active:bg-black active:text-white"
        >
          View all {paintings.length} paintings
        </Link>
      </div>
    </main>
  );
}
