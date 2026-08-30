"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

type WishlistToggleButtonProps = {
  productSlug: string;
  optionId?: string | undefined;
  sku: string;
  productName: string;
};

export function WishlistToggleButton({ productSlug, optionId, sku, productName }: WishlistToggleButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [pending, setPending] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const hasUserInteracted = useRef(false);

  // The PDP is statically generated, so the initial wishlist state is resolved
  // client-side after mount (via GET /api/wishlist/items) instead of reading the
  // session server-side, which would force the whole product page to be dynamic.
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
          sku &&
          payload.skus.includes(sku)
        ) {
          setWishlisted(true);
        }
      } catch {
        // Ignore network errors — the toggle simply starts un-wishlisted.
      }
    }

    void loadInitialWishlistState();

    return () => {
      cancelled = true;
    };
  }, [sku]);

  async function handleToggle() {
    if (pending) {
      return;
    }

    hasUserInteracted.current = true;
    setPending(true);

    try {
      const response = await fetch("/api/wishlist/items", {
        method: wishlisted ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productSlug,
          ...(optionId ? { optionId } : {}),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          notify.info("Sign in required", "Please sign in to save products to your wishlist.");
          router.push(`${routes.auth.signIn}?from=${encodeURIComponent(pathname || routes.storefront.wishlist)}`);
          return;
        }

        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new AppError("Wishlist request failed.", "INTERNAL_ERROR", {
          userMessage: errorPayload?.error ?? "Could not update wishlist right now. Please try again.",
        });
      }

      const nextValue = !wishlisted;
      setWishlisted(nextValue);
      notify.success(nextValue ? `${productName} saved` : `${productName} removed`, "Wishlist updated.");
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
      variant={wishlisted ? "secondary" : "outline"}
      size="lg"
      className="w-full"
      onClick={handleToggle}
      disabled={pending || !sku}
      aria-busy={pending}
      aria-pressed={wishlisted}
    >
      <Heart className={cn("size-4", wishlisted && "fill-current")} aria-hidden="true" />
      {pending ? "Updating..." : wishlisted ? "Saved to wishlist" : "Save to wishlist"}
    </Button>
  );
}