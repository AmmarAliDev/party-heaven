"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

import { openSearchDialog } from "../search-dialog-state";

type SearchDialogTriggerProps = {
  /**
   * "desktop" renders a labeled button; "mobile" renders an icon-only button.
   * Both open the same shared search dialog so the search bar is consistent
   * across breakpoints.
   */
  mode: "desktop" | "mobile";
};

/**
 * Header trigger for the storefront search command dialog.
 *
 * Rendered in the server-rendered header (desktop + mobile slots); clicking
 * opens the single mounted `CatalogSearchCommandDialog` via the shared
 * `search-dialog-state` store.
 */
export function SearchDialogTrigger({ mode }: SearchDialogTriggerProps) {
  if (mode === "mobile") {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={openSearchDialog}
        aria-haspopup="dialog"
        aria-label="Search"
      >
        <Search className="size-4" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={openSearchDialog}
      aria-haspopup="dialog"
      aria-label="Open search"
    >
      <Search className="size-4" aria-hidden="true" />
      Search
    </Button>
  );
}
