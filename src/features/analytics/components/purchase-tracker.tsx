"use client";

import { useEffect } from "react";

import { trackEvent } from "../lib";

type PurchaseTrackerItem = {
  id: string;
  name: string;
  price: number;
  category?: string;
  quantity?: number;
};

type PurchaseTrackerProps = {
  transactionId: string;
  items: PurchaseTrackerItem[];
  value: number;
  currency: string;
  tax?: number;
  shipping?: number;
};

/**
 * Fires the GTM/GA4 "purchase" event once when the order confirmation page
 * renders (client-side, after hydration). The order payload is static per
 * confirmation URL, so it only needs to run on mount.
 */
export function PurchaseTracker({
  transactionId,
  items,
  value,
  currency,
  tax,
  shipping,
}: PurchaseTrackerProps) {
  useEffect(() => {
    trackEvent({
      type: 'PURCHASE',
      payload: {
        transactionId,
        items,
        value,
        currency,
        ...(typeof tax === "number" ? { tax } : {}),
        ...(typeof shipping === "number" ? { shipping } : {}),
      },
    });
    // Fire once per confirmation page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
