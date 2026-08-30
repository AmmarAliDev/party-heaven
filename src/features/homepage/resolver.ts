import { HOMEPAGE_FALLBACK_SECTIONS } from "./fallback-content";
import type { HomepageContentResult, HomepageSection, HomepageSectionKind } from "./types";

const SECTION_RENDER_ORDER: HomepageSectionKind[] = [
  "announcement-bar",
  "party-heaven",
  "featured-categories",
  "featured-products",
  "deal-spotlight",
];

const SECTION_ORDER_INDEX: Record<HomepageSectionKind, number> = SECTION_RENDER_ORDER.reduce(
  (accumulator, kind, index) => {
    accumulator[kind] = index;
    return accumulator;
  },
  {} as Record<HomepageSectionKind, number>,
);

const OVERLAY_SECTION_KINDS: ReadonlySet<HomepageSectionKind> = new Set(["announcement-bar", "deal-spotlight"]);

const PRIMARY_SECTION_KINDS: ReadonlySet<HomepageSectionKind> = new Set(
  SECTION_RENDER_ORDER.filter((kind) => !OVERLAY_SECTION_KINDS.has(kind)),
);

function isOverlaySection(section: HomepageSection) {
  return OVERLAY_SECTION_KINDS.has(section.kind);
}

function composeSectionsWithFallback(cmsSections: HomepageSection[], enabledCmsSections: HomepageSection[]): HomepageSection[] {
  const configuredKinds = new Set(cmsSections.map((section) => section.kind));

  // Fallback sections are additive for any section kind not explicitly managed
  // in CMS. This keeps composition stable for incremental CRUD (add one
  // section at a time) without forcing operators to seed the full baseline.
  const hasCmsDealSpotlight = enabledCmsSections.some((section) => section.kind === "deal-spotlight");

  const fallbackPrimarySections = HOMEPAGE_FALLBACK_SECTIONS.filter((section) => {
    if (section.kind === "announcement-bar") {
      return false;
    }

    if (section.kind === "deal-spotlight") {
      if (configuredKinds.has("deal-spotlight") || hasCmsDealSpotlight) {
        return false;
      }

      return true;
    }

    if (PRIMARY_SECTION_KINDS.has(section.kind) && configuredKinds.has(section.kind)) {
      return false;
    }

    return true;
  });

  return [...enabledCmsSections, ...fallbackPrimarySections];
}

function sortSections(sections: HomepageSection[]): HomepageSection[] {
  return [...sections].sort((left, right) => {
    const leftOrder = left.displayOrder ?? Number.POSITIVE_INFINITY;
    const rightOrder = right.displayOrder ?? Number.POSITIVE_INFINITY;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return SECTION_ORDER_INDEX[left.kind] - SECTION_ORDER_INDEX[right.kind];
  });
}

export function resolveHomepageSections(cmsSections: HomepageSection[] | null | undefined): HomepageContentResult {
  if (!cmsSections || cmsSections.length === 0) {
    return {
      sections: sortSections(HOMEPAGE_FALLBACK_SECTIONS),
      source: "fallback",
    };
  }

  const enabledCmsSections = cmsSections.filter((section) => section.enabled !== false);

  if (enabledCmsSections.length === 0) {
    return {
      sections: sortSections(HOMEPAGE_FALLBACK_SECTIONS),
      source: "fallback",
    };
  }

  const composedSections = composeSectionsWithFallback(cmsSections, enabledCmsSections);

  return {
    sections: sortSections(composedSections),
    source: "cms",
  };
}

export { SECTION_RENDER_ORDER };
