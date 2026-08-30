import { describe, expect, it } from 'vitest';

async function loadWorkflowHelpers() {
  const moduleUrl = new URL('../../scripts/prisma-env.mjs', import.meta.url).href;
  return import(moduleUrl);
}

const isolatedCwd = new URL('./__prisma_env_isolated__/', import.meta.url).pathname;

describe('Prisma workflow helpers', () => {
  it('falls back to DATABASE_URL when POSTGRES_URL_NON_POOLING is not set', async () => {
    const { buildPrismaProcessEnv } = await loadWorkflowHelpers();
    const env = buildPrismaProcessEnv(
      {
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/party_heaven_dev?schema=public',
      },
      isolatedCwd,
    );

    expect(env.POSTGRES_URL_NON_POOLING).toBe(env.DATABASE_URL);
  });

  it('allows prisma migrate dev for a local database URL', async () => {
    const { getMigrateDevSafetyCheck } = await loadWorkflowHelpers();
    const result = getMigrateDevSafetyCheck(
      {
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/party_heaven_dev?schema=public',
      },
      isolatedCwd,
    );

    expect(result.allowed).toBe(true);
  });

  it('blocks prisma migrate dev for obvious hosted Supabase URLs', async () => {
    const { getMigrateDevSafetyCheck } = await loadWorkflowHelpers();
    const result = getMigrateDevSafetyCheck(
      {
        DATABASE_URL:
          'postgresql://postgres:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
      },
      isolatedCwd,
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/hosted|production/i);
  });

  it('allows an explicit override for intentional remote development databases', async () => {
    const { getMigrateDevSafetyCheck } = await loadWorkflowHelpers();
    const result = getMigrateDevSafetyCheck(
      {
        DATABASE_URL:
          'postgresql://postgres:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
        PRISMA_ALLOW_HOSTED_MIGRATE_DEV: 'true',
      },
      isolatedCwd,
    );

    expect(result.allowed).toBe(true);
  });

  it('blocks migrate deploy when hosted DATABASE_URL is pooled and POSTGRES_URL_NON_POOLING is missing', async () => {
    const { getMigrateDeploySafetyCheck } = await loadWorkflowHelpers();
    const result = getMigrateDeploySafetyCheck(
      {
        DATABASE_URL:
          'postgresql://postgres:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
      },
      isolatedCwd,
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/POSTGRES_URL_NON_POOLING|direct|non-pooling/i);
  });

  it('allows migrate deploy when hosted pooled and direct URLs are properly separated', async () => {
    const { getMigrateDeploySafetyCheck } = await loadWorkflowHelpers();
    const result = getMigrateDeploySafetyCheck(
      {
        DATABASE_URL:
          'postgresql://postgres:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
        POSTGRES_URL_NON_POOLING:
          'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres?sslmode=require',
      },
      isolatedCwd,
    );

    expect(result.allowed).toBe(true);
  });

  it('blocks deployment runtime when DATABASE_URL points to a direct Supabase host', async () => {
    const { getRuntimeDatabaseSafetyCheck } = await loadWorkflowHelpers();
    const result = getRuntimeDatabaseSafetyCheck(
      {
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres?sslmode=require',
        POSTGRES_URL_NON_POOLING:
          'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres?sslmode=require',
      },
      isolatedCwd,
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/direct Supabase host|pooled/i);
  });

  it('allows deployment runtime when hosted pooled URL misses connection_limit=1, with recommendation', async () => {
    const { getRuntimeDatabaseSafetyCheck } = await loadWorkflowHelpers();
    const result = getRuntimeDatabaseSafetyCheck(
      {
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgresql://postgres:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
        POSTGRES_URL_NON_POOLING:
          'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres?sslmode=require',
      },
      isolatedCwd,
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/connection_limit=1/i);
  });

  it('allows deployment runtime when hosted pooled URL has pgbouncer and connection_limit=1', async () => {
    const { getRuntimeDatabaseSafetyCheck } = await loadWorkflowHelpers();
    const result = getRuntimeDatabaseSafetyCheck(
      {
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgresql://postgres:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1',
        POSTGRES_URL_NON_POOLING:
          'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres?sslmode=require',
      },
      isolatedCwd,
    );

    expect(result.allowed).toBe(true);
  });

  it('detects production-like deployment runtime through VERCEL or CI env', async () => {
    const { isDeploymentRuntime } = await loadWorkflowHelpers();

    expect(isDeploymentRuntime({ VERCEL: '1' })).toBe(true);
    expect(isDeploymentRuntime({ CI: 'true' })).toBe(true);
    expect(isDeploymentRuntime({ NODE_ENV: 'production' })).toBe(true);
    expect(isDeploymentRuntime({ NODE_ENV: 'development' })).toBe(false);
  });
});
