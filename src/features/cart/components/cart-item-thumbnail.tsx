"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { normalizeCatalogImageUrl } from "@/features/catalog/lib/product-image-url";

type CartItemThumbnailProps = {
  productName: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  href?: string;
  onClick?: () => void;
  className?: string;
};

/**
 * Small product thumbnail used in cart line items.
 * Renders a real image when a safe URL is available, otherwise a placeholder.
 * Optionally links to the product page via `href`.
 */
export function CartItemThumbnail({
  productName,
  imageUrl,
  imageAlt,
  href,
  onClick,
  className = "size-16",
}: CartItemThumbnailProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedImageUrl = normalizeCatalogImageUrl(imageUrl);

  const thumbnail =
    normalizedImageUrl && !imageFailed ? (
      <div className={`relative ${className} shrink-0 overflow-hidden rounded-md bg-slate-100`}>
        <Image
          src={normalizedImageUrl}
          alt={imageAlt?.trim() || productName}
          fill
          sizes="80px"
          className="object-cover"
          loading="lazy"
          onError={() => {
            setImageFailed(true);
          }}
        />
      </div>
    ) : (
      <div
        role="img"
        aria-label={`${productName} image placeholder`}
        className={`bg-muted flex ${className} shrink-0 items-center justify-center rounded-md`}
      >
        <span className="text-muted-foreground text-sm font-semibold tracking-tight uppercase">
          {productName.trim().charAt(0) || "?"}
        </span>
      </div>
    );

  if (href) {
    return (
      <Link
        href={href}
        className="shrink-0"
        aria-label={`View ${productName}`}
        {...(onClick ? { onClick } : {})}
      >
        {thumbnail}
      </Link>
    );
  }

  return thumbnail;
}
