import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { routes } from "@/config/routes";
import { normalizeCatalogImageUrl } from "@/features/catalog/lib/product-image-url";
import { HOMEPAGE_FALLBACK_SECTIONS } from "@/features/homepage/fallback-content";
import type { AnnouncementBarSection, DealSpotlightSection, HomepageContent, HomepageSection, PartyHeavenSection } from "@/features/homepage/types";
import { logAdminAction } from "@/lib/audit/admin-actions";
import { AppError } from "@/lib/errors/app-error";
import { createLogger } from "@/lib/logger";
import { getPrismaClient } from "@/server/db";

import {
  type AdminBannerInput,
  type AdminDealCampaignInput,
  type AdminHomepageSectionInput,
  isScheduledWindowActive,
  validateAdminBannerInput,
  validateAdminDealCampaignInput,
  validateAdminHomepageSectionInput,
} from "./validation";

const logger = createLogger("admin.homepage.service");

type AuditActorInput = {
  actorId: string;
  actorRole?: string | null;
};

type AdminDbClient = ReturnType<typeof getPrismaClient> | Prisma.TransactionClient;

type HomePageSectionRow = Awaited<ReturnType<ReturnType<typeof getPrismaClient>["homePageSection"]["findMany"]>>[number];
type BannerRow = Awaited<ReturnType<ReturnType<typeof getPrismaClient>["banner"]["findMany"]>>[number];
type DealCampaignRow = Awaited<ReturnType<ReturnType<typeof getPrismaClient>["dealCampaign"]["findMany"]>>[number] & {
  price?: number | null;
  compareAt?: number | null;
};

const FALLBACK_DEAL_SPOTLIGHT_SECTION = HOMEPAGE_FALLBACK_SECTIONS.find(
  (section): section is DealSpotlightSection => section.kind === "deal-spotlight",
);
const FALLBACK_CAMPAIGN_SPOTLIGHT_PRICE = FALLBACK_DEAL_SPOTLIGHT_SECTION?.price ?? 0;
const FALLBACK_CAMPAIGN_SPOTLIGHT_COMPARE_AT =
  FALLBACK_DEAL_SPOTLIGHT_SECTION?.compareAt ?? FALLBACK_CAMPAIGN_SPOTLIGHT_PRICE;

export type AdminHomepageSectionRecord = {
  id: string;
  key: string;
  title: string;
  type: string;
  position: number;
  active: boolean;
  startAt: Date | null;
  endAt: Date | null;
  contentJson: string;
  updatedAt: Date;
};

export type AdminBannerRecord = {
  id: string;
  title: string;
  imageUrl: string;
  href: string;
  position: number;
  active: boolean;
  startAt: Date | null;
  endAt: Date | null;
  updatedAt: Date;
};

export type AdminDealCampaignRecord = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  compareAt: number | null;
  targetHref: string;
  imageUrl: string;
  imageAlt: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  updatedAt: Date;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseOptionalDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTimeLocalValue(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
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

function stringifyContent(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function getSectionSchedule(record: { meta?: Prisma.JsonValue | null }) {
  const meta = asRecord(record.meta);

  return {
    startAt: parseOptionalDate(meta.startAt),
    endAt: parseOptionalDate(meta.endAt),
  };
}

function mapAdminHomepageSectionRecord(record: HomePageSectionRow): AdminHomepageSectionRecord {
  const schedule = getSectionSchedule(record);

  return {
    id: record.id,
    key: record.key,
    title: record.title,
    type: record.type,
    position: record.position,
    active: record.active,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    contentJson: stringifyContent(record.content),
    updatedAt: record.updatedAt,
  };
}

function mapAdminBannerRecord(record: BannerRow): AdminBannerRecord {
  return {
    id: record.id,
    title: record.title,
    imageUrl: record.imageUrl,
    href: record.href ?? "",
    position: record.position,
    active: record.active,
    startAt: record.startAt,
    endAt: record.endAt,
    updatedAt: record.updatedAt,
  };
}

function mapAdminDealCampaignRecord(record: DealCampaignRow): AdminDealCampaignRecord {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? "",
    price: record.price ?? null,
    compareAt: record.compareAt ?? null,
    targetHref: record.targetHref ?? "",
    imageUrl: record.imageUrl ?? "",
    imageAlt: record.imageAlt ?? "",
    active: record.active,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    updatedAt: record.updatedAt,
  };
}

function buildSectionMeta(input: Pick<AdminHomepageSectionInput, "startAt" | "endAt">) {
  const meta: Record<string, unknown> = {};

  if (input.startAt) {
    meta.startAt = input.startAt.toISOString();
  }

  if (input.endAt) {
    meta.endAt = input.endAt.toISOString();
  }

  return sanitizeJsonValue(meta);
}

function buildHomepageSectionWriteData(input: AdminHomepageSectionInput) {
  return {
    key: input.key,
    title: input.title,
    type: input.type,
    position: input.position,
    active: input.active,
    content: sanitizeJsonValue(input.content),
    meta: buildSectionMeta(input),
  };
}

function buildBannerWriteData(input: AdminBannerInput) {
  return {
    title: input.title,
    imageUrl: input.imageUrl,
    href: input.href ?? null,
    position: input.position,
    active: input.active,
    startAt: input.startAt ?? null,
    endAt: input.endAt ?? null,
  };
}

function buildDealCampaignWriteData(input: AdminDealCampaignInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    price: input.price ?? null,
    compareAt: input.compareAt ?? null,
    targetHref: input.targetHref ?? null,
    imageUrl: input.imageUrl ?? null,
    imageAlt: input.imageAlt ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    active: input.active,
  };
}

function isValidStorefrontHref(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

function resolveCampaignSpotlightHref(
  record: Pick<DealCampaignRow, "id" | "targetHref">,
  featuredProduct: { slug: string; category: { slug: string } | null } | undefined,
) {
  const normalizedTargetHref = (record.targetHref ?? "").trim();

  if (normalizedTargetHref.length > 0) {
    if (isValidStorefrontHref(normalizedTargetHref)) {
      return normalizedTargetHref;
    }

    logger.warn("Ignoring invalid campaign target href; using fallback spotlight destination.", {
      campaignId: record.id,
      targetHref: normalizedTargetHref,
    });
  }

  if (featuredProduct?.category?.slug) {
    return routes.storefront.product(featuredProduct.category.slug, featuredProduct.slug);
  }

  return routes.storefront.categories;
}

function resolveCampaignSpotlightImage(
  record: Pick<DealCampaignRow, "imageUrl" | "imageAlt">,
  featuredProductImage: { url: string; alt: string | null } | undefined,
  campaignName: string,
) {
  const campaignImageUrl = normalizeCatalogImageUrl(record.imageUrl);
  if (campaignImageUrl) {
    return {
      url: campaignImageUrl,
      alt: record.imageAlt?.trim() || `${campaignName} spotlight image`,
    };
  }

  const productImageUrl = normalizeCatalogImageUrl(featuredProductImage?.url);
  if (!productImageUrl) {
    return undefined;
  }

  return {
    url: productImageUrl,
    alt: featuredProductImage?.alt?.trim() || `${campaignName} spotlight image`,
  };
}

function resolveCampaignSpotlightPricing(
  record: Pick<DealCampaignRow, "id" | "price" | "compareAt">,
  featuredVariant: { price: number; compareAtPrice: number | null } | undefined,
) {
  const campaignPrice = record.price;
  const hasValidCampaignPrice = typeof campaignPrice === "number" && Number.isFinite(campaignPrice) && campaignPrice > 0;

  if (hasValidCampaignPrice) {
    const campaignCompareAt = record.compareAt;
    const compareAt =
      typeof campaignCompareAt === "number" && Number.isFinite(campaignCompareAt) && campaignCompareAt > campaignPrice
        ? campaignCompareAt
        : campaignPrice;

    return {
      price: campaignPrice,
      compareAt,
    };
  }

  const price = featuredVariant?.price;
  const hasValidPrice = typeof price === "number" && Number.isFinite(price) && price > 0;

  if (!hasValidPrice) {
    logger.warn("Using fallback spotlight pricing because linked campaign product pricing is missing.", {
      campaignId: record.id,
    });

    return {
      price: FALLBACK_CAMPAIGN_SPOTLIGHT_PRICE,
      compareAt: Math.max(FALLBACK_CAMPAIGN_SPOTLIGHT_COMPARE_AT, FALLBACK_CAMPAIGN_SPOTLIGHT_PRICE),
    };
  }

  const compareAtCandidate = featuredVariant?.compareAtPrice;
  const compareAt =
    typeof compareAtCandidate === "number" && Number.isFinite(compareAtCandidate) && compareAtCandidate > price
      ? compareAtCandidate
      : price;

  return {
    price,
    compareAt,
  };
}

async function writeAuditLog(
  database: AdminDbClient,
  actor: AuditActorInput,
  action: string,
  model: string,
  modelId: string,
  changes: Record<string, unknown>,
) {
  const sanitizedChanges = sanitizeJsonValue(changes);

  await database.auditLog.create({
    data: {
      actorId: actor.actorId,
      action,
      model,
      modelId,
      changes: sanitizedChanges,
    },
  });

  logAdminAction({
    actorId: actor.actorId,
    actorRole: actor.actorRole ?? null,
    action,
    targetType: model,
    targetId: modelId,
    status: "success",
    metadata: changes,
  });
}

function buildMutationError(error: unknown): AppError | null {
  if (!(error instanceof PrismaClientKnownRequestError)) {
    return null;
  }

  if (error.code === "P2002") {
    return new AppError("Homepage content key must be unique.", "HOMEPAGE_CONTENT_CONFLICT", {
      statusCode: 409,
      userMessage: "This homepage key is already being used by another record.",
    });
  }

  return null;
}

export function formatAdminDateTimeLocalValue(value: Date | null | undefined) {
  return formatDateTimeLocalValue(value);
}

export async function listAdminHomepageSections() {
  const database = getPrismaClient();
  const records = await database.homePageSection.findMany({
    orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
  });

  return records.map(mapAdminHomepageSectionRecord);
}

export async function listAdminBanners() {
  const database = getPrismaClient();
  const records = await database.banner.findMany({
    orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
  });

  return records.map(mapAdminBannerRecord);
}

export async function listAdminDealCampaigns() {
  const database = getPrismaClient();
  const records = await database.dealCampaign.findMany({
    orderBy: [{ startsAt: "asc" }, { updatedAt: "desc" }],
  });

  return records.map(mapAdminDealCampaignRecord);
}

export async function seedAdminHomepageSections({ actor }: { actor: AuditActorInput }) {
  const database = getPrismaClient();

  return database.$transaction(async (tx) => {
    const existing = await tx.homePageSection.findMany({
      select: { id: true },
      take: 1,
    });

    if (existing.length > 0) {
      return { created: false as const, count: 0 };
    }

    let createdCount = 0;

    for (const section of HOMEPAGE_FALLBACK_SECTIONS) {
      const content = (() => {
        switch (section.kind) {
          case "featured-categories":
            return {
              description: section.description,
              categories: section.categories,
            };
          case "featured-products":
            return {
              description: section.description,
              products: section.products,
            };
          case "deal-spotlight":
            return {
              description: section.description,
              dealLabel: section.dealLabel,
              price: section.price,
              compareAt: section.compareAt,
              ctaLabel: section.ctaLabel,
              ctaHref: section.ctaHref,
            };
          case "announcement-bar":
            return {
              message: section.message,
              href: section.href,
              label: section.label,
            };
          case "party-heaven":
            // Products are hydrated at runtime — only persist CMS-configurable shell fields.
            return {
              description: section.description,
              ctaLabel: section.ctaLabel,
              ctaHref: section.ctaHref,
              placeholderMessage: section.placeholderMessage,
            };
          default:
            return {};
        }
      })();

      const title = section.kind === "announcement-bar" ? section.message : section.title;

      await tx.homePageSection.create({
        data: {
          key: section.id,
          title,
          type: section.kind,
          position: section.displayOrder ?? 0,
          active: section.enabled !== false,
          content: sanitizeJsonValue(content),
          meta: {},
        },
      });

      createdCount += 1;
    }

    await writeAuditLog(tx, actor, "homepage.section.seeded", "HomePageSection", "seed", {
      count: createdCount,
      source: "fallback",
    });

    return { created: true as const, count: createdCount };
  });
}

export async function createAdminHomepageSection({ data, actor }: { data: AdminHomepageSectionInput; actor: AuditActorInput }) {
  const parsed = validateAdminHomepageSectionInput(data);
  if (!parsed.success) {
    throw new AppError("Homepage section input is invalid.", "HOMEPAGE_CONTENT_INVALID", {
      statusCode: 400,
      userMessage: "Please review the homepage section content and try again.",
    });
  }

  const database = getPrismaClient();

  try {
    return await database.$transaction(async (tx) => {
      const created = await tx.homePageSection.create({
        data: buildHomepageSectionWriteData(parsed.data),
      });

      await writeAuditLog(tx, actor, "homepage.section.created", "HomePageSection", created.id, {
        key: created.key,
        type: created.type,
        position: created.position,
        active: created.active,
      });

      return mapAdminHomepageSectionRecord(created);
    });
  } catch (error) {
    throw buildMutationError(error) ?? error;
  }
}

export async function updateAdminHomepageSection({ data, actor }: { data: AdminHomepageSectionInput; actor: AuditActorInput }) {
  const parsed = validateAdminHomepageSectionInput(data);
  if (!parsed.success || !parsed.data.id) {
    throw new AppError("Homepage section input is invalid.", "HOMEPAGE_CONTENT_INVALID", {
      statusCode: 400,
      userMessage: "Please review the homepage section content and try again.",
    });
  }

  const database = getPrismaClient();
  const sectionId = parsed.data.id;

  try {
    return await database.$transaction(async (tx) => {
      const existing = await tx.homePageSection.findUnique({
        where: { id: sectionId },
      });

      if (!existing) {
        throw new AppError("Homepage section not found.", "HOMEPAGE_CONTENT_NOT_FOUND", {
          statusCode: 404,
          userMessage: "The selected homepage section could not be found.",
        });
      }

      const updated = await tx.homePageSection.update({
        where: { id: sectionId },
        data: buildHomepageSectionWriteData(parsed.data),
      });

      await writeAuditLog(tx, actor, "homepage.section.updated", "HomePageSection", updated.id, {
        before: {
          title: existing.title,
          type: existing.type,
          position: existing.position,
          active: existing.active,
        },
        after: {
          title: updated.title,
          type: updated.type,
          position: updated.position,
          active: updated.active,
        },
      });

      return mapAdminHomepageSectionRecord(updated);
    });
  } catch (error) {
    throw buildMutationError(error) ?? error;
  }
}

export async function deleteAdminHomepageSection({ id, actor }: { id: string; actor: AuditActorInput }) {
  const sectionId = id.trim();

  if (sectionId.length === 0) {
    throw new AppError("Homepage section id is required.", "HOMEPAGE_CONTENT_INVALID", {
      statusCode: 400,
      userMessage: "The selected homepage section could not be removed because it is missing an id.",
    });
  }

  const database = getPrismaClient();

  try {
    return await database.$transaction(async (tx) => {
      const existing = await tx.homePageSection.findUnique({
        where: { id: sectionId },
      });

      if (!existing) {
        throw new AppError("Homepage section not found.", "HOMEPAGE_CONTENT_NOT_FOUND", {
          statusCode: 404,
          userMessage: "The selected homepage section could not be found.",
        });
      }

      await tx.homePageSection.delete({
        where: { id: sectionId },
      });

      await writeAuditLog(tx, actor, "homepage.section.deleted", "HomePageSection", sectionId, {
        key: existing.key,
        title: existing.title,
        type: existing.type,
        position: existing.position,
        active: existing.active,
      });

      return { id: sectionId };
    });
  } catch (error) {
    throw buildMutationError(error) ?? error;
  }
}

export async function createAdminBanner({ data, actor }: { data: AdminBannerInput; actor: AuditActorInput }) {
  const parsed = validateAdminBannerInput(data);
  if (!parsed.success) {
    throw new AppError("Banner input is invalid.", "HOMEPAGE_CONTENT_INVALID", {
      statusCode: 400,
      userMessage: "Please review the banner details and try again.",
    });
  }

  const database = getPrismaClient();

  try {
    return await database.$transaction(async (tx) => {
      const created = await tx.banner.create({
        data: buildBannerWriteData(parsed.data),
      });

      await writeAuditLog(tx, actor, "homepage.banner.created", "Banner", created.id, {
        title: created.title,
        position: created.position,
        active: created.active,
      });

      return mapAdminBannerRecord(created);
    });
  } catch (error) {
    throw buildMutationError(error) ?? error;
  }
}

export async function updateAdminBanner({ data, actor }: { data: AdminBannerInput; actor: AuditActorInput }) {
  const parsed = validateAdminBannerInput(data);
  if (!parsed.success || !parsed.data.id) {
    throw new AppError("Banner input is invalid.", "HOMEPAGE_CONTENT_INVALID", {
      statusCode: 400,
      userMessage: "Please review the banner details and try again.",
    });
  }

  const database = getPrismaClient();
  const bannerId = parsed.data.id;

  try {
    return await database.$transaction(async (tx) => {
      const existing = await tx.banner.findUnique({
        where: { id: bannerId },
      });

      if (!existing) {
        throw new AppError("Banner not found.", "HOMEPAGE_CONTENT_NOT_FOUND", {
          statusCode: 404,
          userMessage: "The selected banner could not be found.",
        });
      }

      const updated = await tx.banner.update({
        where: { id: bannerId },
        data: buildBannerWriteData(parsed.data),
      });

      await writeAuditLog(tx, actor, "homepage.banner.updated", "Banner", updated.id, {
        before: {
          title: existing.title,
          position: existing.position,
          active: existing.active,
        },
        after: {
          title: updated.title,
          position: updated.position,
          active: updated.active,
        },
      });

      return mapAdminBannerRecord(updated);
    });
  } catch (error) {
    throw buildMutationError(error) ?? error;
  }
}

export async function deleteAdminBanner({ id, actor }: { id: string; actor: AuditActorInput }) {
  const bannerId = id.trim();

  if (bannerId.length === 0) {
    throw new AppError("Banner id is required.", "HOMEPAGE_CONTENT_INVALID", {
      statusCode: 400,
      userMessage: "The selected banner could not be removed because it is missing an id.",
    });
  }

  const database = getPrismaClient();

  try {
    return await database.$transaction(async (tx) => {
      const existing = await tx.banner.findUnique({
        where: { id: bannerId },
      });

      if (!existing) {
        throw new AppError("Banner not found.", "HOMEPAGE_CONTENT_NOT_FOUND", {
          statusCode: 404,
          userMessage: "The selected banner could not be found.",
        });
      }

      await tx.banner.delete({
        where: { id: bannerId },
      });

      await writeAuditLog(tx, actor, "homepage.banner.deleted", "Banner", bannerId, {
        title: existing.title,
        position: existing.position,
        active: existing.active,
      });

      return { id: bannerId };
    });
  } catch (error) {
    throw buildMutationError(error) ?? error;
  }
}

export async function createAdminDealCampaign({ data, actor }: { data: AdminDealCampaignInput; actor: AuditActorInput }) {
  const parsed = validateAdminDealCampaignInput(data);
  if (!parsed.success) {
    throw new AppError("Deal campaign input is invalid.", "HOMEPAGE_CONTENT_INVALID", {
      statusCode: 400,
      userMessage: "Please review the campaign details and try again.",
    });
  }

  const database = getPrismaClient();

  try {
    return await database.$transaction(async (tx) => {
      const created = await tx.dealCampaign.create({
        data: buildDealCampaignWriteData(parsed.data),
      });

      await writeAuditLog(tx, actor, "homepage.campaign.created", "DealCampaign", created.id, {
        name: created.name,
        active: created.active,
      });

      return mapAdminDealCampaignRecord(created);
    });
  } catch (error) {
    throw buildMutationError(error) ?? error;
  }
}

export async function updateAdminDealCampaign({ data, actor }: { data: AdminDealCampaignInput; actor: AuditActorInput }) {
  const parsed = validateAdminDealCampaignInput(data);
  if (!parsed.success || !parsed.data.id) {
    throw new AppError("Deal campaign input is invalid.", "HOMEPAGE_CONTENT_INVALID", {
      statusCode: 400,
      userMessage: "Please review the campaign details and try again.",
    });
  }

  const database = getPrismaClient();
  const campaignId = parsed.data.id;

  try {
    return await database.$transaction(async (tx) => {
      const existing = await tx.dealCampaign.findUnique({
        where: { id: campaignId },
      });

      if (!existing) {
        throw new AppError("Deal campaign not found.", "HOMEPAGE_CONTENT_NOT_FOUND", {
          statusCode: 404,
          userMessage: "The selected deal campaign could not be found.",
        });
      }

      const updated = await tx.dealCampaign.update({
        where: { id: campaignId },
        data: buildDealCampaignWriteData(parsed.data),
      });

      await writeAuditLog(tx, actor, "homepage.campaign.updated", "DealCampaign", updated.id, {
        before: {
          name: existing.name,
          active: existing.active,
        },
        after: {
          name: updated.name,
          active: updated.active,
        },
      });

      return mapAdminDealCampaignRecord(updated);
    });
  } catch (error) {
    throw buildMutationError(error) ?? error;
  }
}

export async function deleteAdminDealCampaign({ id, actor }: { id: string; actor: AuditActorInput }) {
  const campaignId = id.trim();

  if (campaignId.length === 0) {
    throw new AppError("Deal campaign id is required.", "HOMEPAGE_CONTENT_INVALID", {
      statusCode: 400,
      userMessage: "The selected campaign could not be removed because it is missing an id.",
    });
  }

  const database = getPrismaClient();

  try {
    return await database.$transaction(async (tx) => {
      const existing = await tx.dealCampaign.findUnique({
        where: { id: campaignId },
      });

      if (!existing) {
        throw new AppError("Deal campaign not found.", "HOMEPAGE_CONTENT_NOT_FOUND", {
          statusCode: 404,
          userMessage: "The selected deal campaign could not be found.",
        });
      }

      await tx.dealCampaign.delete({
        where: { id: campaignId },
      });

      await writeAuditLog(tx, actor, "homepage.campaign.deleted", "DealCampaign", campaignId, {
        name: existing.name,
        active: existing.active,
      });

      return { id: campaignId };
    });
  } catch (error) {
    throw buildMutationError(error) ?? error;
  }
}

function mapSectionRecordToStorefrontSection(record: HomePageSectionRow, referenceTime: Date): HomepageSection | null {
  const schedule = getSectionSchedule(record);

  if (!record.active || !isScheduledWindowActive(schedule.startAt, schedule.endAt, referenceTime)) {
    return null;
  }

  const parsed = validateAdminHomepageSectionInput({
    id: record.id,
    key: record.key,
    title: record.title,
    type: record.type,
    position: record.position,
    active: record.active,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    content: record.content ?? {},
  });

  if (!parsed.success) {
    logger.warn("Skipping invalid homepage section record.", {
      sectionId: record.id,
      key: record.key,
      type: record.type,
      errors: parsed.errors,
    });
    return null;
  }

  const base = {
    id: record.key || record.id,
    enabled: parsed.data.active,
    displayOrder: parsed.data.position,
  };

  switch (parsed.data.type) {
    case "announcement-bar": {
      const content = parsed.data.content as { message: string; href?: string; label?: string };
      return {
        ...base,
        kind: "announcement-bar",
        message: content.message,
        ...(content.href ? { href: content.href } : {}),
        ...(content.label ? { label: content.label } : {}),
      };
    }
    case "featured-categories": {
      const content = parsed.data.content as {
        description?: string;
        categories: Array<{
          id: string;
          name: string;
          description: string;
          href: string;
          slug?: string;
          cardImageUrl?: string;
        }>;
      };
      return {
        ...base,
        kind: "featured-categories",
        title: parsed.data.title,
        ...(content.description ? { description: content.description } : {}),
        categories: content.categories,
      };
    }
    case "featured-products": {
      const content = parsed.data.content as {
        description?: string;
        products: Array<{
          id: string;
          name: string;
          description?: string;
          href: string;
          price: number;
          compareAt?: number;
          badge?: string;
        }>;
      };
      return {
        ...base,
        kind: "featured-products",
        title: parsed.data.title,
        ...(content.description ? { description: content.description } : {}),
        products: content.products,
      };
    }
    case "deal-spotlight": {
      const content = parsed.data.content as {
        description: string;
        dealLabel: string;
        price: number;
        compareAt: number;
        ctaLabel: string;
        ctaHref: string;
        image?: { url: string; alt: string };
      };
      return {
        ...base,
        kind: "deal-spotlight",
        title: parsed.data.title,
        description: content.description,
        dealLabel: content.dealLabel,
        price: content.price,
        compareAt: content.compareAt,
        ctaLabel: content.ctaLabel,
        ctaHref: content.ctaHref,
        ...(content.image ? { image: content.image } : {}),
      };
    }
    case "party-heaven": {
      // Products are never stored in CMS — they are hydrated at runtime from
      // the live catalog by hydratePartyHeavenSections() in the homepage service.
      const content = parsed.data.content as {
        description?: string;
        ctaLabel: string;
        ctaHref: string;
        placeholderMessage: string;
      };
      return {
        ...base,
        kind: "party-heaven",
        title: parsed.data.title,
        ...(content.description ? { description: content.description } : {}),
        products: [],
        ctaLabel: content.ctaLabel,
        ctaHref: content.ctaHref,
        placeholderMessage: content.placeholderMessage,
      } satisfies PartyHeavenSection;
    }
    default:
      return null;
  }
}

function mapBannerToStorefrontSection(record: BannerRow, referenceTime: Date): AnnouncementBarSection | null {
  if (!record.active || !isScheduledWindowActive(record.startAt, record.endAt, referenceTime)) {
    return null;
  }

  const message = record.title.trim();
  if (message.length === 0) {
    logger.warn("Skipping invalid banner with empty storefront message.", {
      bannerId: record.id,
    });
    return null;
  }

  const normalizedHref = (record.href ?? "").trim();
  const hasValidHref = normalizedHref.startsWith("/") || /^https?:\/\//i.test(normalizedHref);

  if (normalizedHref.length > 0 && !hasValidHref) {
    logger.warn("Skipping invalid banner href for storefront announcement link.", {
      bannerId: record.id,
      href: normalizedHref,
    });
  }

  return {
    id: `banner-${record.id}`,
    kind: "announcement-bar",
    enabled: true,
    displayOrder: record.position,
    message,
    ...(hasValidHref ? { href: normalizedHref, label: "View offer" } : {}),
  };
}

function mapCampaignToStorefrontSection(
  record: DealCampaignRow & {
    products?: Array<{
      product: {
        slug: string;
        category: { slug: string } | null;
        images: Array<{ url: string; alt: string | null }>;
        variants: Array<{
          price: number;
          compareAtPrice: number | null;
          images: Array<{ url: string; alt: string | null }>;
        }>;
      };
    }>;
  },
  index: number,
  referenceTime: Date,
): DealSpotlightSection | null {
  if (!record.active || !isScheduledWindowActive(record.startsAt, record.endsAt, referenceTime)) {
    return null;
  }

  const featuredProduct = record.products?.[0]?.product;
  // Variant products may store images per variant, so fall back to the first
  // variant's image when no product-level image exists.
  const featuredProductImage =
    featuredProduct?.images?.[0] ?? featuredProduct?.variants?.[0]?.images?.[0];
  const featuredVariant = featuredProduct?.variants?.[0];
  const pricing = resolveCampaignSpotlightPricing(record, featuredVariant);
  const ctaHref = resolveCampaignSpotlightHref(record, featuredProduct);
  const image = resolveCampaignSpotlightImage(record, featuredProductImage, record.name);

  return {
    id: `campaign-${record.id}`,
    kind: "deal-spotlight",
    enabled: true,
    displayOrder: 40 + index,
    title: record.name,
    description: record.description ?? "Short-term campaign promotion managed from admin.",
    dealLabel: "Active campaign",
    price: pricing.price,
    compareAt: pricing.compareAt,
    ctaLabel: "Shop campaign",
    ctaHref,
    ...(image ? { image } : {}),
  };
}

export async function loadHomepageContentForStorefront(referenceTime = new Date()): Promise<HomepageContent | null> {
  const database = getPrismaClient();

  try {
    const [sectionRecords, bannerRecords, campaignRecords] = await Promise.all([
      database.homePageSection.findMany({
        orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      }),
      database.banner.findMany({
        where: { active: true },
        orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      }),
      database.dealCampaign.findMany({
        where: { active: true },
        orderBy: [{ startsAt: "asc" }, { updatedAt: "desc" }],
        include: {
          products: {
            take: 1,
            include: {
              product: {
                select: {
                  slug: true,
                  category: {
                    select: {
                      slug: true,
                    },
                  },
                  images: {
                    take: 1,
                    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
                    select: {
                      url: true,
                      alt: true,
                    },
                  },
                  variants: {
                    take: 1,
                    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
                    select: {
                      price: true,
                      compareAtPrice: true,
                      images: {
                        take: 1,
                        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
                        select: {
                          url: true,
                          alt: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const sections: HomepageSection[] = [
      ...bannerRecords
        .map((record) => mapBannerToStorefrontSection(record, referenceTime))
        .filter((record): record is AnnouncementBarSection => record !== null),
      ...sectionRecords
        .map((record) => mapSectionRecordToStorefrontSection(record, referenceTime))
        .filter((record): record is HomepageSection => record !== null),
      ...campaignRecords
        .map((record, index) => mapCampaignToStorefrontSection(record, index, referenceTime))
        .filter((record): record is DealSpotlightSection => record !== null),
    ];

    return sections.length > 0 ? { sections } : null;
  } catch (error) {
    logger.error("Failed to load admin-managed homepage content.", error);
    return null;
  }
}
