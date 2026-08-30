"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

import type { CatalogProductImageTone, ProductImage } from "../types";

const toneBg: Record<CatalogProductImageTone, string> = {
  sky: "from-sky-200 via-sky-100 to-white text-sky-950",
  emerald: "from-emerald-200 via-emerald-100 to-white text-emerald-950",
  amber: "from-amber-200 via-amber-100 to-white text-amber-950",
  rose: "from-rose-200 via-rose-100 to-white text-rose-950",
  slate: "from-slate-300 via-slate-100 to-white text-slate-950",
};

type ProductImageGalleryProps = {
  images: ProductImage[];
  productName: string;
  /**
   * Active variant id (variant products only). The gallery shows the selected
   * variant's primary image and reacts when the picker changes the variant.
   */
  selectedVariantId?: string;
  /**
   * Called when a thumbnail belonging to a different variant is tapped so the
   * parent can sync the variant picker to that variant.
   */
  onSelectVariant?: (variantId: string) => void;
};

/**
 * Picks the image to show on first render.
 *
 * For variant products this prefers the selected variant's primary image
 * (falling back to the first image of that variant, then the global primary).
 * For simple products it uses the global primary image.
 */
function resolveInitialActive(
  images: ProductImage[],
  selectedVariantId: string | undefined,
): ProductImage | undefined {
  if (selectedVariantId) {
    return (
      images.find((img) => img.variantId === selectedVariantId && img.isPrimary) ??
      images.find((img) => img.variantId === selectedVariantId) ??
      images.find((img) => img.isPrimary) ??
      images[0]
    );
  }

  return images.find((img) => img.isPrimary) ?? images[0];
}

/**
 * Renders the main image and thumbnail strip for a product detail page.
 *
 * When an image has a `url`, a real `<img>` is displayed.
 * When `url` is absent (legacy placeholder mode), the coloured gradient
 * with `label` text is rendered instead.
 *
 * For variant products every thumbnail carries the variant it belongs to.
 * Tapping a thumbnail for a different variant switches the active image AND
 * notifies the parent (`onSelectVariant`) so the picker stays in sync.
 */
export function ProductImageGallery({
  images,
  productName,
  selectedVariantId,
  onSelectVariant,
}: ProductImageGalleryProps) {
  // `initialActive` is captured once at mount: it drives the above-the-fold
  // eager/high loading decision and acts as the fallback when `activeId` is
  // cleared. It must NOT be recomputed from the current `activeId` on later
  // renders or every thumbnail click would look like the initial image.
  const [initialActive] = useState<ProductImage | undefined>(() =>
    resolveInitialActive(images, selectedVariantId),
  );
  const [activeId, setActiveId] = useState<string>(initialActive?.id ?? "");
  const active = images.find((img) => img.id === activeId) ?? initialActive;
  const isInitialAboveFoldImage = Boolean(initialActive && active?.id === initialActive.id);

  // React-recommended "adjust state during render" pattern: when the selected
  // variant changes (via the picker) we show that variant's image. We skip the
  // adjustment when the active image already belongs to the new variant so a
  // thumbnail tap that selected the variant keeps showing the tapped image.
  const [lastSelectedVariantId, setLastSelectedVariantId] = useState<string | undefined>(
    selectedVariantId,
  );

  if (selectedVariantId !== lastSelectedVariantId) {
    setLastSelectedVariantId(selectedVariantId);

    const activeImage = images.find((img) => img.id === activeId);
    const alreadyShowsSelectedVariant = activeImage?.variantId === selectedVariantId;

    if (selectedVariantId && !alreadyShowsSelectedVariant) {
      const variantImage =
        images.find((img) => img.variantId === selectedVariantId && img.isPrimary) ??
        images.find((img) => img.variantId === selectedVariantId);

      if (variantImage) {
        setActiveId(variantImage.id);
      }
    }
  }

  const hasVariantImages = images.some((img) => img.variantId != null);

  if (!active) {
    return null;
  }

  function handleThumbnailSelect(image: ProductImage) {
    setActiveId(image.id);

    // Tapping a variant-specific image also selects its variant so the price,
    // SKU, and stock shown match the image on screen.
    if (image.variantId && image.variantId !== selectedVariantId && onSelectVariant) {
      onSelectVariant(image.variantId);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse">
      {/* Main image */}
      {active.url ? (
        <div className="relative min-h-80 flex-1 overflow-hidden rounded-xl shadow-(--shadow-soft)">
          <Image
            src={active.url}
            alt={active.label}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
            loading={isInitialAboveFoldImage ? "eager" : "lazy"}
            fetchPriority={isInitialAboveFoldImage ? "high" : "auto"}
          />
        </div>
      ) : (
        <div
          role="img"
          aria-label={`${productName} - ${active.label}`}
          className={cn(
            "flex min-h-80 flex-1 items-end bg-linear-to-br p-8 rounded-xl shadow-(--shadow-soft)",
            toneBg[active.tone],
          )}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] opacity-60">Product image</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{active.label}</p>
          </div>
        </div>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 ? (
        <div className="flex flex-row gap-2 sm:flex-col sm:w-20">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => handleThumbnailSelect(img)}
              aria-label={`View ${img.label}${img.variantLabel ? ` (${img.variantLabel})` : ""}`}
              aria-pressed={img.id === activeId}
              title={img.variantLabel}
              className={cn(
                "relative aspect-square flex-1 overflow-hidden sm:flex-none sm:w-20 sm:h-20 rounded-lg border-2 transition-all",
                img.url ? "bg-muted" : cn("bg-linear-to-br", toneBg[img.tone]),
                img.id === activeId
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border/60 hover:border-primary/50",
              )}
            >
              {img.url ? (
                <Image
                  src={img.url}
                  alt={img.label}
                  width={80}
                  height={80}
                  sizes="80px"
                  className="h-full w-full object-cover"
                />
              ) : null}
              {hasVariantImages && img.variantLabel ? (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-center text-[9px] font-medium leading-tight text-white">
                  {img.variantLabel}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
