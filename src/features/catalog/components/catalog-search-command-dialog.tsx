"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { History, SearchX, TrendingUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { trackEvent } from "@/features/analytics";
import { formatPrice } from "@/lib/currency";

import { normalizeCatalogImageUrl } from "../lib/product-image-url";
import { POPULAR_SEARCHES, POPULAR_SEARCHES_MAX_ITEMS } from "../popular-searches";
import {
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
  removeRecentSearch,
  writeRecentSearches,
} from "../recent-searches";
import { closeSearchDialog, useSearchDialogState } from "../search-dialog-state";
import type { CatalogProductCard, CatalogSearchResponse } from "../types";

const DEBOUNCE_DELAY_MS = 280;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

/**
 * Single result row inside the search dialog: product image on the left,
 * product name with the price underneath on the right.
 */
function SearchResultItem({
  product,
  onSelect,
}: {
  product: CatalogProductCard;
  onSelect: () => void;
}) {
  const imageUrl = normalizeCatalogImageUrl(product.imageUrl);
  const [imageFailed, setImageFailed] = React.useState(false);

  return (
    <CommandItem
      value={`${product.name} ${product.slug}`}
      onSelect={onSelect}
      className="gap-3 py-2"
    >
      <span className="bg-muted relative block size-12 shrink-0 overflow-hidden rounded-md">
        {imageUrl && !imageFailed ? (
          <Image
            src={imageUrl}
            alt={`${product.name} product image`}
            fill
            sizes="48px"
            className="object-cover"
            onError={() => {
              setImageFailed(true);
            }}
          />
        ) : (
          <span className="from-muted to-background flex h-full w-full items-center justify-center bg-gradient-to-br px-1 text-center text-[10px] leading-tight font-semibold text-muted-foreground">
            {product.imageLabel}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{product.name}</span>
        <span className="text-muted-foreground text-xs">{formatPrice(product.price)}</span>
      </span>
    </CommandItem>
  );
}

/**
 * Storefront search redesigned as a shadcn command dialog instead of a separate
 * page. The dialog is mounted once in the storefront layout and opened from the
 * header (desktop + mobile) via the shared `search-dialog-state` store.
 *
 * UX contract:
 * - Empty query  → "Recent searches" + "Popular searches" quick-entry groups.
 *   Popular searches are hidden on mobile (CSS `hidden md:block`).
 * - Typed query  → live debounced results from `GET /api/catalog/search`.
 *   The recent/popular landing groups hide once the user is searching.
 * - Enter / selecting a result records the query in recent searches.
 */
export function CatalogSearchCommandDialog() {
  const router = useRouter();
  const { open } = useSearchDialogState();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<CatalogProductCard[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [resolvedQuery, setResolvedQuery] = React.useState("");
  const [retryNonce, setRetryNonce] = React.useState(0);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [recentSearchesError, setRecentSearchesError] = React.useState<string | null>(null);
  const activeRequest = React.useRef<AbortController | null>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_DELAY_MS);
  const canSearch = query.trim().length >= MIN_QUERY_LENGTH;

  // Reset transient state every time the dialog closes so reopening shows the
  // recent/popular landing groups again instead of stale results.
  React.useEffect(() => {
    if (open) {
      return;
    }

    activeRequest.current?.abort();
    setQuery("");
    setResults([]);
    setIsFetching(false);
    setErrorMessage(null);
    setResolvedQuery("");
    setRetryNonce(0);
  }, [open]);

  // Load recent searches once on mount (localStorage, gracefully degraded).
  React.useEffect(() => {
    try {
      setRecentSearches(readRecentSearches());
    } catch {
      setRecentSearchesError("Recent searches are unavailable in this browser session.");
    }
  }, []);

  const persistRecentSearches = (updater: (current: string[]) => string[]) => {
    setRecentSearches((current) => {
      const next = updater(current);

      try {
        writeRecentSearches(next);
        if (recentSearchesError) {
          setRecentSearchesError(null);
        }
      } catch {
        setRecentSearchesError("Recent searches are unavailable in this browser session.");
      }

      return next;
    });
  };

  const saveRecentQuery = (nextQuery: string) => {
    if (nextQuery.trim().length < MIN_QUERY_LENGTH) {
      return;
    }

    persistRecentSearches((current) => addRecentSearch(current, nextQuery));
  };

  // Debounced live search while the dialog is open.
  React.useEffect(() => {
    if (!open || debouncedQuery.length < MIN_QUERY_LENGTH) {
      activeRequest.current?.abort();
      setIsFetching(false);
      setResults([]);
      setErrorMessage(null);
      setResolvedQuery("");
      return;
    }

    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setIsFetching(true);
    setErrorMessage(null);

    const loadResults = async () => {
      try {
        const response = await fetch(
          `/api/catalog/search?query=${encodeURIComponent(debouncedQuery)}&limit=${MAX_RESULTS}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const payload = (await response.json()) as CatalogSearchResponse;

        setResults(payload.items);
        setResolvedQuery(debouncedQuery);

        if (payload.items.length > 0) {
          trackEvent({
            type: 'VIEW_ITEM_LIST',
            payload: {
              itemListId: 'search_results',
              itemListName: 'Search results',
              items: payload.items.map((item) => ({
                id: item.id,
                name: item.name,
                price: item.price,
                category: item.categorySlug,
                quantity: 1,
              })),
            },
          });
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setErrorMessage("Search is temporarily unavailable. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsFetching(false);
        }
      }
    };

    void loadResults();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, open, retryNonce]);

  const navigateToProduct = (href: string) => {
    closeSearchDialog();
    router.push(href);
  };

  const showLanding = !canSearch;
  const showLoading = isFetching && results.length === 0;
  const showError = Boolean(errorMessage);
  const showEmpty = !isFetching && !showError && canSearch && results.length === 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeSearchDialog();
        }
      }}
      title="Search products"
      description="Search products and collections"
      shouldFilter={false}
      className="max-w-xl top-[40%] md:top-[50%]"
    >
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Search products and collections"
        aria-label="Search products"
        onKeyDown={(event) => {
          if (event.key === "Enter" && canSearch) {
            saveRecentQuery(query);
            trackEvent({ type: 'SEARCH', payload: { searchTerm: query.trim() } });
          }
        }}
      />

      <CommandList className="max-h-[min(420px,60vh)]">
        {showLanding ? (
          <>
            {recentSearches.length > 0 ? (
              <CommandGroup heading="Recent searches">
                {recentSearches.map((term) => (
                  <CommandItem
                    key={term}
                    value={`recent:${term}`}
                    onSelect={() => {
                      setQuery(term);
                    }}
                    className="group gap-2"
                  >
                    <History className="text-muted-foreground size-4" aria-hidden="true" />
                    <span className="flex-1 truncate text-sm">{term}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${term} from recent searches`}
                      className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-sm p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        persistRecentSearches((current) => removeRecentSearch(current, term));
                      }}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </CommandItem>
                ))}

                <CommandSeparator />

                <CommandItem
                  value="recent:clear-all"
                  onSelect={() => {
                    setRecentSearches([]);

                    try {
                      clearRecentSearches();
                      if (recentSearchesError) {
                        setRecentSearchesError(null);
                      }
                    } catch {
                      setRecentSearchesError(
                        "Recent searches are unavailable in this browser session.",
                      );
                    }
                  }}
                  className="gap-2 text-muted-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                  Clear all recent searches
                </CommandItem>

                {recentSearchesError ? (
                  <p className="text-amber-700 px-3 py-2 text-xs" role="status" aria-live="polite">
                    {recentSearchesError}
                  </p>
                ) : null}
              </CommandGroup>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <p>No recent searches yet.</p>
              </div>
            )}

            {/* Popular searches are intentionally hidden on mobile to keep the
                compact mobile palette focused. */}
            <div className="hidden md:block">
              <CommandGroup heading="Popular searches">
                {POPULAR_SEARCHES.slice(0, POPULAR_SEARCHES_MAX_ITEMS).map((term) => (
                  <CommandItem
                    key={term}
                    value={`popular:${term}`}
                    onSelect={() => {
                      setQuery(term);
                    }}
                    className="gap-2"
                  >
                    <TrendingUp className="text-muted-foreground size-4" aria-hidden="true" />
                    <span className="text-sm">{term}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          </>
        ) : null}

        {!showLanding ? (
          <>
            {showLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                <InlineSpinner label="Searching products" />
              </div>
            ) : null}

            {showError ? (
              <div className="space-y-3 px-4 py-6 text-center">
                <SearchX className="text-muted-foreground mx-auto size-6" aria-hidden="true" />
                <p className="text-sm font-medium">{errorMessage}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRetryNonce((current) => current + 1);
                  }}
                >
                  Retry search
                </Button>
              </div>
            ) : null}

            {showEmpty ? (
              <div className="px-4 py-8 text-center">
                <SearchX className="text-muted-foreground mx-auto size-6" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium">No products found</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  No products matched &quot;{resolvedQuery}&quot;. Try a broader keyword.
                </p>
              </div>
            ) : null}

            {results.length > 0 ? (
              <CommandGroup heading={`Results (${results.length})`} aria-live="polite">
                {results.map((product) => (
                  <SearchResultItem
                    key={product.id}
                    product={product}
                    onSelect={() => {
                      saveRecentQuery(query);
                      trackEvent({ type: 'SEARCH', payload: { searchTerm: query.trim() } });
                      trackEvent({
                        type: 'SELECT_ITEM',
                        payload: {
                          itemListName: 'Search results',
                          product: {
                            id: product.id,
                            name: product.name,
                            price: product.price,
                            category: product.categorySlug,
                            quantity: 1,
                          },
                        },
                      });
                      navigateToProduct(product.href);
                    }}
                  />
                ))}
              </CommandGroup>
            ) : null}
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
