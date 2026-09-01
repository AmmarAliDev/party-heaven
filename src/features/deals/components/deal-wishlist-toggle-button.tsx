"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { trackEvent } from "@/features/analytics";
import type { StorefrontDeal } from "@/features/deals/types";
import { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

type DealWishlistToggleButtonProps = {
  deal: StorefrontDeal;
};

/**
 * Wishlist toggle for a deal — saves every included product (with the deal's
 * effective variant) to the user's wishlist. Mirrors the PDP's
 * `WishlistToggleButton`, but treats the deal as saved only when ALL included
 * products are wishlisted.
 */
export function DealWishlistToggleButton({ deal }: DealWishlistToggleButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasUserInteracted = useRef(false);

  const products = useMemo(() => deal.products, [deal.products]);
  const productKey = useMemo(() => products.map((product) => product.sku ?? product.slug).join("|"), [products]);

  // The deal detail page is statically generated, so the initial wishlist state
  // is resolved client-side after mount (via GET /api/wishlist/items) instead of
  // reading the session server-side, which would force the page to be dynamic.
  useEffect(() => {
    let cancelled = false;

    async function loadInitialWishlistState() {
      try {
        const response = await fetch("/api/wishlist/items");

        if (!response.ok) {
          return; // Not signed in (401) or an error → nothing wishlisted.
        }

        const payload = (await response.json()) as { ok?: boolean; skus?: string[] };
        if (
          !cancelled &&
          !hasUserInteracted.current &&
          payload?.ok &&
          Array.isArray(payload.skus) &&
          products.length > 0
        ) {
          const wishlistedSkus = new Set(payload.skus);
          setSaved(products.every((product) => product.sku && wishlistedSkus.has(product.sku)));
        }
      } catch {
        // Ignore network errors — the toggle simply starts un-saved.
      }
    }

    void loadInitialWishlistState();

    return () => {
      cancelled = true;
    };
  }, [productKey, products]);

  function redirectToSignIn() {
    notify.info("Sign in required", "Please sign in to save deals to your wishlist.");
    router.push(`${routes.auth.signIn}?from=${encodeURIComponent(pathname || routes.storefront.wishlist)}`);
  }

  async function handleToggle() {
    if (pending || products.length === 0) {
      return;
    }

    hasUserInteracted.current = true;
    setPending(true);

    try {
      if (saved) {
        // Remove every included product from the wishlist.
        for (const product of products) {
          if (!product.sku) {
            continue;
          }

          const response = await fetch("/api/wishlist/items", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sku: product.sku }),
          });

          if (!response.ok) {
            if (response.status === 401) {
              redirectToSignIn();
              return;
            }

            const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new AppError("Wishlist request failed.", "INTERNAL_ERROR", {
              userMessage: errorPayload?.error ?? "Could not update wishlist right now. Please try again.",
            });
          }
        }

        setSaved(false);
        notify.success("Deal removed", "Wishlist updated.");
      } else {
        // Save every included product to the wishlist.
        for (const product of products) {
          if (!product.sku) {
            continue;
          }

          const response = await fetch("/api/wishlist/items", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productSlug: product.slug,
              ...(product.variantId ? { optionId: product.variantId } : {}),
            }),
          });

          if (!response.ok) {
            if (response.status === 401) {
              redirectToSignIn();
              return;
            }

            const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new AppError("Wishlist request failed.", "INTERNAL_ERROR", {
              userMessage: errorPayload?.error ?? "Could not update wishlist right now. Please try again.",
            });
          }
        }

        for (const product of products) {
          if (!product.sku) {
            continue;
          }
          trackEvent({
            type: 'ADD_TO_WISHLIST',
            payload: {
              product: {
                id: product.id,
                name: product.name,
                quantity: product.quantity,
              },
            },
          });
        }

        setSaved(true);
        notify.success("Deal saved", "All included products were added to your wishlist.");
      }

      router.refresh();
    } catch (error) {
      notify.error("Could not update wishlist", toUserMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "outline"}
      size="lg"
      className="w-full"
      onClick={handleToggle}
      disabled={pending}
      aria-busy={pending}
      aria-pressed={saved}
    >
      <Heart className={cn("size-4", saved && "fill-current")} aria-hidden="true" />
      {pending ? "Updating..." : saved ? "Saved to wishlist" : "Save to wishlist"}
    </Button>
  );
}
