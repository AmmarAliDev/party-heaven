import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalNonPoolingUrl = process.env.POSTGRES_URL_NON_POOLING;
const originalNodeEnv = process.env.NODE_ENV;

describe('database client', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/party_heaven_test?schema=public';
    process.env.POSTGRES_URL_NON_POOLING = process.env.DATABASE_URL;
  });

  afterEach(async () => {
    const databaseModule = await import('@/server/db');

    try {
      await databaseModule.getPrismaClient().$disconnect();
    } catch {
      // Some tests intentionally validate startup failures before a client can be created.
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalNonPoolingUrl === undefined) {
      delete process.env.POSTGRES_URL_NON_POOLING;
    } else {
      process.env.POSTGRES_URL_NON_POOLING = originalNonPoolingUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('returns the same Prisma client instance across repeated calls', async () => {
    const { getPrismaClient } = await import('@/server/db');

    const firstClient = getPrismaClient();
    const secondClient = getPrismaClient();

    expect(firstClient).toBe(secondClient);
  });

  it('fails fast for deployment-like runtime when DATABASE_URL is a direct Supabase host', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL =
      'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres?sslmode=require';
    process.env.POSTGRES_URL_NON_POOLING = process.env.DATABASE_URL;

    const { createPrismaClient } = await import('@/server/db');

    expect(() => createPrismaClient()).toThrow(/direct Supabase host|pooled runtime URL/i);
  });
});
