/**
 * When a deal's effective variant has at most this many units left it is
 * flagged as low stock in the admin form and on the storefront.
 *
 * Kept in a client-safe module so the admin deal form picker can render the
 * low-stock warning without importing the server-only deals service.
 */
export const DEAL_LOW_STOCK_THRESHOLD = 5;
