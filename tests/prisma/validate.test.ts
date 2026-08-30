import { spawnSync } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';

const prismaCliEntrypoint = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');

describe('Prisma schema', () => {
  it('validates with `prisma validate`', () => {
    const res = spawnSync(process.execPath, [prismaCliEntrypoint, 'validate'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://postgres:postgres@localhost:5432/party_heaven_test?schema=public',
        POSTGRES_URL_NON_POOLING:
          process.env.POSTGRES_URL_NON_POOLING ??
          process.env.DATABASE_URL ??
          'postgresql://postgres:postgres@localhost:5432/party_heaven_test?schema=public',
      },
    });
    expect(res.status === 0).toBeTruthy();
  }, 120_000);

  it('can generate migration SQL from the schema without connecting to a database', () => {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    const res = spawnSync(
      process.execPath,
      [
        prismaCliEntrypoint,
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema-datamodel',
        schemaPath,
        '--script',
      ],
      {
        encoding: 'utf-8',
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_URL ??
            'postgresql://postgres:postgres@localhost:5432/party_heaven_test?schema=public',
          POSTGRES_URL_NON_POOLING:
            process.env.POSTGRES_URL_NON_POOLING ??
            process.env.DATABASE_URL ??
            'postgresql://postgres:postgres@localhost:5432/party_heaven_test?schema=public',
        },
      },
    );

    expect(res.status === 0).toBeTruthy();
    expect(res.stdout).toContain('CREATE TABLE');
  }, 240_000);
});
