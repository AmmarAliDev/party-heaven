"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Menu, User, X } from "lucide-react";

import { routes } from "@/config/routes";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/app";

import { Button, buttonVariants } from "../ui/button";

type StorefrontMobileNavProps = {
  navItems: NavItem[];
  accountHref: string;
  wishlistHref: string;
  isSignedIn: boolean;
  isAdmin: boolean;
};

export function StorefrontMobileNav({
  navItems,
  accountHref,
  wishlistHref,
  isSignedIn,
  isAdmin,
}: StorefrontMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-panel"
        onClick={() => setIsOpen((value) => !value)}
      >
        {isOpen ? <X className="size-4" /> : <Menu className="size-4" />}
      </Button>

      {isOpen ? (
        <div
          id="mobile-navigation-panel"
          className="border-border/80 bg-black/90 text-primary-strong absolute inset-x-0 top-full z-50 border-b px-4 py-4 shadow-(--shadow-soft) backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-(--container-width) flex-col gap-4">
            <div className={cn("grid gap-2 place-items-center", isSignedIn ? "grid-cols-3" : "grid-cols-2")}>
              <Link
                href={wishlistHref}
                className={buttonVariants({ variant: "outline", size: "lg" })}
                onClick={() => setIsOpen(false)}
                aria-label="Wishlist"
              >
                <Heart className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href={accountHref}
                className={buttonVariants({ variant: "outline", size: "lg" })}
                onClick={() => setIsOpen(false)}
                aria-label="Account"
              >
                <User className="size-4" aria-hidden="true" />
              </Link>
              {isSignedIn && (
                <SignOutButton
                  variant="outline"
                  size="lg"
                  className="px-6 w-max"
                  formClassName="w-max"
                  fullWidth
                  showText={false}
                  onBeforeSubmit={() => setIsOpen(false)}
                />
              )}
            </div>
            <nav aria-label="Mobile storefront" className="grid gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="text-primary-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
                >
                  {item.title}
                </Link>
              ))}

              {/* Account menu options — mirror the desktop user menu */}
              {(isSignedIn || isAdmin) && (
                <div className="border-border/80 mt-2 grid gap-1 border-t pt-2">
                  {isAdmin && (
                    <Link
                      href={routes.admin.dashboard}
                      onClick={() => setIsOpen(false)}
                      className="text-primary-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
                    >
                      Admin Panel
                    </Link>
                  )}
                  {isSignedIn && (
                    <Link
                      href={routes.storefront.accountOrders}
                      onClick={() => setIsOpen(false)}
                      className="text-primary-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
                    >
                      Your Orders
                    </Link>
                  )}
                </div>
              )}
            </nav>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => setIsOpen(false)}
          >
            Close menu
          </Button>
        </div>
      ) : null}
    </div>
  );
}
