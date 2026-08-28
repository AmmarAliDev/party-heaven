import Link from "next/link";

import { routes } from "@/config/routes";
import { getCatalogCategories } from "@/features/catalog";
import { logger } from "@/lib/logger";

import { buttonVariants } from "../ui/button";
import { PageContainer } from "../ui/page-container";
import { FooterColumn } from "./footer-column";
import { buildStorefrontNavbarCategoryMenu } from "./storefront-category-menu";

const helpLinks = [
  { title: "About us", href: routes.storefront.about },
  { title: "Contact us", href: routes.storefront.contact },
  { title: "Your Orders", href: routes.storefront.accountOrders },
] as const;

const policyLinks = [
  { title: "Privacy Policy", href: routes.storefront.privacy },
  { title: "Refund Policy", href: routes.storefront.returnPolicy },
  { title: "Shipping Policy", href: routes.storefront.shippingPolicy },
  { title: "Terms of Service", href: routes.storefront.terms },
] as const;

export async function AppFooter() {
  let categories = [] as Awaited<ReturnType<typeof getCatalogCategories>>;

  try {
    categories = await getCatalogCategories();
  } catch (error) {
    logger.error("Failed to load footer categories", {
      code: "FOOTER_CATEGORY_NAV_LOAD_FAILED",
      error,
    });
  }

  const quickLinks = buildStorefrontNavbarCategoryMenu(
    categories.map((category) => ({
      name: category.name,
      href: category.href,
    })),
  );

  return (
    <footer className="border-border/70 bg-background-header-footer border-t pb-24 text-footer-text md:pb-0">
      <PageContainer>
        <div className="grid gap-0 py-8 md:grid-cols-4 md:gap-8">
          <FooterColumn
            heading="Quick Links"
            links={quickLinks.directCategories.map((item) => ({
              title: item.title,
              href: item.href,
            }))}
            action={
              <Link
                href={quickLinks.allCategories.href}
                className={buttonVariants({ variant: "ghost", size: "sm", className: "mt-2 hover:bg-transparent p-0!" })}
              >
                View All
              </Link>
            }
          />

          <FooterColumn heading="Help" links={helpLinks} />

          <FooterColumn heading="Policies" links={policyLinks} />

          <FooterColumn heading="Contact">
            <ul className="space-y-2.5">
              <li>
                <span className="font-medium">Email:</span>{" "}
                <span className="text-muted-foreground">—</span>
              </li>
              <li>
                <span className="font-medium">Phone:</span>{" "}
                <span className="text-muted-foreground">—</span>
              </li>
            </ul>
          </FooterColumn>
        </div>
      </PageContainer>
    </footer>
  );
}
