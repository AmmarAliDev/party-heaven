// @vitest-environment jsdom
import { beforeEach,describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/features/analytics/lib';
import type { AnalyticsEvent } from '@/features/analytics/types';

describe('Analytics trackEvent', () => {
  beforeEach(() => {
    window.gtag = vi.fn();
    window.fbq = vi.fn();
  });

  const mockProduct = {
    id: 'prod_123',
    name: 'Test Product',
    price: 19.99,
    currency: 'USD',
    category: 'Test Category',
  };

  it('tracks PAGE_VIEW event correctly', () => {
    const event: AnalyticsEvent = {
      type: 'PAGE_VIEW',
      payload: { url: '/test-url', title: 'Test Title' },
    };

    trackEvent(event);

    expect(window.gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_location: '/test-url',
      page_title: 'Test Title',
    });
    expect(window.fbq).toHaveBeenCalledWith('track', 'PageView');
  });

  it('tracks PRODUCT_VIEW event correctly', () => {
    const event: AnalyticsEvent = {
      type: 'PRODUCT_VIEW',
      payload: { product: mockProduct },
    };

    trackEvent(event);

    expect(window.gtag).toHaveBeenCalledWith('event', 'view_item', {
      currency: 'USD',
      value: 19.99,
      items: [{
        item_id: 'prod_123',
        item_name: 'Test Product',
        price: 19.99,
        item_category: 'Test Category',
        item_brand: undefined,
        quantity: 1,
      }],
    });
  });

  it('tracks ADD_TO_CART event correctly', () => {
    const event: AnalyticsEvent = {
      type: 'ADD_TO_CART',
      payload: { product: mockProduct, value: 19.99, currency: 'USD' },
    };

    trackEvent(event);

    expect(window.gtag).toHaveBeenCalledWith('event', 'add_to_cart', {
      currency: 'USD',
      value: 19.99,
      items: [{
        item_id: 'prod_123',
        item_name: 'Test Product',
        price: 19.99,
        item_category: 'Test Category',
        item_brand: undefined,
        quantity: 1,
      }],
    });
    expect(window.fbq).toHaveBeenCalledWith('track', 'AddToCart', {
      content_type: 'product',
      content_ids: ['prod_123'],
      value: 19.99,
      currency: 'USD',
    });
  });
  
  it('does not crash if window objects are undefined', () => {
    delete window.gtag;
    delete window.fbq;
    
    expect(() => {
      trackEvent({ type: 'PAGE_VIEW', payload: { url: '/' } });
    }).not.toThrow();
  });
});
