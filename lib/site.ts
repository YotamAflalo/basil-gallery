import type { Country } from "./schema";

/**
 * Page furniture that lives in ImageKit's /site folder rather than
 * /paintings, so the gallery never lists it.
 */
export const SITE_IMAGES = {
  portrait: "/site/dubi.jpg",
  hero: "/site/home_art.jpg",
} as const;

/**
 * The country whose works front the home page's "From the collection" strip.
 *
 * A named country rather than a slice across everything: 227 of the 258 works
 * are still untagged, so "spread across the collection" in practice meant
 * "whatever six the filename sort landed on". The Swiss paintings are a set
 * someone has been through, so they are the ones fit to be the first thing a
 * visitor sees.
 *
 * Change this to any value in COUNTRIES. If nothing published carries it, the
 * strip falls back to the whole collection rather than coming up empty — see
 * getFeaturedPaintings in lib/paintings.ts.
 */
export const FEATURED_COUNTRY: Country = "Switzerland";

/**
 * Basil's biography, carried over from the old site's index.html.
 *
 * Kept close to the family's own wording. Two things are deliberate and
 * should not be lost in an edit: Basil is **living**, so everything about him
 * is present tense, and the standing line makes that explicit — a gallery of
 * one artist's life's work reads as a memorial otherwise. The one past-tense
 * note is his daughter Aviva, of blessed memory.
 */
export const BIO = {
  name: "Basil Andrew Swimmer",
  /** The artist's-bio convention, and the clearest signal that he is alive. */
  standing: "b. 1941, South Africa — lives and works in Rishon LeZion, Israel",
  born: "Born 27 October 1941 in South Africa, Basil made Aliyah to Israel in 1977. He lives today in Rishon LeZion with his wife, Phyllis.",
  family: [
    "The son of Rebecka and Avraham Swimmer, and the middle brother of Lennie and Courine.",
    "Father to Aviva, of blessed memory, Osnat and Cherilee, and the happiest grandfather to eleven grandchildren — Moran, Ziv, Shira, Shai, Michal, Guy, Yotam, Eran, Dror, Yoav and Avner.",
  ],
  work: [
    "Basil paints and draws in oil, water colours, acrylic and chalk.",
    "His paintings are a world of nature, feelings, imaginary and thoughts. Each painting can express so many feelings and beauty.",
    "They include scenery from all over the world: South Africa, Israel, Switzerland, the Netherlands and more.",
  ],
} as const;
