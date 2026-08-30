export type CartItemSummary = {
  id: string;
  productName: string;
  productSlug: string;
  categorySlug: string;
  sku: string;
  optionLabel: string | null;
  quantity: number;
  unitPrice: number;
  compareAtPrice: number | null;
  lineSubtotal: number;
  availableQuantity: number;
  href: string;
  /** Primary product image URL (variant first, then product), or null. */
  imageUrl: string | null;
  /** Alt text for the primary image, or null. */
  imageAlt: string | null;
};

export type DealCartItemSummary = {
  id: string;
  dealId: string;
  dealSlug: string;
  title: string;
  /** Compact summary of the included products (e.g. "A + B +1 more"). */
  productSummary: string;
  /** Number of products included in the deal. */
  itemCount: number;
  quantity: number;
  unitPrice: number;
  compareAtPrice: number | null;
  lineSubtotal: number;
  /**
   * How many copies of the whole deal can still be fulfilled (min across the
   * included products of floor(stock / per-deal quantity)).
   */
  availableQuantity: number;
  href: string;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Synthetic SKU used for cart matching/validation (e.g. "deal:<slug>"). */
  sku: string;
};

export type CartSummary = {
  id: string;
  token: string;
  itemCount: number;
  subtotal: number;
  items: CartItemSummary[];
  dealItems: DealCartItemSummary[];
};

export type CartStockIssue = {
  cartItemId: string;
  productName: string;
  sku: string;
  requestedQuantity: number;
  availableQuantity: number;
};

export type CartStockValidationResult = {
  ok: boolean;
  issues: CartStockIssue[];
};

export type ResolveCartContextInput = {
  userId?: string | undefined;
  guestToken?: string | undefined;
  mergeGuestIntoUser?: boolean | undefined;
};

export type AddCartItemInput = {
  productSlug: string;
  optionId?: string | undefined;
  quantity?: number | undefined;
};

export type AddDealCartItemInput = {
  dealSlug: string;
  quantity?: number | undefined;
};

export type UpdateCartItemInput = {
  cartItemId: string;
  quantity: number;
};

export type UpdateDealCartItemInput = {
  dealCartItemId: string;
  quantity: number;
};

export type RemoveCartItemInput = {
  cartItemId: string;
};

export type RemoveDealCartItemInput = {
  dealCartItemId: string;
};
