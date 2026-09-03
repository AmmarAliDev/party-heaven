"use client";

import type { ReactNode } from "react";

import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { cn } from "@/lib/utils";

type HeaderScrollHideProps = {
  children: ReactNode;
};

/**
 * Renders the sticky storefront header and smoothly slides it out of view
 * while the user scrolls down, revealing it again on upward scroll.
 */
export function HeaderScrollHide({ children }: HeaderScrollHideProps) {
  const hidden = useHideOnScroll();

  return (
    <header
      className={cn(
        "bg-background flex flex-col border-border/70 border-b sticky top-0 z-40",
        "transition-transform duration-600 ease-in-out motion-reduce:transition-none",
        hidden ? "-translate-y-full" : "translate-y-0",
      )}
    >
      {children}
    </header>
  );
}
