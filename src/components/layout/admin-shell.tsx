import Link from "next/link";
import type { Session } from "next-auth";
import { ChevronDown, Store } from "lucide-react";
import type { ReactNode } from "react";

import { routes } from "@/config/routes";
import { AdminBreadcrumb } from "@/features/admin/components/admin-breadcrumb";
import { AdminSidebarNav } from "@/features/admin/components/admin-sidebar-nav";
import { getAdminRoleSummary, getVisibleAdminNavigation } from "@/features/admin/navigation";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import type { RoleKey } from "@/lib/auth/roles";

import { ThemeToggle } from "../theme-toggle";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import { PageContainer } from "../ui/page-container";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar";

type AdminShellProps = {
  children: ReactNode;
  role: RoleKey | null;
  user: NonNullable<Session["user"]>;
};

export function AdminShell({ children, role, user }: AdminShellProps) {
  const visibleNav = getVisibleAdminNavigation(role);

  return (
    <SidebarProvider>
      <div className="bg-background min-h-screen lg:flex w-full">
        <Sidebar aria-label="Admin navigation sidebar" className="bg-background">
          <SidebarHeader className="gap-2 p-4 lg:p-6 border-b">
            <Badge variant="info">Admin workspace</Badge>
            <div>
              <Link href={routes.admin.dashboard} className="text-lg font-semibold tracking-tight">
                Party Heaven Ops
              </Link>
              <p className="text-muted-foreground text-sm">
                Friendly operations panel for day-to-day store management.
              </p>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-4 lg:px-6 py-4">
            <AdminSidebarNav items={visibleNav} />
          </SidebarContent>

          <SidebarFooter className="p-4 lg:p-6 border-t">
            <div className="bg-muted/60 rounded-xl p-4 text-sm">
              <p className="font-medium">{getAdminRoleSummary(role)}</p>
              <p className="text-muted-foreground mt-1">Menu items are shown based on what this role can access.</p>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="border-border/70 bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
            <PageContainer className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="space-y-2">
                <div>
                  <SidebarTrigger />
                </div>
                <AdminBreadcrumb navItems={visibleNav} />
                <p className="text-sm font-medium">Operations workspace</p>
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Link href={routes.storefront.home} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Store className="size-4" />
                  View storefront
                </Link>

                <details className="group relative">
                  <summary className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {user.name ?? user.email ?? "Admin user"}
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="border-border/70 bg-card absolute right-0 z-40 mt-2 w-56 rounded-xl border p-2 shadow-(--shadow-soft)">
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">{user.email ?? "No email available"}</p>
                    <Link
                      href={routes.storefront.accountProfile}
                      className="hover:bg-accent hover:text-foreground block rounded-lg px-2 py-1.5 text-sm text-muted-foreground"
                    >
                      My profile
                    </Link>
                    <SignOutButton
                      formClassName="mt-1"
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="h-auto justify-start px-2 py-1.5 text-muted-foreground hover:text-foreground"
                    />
                  </div>
                </details>
              </div>
            </PageContainer>
          </header>

          <main id="main-content" className="flex-1">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
