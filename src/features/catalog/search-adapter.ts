import { routes } from "@/config/routes";
import { searchPublishedProducts } from "@/server/db/catalog-queries";

import { normalizeCatalogImageUrl } from "./lib/product-image-url";
import { tokenizeSearchQuery, tokenMatchesText } from "./lib/search-text";
import type { CatalogProductCard } from "./types";

export type CatalogSearchRequest = {
  query: string;
  limit?: number;
};

export type CatalogSearchResult = {
  query: string;
  total: number;
  items: CatalogProductCard[];
  source: "db" | "seed" | "external";
};

export interface CatalogSearchAdapter {
  searchProducts(request: CatalogSearchRequest): Promise<CatalogSearchResult>;
}

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------

/**
 * The minimal record shape the relevance scorer needs. The full Prisma search
 * rows (from `searchPublishedProducts`) are structurally compatible.
 */
type SearchCandidate = {
  name: string;
  shortDescription: string | null;
  description: string | null;
  category: { name: string } | null;
  createdAt: Date;
};

/** Weight per matched field — name and category matches beat description-only hits. */
const SEARCH_SCORE_WEIGHTS = {
  name: 100,
  category: 70,
  shortDescription: 40,
  description: 20,
} as const;

/**
 * Relevance score for a candidate: the sum of field weights over every query
 * token (each token also matches through its plural/singular variants). A
 * product whose name literally contains the query outranks one that only
 * mentions it deep inside a description — so typing "candles" surfaces candle
 * products instead of, say, balloons that happen to mention candles.
 */
function scoreSearchCandidate(candidate: SearchCandidate, tokens: string[]): number {
  let score = 0;

  for (const token of tokens) {
    if (tokenMatchesText(token, candidate.name)) {
      score += SEARCH_SCORE_WEIGHTS.name;
    }

    if (tokenMatchesText(token, candidate.category?.name)) {
      score += SEARCH_SCORE_WEIGHTS.category;
    }

    if (tokenMatchesText(token, candidate.shortDescription)) {
      score += SEARCH_SCORE_WEIGHTS.shortDescription;
    }

    if (tokenMatchesText(token, candidate.description)) {
      score += SEARCH_SCORE_WEIGHTS.description;
    }
  }

  return score;
}

/**
 * Sorts search candidates by relevance (score desc, then newest first) so the
 * final `limit` slice contains the most relevant matches rather than the most
 * recently created ones.
 */
function rankSearchCandidates<T extends SearchCandidate>(records: T[], query: string): T[] {
  const tokens = tokenizeSearchQuery(query);

  return [...records]
    .map((record) => ({ record, score: scoreSearchCandidate(record, tokens) }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.record.createdAt.getTime() - left.record.createdAt.getTime();
    })
    .map(({ record }) => record);
}

// ---------------------------------------------------------------------------
// DB-backed adapter (default for production)
// ---------------------------------------------------------------------------

/**
 * Searches PUBLISHED products in the database using a case-insensitive
 * keyword match over name, shortDescription, description, and category name.
 *
 * The query layer widens the match with tokenization + plural/singular
 * variants and returns a candidate pool; this adapter ranks the candidates by
 * relevance (name/category matches first) before slicing to `limit`.
 * For a dedicated search engine (Algolia, Typesense), replace this adapter
 * by returning a different implementation from getCatalogSearchAdapter().
 */
const dbCatalogSearchAdapter: CatalogSearchAdapter = {
  async searchProducts({ query, limit = 12 }) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return {
        query: normalizedQuery,
        total: 0,
        items: [],
        source: "db",
      };
    }

    // Fetch a candidate pool (larger than `limit`) so ranking has room to
    // promote name/category matches over description-only matches.
    const records = await searchPublishedProducts(normalizedQuery, limit);

    const topRecords = rankSearchCandidates(records, normalizedQuery).slice(0, limit);

    const items: CatalogProductCard[] = topRecords.map((record) => {
      const categorySlug = record.category?.slug ?? "";
      const defaultVariant =
        record.variants.find((v) => v.isDefault) ?? record.variants[0] ?? null;
      const price = defaultVariant?.price ?? 0;
      const compareAtRaw = defaultVariant?.compareAtPrice ?? null;
      const compareAt =
        typeof compareAtRaw === "number" && compareAtRaw > price
          ? compareAtRaw
          : undefined;
      const reviewRatings = record.reviews;
      const reviewCount = reviewRatings.length;
      const averageRating =
        reviewCount > 0
          ? Number(
              (
                reviewRatings.reduce((sum, r) => sum + r.rating, 0) / reviewCount
              ).toFixed(1),
            )
          : 0;
      const inventoryQuantity = record.variants.reduce(
        (total, v) => total + (v.inventory?.quantity ?? 0),
        0,
      );
      const primaryImage = record.images[0];
      const normalizedImageUrl = record.images
        .map((image) => normalizeCatalogImageUrl(image.url))
        .find((imageUrl): imageUrl is string => typeof imageUrl === "string");
      const imageLabel = primaryImage?.alt?.trim() || record.name;

      return {
        id: record.id,
        slug: record.slug,
        name: record.name,
        description: record.shortDescription ?? record.description ?? "",
        categorySlug,
        price,
        ...(compareAt !== undefined ? { compareAt } : {}),
        inventoryQuantity,
        averageRating,
        reviewCount,
        ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
        imageLabel,
        imageTone: "slate",
        attributeSummary: record.specifications.slice(0, 2).map((s) => s.value),
        href: routes.storefront.product(categorySlug, record.slug),
      };
    });

    return {
      query: normalizedQuery,
      total: items.length,
      items,
      source: "db",
    };
  },
};

// ---------------------------------------------------------------------------
// Adapter factory — replace this return value to swap search backends.
// ---------------------------------------------------------------------------

/**
 * Returns the active catalog search adapter.
 *
 * Default: DB-backed adapter using Prisma full-text-like search.
 * Future: swap for an Algolia/Typesense adapter without changing call sites.
 */
export function getCatalogSearchAdapter(): CatalogSearchAdapter {
  return dbCatalogSearchAdapter;
}
