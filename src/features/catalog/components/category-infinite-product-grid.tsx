"use client";

import { useEffect, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";

import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { SectionErrorState } from "@/components/ui/section-error-state";
import { testIds } from "@/lib/test-selectors";
import type { PaginationMeta } from "@/server/db/pagination";

import { buildCategoryListingSearchParams } from "../filters";
import type { CatalogCategoryListing, CatalogProductCard } from "../types";
import { ProductGridCard } from "./product-grid-card";

type CategoryProductsPageResponse = {
  products: CatalogProductCard[];
  pagination: PaginationMeta;
};

type CategoryInfiniteProductGridProps = {
  listing: CatalogCategoryListing;
};

async function parseCategoryProductsResponse(response: Response): Promise<CategoryProductsPageResponse> {
  const payload = (await response.json()) as Partial<CategoryProductsPageResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "We could not load more products right now.");
  }

  if (!Array.isArray(payload.products) || !payload.pagination) {
    throw new Error("The product response was incomplete. Please try again.");
  }

  return {
    products: payload.products,
    pagination: payload.pagination,
  };
}

export function CategoryInfiniteProductGrid({ listing }: CategoryInfiniteProductGridProps) {
  const [products, setProducts] = useState(listing.products);
  const [pagination, setPagination] = useState(listing.pagination);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setProducts(listing.products);
    setPagination(listing.pagination);
    setIsLoadingMore(false);
    setLoadError(null);
  }, [listing]);

  const hasProducts = products.length > 0;
  const hasMorePages = pagination.hasNextPage;

  const loadMoreProducts = async () => {
    if (isLoadingMore || !hasMorePages) {
      return;
    }

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const nextPage = pagination.currentPage + 1;
      const params = buildCategoryListingSearchParams(listing.filters, { page: nextPage });
      const response = await fetch(
        `/api/catalog/categories/${encodeURIComponent(listing.category.slug)}/products?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const payload = await parseCategoryProductsResponse(response);

      setProducts((currentProducts) => [...currentProducts, ...payload.products]);
      setPagination(payload.pagination);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We could not load more products right now.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6">
      {hasProducts ? (
        <div
          className="text-muted-foreground rounded-xl border border-dashed px-4 py-3 text-sm"
          aria-live="polite"
        >
          Showing {products.length} of {listing.filteredProductCount} matching products.
          {hasMorePages ? " Scroll down to load more." : " You have reached the end of this list."}
        </div>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          title="No products match these filters"
          description="Try adjusting your filters to see more products."
          eyebrow="Empty state"
        />
      ) : (
        <InfiniteScroll
          dataLength={products.length}
          next={() => {
            void loadMoreProducts();
          }}
          hasMore={hasMorePages && !loadError}
          loader={
            <LoadingState
              title="Loading more products"
              description="Bringing in more items for this category."
              className="rounded-xl border"
            />
          }
          endMessage={
            <p className="text-muted-foreground py-4 text-center text-sm">You have reached the end of this list.</p>
          }
        >
          <ul
            className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            data-testid={testIds.storefront.productGrid}
          >
            {products.map((product, index) => (
              <li key={product.id} className="list-none">
                <ProductGridCard product={product} eagerImage={index === 0} />
              </li>
            ))}
          </ul>
        </InfiniteScroll>
      )}

      {loadError ? (
        <SectionErrorState
          title="Could not load more products"
          description={loadError}
          retryLabel="Retry"
          onRetry={() => {
            void loadMoreProducts();
          }}
        />
      ) : null}
    </div>
  );
}
