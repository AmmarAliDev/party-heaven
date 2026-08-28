"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FooterLink = {
  title: string;
  href: string;
};

type FooterColumnProps = {
  /** Heading shown for the column; also used to derive the accessible content id. */
  heading: string;
  /** Simple text links rendered as a list. When omitted, `children` is rendered instead. */
  links?: readonly FooterLink[];
  /** Optional node rendered after the links (e.g. a "View All" action). */
  action?: ReactNode;
  /** Custom column body for non-link content (e.g. contact details). */
  children?: ReactNode;
};

function toContentId(heading: string) {
  return `footer-${heading.trim().toLocaleLowerCase("en-US").replace(/\s+/g, "-")}-content`;
}

/**
 * A single storefront footer column. On mobile it collapses behind its heading
 * (toggled by the chevron button); from the `md` breakpoint up it always renders
 * expanded as part of the four-column footer grid.
 */
export function FooterColumn({ heading, links, action, children }: FooterColumnProps) {
  const [open, setOpen] = useState(false);
  const contentId = toContentId(heading);

  return (
    <section className="border-border/70 border-b md:border-0">
      <h2 className="flex items-center justify-between gap-2 py-4 md:py-0 md:pb-4">
        <span className="text-sm md:text-xl font-medium tracking-tight">{heading}</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={`Toggle ${heading}`}
          className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors md:hidden"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
          />
        </button>
      </h2>

      <div id={contentId} className={cn("pb-5 text-sm md:pb-0", !open && "hidden md:block")}>
        {links ? (
          <nav aria-label={`${heading} links`}>
            <ul className="space-y-2.5">
              {links.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted hover:text-muted-foreground transition-colors"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
            {action}
          </nav>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
