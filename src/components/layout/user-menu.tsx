"use client";

import Link from "next/link";
import { BookOpenText, BookUser, House, Info, LayoutDashboard, Package, User } from "lucide-react";

import { routes } from "@/config/routes";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import type { NavItem } from "@/types/app";

import { buttonVariants } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const menuIcons: Record<string, React.ReactNode> = {
  "Admin Panel": <LayoutDashboard className="size-4" aria-hidden="true" />,
  "Account": <User className="size-4" aria-hidden="true" />,
  "Sign in": <User className="size-4" aria-hidden="true" />,
  "Home": <House className="size-4" aria-hidden="true" />,
  "About": <Info className="size-4" aria-hidden="true" />,
  "Blog": <BookOpenText className="size-4" aria-hidden="true" />,
  "Contact": <BookUser className="size-4" aria-hidden="true" />,
}

const UserMenu = ({
  isSignedIn,
  isAdmin,
  navItems,
}: {
  isSignedIn: boolean;
  isAdmin: boolean;
  navItems: NavItem[];
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label="Open user and navigation menu"
        >
          <User className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex min-w-48 flex-col gap-1 bg-card">
        {navItems.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link
              href={item.href}
              className={buttonVariants({ variant: "ghost", size: "sm", className: "cursor-pointer justify-start pl-8" })}
            >
              {menuIcons[item.title] || <User className="size-4" aria-hidden="true" />}
              {item.title}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link
              href={routes.admin.dashboard}
              className={buttonVariants({ variant: "ghost", size: "sm", className: "cursor-pointer justify-start pl-8" })}
            >
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Admin Panel
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link
            href={routes.storefront.account}
            className={buttonVariants({ variant: "ghost", size: "sm", className: "cursor-pointer justify-start pl-8" })}
          >
            <User className="size-4" aria-hidden="true" />
            {isSignedIn ? "Account" : "Sign in"}
          </Link>
        </DropdownMenuItem>
        {isSignedIn && (
          <DropdownMenuItem asChild>
            <Link
              href={routes.storefront.accountOrders}
              className={buttonVariants({ variant: "ghost", size: "sm", className: "cursor-pointer justify-start pl-8" })}
            >
              <Package className="size-4" aria-hidden="true" />
              Your Orders
            </Link>
          </DropdownMenuItem>
        )}
        {isSignedIn && (
          <div className="pb-1 w-full">
            <SignOutButton
              fullWidth={true}
              variant="ghost"
              className={buttonVariants({ variant: "ghost", size: "sm", className: "cursor-pointer rounded-sm justify-start pl-8" })}
            />
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
