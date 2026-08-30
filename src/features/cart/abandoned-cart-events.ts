/**
 * Abandoned cart event tracking.
 *
 * This module records append-only `AbandonedCartEvent` rows that feed the
 * future abandoned-cart recovery pipeline (background job / cron). The events
 * are stored so the pipeline can be built without a backfill.
 *
 * DEFERRED — recovery job:
 *   A cron/queue worker that reads CART_CREATED / CART_UPDATED events, calculates
 *   the abandonment window (e.g. 1 hour of inactivity), queues a REMINDER_QUEUED
 *   event, sends a recovery email, and records REMINDER_SENT. Recovering carts
 *   should call `markCartRecovered()`. Expired carts should call `markCartAbandoned()`.
 *
 * DEFERRED — recovery email template:
 *   A templated email containing the cart's snapshot items (from `metadata`) and
 *   a `recoveryToken`-based deep link back to the cart.
 *
 * Call sites:
 *   - `recordCartActivity()` → from cart service after add/update/remove item.
 *   - `markCartAbandoned()` → from a future background job.
 *   - `markCartRecovered()` → from checkout completion (checkout service).
 *   - `recordCartExpired()` → from a future cleanup job.
 */

import { randomUUID } from "node:crypto";

import { createLogger } from "@/lib/logger";
import { getPrismaClient } from "@/lib/prisma";

const abandonedCartLogger = createLogger("cart.abandoned-cart");

// ----- Types ----------------------------------------------------------------

/** Snapshot of cart contents stored in the event metadata for recovery emails. */
export type CartEventMetadata = {
  /** Total number of unique line items in the cart. */
  itemCount: number;
  /** Cart subtotal in paisa (smallest PKR unit). */
  subtotalPaisa: number;
  /** Name of the first product in the cart (for email preview text). */
  firstProductName?: string | undefined;
};

export type RecordCartActivityInput = {
  cartId: string;
  cartToken: string;
  userId?: string | undefined;
  /** Customer email if known (from checkout form or user profile). */
  email?: string | undefined;
  metadata: CartEventMetadata;
  /**
   * Whether this is the first time an item has been added to this cart.
   * Determines whether to emit CART_CREATED or CART_UPDATED.
   */
  isFirstItem: boolean;
};

// ----- Public API -----------------------------------------------------------

/**
 * Record a CART_CREATED or CART_UPDATED event.
 *
 * Call this from cart service operations (add item, update quantity, remove item)
 * after the cart mutation has been committed to the database.
 * Errors are caught and logged — they must never fail the cart operation.
 */
export async function recordCartActivity(input: RecordCartActivityInput): Promise<void> {
  const eventType = input.isFirstItem ? "CART_CREATED" : "CART_UPDATED";

  try {
    const db = getPrismaClient();
    await db.abandonedCartEvent.create({
      data: {
        cartId: input.cartId,
        cartToken: input.cartToken,
        userId: input.userId ?? null,
        email: input.email ?? null,
        eventType,
        metadata: input.metadata,
      },
    });

    abandonedCartLogger.debug("cart activity event recorded", {
      cartId: input.cartId,
      eventType,
      itemCount: input.metadata.itemCount,
    });
  } catch (error) {
    // Non-fatal: logging only, never block the cart operation.
    abandonedCartLogger.error("failed to record cart activity event", {
      cartId: input.cartId,
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mark a cart as abandoned in the Cart table and emit a CART_EXPIRED event.
 *
 * Called by the background recovery job when a cart has been inactive beyond
 * the abandonment window and no recovery email will be sent.
 * This is a no-op if the cart is already in a non-ACTIVE status.
 */
export async function markCartAbandoned(
  cartId: string,
  cartToken: string,
): Promise<void> {
  try {
    const db = getPrismaClient();

    // Only transition ACTIVE carts to ABANDONED.
    const updated = await db.cart.updateMany({
      where: { id: cartId, status: "ACTIVE" },
      data: { status: "ABANDONED", abandonedAt: new Date() },
    });

    if (updated.count === 0) {
      // Cart was already transitioned; nothing to do.
      return;
    }

    await db.abandonedCartEvent.create({
      data: {
        cartId,
        cartToken,
        eventType: "CART_EXPIRED",
        metadata: {},
      },
    });

    abandonedCartLogger.info("cart marked abandoned", { cartId });
  } catch (error) {
    abandonedCartLogger.error("failed to mark cart as abandoned", {
      cartId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mark a cart as recovered after the customer completes checkout.
 *
 * Records a CART_RECOVERED event and clears the abandonment markers on the Cart row.
 * Call this from the checkout service after a successful order placement.
 * Errors are caught and logged — they must never fail the checkout.
 */
export async function markCartRecovered(
  cartId: string,
  cartToken: string,
  userId?: string | undefined,
  email?: string | undefined,
): Promise<void> {
  try {
    const db = getPrismaClient();

    await Promise.all([
      // Clear abandonment markers (the cart status will be set to COMPLETED by checkout).
      db.cart.update({
        where: { id: cartId },
        data: { abandonedAt: null, recoveryToken: null },
      }),

      // Append the recovery event for reporting.
      db.abandonedCartEvent.create({
        data: {
          cartId,
          cartToken,
          userId: userId ?? null,
          email: email ?? null,
          eventType: "CART_RECOVERED",
          metadata: {},
        },
      }),
    ]);

    abandonedCartLogger.info("cart recovered (checkout completed)", { cartId });
  } catch (error) {
    abandonedCartLogger.error("failed to record cart recovery event", {
      cartId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Generate a recovery token for a cart and persist it.
 *
 * The recovery token is embedded in the recovery email as a deep link:
 *   /cart?recover=<recoveryToken>
 * The storefront reads this token and restores the cart session.
 *
 * DEFERRED: the recovery email template and deep link handler are not yet built.
 * This function is provided so the background job can call it when it's ready.
 */
export async function generateCartRecoveryToken(cartId: string): Promise<string | null> {
  try {
    const db = getPrismaClient();
    const token = randomUUID().replace(/-/g, "");

    await db.cart.update({
      where: { id: cartId },
      data: { recoveryToken: token },
    });

    return token;
  } catch (error) {
    abandonedCartLogger.error("failed to generate cart recovery token", {
      cartId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
