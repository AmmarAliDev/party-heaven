import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import type { DatabaseExecutor } from "@/server/db";
import { defineRepository } from "@/server/db";

import type { EmailSubscriber } from "./types";

/** Minimal Prisma select for subscriber rows returned to callers. */
const SUBSCRIBER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  source: true,
  status: true,
  tags: true,
  unsubscribeToken: true,
  confirmedAt: true,
  unsubscribedAt: true,
  providerMeta: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type EmailSubscriberRepository = ReturnType<typeof createEmailSubscriberRepository>;

function mapRow(row: {
  id: string;
  email: string;
  firstName: string | null;
  source: string;
  status: string;
  tags: string[];
  unsubscribeToken: string;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  providerMeta: unknown;
  createdAt: Date;
  updatedAt: Date;
}): EmailSubscriber {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    source: row.source,
    status: row.status as EmailSubscriber["status"],
    tags: row.tags,
    unsubscribeToken: row.unsubscribeToken,
    confirmedAt: row.confirmedAt,
    unsubscribedAt: row.unsubscribedAt,
    providerMeta: row.providerMeta,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function createEmailSubscriberRepository({ db }: { db: DatabaseExecutor }) {
  return {
    /** Find a subscriber by email address (case-insensitive via Prisma's PostgreSQL default). */
    findByEmail(email: string): Promise<EmailSubscriber | null> {
      return db.emailSubscriber
        .findUnique({ where: { email: email.trim().toLowerCase() }, select: SUBSCRIBER_SELECT })
        .then((row) => (row ? mapRow(row) : null));
    },

    /** Find a subscriber by their unsubscribe token. */
    findByUnsubscribeToken(token: string): Promise<EmailSubscriber | null> {
      return db.emailSubscriber
        .findUnique({ where: { unsubscribeToken: token }, select: SUBSCRIBER_SELECT })
        .then((row) => (row ? mapRow(row) : null));
    },

    /**
     * Upsert a subscriber.
     * On conflict (same email): BOUNCED records are never re-activated (returned as-is);
     * UNSUBSCRIBED records are re-subscribed to PENDING status; PENDING/ACTIVE records
     * keep their status — only source, tags, and firstName are updated.
     */
    async upsert(input: {
      email: string;
      firstName?: string | null;
      source: string;
      tags: string[];
    }): Promise<{ subscriber: EmailSubscriber; alreadySubscribed: boolean }> {
      const normalizedEmail = input.email.trim().toLowerCase();
      const existing = await db.emailSubscriber.findUnique({
        where: { email: normalizedEmail },
        select: SUBSCRIBER_SELECT,
      });

      if (existing) {
        // If BOUNCED, do not re-activate. Return the existing record as-is.
        if (existing.status === "BOUNCED") {
          return { subscriber: mapRow(existing), alreadySubscribed: true };
        }

        // If UNSUBSCRIBED, re-subscribe by resetting to PENDING.
        // If already PENDING or ACTIVE, just update name/source/tags (non-destructive merge).
        const updated = await db.emailSubscriber.update({
          where: { email: normalizedEmail },
          data: {
            // Refresh source to the most recent capture point.
            source: input.source,
            // Merge tags — append new ones, keep existing.
            tags: { set: [...new Set([...existing.tags, ...input.tags])] },
            // Only overwrite name when a new value is explicitly provided.
            ...(input.firstName != null ? { firstName: input.firstName } : {}),
            // Re-subscribe if previously unsubscribed (clear the unsubscribed timestamp).
            ...(existing.status === "UNSUBSCRIBED"
              ? { status: "PENDING", unsubscribedAt: null }
              : {}),
          },
          select: SUBSCRIBER_SELECT,
        });

        return { subscriber: mapRow(updated), alreadySubscribed: existing.status !== "UNSUBSCRIBED" };
      }

      // New subscriber — create with PENDING status (double opt-in confirmation deferred).
      try {
        const created = await db.emailSubscriber.create({
          data: {
            email: normalizedEmail,
            firstName: input.firstName ?? null,
            source: input.source,
            status: "PENDING",
            tags: input.tags,
            unsubscribeToken: randomUUID().replace(/-/g, ""),
          },
          select: SUBSCRIBER_SELECT,
        });

        return { subscriber: mapRow(created), alreadySubscribed: false };
      } catch (err) {
        // Race condition: another request created this subscriber between our findUnique and create.
        if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
          const conflict = await db.emailSubscriber.findUnique({
            where: { email: normalizedEmail },
            select: SUBSCRIBER_SELECT,
          });
          if (!conflict) throw err;

          // Apply the same merge semantics as the existing branch.
          const updated = await db.emailSubscriber.update({
            where: { email: normalizedEmail },
            data: {
              source: input.source,
              tags: { set: [...new Set([...conflict.tags, ...input.tags])] },
              ...(input.firstName != null ? { firstName: input.firstName } : {}),
              ...(conflict.status === "UNSUBSCRIBED"
                ? { status: "PENDING", unsubscribedAt: null }
                : {}),
            },
            select: SUBSCRIBER_SELECT,
          });

          return { subscriber: mapRow(updated), alreadySubscribed: true };
        }
        throw err;
      }
    },

    /** Mark a subscriber as unsubscribed by token. Returns null if token not found. */
    async unsubscribeByToken(token: string): Promise<EmailSubscriber | null> {
      const existing = await db.emailSubscriber.findUnique({
        where: { unsubscribeToken: token },
        select: { id: true, status: true },
      });

      if (!existing) {
        return null;
      }

      // Idempotent — already unsubscribed is fine.
      if (existing.status === "UNSUBSCRIBED") {
        return db.emailSubscriber
          .findUnique({ where: { id: existing.id }, select: SUBSCRIBER_SELECT })
          .then((row) => (row ? mapRow(row) : null));
      }

      const updated = await db.emailSubscriber.update({
        where: { id: existing.id },
        data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
        select: SUBSCRIBER_SELECT,
      });

      return mapRow(updated);
    },

    /** Update provider metadata after a successful provider sync. */
    async updateProviderMeta(
      id: string,
      meta: Record<string, unknown>,
    ): Promise<void> {
      await db.emailSubscriber.update({
        where: { id },
        data: { providerMeta: meta as Prisma.InputJsonValue },
      });
    },
  };
}

/**
 * Factory that follows the `defineRepository` pattern from `@/server/db`.
 * Usage: `emailSubscriberRepository()` or `emailSubscriberRepository(tx)` inside
 * a transaction.
 */
export const emailSubscriberRepository = defineRepository(createEmailSubscriberRepository);
