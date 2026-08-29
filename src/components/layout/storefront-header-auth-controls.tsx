"use client";

import { useSession } from "next-auth/react";

import { routes } from "@/config/routes";
import { RoleKey } from "@/lib/auth/roles";
import type { NavItem } from "@/types/app";

import { StorefrontMobileNav } from "./storefront-mobile-nav";
import UserMenu from "./user-menu";

type StorefrontHeaderAuthControlsProps = {
  topLevelNavItems: NavItem[];
  /**
   * "mobile" renders the hamburger drawer trigger, which hosts the full
   * navigation + account menu on mobile. "desktop" renders the shared user
   * menu dropdown. There is no separate user-menu button in the mobile header.
   */
  mode: "mobile" | "desktop";
};

export function StorefrontHeaderAuthControls({
  topLevelNavItems,
  mode,
}: StorefrontHeaderAuthControlsProps) {
  const { data: session } = useSession();
  const isSignedIn = Boolean(session?.user?.id);
  const isAdmin = Boolean(session?.user?.role === RoleKey.SUPER_ADMIN);

  if (mode === "mobile") {
    return (
      <StorefrontMobileNav
        navItems={topLevelNavItems}
        accountHref={routes.storefront.account}
        wishlistHref={routes.storefront.wishlist}
        isSignedIn={isSignedIn}
        isAdmin={isAdmin}
      />
    );
  }

  return <UserMenu isSignedIn={isSignedIn} isAdmin={isAdmin} navItems={topLevelNavItems} />;
}
