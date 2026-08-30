import type { CartStockIssue, CartStockValidationResult, CartSummary } from "./types";

export function validateCartStock(summary: CartSummary): CartStockValidationResult {
  const productIssues: CartStockIssue[] = summary.items
    .filter((item) => item.quantity > item.availableQuantity)
    .map((item) => ({
      cartItemId: item.id,
      productName: item.productName,
      sku: item.sku,
      requestedQuantity: item.quantity,
      availableQuantity: item.availableQuantity,
    }));

  // Deal lines are validated against the deal-level available quantity (min
  // across included products of floor(stock / per-deal quantity)).
  const dealIssues: CartStockIssue[] = summary.dealItems
    .filter((item) => item.quantity > item.availableQuantity)
    .map((item) => ({
      cartItemId: item.id,
      productName: item.title,
      sku: item.sku,
      requestedQuantity: item.quantity,
      availableQuantity: item.availableQuantity,
    }));

  const issues = [...productIssues, ...dealIssues];

  return {
    ok: issues.length === 0,
    issues,
  };
}
