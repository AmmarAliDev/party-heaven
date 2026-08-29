import { HOMEPAGE_CAROUSEL_OPTIONS } from "./homepage-carousel-config";

/**
 * Featured categories use a denser card layout than products at large viewports.
 *
 * Keep mobile through `md` aligned with shared homepage carousel behavior,
 * hold `xl` at 4-up to preserve label readability, then step up to 5-up on `2xl`.
 *
 * NOTE: Tailwind v4 important modifier is a SUFFIX (`basis-1/4!`), not the
 * v3 prefix (`!basis-1/4`) — the prefix form silently generates nothing.
 */
export const FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS =
  "basis-[85%] sm:basis-1/2 md:basis-1/3 xl:basis-1/4! 2xl:basis-1/5!";

/** Embla options shared with other homepage carousel sections. */
export const FEATURED_CATEGORIES_CAROUSEL_OPTIONS = HOMEPAGE_CAROUSEL_OPTIONS;
