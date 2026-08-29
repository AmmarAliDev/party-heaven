import type { CarouselOptions } from "@/components/ui/carousel";

/**
 * Maximum number of items to render in any homepage category/product carousel.
 *
 * Items beyond this cap are NOT displayed in the carousel.
 * A "View All" link is shown instead so users can reach the full listing.
 *
 * Keep in sync with the service-layer fetch limits for hydrated sections.
 */
export const HOMEPAGE_CAROUSEL_MAX_ITEMS = 8;

/**
 * Responsive basis classes for homepage carousels.
 *
 * Visible item count by breakpoint:
 *  default  (< 640px)   → 1  full-width, swipeable
 *  sm       (≥ 640px)   → 2
 *  md       (≥ 768px)   → 3
 *  xl       (≥ 1280px)  → 4
 *  2xl      (≥ 1536px)  → 5  (maximum per spec)
 *
 * NOTE: Tailwind v4 important modifier is a SUFFIX (`basis-1/5!`), not the
 * v3 prefix (`!basis-1/5`) — the prefix form silently generates nothing.
 */
export const HOMEPAGE_CAROUSEL_ITEM_CLASS =
  "basis-[85%] sm:basis-1/2 md:basis-1/3 xl:basis-1/4 2xl:basis-1/5!";
/** Embla options shared across all homepage carousels. */
export const HOMEPAGE_CAROUSEL_OPTIONS: CarouselOptions = {
  align: "start",
};
