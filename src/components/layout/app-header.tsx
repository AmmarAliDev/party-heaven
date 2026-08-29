import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Heart } from "lucide-react";

import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { CartDrawerTrigger } from "@/features/cart/components/cart-drawer-trigger";
import { MobileCartButton } from "@/features/cart/components/mobile-cart-button";
import { getCatalogCategories } from "@/features/catalog";
import { SearchDialogTrigger } from "@/features/catalog/components/search-dialog-trigger";
import { logger } from "@/lib/logger";

import { buttonVariants } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { PageContainer } from "../ui/page-container";
import { HeaderScrollHide } from "./header-scroll-hide";
import { buildStorefrontNavbarCategoryMenu } from "./storefront-category-menu";
import { StorefrontHeaderAuthControls } from "./storefront-header-auth-controls";

export async function AppHeader() {
  let categoriesError = false;
  let categories = [] as Awaited<ReturnType<typeof getCatalogCategories>>;

  try {
    categories = await getCatalogCategories();
  } catch (error) {
    categoriesError = true;
    logger.error("Failed to load header categories", {
      code: "HEADER_CATEGORY_NAV_LOAD_FAILED",
      error,
    });
  }

  const navbarCategoryMenu = buildStorefrontNavbarCategoryMenu(
    categories.map((category) => ({
      name: category.name,
      href: category.href,
    })),
  );

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

      <PageContainer className="relative flex flex-col gap-3 py-3">
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

              {/* <span className="min-w-0">
                <span className="text-base font-semibold tracking-tight">
                  {siteConfig.name}
                </span>
              </span> */}
            </span>
          </Link>

          {/* Right side controls */}
          <div className="flex items-center justify-self-end gap-2">
            {/* Mobile search — intentionally hidden for now; remove `hidden` to re-enable */}
            <div className="hidden md:hidden">
              <SearchDialogTrigger mode="mobile" />
            </div>

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
              {/* Temporarily disabled */}
              {/* <ThemeToggle /> */}
              <StorefrontHeaderAuthControls
                topLevelNavItems={topLevelNavItems}
                mode="desktop"
              />
            </div>
          </div>
        </div>

        <nav aria-label="Storefront" className="hidden w-full justify-center overflow-x-auto pb-1 md:flex">
          <ul className="flex items-center gap-1">
            {navbarCategoryMenu.directCategories.map((item) => (
              <li key={`${item.kind}-${item.href}`}>
                <Link
                  href={item.href}
                  className="text-muted hover:bg-accent hover:text-foreground rounded-full px-3 py-2 text-sm transition-colors"
                >
                  {item.title}
                </Link>
              </li>
            ))}
            <li>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="text-muted hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
                  aria-label="More storefront navigation"
                >
                  More
                  <ChevronDown className="size-4" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56" sideOffset={8}>
                  {navbarCategoryMenu.moreCategories.map((item) => (
                    <DropdownMenuItem key={`${item.kind}-${item.href}-${item.title}`} asChild>
                      <Link href={item.href}>{item.title}</Link>
                    </DropdownMenuItem>
                  ))}
                  {navbarCategoryMenu.moreCategories.length > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem asChild>
                    <Link href={navbarCategoryMenu.allCategories.href}>
                      {navbarCategoryMenu.allCategories.title}
                    </Link>
                  </DropdownMenuItem>
                  {categoriesError ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>
                        Categories are temporarily unavailable.
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {!categoriesError && categories.length === 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>
                        No categories are available yet.
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </ul>
        </nav>
      </PageContainer>
    </HeaderScrollHide>
  );
}
