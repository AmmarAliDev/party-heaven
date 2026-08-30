import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

type GlobalPrismaCache = typeof globalThis & {
  __partyHeavenPrisma?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalPrismaCache;
let hasValidatedRuntimeDatabaseUrl = false;
let hasWarnedAboutRuntimeConnectionLimit = false;

export type DatabaseClient = PrismaClient;
export type DatabaseTransactionClient = Prisma.TransactionClient;
export type DatabaseExecutor = DatabaseClient | DatabaseTransactionClient;

function isDeploymentLikeRuntime(rawEnv: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = (rawEnv.NODE_ENV ?? '').trim().toLowerCase();
  const ci = (rawEnv.CI ?? '').trim().toLowerCase();
  const vercel = (rawEnv.VERCEL ?? '').trim().toLowerCase();

  return nodeEnv === 'production' || ci === '1' || ci === 'true' || vercel === '1' || vercel === 'true';
}

function getUrlSearchParam(databaseUrl: string, key: string): string | null {
  try {
    return new URL(databaseUrl).searchParams.get(key);
  } catch {
    return null;
  }
}

function validateRuntimeDatabaseUrl(): void {
  if (hasValidatedRuntimeDatabaseUrl) {
    return;
  }

  hasValidatedRuntimeDatabaseUrl = true;

  if (!isDeploymentLikeRuntime()) {
    return;
  }

  const databaseUrl = (process.env.DATABASE_URL ?? '').trim();
  const nonPoolingUrl = (process.env.POSTGRES_URL_NON_POOLING ?? '').trim();

  if (!databaseUrl) {
    return;
  }

  const normalizedUrl = databaseUrl.toLowerCase();
  const isHostedDatabase =
    normalizedUrl.includes('pooler.supabase.com') ||
    normalizedUrl.includes('.supabase.co') ||
    normalizedUrl.includes('pgbouncer=true');
  const isSupabasePooler = normalizedUrl.includes('pooler.supabase.com');
  const isSupabaseDirect = normalizedUrl.includes('.supabase.co') && !isSupabasePooler;

  if (isSupabaseDirect) {
    throw new Error(
      'Invalid Prisma runtime configuration: DATABASE_URL points to a direct Supabase host. Use pooled runtime URL for DATABASE_URL and keep POSTGRES_URL_NON_POOLING for migrations.',
    );
  }

  if (isHostedDatabase && !normalizedUrl.includes('pgbouncer=true')) {
    throw new Error(
      'Invalid Prisma runtime configuration: hosted DATABASE_URL must include pgbouncer=true in deployment-like environments.',
    );
  }

  if (isHostedDatabase && getUrlSearchParam(databaseUrl, 'connection_limit') !== '1') {
    if (!hasWarnedAboutRuntimeConnectionLimit) {
      hasWarnedAboutRuntimeConnectionLimit = true;
      console.warn(
        '[prisma] Hosted DATABASE_URL is missing connection_limit=1. Runtime will continue, but adding connection_limit=1 is strongly recommended for Prisma + PgBouncer compatibility.',
      );
    }
  }

  if (isHostedDatabase && nonPoolingUrl && nonPoolingUrl === databaseUrl) {
    throw new Error(
      'Invalid Prisma runtime configuration: DATABASE_URL and POSTGRES_URL_NON_POOLING must not be identical in deployment-like environments.',
    );
  }
}

function createPrismaClientOptions(): Prisma.PrismaClientOptions {
  if (process.env.NODE_ENV === 'development') {
    return {
      log: ['warn', 'error'],
    };
  }

  return {};
}

export function createPrismaClient(): PrismaClient {
  validateRuntimeDatabaseUrl();
  return new PrismaClient(createPrismaClientOptions());
}

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.__partyHeavenPrisma) {
    globalForPrisma.__partyHeavenPrisma = createPrismaClient();
  }

  return globalForPrisma.__partyHeavenPrisma;
}

export function resolveDbExecutor(db?: DatabaseExecutor): DatabaseExecutor {
  return db ?? getPrismaClient();
}