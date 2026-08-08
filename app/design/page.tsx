import Link from "next/link";

export const metadata = { title: "Pick a direction · Basil Swimmer" };

const DIRECTIONS = [
  {
    slug: "salon",
    name: "Salon",
    idea: "A wall, hung the way a real one is.",
    detail:
      "Paintings at varying sizes down a deep olive gallery wall, each with a museum label underneath. Leans into having 258 works — it feels like a collection, not a feed.",
    swatches: ["#2F332E", "#EDE9E0", "#B08D57"],
  },
  {
    slug: "deck",
    name: "Deck",
    idea: "One painting at a time. The phone is the frame.",
    detail:
      "Full-bleed, swipe left and right, no chrome. The background is an enormous blur of whatever painting you are on, so the whole screen takes its colour from the work itself.",
    swatches: ["#000000", "#F5F2EC", "#6B7F6E"],
  },
  {
    slug: "atlas",
    name: "Atlas",
    idea: "The collection as the map of a life.",
    detail:
      "Place first, then year. South Africa to Israel to Switzerland, with a year rail you scrub with your thumb. Puts the two things you wanted to browse by at the centre.",
    swatches: ["#1B2430", "#E7E3D8", "#4E8C7D"],
  },
];

export default function DesignChooser() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-paper px-6 pad-safe text-ink">
      <header className="pt-14 pb-10">
        <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-50">
          Three directions
        </p>
        <h1 className="mt-3 text-3xl leading-tight font-semibold">
          Open each one on your phone, then pick.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed opacity-70">
          They differ in how you browse, not just how they look. Whichever you
          choose gets built properly; the other two get deleted.
        </p>
      </header>

      <ul className="space-y-4 pb-16">
        {DIRECTIONS.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/design/${d.slug}`}
              className="block rounded-2xl border border-black/10 bg-white p-5 transition-transform active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{d.name}</h2>
                <div className="flex gap-1" aria-hidden>
                  {d.swatches.map((c) => (
                    <span
                      key={c}
                      className="size-4 rounded-full ring-1 ring-black/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[15px] font-medium">{d.idea}</p>
              <p className="mt-2 text-sm leading-relaxed opacity-65">
                {d.detail}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
