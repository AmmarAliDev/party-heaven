import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailCampaignProvider } from "@/features/email-marketing/provider";
import {
  resetEmailCampaignProvider,
  setEmailCampaignProvider,
} from "@/features/email-marketing/providers/index";
import { subscribeEmail, unsubscribeByToken } from "@/features/email-marketing/service";

// ---------------------------------------------------------------------------
// Prisma mock — simulates the EmailSubscriber table
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => {
  return {
    emailSubscriber: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
  defineRepository: (factory: (ctx: { db: unknown }) => unknown) => {
    return () => factory({ db: prismaMock });
  },
  resolveDbExecutor: (db?: unknown) => db ?? prismaMock,
}));

// ---------------------------------------------------------------------------
// Provider mock
// ---------------------------------------------------------------------------

const mockProvider: EmailCampaignProvider = {
  name: "mock",
  syncSubscriber: vi.fn().mockResolvedValue({}),
  syncUnsubscribe: vi.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSubscriberRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sub-1",
    email: "test@example.com",
    firstName: "Test",
    source: "newsletter_popup",
    status: "PENDING",
    tags: [],
    unsubscribeToken: "token-abc123",
    confirmedAt: null,
    unsubscribedAt: null,
    providerMeta: null,
    createdAt: new Date("2026-04-21T00:00:00.000Z"),
    updatedAt: new Date("2026-04-21T00:00:00.000Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("subscribeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEmailCampaignProvider(mockProvider);
  });

  afterEach(() => {
    resetEmailCampaignProvider();
  });

  it("creates a new subscriber with PENDING status", async () => {
    prismaMock.emailSubscriber.findUnique.mockResolvedValue(null);
    prismaMock.emailSubscriber.create.mockResolvedValue(makeSubscriberRow());

    const result = await subscribeEmail({
      email: "test@example.com",
      source: "newsletter_popup",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.alreadySubscribed).toBe(false);
    expect(result.subscriber.email).toBe("test@example.com");
    expect(result.subscriber.status).toBe("PENDING");
    expect(prismaMock.emailSubscriber.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "test@example.com",
          source: "newsletter_popup",
          status: "PENDING",
        }),
      }),
    );
  });

  it("normalises email to lowercase", async () => {
    prismaMock.emailSubscriber.findUnique.mockResolvedValue(null);
    prismaMock.emailSubscriber.create.mockResolvedValue(
      makeSubscriberRow({ email: "user@example.com" }),
    );

    await subscribeEmail({ email: "USER@EXAMPLE.COM", source: "checkout" });

    expect(prismaMock.emailSubscriber.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "user@example.com" }),
      }),
    );
  });

  it("returns alreadySubscribed=true when email is ACTIVE", async () => {
    const existing = makeSubscriberRow({ status: "ACTIVE" });
    prismaMock.emailSubscriber.findUnique.mockResolvedValue(existing);
    prismaMock.emailSubscriber.update.mockResolvedValue(existing);

    const result = await subscribeEmail({
      email: "test@example.com",
      source: "order_completion",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.alreadySubscribed).toBe(true);
    // Should NOT create a new row
    expect(prismaMock.emailSubscriber.create).not.toHaveBeenCalled();
  });

  it("returns alreadySubscribed=true and does not update a BOUNCED subscriber", async () => {
    const existing = makeSubscriberRow({ status: "BOUNCED" });
    prismaMock.emailSubscriber.findUnique.mockResolvedValue(existing);

    const result = await subscribeEmail({
      email: "test@example.com",
      source: "newsletter_popup",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.alreadySubscribed).toBe(true);
    // Neither create nor update should be called for BOUNCED
    expect(prismaMock.emailSubscriber.create).not.toHaveBeenCalled();
    expect(prismaMock.emailSubscriber.update).not.toHaveBeenCalled();
  });

  it("returns an error for an invalid email address", async () => {
    const result = await subscribeEmail({
      email: "not-an-email",
      source: "checkout",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeTruthy();
    expect(prismaMock.emailSubscriber.create).not.toHaveBeenCalled();
  });

  it("returns an error when source is missing", async () => {
    const result = await subscribeEmail({
      email: "test@example.com",
      source: "",
    });

    expect(result.success).toBe(false);
  });

  it("handles unexpected database errors gracefully", async () => {
    prismaMock.emailSubscriber.findUnique.mockRejectedValue(
      new Error("Connection refused"),
    );

    const result = await subscribeEmail({
      email: "test@example.com",
      source: "newsletter_popup",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/could not save your subscription/i);
  });
});

describe("unsubscribeByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEmailCampaignProvider(mockProvider);
  });

  afterEach(() => {
    resetEmailCampaignProvider();
  });

  it("marks the subscriber as UNSUBSCRIBED by token", async () => {
    const existing = makeSubscriberRow({ status: "ACTIVE" });
    prismaMock.emailSubscriber.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if ("unsubscribeToken" in where) return Promise.resolve({ id: "sub-1", status: "ACTIVE" });
      return Promise.resolve(null);
    });
    prismaMock.emailSubscriber.update.mockResolvedValue({
      ...existing,
      status: "UNSUBSCRIBED",
      unsubscribedAt: new Date(),
    });

    const result = await unsubscribeByToken({ token: "token-abc123" });

    expect(result.success).toBe(true);
    expect(prismaMock.emailSubscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ status: "UNSUBSCRIBED" }),
      }),
    );
  });

  it("returns success even when token is not found (anti-enumeration)", async () => {
    prismaMock.emailSubscriber.findUnique.mockResolvedValue(null);

    const result = await unsubscribeByToken({ token: "unknown-token" });

    expect(result.success).toBe(true);
    expect(prismaMock.emailSubscriber.update).not.toHaveBeenCalled();
  });

  it("returns an error for an empty token", async () => {
    const result = await unsubscribeByToken({ token: "" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/token/i);
  });

  it("is idempotent for already-UNSUBSCRIBED subscribers", async () => {
    prismaMock.emailSubscriber.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if ("unsubscribeToken" in where)
        return Promise.resolve({ id: "sub-1", status: "UNSUBSCRIBED" });
      if ("id" in where)
        return Promise.resolve(makeSubscriberRow({ status: "UNSUBSCRIBED" }));
      return Promise.resolve(null);
    });

    const result = await unsubscribeByToken({ token: "token-abc123" });

    expect(result.success).toBe(true);
    // No further update should be issued
    expect(prismaMock.emailSubscriber.update).not.toHaveBeenCalled();
  });
});
