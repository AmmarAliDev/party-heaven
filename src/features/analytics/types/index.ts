export interface ProductInfo {
  id: string;
  name: string;
  price?: number;
  currency?: string;
  category?: string;
  brand?: string;
  quantity?: number;
}

export interface PageViewEvent {
  url: string;
  title?: string;
}

export interface ProductViewEvent {
  product: ProductInfo;
}

export interface AddToCartEvent {
  product: ProductInfo;
  value: number;
  currency: string;
}

export interface BeginCheckoutEvent {
  items: ProductInfo[];
  value: number;
  currency: string;
}

export interface PurchaseEvent {
  transactionId: string;
  items: ProductInfo[];
  /**
   * Grand total of the purchase (subtotal + tax + shipping).
   * This is the final amount paid by the customer in the specified currency.
   * For revenue reporting, this represents the total transaction value.
   */
  value: number;
  currency: string;
  /**
   * Tax amount included in the total value (optional, for detailed reporting).
   */
  tax?: number;
  /**
   * Shipping cost included in the total value (optional, for detailed reporting).
   */
  shipping?: number;
}

export interface ItemListEvent {
  itemListId: string;
  itemListName: string;
  items: ProductInfo[];
}

export interface SelectItemEvent {
  itemListName: string;
  product: ProductInfo;
}

export interface ViewCartEvent {
  items: ProductInfo[];
  value: number;
  currency: string;
}

export interface RemoveFromCartEvent {
  product: ProductInfo;
  value: number;
  currency: string;
}

export interface AddToWishlistEvent {
  product: ProductInfo;
}

export interface SearchEvent {
  searchTerm: string;
}

export type AnalyticsEvent =
  | { type: 'PAGE_VIEW'; payload: PageViewEvent }
  | { type: 'PRODUCT_VIEW'; payload: ProductViewEvent }
  | { type: 'ADD_TO_CART'; payload: AddToCartEvent }
  | { type: 'BEGIN_CHECKOUT'; payload: BeginCheckoutEvent }
  | { type: 'PURCHASE'; payload: PurchaseEvent }
  | { type: 'VIEW_ITEM_LIST'; payload: ItemListEvent }
  | { type: 'SELECT_ITEM'; payload: SelectItemEvent }
  | { type: 'VIEW_CART'; payload: ViewCartEvent }
  | { type: 'REMOVE_FROM_CART'; payload: RemoveFromCartEvent }
  | { type: 'ADD_TO_WISHLIST'; payload: AddToWishlistEvent }
  | { type: 'SEARCH'; payload: SearchEvent }
  | { type: 'SIGN_UP'; payload: { method: string } };
