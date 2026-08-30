/**
 * Smoke tests for the health/readiness endpoint logic.
 *
 * The handler is tested at the unit level — we verify the shape and status
 * codes of the JSON response under normal and degraded conditions without
 * spinning up a real HTTP server.
 */

import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma so the DB probe can be controlled without a real connection.
// ---------------------------------------------------------------------------
vi.mock("../../src/server/db/client", () => ({
  getPrismaClient: vi.fn(),
}));

// Import the handler after mocks are set up.
import { GET } from "../../src/app/api/health/route";
import { getPrismaClient } from "../../src/server/db/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrisma(queryResult: "pass" | "fail" | "timeout") {
  return {
    $queryRaw: queryResult === "fail"
      ? vi.fn().mockRejectedValue(new Error("Connection refused"))
      : queryResult === "timeout"
        ? vi.fn().mockImplementation(
            () => new Promise((_, reject) => setTimeout(() => reject(new Error("DB health check timed out")), 6_000)),
          )
        : vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Provide minimal required env vars for the env check to pass.
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      AUTH_SECRET: "a-very-long-test-secret-that-is-at-least-32-chars!!",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns 200 with status ok when all checks pass", async () => {
    vi.mocked(getPrismaClient).mockReturnValue(makePrisma("pass") as never);

    const response = await GET();

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.checks.env.status).toBe("pass");
    expect(body.checks.db.status).toBe("pass");
  });

  it("returns 503 with status degraded when the database is unreachable", async () => {
    vi.mocked(getPrismaClient).mockReturnValue(makePrisma("fail") as never);

    const response = await GET();

    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.db.status).toBe("fail");
    expect(body.checks.db.detail).toBe("Database unreachable");
    // Internal error message must not be exposed.
    expect(JSON.stringify(body)).not.toContain("Connection refused");
  });

  it("returns 503 when a required env var is missing", async () => {
    delete process.env["AUTH_SECRET"];
    vi.mocked(getPrismaClient).mockReturnValue(makePrisma("pass") as never);

    const response = await GET();

    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.env.status).toBe("fail");
    expect(body.checks.env.detail).toBe("Environment configuration incomplete");
    expect(JSON.stringify(body)).not.toContain("AUTH_SECRET");
  });

  it("includes uptime, timestamp, and appUrl in every response", async () => {
    vi.mocked(getPrismaClient).mockReturnValue(makePrisma("pass") as never);

    const response = await GET();
    const body = await response.json();

    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.appUrl).toBe("http://localhost:3000");
  });
});
