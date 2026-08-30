import type { RoleKey } from "@/lib/auth/roles";
import { logger, sanitizeForLogging } from "@/lib/logger";

import { normalizeRole } from "../auth/rbac";

const auditLogger = logger.child("audit");

export const adminAuditStatuses = ["attempt", "success", "failure"] as const;
export type AdminAuditStatus = (typeof adminAuditStatuses)[number];

export interface CreateAdminAuditEntryInput {
  action: string;
  actorId?: string | null;
  actorRole?: RoleKey | string | null;
  targetType?: string | null;
  targetId?: string | null;
  status?: AdminAuditStatus;
  summary?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

/**
 * Enriched audit payload used by future admin mutations.
 * `toAdminAuditLogData()` converts it into the Prisma `AuditLog` shape.
 */
export interface AdminAuditEntry {
  actorId: string | null;
  actorRole: RoleKey | null;
  action: string;
  model: string | null;
  modelId: string | null;
  status: AdminAuditStatus;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  error: unknown;
  createdAt: Date;
}

export function createAdminAuditEntry(input: CreateAdminAuditEntryInput): AdminAuditEntry {
  const action = input.action.trim();

  if (action.length === 0) {
    throw new Error("Admin audit actions require a non-empty action name.");
  }

  return {
    actorId: input.actorId ?? null,
    actorRole: normalizeRole(input.actorRole),
    action,
    model: input.targetType?.trim() || null,
    modelId: input.targetId?.trim() || null,
    status: input.status ?? "attempt",
    summary: input.summary?.trim() || null,
    metadata: input.metadata ? (sanitizeForLogging(input.metadata) as Record<string, unknown>) : null,
    error: input.error ? sanitizeForLogging(input.error) : null,
    createdAt: new Date(),
  };
}

export function toAdminAuditLogData(entry: AdminAuditEntry) {
  return {
    actorId: entry.actorId,
    action: entry.action,
    model: entry.model,
    modelId: entry.modelId,
    changes: {
      actorRole: entry.actorRole,
      status: entry.status,
      summary: entry.summary,
      metadata: entry.metadata,
      error: entry.error,
    },
    createdAt: entry.createdAt,
  };
}

/**
 * Temporary logging-backed audit helper for this foundation step.
 * Persisting entries to the `AuditLog` table is intentionally deferred until
 * admin mutations are introduced in later prompts.
 */
export function logAdminAction(input: CreateAdminAuditEntryInput) {
  const entry = createAdminAuditEntry(input);
  auditLogger.info("admin action recorded", toAdminAuditLogData(entry));
  return entry;
}
