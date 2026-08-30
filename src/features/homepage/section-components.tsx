import type { ComponentType } from "react";

import { AnnouncementBarSectionBlock } from "./components/announcement-bar-section";
import { DealSpotlightSectionBlock } from "./components/deal-spotlight-section";
import { FeaturedCategoriesSectionBlock } from "./components/featured-categories-section";
import { FeaturedProductsSectionBlock } from "./components/featured-products-section";
import { PartyHeavenSectionBlock } from "./components/party-heaven-section";
import type {
  AnnouncementBarSection,
  DealSpotlightSection,
  FeaturedCategoriesSection,
  FeaturedProductsSection,
  HomepageSection,
  HomepageSectionKind,
  PartyHeavenSection,
} from "./types";

type SectionComponentMap = {
  "announcement-bar": ComponentType<{ section: AnnouncementBarSection }>;
  "featured-categories": ComponentType<{ section: FeaturedCategoriesSection }>;
  "party-heaven": ComponentType<{ section: PartyHeavenSection }>;
  "featured-products": ComponentType<{ section: FeaturedProductsSection }>;
  "deal-spotlight": ComponentType<{ section: DealSpotlightSection }>;
};

export const SECTION_COMPONENTS: SectionComponentMap = {
  "announcement-bar": AnnouncementBarSectionBlock,
  "featured-categories": FeaturedCategoriesSectionBlock,
  "party-heaven": PartyHeavenSectionBlock,
  "featured-products": FeaturedProductsSectionBlock,
  "deal-spotlight": DealSpotlightSectionBlock,
};

export function renderHomepageSection(section: HomepageSection) {
  const SectionComponent = SECTION_COMPONENTS[section.kind] as
    | ComponentType<{ section: HomepageSection }>
    | undefined;

  if (!SectionComponent) {
    console.warn(`[homepage] No component registered for section kind="${section.kind}" id="${section.id}"`);
    return null;
  }

  return <SectionComponent key={section.id} section={section} />;
}

export function hasRegisteredSectionComponent(kind: HomepageSectionKind): boolean {
  return kind in SECTION_COMPONENTS;
}
