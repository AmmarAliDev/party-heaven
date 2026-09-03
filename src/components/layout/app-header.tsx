import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";

import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { CartDrawerTrigger } from "@/features/cart/components/cart-drawer-trigger";
import { MobileCartButton } from "@/features/cart/components/mobile-cart-button";
import { SearchDialogTrigger } from "@/features/catalog/components/search-dialog-trigger";

import { buttonVariants } from "../ui/button";
import { PageContainer } from "../ui/page-container";
import AppNavbar from "./app-navbar";
import { HeaderScrollHide } from "./header-scroll-hide";
import { StorefrontHeaderAuthControls } from "./storefront-header-auth-controls";

export async function AppHeader() {
  const topLevelNavItems = siteConfig.storefrontNav.filter(
    (item) => item.href !== routes.storefront.categories,
  );

  return (
    <HeaderScrollHide>
      <a
        href="#main-content"
        className="bg-background focus-visible:ring-ring sr-only absolute left-4 top-4 rounded-md px-3 py-2 focus:not-sr-only focus-visible:outline-none focus-visible:ring-2"
      >
        Skip to content
      </a>

      {/* Dark strip — only the upper (logo + actions) section lives on the
          header background. The category navbar is rendered below on the page
          background so the two regions stay individually visible. */}
      <div className="bg-background-header-footer w-full">
        <PageContainer className="py-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 md:flex md:justify-between">
            {/* Mobile: hamburger drawer trigger on the far left */}
            <div className="justify-self-start md:hidden">
              <StorefrontHeaderAuthControls
                topLevelNavItems={topLevelNavItems}
                mode="mobile"
              />
            </div>

            {/* Logo: centered on mobile, leading on desktop */}
            <Link
              href={routes.storefront.home}
              className="justify-self-center text-base font-semibold tracking-tight md:justify-self-start"
              aria-label={`${siteConfig.name} homepage`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Image
                  src={siteConfig.logoPath}
                  alt={`${siteConfig.name} logo`}
                  width={450}
                  height={70}
                  sizes="(min-width: 1024px) 200px, (min-width: 768px) 160px, 120px"
                  className="h-10 w-60 lg:h-20 lg:w-70 rounded-md object-contain"
                  loading="eager"
                />
              </span>
            </Link>

            {/* Right side controls */}
            <div className="flex items-center justify-self-end gap-2">
              {/* Mobile cart — rightmost (the hamburger drawer hosts the full menu) */}
              <div className="md:hidden">
                <MobileCartButton />
              </div>

              {/* Desktop controls */}
              <div className="hidden items-center gap-2 md:flex">
                <SearchDialogTrigger mode="desktop" />
                <Link
                  href={routes.storefront.wishlist}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  aria-label="Wishlist"
                >
                  <Heart className="size-4" aria-hidden="true" />
                  Wishlist
                </Link>
                <CartDrawerTrigger />
                <StorefrontHeaderAuthControls
                  topLevelNavItems={topLevelNavItems}
                  mode="desktop"
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </div>

      {/* Full-width category navbar on the page background */}
      <AppNavbar />
    </HeaderScrollHide>
  );
}
