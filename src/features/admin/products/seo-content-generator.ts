import { createSlugCandidate } from "@/features/admin/seo/schema";

type ProductSpecificationInput = {
  key: string;
  value: string;
};

type ProductSeoContentInput = {
  title: string;
  categoryName?: string | null | undefined;
  shortDescription?: string | null | undefined;
  description?: string | null | undefined;
  specifications?: ProductSpecificationInput[] | undefined;
};

type ProductFaqIdea = {
  question: string;
  shortAnswerDirection: string;
};

type ProductStructuredSpecificationSuggestion = {
  key: string;
  suggestedValue: string;
  reason: string;
};

type ProductInternalLinkSuggestion = {
  anchorText: string;
  href: string;
  reason: string;
};

export type ProductSeoContentResult = {
  titleImprovementSuggestions: string[];
  seoTitle: string;
  metaDescription: string;
  shortDescription: string;
  productHighlights: string[];
  faqIdeas: ProductFaqIdea[];
  structuredSpecificationSuggestions: ProductStructuredSpecificationSuggestion[];
  internalLinkingSuggestions: ProductInternalLinkSuggestion[];
  suggestedSlug: string;
};

const BRAND_SUFFIX = "Party Heaven Pakistan";

function collapseWhitespace(value: string | null | undefined) {
  return `${value ?? ""}`.replace(/\s+/g, " ").trim();
}

function sentenceCase(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toNaturalSnippet(value: string, maxLength: number) {
  const normalized = collapseWhitespace(value);
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxLength + 1);
  const lastSpaceIndex = sliced.lastIndexOf(" ");
  const safeSlice = lastSpaceIndex > 0 ? sliced.slice(0, lastSpaceIndex) : sliced.slice(0, maxLength);

  return `${safeSlice.trim()}...`;
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildTitleImprovementSuggestions(title: string, categoryName: string) {
  const base = sentenceCase(title);
  const options = [
    base,
    `${base} - Original Quality in Pakistan`,
    `${base} for Daily Use`,
    categoryName ? `${base} | ${categoryName}` : base,
  ];

  return dedupe(options).slice(0, 4);
}

function buildMetaDescription(input: {
  title: string;
  categoryName: string;
  shortDescription: string;
  description: string;
}) {
  const summarySource = input.shortDescription || input.description;
  const summary = toNaturalSnippet(summarySource, 90);

  return toNaturalSnippet(
    `${input.title} for Pakistan shoppers. ${summary || "Simple quality and practical value for everyday use."} Fast support, clear pricing, and smooth delivery experience in ${input.categoryName || "this category"}.`,
    158,
  ) || toNaturalSnippet(`${input.title} in Pakistan with clear value, practical quality, and reliable delivery support.`, 158);
}

function buildShortDescription(input: { title: string; shortDescription: string; description: string }) {
  const summarySource = input.shortDescription || input.description;
  const summary = toNaturalSnippet(summarySource, 95);

  return (
    summary || `${input.title} with practical quality for everyday use, simple choices, and dependable delivery in Pakistan.`
  );
}

function buildHighlights(title: string, specs: ProductSpecificationInput[]) {
  const mappedSpecs = specs
    .map((spec) => ({
      key: collapseWhitespace(spec.key),
      value: collapseWhitespace(spec.value),
    }))
    .filter((spec) => spec.key.length > 0 && spec.value.length > 0)
    .slice(0, 3)
    .map((spec) => `${spec.key}: ${spec.value}`);

  const fallback = [
    `${title} designed for practical everyday use`,
    "Simple buying decision with clear product details",
    "Reliable quality focus for Pakistan shoppers",
  ];

  return dedupe([...mappedSpecs, ...fallback]).slice(0, 5);
}

function buildFaqIdeas(title: string) {
  return [
    {
      question: `Is ${title} original and quality checked?`,
      shortAnswerDirection: "Explain sourcing confidence, quality checks, and what customers can expect on delivery.",
    },
    {
      question: `How do I choose the right ${title} option for my need?`,
      shortAnswerDirection: "Guide users using size, material, compatibility, or use-case points from product specs.",
    },
    {
      question: `Is Cash on Delivery available for ${title}?`,
      shortAnswerDirection: "Confirm COD availability by city/zone and clarify verification or call-confirm process if used.",
    },
    {
      question: `How long does delivery take in Pakistan?`,
      shortAnswerDirection: "Share realistic delivery windows for Karachi and other cities, with any holiday exceptions.",
    },
    {
      question: `What is the return policy for ${title}?`,
      shortAnswerDirection: "State return window, condition requirements, and easy support contact path.",
    },
  ];
}

function buildStructuredSpecificationSuggestions(specs: ProductSpecificationInput[]) {
  const normalizedSpecs = specs
    .map((spec) => ({
      key: collapseWhitespace(spec.key),
      value: collapseWhitespace(spec.value),
    }))
    .filter((spec) => spec.key.length > 0 && spec.value.length > 0);

  const existingKeys = new Set(normalizedSpecs.map((spec) => spec.key.toLowerCase()));
  const baselineSuggestions: ProductStructuredSpecificationSuggestion[] = [
    {
      key: "Brand",
      suggestedValue: "Party Heaven or supplier brand name",
      reason: "Improves Product schema clarity and trust signals.",
    },
    {
      key: "Model / Variant",
      suggestedValue: "Model code, color, size, or variant name",
      reason: "Helps users and search engines differentiate purchase options.",
    },
    {
      key: "Material / Build",
      suggestedValue: "Primary material or build quality note",
      reason: "Supports customer confidence and long-tail search relevance.",
    },
    {
      key: "Warranty",
      suggestedValue: "Warranty period and coverage summary",
      reason: "Important conversion detail for Pakistan buyers.",
    },
    {
      key: "In the Box",
      suggestedValue: "List included items",
      reason: "Reduces pre-purchase questions and return friction.",
    },
  ];

  const normalizedSuggestions = baselineSuggestions.filter((item) => !existingKeys.has(item.key.toLowerCase()));
  const preservedSpecs = normalizedSpecs.slice(0, 3).map((item) => ({
    key: item.key,
    suggestedValue: item.value,
    reason: "Already present and suitable for structured Product schema properties.",
  }));

  return [...preservedSpecs, ...normalizedSuggestions].slice(0, 8);
}

function buildInternalLinkingSuggestions(input: { title: string; categoryName: string; suggestedSlug: string }) {
  const categorySlug = createSlugCandidate(input.categoryName) || "categories";
  const productPath = `/categories/${categorySlug}/${input.suggestedSlug}`;

  return [
    {
      anchorText: `${input.title} price in Pakistan`,
      href: productPath,
      reason: "Targets high-intent product queries and supports direct conversion traffic.",
    },
    {
      anchorText: `${input.categoryName || "Category"} buying guide`,
      href: `/categories/${categorySlug}`,
      reason: "Connects product page to collection-level discovery and browsing journeys.",
    },
    {
      anchorText: "Delivery and return policy",
      href: "/shipping-and-returns",
      reason: "Reduces hesitation by answering logistics and trust questions before checkout.",
    },
    {
      anchorText: "How to choose the right product",
      href: "/blog",
      reason: "Supports informational intent and gives room for category-focused educational content.",
    },
  ];
}

export function generateProductSeoContent(input: ProductSeoContentInput): ProductSeoContentResult {
  const title = collapseWhitespace(input.title);
  if (!title) {
    throw new Error("Add a product title first so SEO suggestions can be generated.");
  }

  const categoryName = collapseWhitespace(input.categoryName) || "Product";
  const shortDescription = collapseWhitespace(input.shortDescription);
  const description = collapseWhitespace(input.description);
  const specifications = Array.isArray(input.specifications) ? input.specifications : [];
  const suggestedSlug = createSlugCandidate(title);

  return {
    titleImprovementSuggestions: buildTitleImprovementSuggestions(title, categoryName),
    seoTitle: toNaturalSnippet(`${title} | ${BRAND_SUFFIX}`, 68),
    metaDescription: buildMetaDescription({
      title,
      categoryName,
      shortDescription,
      description,
    }),
    shortDescription: buildShortDescription({
      title,
      shortDescription,
      description,
    }),
    productHighlights: buildHighlights(title, specifications),
    faqIdeas: buildFaqIdeas(title),
    structuredSpecificationSuggestions: buildStructuredSpecificationSuggestions(specifications),
    internalLinkingSuggestions: buildInternalLinkingSuggestions({
      title,
      categoryName,
      suggestedSlug,
    }),
    suggestedSlug,
  };
}

export type { ProductSeoContentInput, ProductFaqIdea, ProductStructuredSpecificationSuggestion, ProductInternalLinkSuggestion };
