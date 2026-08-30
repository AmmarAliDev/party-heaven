import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/errors/app-error";
import { createLogger } from "@/lib/logger";
import { getPrismaClient } from "@/server/db";

import {
  type AdminStoreSettingsInput,
  adminStoreSettingsSingletonId,
  defaultAdminStoreSettings,
  validateAdminStoreSettingsInput,
} from "./validation";

const logger = createLogger("admin.settings.service");

type AuditActorInput = {
  actorId: string;
  actorRole?: string | null;
};

type AdminDbClient = ReturnType<typeof getPrismaClient> | Prisma.TransactionClient;

type StoreSettingsRow = Awaited<
  ReturnType<ReturnType<typeof getPrismaClient>["storeSettings"]["findUnique"]>
>;

export type AdminStoreSettingsRecord = AdminStoreSettingsInput & {
  id: string;
  updatedAt: Date;
};

export type AdminStoreSettingsLoadResult = {
  settings: AdminStoreSettingsRecord;
  hasPersistedSettings: boolean;
};

function mapStoreSettingsRow(record: NonNullable<StoreSettingsRow>): AdminStoreSettingsRecord {
  const parsed = validateAdminStoreSettingsInput({
    storeName: record.storeName,
    storeTagline: record.storeTagline ?? undefined,
    supportEmail: record.supportEmail,
    supportPhone: record.supportPhone ?? undefined,
    supportWhatsapp: record.supportWhatsapp ?? undefined,
    supportHours: record.supportHours ?? undefined,
    shippingOriginCity: record.shippingOriginCity,
    shippingFlatRate: record.shippingFlatRate,
    shippingFreeThreshold: record.shippingFreeThreshold ?? undefined,
    dispatchLeadTimeDays: record.dispatchLeadTimeDays,
    lowStockThreshold: record.lowStockThreshold,
    allowBackorders: record.allowBackorders,
  });

  if (!parsed.success) {
    throw new AppError("Persisted store settings failed validation.", "STORE_SETTINGS_CORRUPT", {
      statusCode: 500,
      userMessage: "Store settings are temporarily unavailable. Please contact support.",
      cause: parsed.error,
    });
  }

  return {
    id: record.id,
    updatedAt: record.updatedAt,
    ...parsed.data,
  };
}

function buildWriteData(data: AdminStoreSettingsInput) {
  return {
    storeName: data.storeName,
    storeTagline: data.storeTagline ?? null,
    supportEmail: data.supportEmail,
    supportPhone: data.supportPhone ?? null,
    supportWhatsapp: data.supportWhatsapp ?? null,
    supportHours: data.supportHours ?? null,
    shippingOriginCity: data.shippingOriginCity,
    shippingFlatRate: data.shippingFlatRate,
    shippingFreeThreshold: data.shippingFreeThreshold ?? null,
    dispatchLeadTimeDays: data.dispatchLeadTimeDays,
    lowStockThreshold: data.lowStockThreshold,
    allowBackorders: data.allowBackorders,
  };
}

function sanitizeJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === null) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entryValue]) => {
        if (entryValue === undefined) {
          return [];
        }

        return [[key, sanitizeJsonValue(entryValue)]];
      }),
    );
  }

  return `${value ?? ""}`;
}

async function writeAuditLog(
  database: AdminDbClient,
  actor: AuditActorInput,
  settingsId: string,
  changes: Record<string, unknown>,
) {
  await database.auditLog.create({
    data: {
      actorId: actor.actorId,
      action: "settings.updated",
      model: "StoreSettings",
      modelId: settingsId,
      changes: sanitizeJsonValue(changes),
    },
  });
}

export async function loadAdminStoreSettings(): Promise<AdminStoreSettingsLoadResult> {
  const database = getPrismaClient();
  const record = await database.storeSettings.findUnique({
    where: { id: adminStoreSettingsSingletonId },
  });

  if (!record) {
    return {
      hasPersistedSettings: false,
      settings: {
        id: adminStoreSettingsSingletonId,
        updatedAt: new Date(0),
        ...defaultAdminStoreSettings,
      },
    };
  }

  return {
    hasPersistedSettings: true,
    settings: mapStoreSettingsRow(record),
  };
}

export async function saveAdminStoreSettings({
  data,
  actor,
}: {
  data: AdminStoreSettingsInput;
  actor: AuditActorInput;
}): Promise<AdminStoreSettingsRecord> {
  const database = getPrismaClient();

  try {
    return await database.$transaction(async (tx) => {
      const saved = await tx.storeSettings.upsert({
        where: { id: adminStoreSettingsSingletonId },
        create: {
          id: adminStoreSettingsSingletonId,
          ...buildWriteData(data),
        },
        update: buildWriteData(data),
      });

      await writeAuditLog(tx, actor, saved.id, {
        storeName: saved.storeName,
        supportEmail: saved.supportEmail,
        shippingOriginCity: saved.shippingOriginCity,
        shippingFlatRate: saved.shippingFlatRate,
        shippingFreeThreshold: saved.shippingFreeThreshold,
        dispatchLeadTimeDays: saved.dispatchLeadTimeDays,
        lowStockThreshold: saved.lowStockThreshold,
        allowBackorders: saved.allowBackorders,
      });

      return mapStoreSettingsRow(saved);
    });
  } catch (error) {
    logger.error("Store settings save failed", {
      operation: "saveAdminStoreSettings",
      actorId: actor.actorId,
      error,
    });

    throw new AppError("Failed to save store settings.", "STORE_SETTINGS_SAVE_FAILED", {
      statusCode: 500,
      userMessage: "Store settings could not be saved right now. Please try again.",
      cause: error,
    });
  }
}
