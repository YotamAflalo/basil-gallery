import { Archivo, Source_Serif_4 } from "next/font/google";

import { getPublishedPaintings } from "@/lib/paintings";
import { slug } from "@/lib/schema";

import { Atlas, type Section } from "./atlas";

const display = Archivo({
  subsets: ["latin"],
  variable: "--atlas-display",
});

const body = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--atlas-body",
});

export const metadata = { title: "Atlas · Basil Swimmer" };

export default async function AtlasPrototype() {
  const paintings = await getPublishedPaintings();

  const byCountry = new Map<string, typeof paintings>();
  const untagged: typeof paintings = [];

  for (const p of paintings) {
    if (!p.country) {
      untagged.push(p);
      continue;
    }
    const bucket = byCountry.get(p.country) ?? [];
    bucket.push(p);
    byCountry.set(p.country, bucket);
  }

  const sections: Section[] = [...byCountry.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([country, works]) => ({
      key: slug(country),
      label: country,
      sub: describe(works),
      paintings: works,
    }));

  if (untagged.length) {
    sections.push({
      key: "untagged",
      label: "Untagged",
      // Worth stating plainly in the prototype: this direction is the one that
      // gains most from the curation pass, so judge it on the tagged sections.
      sub: `${untagged.length} works with no place recorded yet — these move into the sections above as you tag them.`,
      paintings: untagged,
    });
  }

  return (
    <div className={`${display.variable} ${body.variable}`}>
      <Atlas sections={sections} />
    </div>
  );
}

function describe(works: { year: number | null }[]): string {
  const years = works
    .map((w) => w.year)
    .filter((y): y is number => y !== null)
    .sort((a, b) => a - b);

  if (years.length === 0) return "Years not recorded yet";
  if (years[0] === years.at(-1)) return String(years[0]);
  return `${years[0]}–${years.at(-1)}`;
}
