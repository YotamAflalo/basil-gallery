import { IBM_Plex_Sans, Newsreader } from "next/font/google";

import { getPublishedPaintings } from "@/lib/paintings";

import { Deck } from "./deck";

const display = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--deck-display",
});

const body = IBM_Plex_Sans({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--deck-body",
});

export const metadata = { title: "Deck · Basil Swimmer" };

export default async function DeckPrototype() {
  const paintings = (await getPublishedPaintings()).slice(0, 40);

  return (
    <div
      className={`${display.variable} ${body.variable}`}
      style={{ fontFamily: "var(--deck-body)" }}
    >
      <Deck paintings={paintings} />
    </div>
  );
}
