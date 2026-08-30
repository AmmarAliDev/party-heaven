"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

import type { StorefrontDeal } from "../types";

type DealGalleryProps = {
  deal: StorefrontDeal;
};

type DealGalleryImage = {
  id: string;
  url: string;
  alt: string;
};

/**
 * Renders the deal images using the same gallery pattern as the product detail
 * page: a large main image with a thumbnail strip to switch between images.
 */
export function DealGallery({ deal }: DealGalleryProps) {
  const images: DealGalleryImage[] = deal.images.map((image, index) => ({
    id: `deal-image-${index}`,
    ...image,
  }));

  const [activeId, setActiveId] = useState<string>(images[0]?.id ?? "");
  const active = images.find((image) => image.id === activeId) ?? images[0];

  if (!active) {
    return (
      <div className="flex min-h-80 w-full items-center justify-center rounded-xl border bg-linear-to-br from-slate-100 via-slate-200 to-slate-100 text-sm font-medium uppercase tracking-[0.16em] text-slate-600">
        Deal preview
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse">
      {/* Main image */}
      <div className="relative min-h-80 flex-1 overflow-hidden rounded-xl shadow-(--shadow-soft)">
        <Image
          src={active.url}
          alt={active.alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
          loading={images[0]?.id === active.id ? "eager" : "lazy"}
          fetchPriority={images[0]?.id === active.id ? "high" : "auto"}
          data-testid={`storefront-deal-gallery-image-${active.id}`}
        />
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 ? (
        <div className="flex flex-row gap-2 sm:w-20 sm:flex-col">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveId(image.id)}
              aria-label={`View ${image.alt}`}
              aria-pressed={image.id === activeId}
              className={cn(
                "bg-muted relative aspect-square flex-1 overflow-hidden rounded-lg border-2 transition-all sm:h-20 sm:w-20 sm:flex-none",
                image.id === activeId
                  ? "border-primary ring-primary/30 ring-2"
                  : "border-border/60 hover:border-primary/50",
              )}
            >
              <Image
                src={image.url}
                alt={image.alt}
                width={80}
                height={80}
                sizes="80px"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
