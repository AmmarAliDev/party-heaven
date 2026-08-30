import { AppError } from "@/lib/errors/app-error";
import { getPrismaClient } from "@/server/db";

import {
  type AdminActivityFeedItem,
  type AuditLogActivityRecord,
  buildAdminActivityFeedItem,
} from "./audit-log-feed";

const DEFAULT_ADMIN_ACTIVITY_FEED_LIMIT = 30;
const MAX_ADMIN_ACTIVITY_FEED_LIMIT = 100;

export type ListAdminActivityFeedOptions = {
  take?: number;
};

export type AdminActivityFeedResult = {
  items: AdminActivityFeedItem[];
  nextCursor: string | null;
};

function normalizeTake(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value < 1) {
    return DEFAULT_ADMIN_ACTIVITY_FEED_LIMIT;
  }

  return Math.min(MAX_ADMIN_ACTIVITY_FEED_LIMIT, Math.floor(value));
}

export async function listAdminActivityFeed(options: ListAdminActivityFeedOptions = {}): Promise<AdminActivityFeedResult> {
  const db = getPrismaClient();
  const take = normalizeTake(options.take);

  try {
    const records = (await db.auditLog.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: {
        id: true,
        actorId: true,
        action: true,
        model: true,
        modelId: true,
        changes: true,
        createdAt: true,
      },
    })) as AuditLogActivityRecord[];

    const hasMore = records.length > take;
    const pageRecords = hasMore ? records.slice(0, take) : records;

    const actorIds = [...new Set(pageRecords.map((record) => record.actorId).filter((id): id is string => Boolean(id)))];
    const actorById = new Map<string, { id: string; name: string | null; email: string | null }>();

    if (actorIds.length > 0) {
      const users = await db.user.findMany({
        where: {
          id: {
            in: actorIds,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      for (const user of users) {
        actorById.set(user.id, user);
      }
    }

    return {
      items: pageRecords.map((record) => buildAdminActivityFeedItem(record, actorById)),
      nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null,
    };
  } catch (error) {
    throw new AppError("Admin activity feed query failed.", "ADMIN_ACTIVITY_FEED_QUERY_FAILED", {
      cause: error,
      statusCode: 500,
      userMessage: "Activity feed is temporarily unavailable. Please refresh and try again.",
    });
  }
}
