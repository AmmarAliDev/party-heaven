import { sendGTMEvent } from "@next/third-parties/google";

import type { AnalyticsEvent, ProductInfo } from '../types';

/**
 * Normalizes the GA4 items payload from internal product info. Fields that are
 * not present (e.g. price on wishlist events) are omitted rather than pushed as
 * `undefined`, keeping the dataLayer payload clean.
 */
const mapToG4Items = (items: ProductInfo[]) => {
  return items.map((item) => ({
    item_id: item.id,
    item_name: item.name,
    ...(typeof item.price === 'number' ? { price: item.price } : {}),
    ...(item.category ? { item_category: item.category } : {}),
    ...(item.brand ? { item_brand: item.brand } : {}),
    quantity: item.quantity || 1,
  }));
};

/**
 * Track an analytics event by pushing it onto the GTM dataLayer
 * (Google Tag Manager). GA4 and Meta Pixel are configured INSIDE the GTM
 * container — this app no longer loads or calls GA4/Meta directly.
 *
 * Events use GA4-standard names and payloads; the GTM container is responsible
 * for mapping them to GA4 (as-is) and to Meta's standard events (e.g.
 * `view_item` → `ViewContent`, `add_to_cart` → `AddToCart`).
 *
 * Fails gracefully and silently if the dataLayer is unavailable.
 */
export const trackEvent = (event: AnalyticsEvent) => {
  try {
    switch (event.type) {
      case 'PAGE_VIEW':
        sendGTMEvent({
          event: 'page_view',
          page_location: event.payload.url,
          page_title: event.payload.title,
        });
        break;

      case 'PRODUCT_VIEW':
        sendGTMEvent({
          event: 'view_item',
          ecommerce: {
            currency: event.payload.product.currency || 'PKR',
            value: event.payload.product.price,
            items: mapToG4Items([event.payload.product]),
          },
        });
        break;

      case 'ADD_TO_CART':
        sendGTMEvent({
          event: 'add_to_cart',
          ecommerce: {
            currency: event.payload.currency || 'PKR',
            value: event.payload.value,
            items: mapToG4Items([event.payload.product]),
          },
        });
        break;
      case 'BEGIN_CHECKOUT':
        sendGTMEvent({
          event: 'begin_checkout',
          ecommerce: {
            currency: event.payload.currency,
            value: event.payload.value,
            items: mapToG4Items(event.payload.items),
          },
        });
        break;

      case 'PURCHASE':
        sendGTMEvent({
          event: 'purchase',
          ecommerce: {
            transaction_id: event.payload.transactionId,
            currency: event.payload.currency,
            value: event.payload.value,
            ...(typeof event.payload.tax === 'number' ? { tax: event.payload.tax } : {}),
            ...(typeof event.payload.shipping === 'number' ? { shipping: event.payload.shipping } : {}),
            items: mapToG4Items(event.payload.items),
          },
        });
        break;

      case 'VIEW_ITEM_LIST':
        sendGTMEvent({
          event: 'view_item_list',
          ecommerce: {
            item_list_id: event.payload.itemListId,
            item_list_name: event.payload.itemListName,
            items: mapToG4Items(event.payload.items),
          },
        });
        break;

      case 'SELECT_ITEM':
        sendGTMEvent({
          event: 'select_item',
          ecommerce: {
            item_list_name: event.payload.itemListName,
            items: mapToG4Items([event.payload.product]),
          },
        });
        break;

      case 'VIEW_CART':
        sendGTMEvent({
          event: 'view_cart',
          ecommerce: {
            currency: event.payload.currency,
            value: event.payload.value,
            items: mapToG4Items(event.payload.items),
          },
        });
        break;

      case 'REMOVE_FROM_CART':
        sendGTMEvent({
          event: 'remove_from_cart',
          ecommerce: {
            currency: event.payload.currency,
            value: event.payload.value,
            items: mapToG4Items([event.payload.product]),
          },
        });
        break;

      case 'ADD_TO_WISHLIST':
        sendGTMEvent({
          event: 'add_to_wishlist',
          ecommerce: {
            items: mapToG4Items([event.payload.product]),
          },
        });
        break;

      case 'SEARCH':
        sendGTMEvent({
          event: 'search',
          search_term: event.payload.searchTerm,
        });
        break;

      case 'SIGN_UP':
        sendGTMEvent({
          event: 'sign_up',
          method: event.payload.method,
        });
        break;
    }
  } catch (error) {
    // Analytics failures should never crash the app
    console.error('[Analytics] Failed to track event:', error);
  }
};
