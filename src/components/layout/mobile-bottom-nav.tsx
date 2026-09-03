"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, ShoppingCart, User } from "lucide-react";
import type { ReactNode } from "react";

import { routes } from "@/config/routes";
import { useCartCountState } from "@/features/cart/cart-count-state";
import { openCartDrawer } from "@/features/cart/cart-drawer-state";
import { openSearchDialog } from "@/features/catalog/search-dialog-state";
import { cn } from "@/lib/utils";

/**
 * Shared touch target + label styling for every bottom nav item.
 * Icons sit on top, labels sit underneath (icon-above-label layout).
 */
const BOTTOM_NAV_ITEM_CLASS =
  "flex min-h-16 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium " +
  "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground " +
  "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2";

type BottomNavLinkProps = {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
};

function BottomNavLink({ href, label, icon, active }: BottomNavLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(BOTTOM_NAV_ITEM_CLASS, active && "text-primary")}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

type BottomNavActionProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Optional badge rendered as an overlay on the icon (e.g. cart item count). */
  badge?: ReactNode;
};

function BottomNavAction({ label, icon, onClick, badge }: BottomNavActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(BOTTOM_NAV_ITEM_CLASS, "relative")}
    >
      <span className="relative">
        {icon}
        {badge ? (
          <span className="bg-primary border border-border text-primary-foreground absolute -right-2.5 -top-2.5 rounded-full px-1.5 py-0.5 text-xxs leading-none">
            {badge}
          </span>
        ) : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

/**
 * Mobile-only fixed bottom navigation bar.
 *
 * Provides the five primary storefront actions for touch-first navigation:
 * Collections, Search, Cart, Home, and Profile. It renders on mobile viewports
 * only (`md:hidden`) and is mounted wherever the storefront shell lives
 * (`(storefront)` layout + the root homepage page).
 *
 * - Search opens the shared search command dialog.
 * - Cart opens the shared right-side cart drawer (with live item-count badge).
 * - Link items highlight their active route.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { itemCount } = useCartCountState();

  const isCollectionsActive =
    pathname === routes.storefront.categories || pathname.startsWith(`${routes.storefront.categories}/`);
  const isHomeActive = pathname === routes.storefront.home;
  const isProfileActive = pathname.startsWith("/account/");

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur supports-backdrop-filter:bg-background/85 md:hidden"
    >
      <ul className="mx-auto grid w-full max-w-(--container-width) grid-cols-5">
        <li className="flex items-center justify-center">
          <BottomNavLink
            href={routes.storefront.categories}
            label="Collections"
            icon={<LayoutGrid className="size-5" aria-hidden="true" />}
            active={isCollectionsActive}
          />
        </li>
        <li className="flex items-center justify-center">
          <BottomNavAction
            label="Search"
            onClick={openSearchDialog}
            icon={<Search className="size-5" aria-hidden="true" />}
          />
        </li>
        <li className="flex items-center justify-center">
          <BottomNavLink
            href={routes.storefront.home}
            label="Home"
            icon={<Home className="size-5" aria-hidden="true" />}
            active={isHomeActive}
          />
        </li>
        <li className="flex items-center justify-center">
          <BottomNavAction
            label={`Cart`}
            onClick={openCartDrawer}          
            icon={<ShoppingCart className="size-5" aria-hidden="true" />}
            badge={
              itemCount > 0 ? (
                <>
                  <span aria-hidden="true">{itemCount}</span>
                  <span className="sr-only">{`${itemCount} ${itemCount === 1 ? "item" : "items"} in cart`}</span>
                </>
              ) : undefined
            }
          />
        </li>
        <li className="flex items-center justify-center">
          <BottomNavLink
            href={routes.storefront.accountProfile}
            label="Profile"
            icon={<User className="size-5" aria-hidden="true" />}
            active={isProfileActive}
          />
        </li>
      </ul>
    </nav>
  );
}
