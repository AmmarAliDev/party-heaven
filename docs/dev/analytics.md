# Analytics Setup

This document outlines the analytics integration for the Party Heaven store. We currently support tracking e-commerce events through **Google Analytics 4 (GA4)** and **Meta Pixel**. The implementation is unified, meaning a single analytics call dispatches to all configured providers securely and cleanly.

## Environment Setup

To enable tracking, provide your IDs in `.env.local`:

```env
# Google Analytics 4 Measurement ID (e.g., G-XXXXXXXXXX)
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"

# Meta Pixel ID (e.g., 123456789012345)
NEXT_PUBLIC_META_PIXEL_ID="XXXXXXXXXXXXXXX"
```

If these environment variables are missing (which is typical for local development without keys), the analytics modules intelligently mock or no-op the tracking calls, preventing errors and ensuring console safety.

## Event Payload Structures

We abstract all tracking behind a centralized utility or React context in `src/features/analytics`. Important e-commerce events generally follow a standardized structure, heavily inspired by the GA4 standard e-commerce schema, which is then mapped internally to Meta Pixel's expected format.

### Supported Common Events

1. **`view_item`** (Fired on Product Detail Pages)
   ```ts
   // Example payload
   {
     currency: 'PKR',
     value: 250,
     items: [
       {
         item_id: 'prod_123',
         item_name: 'Example Product',
         price: 250,
         quantity: 1,
       }
     ]
   }
   ```

2. **`add_to_cart`** (Fired when an item enters the cart)
   ```ts
   // Example payload
   {
     currency: 'PKR',
     value: 250,
     items: [
       {
         item_id: 'prod_123',
         item_name: 'Example Product',
         price: 250,
         quantity: 1,
       }
     ]
   }
   ```

3. **`begin_checkout`** (Fired upon entering checkout)
4. **`purchase`** (Fired on successful order completion)

*Note: For Meta Pixel, `purchase` maps to the `Purchase` standard event, `view_item` to `ViewContent`, and `add_to_cart` to `AddToCart`.*

## Implementation Details

### Meta Pixel Tracking Format
Our Meta Pixel implementation uses the simpler `content_ids` parameter approach rather than the structured `contents` array format. This is sufficient for standard e-commerce tracking and conversion optimization.

- **Current**: `content_ids: ['prod_123', 'prod_456']`
- **Alternative**: `contents: [{id: 'prod_123', quantity: 1, item_price: 250}]` (not currently used)

The `mapToMetaContents` utility function in `src/features/analytics/lib/index.ts` is retained for potential future use if we need structured content data for advanced scenarios like dynamic product ads or catalog integration.

### Page View Tracking
The `PageViewTracker` component skips tracking on initial mount to avoid duplicating the automatic pageview sent by GA4's configuration. It only fires `PAGE_VIEW` events for subsequent route changes within the application.

### Purchase Event Value Convention
For the `PURCHASE` event, the `value` field represents the **grand total** (subtotal + tax + shipping). The optional `tax` and `shipping` fields provide breakdown details for analytics reporting but are already included in the total `value`.

## How to Test

### 1. Google Analytics 4 (GA4)
- **Extension**: Install the [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdmacinfjhajhojgfcglknpcgide) extension for Chrome.
- **Verification**: Enable the extension, then open your GA4 property and navigate to **Admin > DebugView**. As you interact with the site, events should stream in real-time. Ensure your `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set locally.

### 2. Meta Pixel
- **Extension**: Install the [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/fdgfkebigiplmhlokhffhbgbeehbfkmo) extension for Chrome.
- **Verification**: Ensure `NEXT_PUBLIC_META_PIXEL_ID` is set. Navigate through the store (add an item to the cart, view a PDP). The Pixel Helper extension icon should light up and display the specific standard events (e.g., `ViewContent`, `AddToCart`) and their payloads.

### 3. Local Development Checks
In development (`NODE_ENV === 'development'`), if no tracking IDs are provided, checking the console will usually show analytics logs or indicate that tracking is running in mock/dry-run mode, confirming the trigger points are successfully executing.
