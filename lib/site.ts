/**
 * Page furniture that lives in ImageKit's /site folder rather than
 * /paintings, so the gallery never lists it.
 */
export const SITE_IMAGES = {
  portrait: "/site/dubi.jpg",
  hero: "/site/home_art.jpg",
} as const;

/**
 * Basil's biography, carried over verbatim from the old site's index.html.
 * His own words about his work; leave the phrasing alone unless the family
 * asks for a change.
 */
export const BIO = {
  name: "Basil Andrew Swimmer",
  born: "Born 27.10.1941 in South Africa, and made Aliyah to Israel in 1977.",
  family: [
    "The son of Rebecka and Avraham Swimmer, and the middle brother of Lennie and Courine.",
    "Married to Phyllis, a father to Aviva, blessed memory, Osnat and Cherilee, and is the happiest grandfather to 11 wonderful grandchildren — Moran, Ziv, Shira, Shai, Michal, Guy, Yotam, Eran, Dror, Yoav and Avner.",
  ],
  work: [
    "Basil has been painting and drawing in oil paints, water colours, acrylic and chalk.",
    "His paintings are a world of nature, feelings, imaginary and thoughts. Each painting can express so many feelings and beauty.",
    "His paintings include scenery from all over the world: South Africa, Israel, Switzerland, the Netherlands and more.",
  ],
} as const;
