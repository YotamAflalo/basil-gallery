/**
 * Page furniture that lives in ImageKit's /site folder rather than
 * /paintings, so the gallery never lists it.
 */
export const SITE_IMAGES = {
  portrait: "/site/dubi.jpg",
  hero: "/site/home_art.jpg",
} as const;

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
