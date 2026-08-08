import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

/**
 * Inter stands in for Unica77, the Haas Unica revival Artsy licenses from
 * Lineto. It is the closest neo-grotesque on Google Fonts.
 */
const inter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Basil Andrew Swimmer",
    template: "%s · Basil Andrew Swimmer",
  },
  description:
    "The paintings of Basil Andrew Swimmer — a world of nature, feeling and imagination, from South Africa to Israel and beyond.",
};

export const viewport: Viewport = {
  // Lets the layout reach under the notch and home indicator; the pad-safe
  // utilities in globals.css put the padding back where it matters.
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-black">{children}</body>
    </html>
  );
}
