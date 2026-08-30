import { routes } from "@/config/routes";
import { getRoleLabel, hasPermission, type RbacPermission, rbacPermissions } from "@/lib/auth/rbac";
import { type RoleKey } from "@/lib/auth/roles";

export type AdminNavigationItem = {
  label: string;
  href: string;
  description: string;
  requiredPermission?: RbacPermission;
};

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  {
    label: "Dashboard",
    href: routes.admin.dashboard,
    description: "Overview of daily operations and shortcuts.",
  },
  {
    label: "Products",
    href: routes.admin.products,
    description: "Create and maintain storefront products, variants, stock, and SEO.",
    requiredPermission: rbacPermissions.catalogRead,
  },
  {
    label: "Deals",
    href: routes.admin.deals,
    description: "Curate Featured Deals linked to catalog products and variants.",
    requiredPermission: rbacPermissions.catalogRead,
  },
  {
    label: "Reviews",
    href: routes.admin.reviews,
    description: "Moderate customer feedback and storefront visibility.",
    requiredPermission: rbacPermissions.catalogRead,
  },
  {
    label: "Blog",
    href: routes.admin.blog,
    description: "Create and publish storefront blog posts with SEO controls.",
    requiredPermission: rbacPermissions.catalogRead,
  },
  {
    label: "Categories",
    href: routes.admin.categories,
    description: "Create and maintain storefront category taxonomy.",
    requiredPermission: rbacPermissions.catalogRead,
  },
  {
    label: "Orders",
    href: routes.admin.orders,
    description: "Track order intake and fulfillment status.",
    requiredPermission: rbacPermissions.ordersRead,
  },
  {
    label: "Homepage",
    href: routes.admin.homepage,
    description: "Manage homepage sections, banners, and promotional campaign timing.",
    requiredPermission: rbacPermissions.settingsManage,
  },
  {
    label: "Revenue",
    href: routes.admin.revenue,
    description: "Review revenue trends and summaries.",
    requiredPermission: rbacPermissions.ordersRead,
  },
  {
    label: "Inventory",
    href: routes.admin.inventory,
    description: "Monitor low stock and product health.",
    requiredPermission: rbacPermissions.catalogRead,
  },
  {
    label: "Recent Activity",
    href: routes.admin.activity,
    description: "View team and system activity history.",
    requiredPermission: rbacPermissions.usersRead,
  },
  {
    label: "Settings",
    href: routes.admin.settings,
    description: "Manage admin workspace settings.",
    requiredPermission: rbacPermissions.settingsManage,
  },
] as const;

export function getVisibleAdminNavigation(role: RoleKey | null | undefined): AdminNavigationItem[] {
  return adminNavigationItems.filter((item) => {
    if (!item.requiredPermission) {
      return true;
    }

    return hasPermission(role, item.requiredPermission);
  });
}

export function getAdminRoleSummary(role: RoleKey | null | undefined) {
  const label = getRoleLabel(role);
  return `Signed in as ${label}`;
}
