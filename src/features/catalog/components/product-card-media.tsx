"use client";

import { useState } from "react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";

import { normalizeCatalogImageUrl } from "../lib/product-image-url";
import type { CatalogProductImageTone } from "../types";

const imageToneClasses: Record<CatalogProductImageTone, string> = {
  sky: "from-sky-200 via-sky-100 to-white text-sky-950",
  emerald: "from-emerald-200 via-emerald-100 to-white text-emerald-950",
  amber: "from-amber-200 via-amber-100 to-white text-amber-950",
  rose: "from-rose-200 via-rose-100 to-white text-rose-950",
  slate: "from-slate-300 via-slate-100 to-white text-slate-950",
};

type ProductCardMediaProps = {
  productName: string;
  imageUrl?: string;
  imageLabel: string;
  imageTone: CatalogProductImageTone;
  attributeSummary: string[];
  eagerImage?: boolean;
};

export function ProductCardMedia({
  productName,
  imageUrl,
  imageLabel,
  imageTone,
  attributeSummary,
  eagerImage = false,
}: ProductCardMediaProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedImageUrl = normalizeCatalogImageUrl(imageUrl);

  if (!normalizedImageUrl || imageFailed) {
    return (
      <div
        role="img"
        aria-label={`${productName} image placeholder`}
        className={`flex aspect-[4/3] items-end justify-between bg-gradient-to-br p-5 ${imageToneClasses[imageTone]}`}
      >
        <div>
          <p className="text-xs font-medium tracking-[0.24em] uppercase opacity-75">Catalog image</p>
          <p className="mt-2 text-lg font-semibold tracking-tight">{imageLabel}</p>
        </div>
        <Badge variant="secondary" className="bg-white/80 text-slate-900">
          {attributeSummary.join(" | ")}
        </Badge>
      </div>
    );
  }

  return (
    <div className="relative flex aspect-[4/3] items-end justify-end overflow-hidden bg-slate-100 p-5">
      <Image
        src={normalizedImageUrl}
        alt={`${productName} catalog image`}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover"
        loading={eagerImage ? "eager" : "lazy"}
        fetchPriority={eagerImage ? "high" : "auto"}
        onError={() => {
          setImageFailed(true);
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />

      <Badge variant="secondary" className="relative z-10 bg-white/90 text-slate-900">
        {attributeSummary.join(" | ")}
      </Badge>
    </div>
  );
}
