import { connection } from "next/server";

import { getPaintings } from "@/lib/paintings";

import { Curator } from "./curator";

export const metadata = { title: "Curate" };

/** Always current — a curator must never be handed a stale queue. */
export const instant = false;

export default async function AdminPage() {
  await connection();

  // Unpublished works are included here on purpose — the point of this screen
  // is to see everything, including what is hidden from visitors.
  const paintings = await getPaintings();

  return <Curator paintings={paintings} />;
}
