/**
 * Email marketing service — subscriber capture and list management.
 *
 * Responsibilities:
 *  - Validate and persist subscriber records (upsert semantics).
 *  - Sync subscribers to the configured campaign provider (stub by default).
 *  - Handle unsubscribe requests via opaque one-time tokens.
 *
 * What this service does NOT do:
 *  - Send marketing emails (that is the campaign provider's job).
 *  - Handle double opt-in confirmation links (deferred — see DEFERRED note below).
 *  - Send transactional email (use NotificationService for that).
 *
 * DEFERRED — double opt-in:
 *   New subscribers are created with status PENDING. A confirmation email with a
 *   verification link is intentionally not yet sent. When double opt-in is
 *   implemented:
 *     1. Create a `/api/email/confirm?token=<confirmToken>` route.
 *     2. Set `status = ACTIVE` and `confirmedAt = now()` on confirmation.
 *     3. Send the confirmation email via NotificationService or a dedicated template.
 */

import { createLogger } from "@/lib/logger";
import { maskEmail } from "@/lib/security/pii";

import { getEmailCampaignProvider } from "./providers/index";
import { emailSubscriberRepository } from "./repository";
import type { SubscribeInput, SubscribeResult, UnsubscribeInput, UnsubscribeResult } from "./types";
import { subscribeInputSchema, unsubscribeTokenSchema } from "./validation";

const serviceLogger = createLogger("email-marketing.service");

/**
 * Capture a new subscriber or update an existing one.
 *
 * - Validates input via Zod.
 * - Upserts the subscriber record (BOUNCED subscribers are silently ignored).
 * - Syncs to the configured campaign provider in the background (errors are logged, not thrown).
 * - Returns the subscriber regardless of whether provider sync succeeded.
 */
export async function subscribeEmail(raw: SubscribeInput): Promise<SubscribeResult> {
  // 1. Validate
  const parsed = subscribeInputSchema.safeParse(raw);
  if (!parsed.success) {
    const firstMessage = parsed.error.issues[0]?.message ?? "Invalid subscriber input.";
    serviceLogger.warn("subscribe validation failed", { issues: parsed.error.issues });
    return { success: false, error: firstMessage };
  }

  const input = parsed.data;
  const maskedEmail = maskEmail(input.email);

  try {
    // 2. Upsert subscriber in database
    const repo = emailSubscriberRepository();
    const { subscriber, alreadySubscribed } = await repo.upsert({
      email: input.email,
      firstName: input.firstName ?? null,
      source: input.source,
      tags: input.tags ?? [],
    });

    serviceLogger.info("subscriber captured", {
      id: subscriber.id,
      email: maskedEmail,
      source: input.source,
      alreadySubscribed,
      status: subscriber.status,
    });

    // 3. Sync to campaign provider (non-blocking — errors do not fail the subscription)
    const provider = getEmailCampaignProvider();
    provider
      .syncSubscriber({
        email: subscriber.email,
        firstName: subscriber.firstName,
        tags: subscriber.tags,
        subscribedAt: subscriber.createdAt.toISOString(),
      })
      .then(async (result) => {
        if (result.providerId || result.meta) {
          await repo.updateProviderMeta(subscriber.id, {
            providerId: result.providerId,
            ...result.meta,
          });
        }
      })
      .catch((err: unknown) => {
        serviceLogger.warn("campaign provider syncSubscriber failed (non-fatal)", {
          provider: provider.name,
          email: maskedEmail,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return { success: true, subscriber, alreadySubscribed };
  } catch (error) {
    serviceLogger.error("subscribe failed unexpectedly", {
      email: maskedEmail,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "We could not save your subscription. Please try again." };
  }
}

/**
 * Unsubscribe a subscriber by their opaque unsubscribe token.
 *
 * The token is embedded in email footers as `?token=<unsubscribeToken>`.
 * NEVER embed the subscriber's email directly in unsubscribe URLs.
 */
export async function unsubscribeByToken(raw: UnsubscribeInput): Promise<UnsubscribeResult> {
  // 1. Validate
  const parsed = unsubscribeTokenSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, reason: "invalid", error: "Invalid unsubscribe token." };
  }

  try {
    const repo = emailSubscriberRepository();
    const subscriber = await repo.unsubscribeByToken(parsed.data.token);

    if (!subscriber) {
      // Token not found — treat as success to avoid token enumeration.
      serviceLogger.warn("unsubscribe token not found (treated as success)", {
        tokenPrefix: parsed.data.token.slice(0, 8),
      });
      return { success: true };
    }

    serviceLogger.info("subscriber unsubscribed", {
      id: subscriber.id,
      email: maskEmail(subscriber.email),
    });

    // Sync unsubscribe to campaign provider (non-blocking)
    const provider = getEmailCampaignProvider();
    provider.syncUnsubscribe(subscriber.email).catch((err: unknown) => {
      serviceLogger.warn("campaign provider syncUnsubscribe failed (non-fatal)", {
        provider: provider.name,
        email: maskEmail(subscriber.email),
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return { success: true };
  } catch (error) {
    serviceLogger.error("unsubscribe failed unexpectedly", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      reason: "error",
      error: "We could not process your unsubscribe request. Please try again.",
    };
  }
}
