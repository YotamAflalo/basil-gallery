import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Basil Swimmer",
  description:
    "The paintings of Basil Andrew Swimmer — a world of nature, feeling and imagination, from South Africa to Israel and beyond.",
};

export const viewport: Viewport = {
  // Lets the layout reach under the notch and home indicator; the pad-safe
  // utilities in globals.css put the padding back where it matters.
  viewportFit: "cover",
  themeColor: "#16171a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
