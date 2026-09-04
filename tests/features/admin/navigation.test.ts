import { RoleKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { getVisibleAdminNavigation } from "@/features/admin/navigation";

describe("admin navigation visibility", () => {
  it("shows full menu for super admins", () => {
    const items = getVisibleAdminNavigation(RoleKey.SUPER_ADMIN);

    expect(items.map((item) => item.label)).toEqual([
      "Dashboard",
      "Products",
      "Deals",
      "Reviews",
      "Blog",
      "Categories",
      "Occasions",
      "Orders",
      "Homepage",
      "Revenue",
      "Inventory",
      "Recent Activity",
      "Settings",
    ]);
  });

  it("hides settings for order managers", () => {
    const items = getVisibleAdminNavigation(RoleKey.ORDER_MANAGER);

    expect(items.map((item) => item.label)).toEqual([
      "Dashboard",
      "Orders",
      "Revenue",
      "Recent Activity",
    ]);
  });

  it("hides operational modules for non-admin roles", () => {
    const items = getVisibleAdminNavigation(RoleKey.CUSTOMER);

    expect(items.map((item) => item.label)).toEqual(["Dashboard"]);
  });
});
