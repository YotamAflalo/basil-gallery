import { Inter } from "next/font/google";

import { Gallery } from "@/components/gallery";
import { getPublishedPaintings } from "@/lib/paintings";

/**
 * Inter stands in for Unica77, the Haas Unica revival Artsy licenses from
 * Lineto. It is the closest neo-grotesque available on Google Fonts.
 */
const inter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-sans",
});

export default async function Home() {
  const paintings = await getPublishedPaintings();

  return (
    <div className={inter.className}>
      <Gallery paintings={paintings} />
    </div>
  );
}
