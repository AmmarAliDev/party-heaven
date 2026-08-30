import { describe, expect, it, vi } from "vitest";

const mockClient = vi.hoisted(() => ({ _tag: "mockClient" as const }));

vi.mock("@/server/db/client", () => ({
  getPrismaClient: vi.fn().mockReturnValue(mockClient),
  resolveDbExecutor: vi.fn((db?: unknown) => (db === undefined ? mockClient : db)),
}));

import {
  createRepositoryContext,
  createServiceContext,
  defineRepository,
  defineService,
} from "@/server/db/repository";

describe("createRepositoryContext", () => {
  it("uses the mock client when no db is passed", () => {
    const ctx = createRepositoryContext();
    expect(ctx.db).toBe(mockClient);
  });

  it("uses the provided db executor when supplied", () => {
    const customDb = { _tag: "customDb" as const };
    const ctx = createRepositoryContext(customDb as never);
    expect(ctx.db).toBe(customDb);
  });
});

describe("createServiceContext", () => {
  it("returns the same shape as createRepositoryContext", () => {
    const ctx = createServiceContext();
    expect(ctx).toHaveProperty("db");
  });
});

describe("defineRepository", () => {
  it("wraps a factory and injects a context", () => {
    const capturedCtx: unknown[] = [];
    const useRepo = defineRepository((ctx) => {
      capturedCtx.push(ctx);
      return { find: () => "found" };
    });

    const repo = useRepo();
    expect(repo.find()).toBe("found");
    expect(capturedCtx).toHaveLength(1);
    expect((capturedCtx[0] as { db: unknown }).db).toBe(mockClient);
  });

  it("forwards a custom db to the factory context", () => {
    const customDb = { _tag: "tx" as const };
    let receivedDb: unknown;
    const useRepo = defineRepository((ctx) => {
      receivedDb = ctx.db;
      return {};
    });

    useRepo(customDb as never);
    expect(receivedDb).toBe(customDb);
  });
});

describe("defineService", () => {
  it("wraps a service factory and injects a context", () => {
    const useService = defineService((ctx) => ({
      getDb: () => ctx.db,
    }));

    const svc = useService();
    expect(svc.getDb()).toBe(mockClient);
  });
});
