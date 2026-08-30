function toStableSegment(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "unknown";
  }

  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const testIds = {
  storefront: {
    categoryGrid: "storefront-category-grid",
    categoryCard: (slug: string) => `storefront-category-card-${toStableSegment(slug)}`,
    productGrid: "storefront-product-grid",
    productCard: (slug: string) => `storefront-product-card-${toStableSegment(slug)}`,
    cardAddToCart: (slug: string) => `storefront-card-add-to-cart-${toStableSegment(slug)}`,
    productOverview: "storefront-product-overview",
    addToCart: "storefront-add-to-cart",
    cartContent: "storefront-cart-content",
    cartSummary: "storefront-cart-summary",
    checkoutForm: "storefront-checkout-form",
    checkoutSubmit: "storefront-checkout-submit",
    checkoutSaveAddress: "storefront-checkout-save-address",
    checkoutManageAddresses: "storefront-checkout-manage-addresses",
    checkoutConfirmation: "storefront-order-confirmation",
  },
  auth: {
    signInForm: "auth-sign-in-form",
    signInSubmit: "auth-sign-in-submit",
    signUpForm: "auth-sign-up-form",
    signUpSubmit: "auth-sign-up-submit",
  },
  admin: {
    ordersTable: "admin-orders-table",
    orderRow: (orderNumber: string) => `admin-order-row-${toStableSegment(orderNumber)}`,
    orderStatusForm: "admin-order-status-form",
    orderStatusSelect: "admin-order-status-select",
    orderStatusSubmit: "admin-order-status-submit",
  },
} as const;
