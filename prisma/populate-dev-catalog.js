/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS script executed directly with `node`; the package is not ESM. */
const { PrismaClient } = require('@prisma/client');
const { createDeterministicDevCatalogData } = require('./dev-catalog-data');

const prisma = new PrismaClient();

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const HOSTED_DATABASE_HINTS = ['pooler.supabase.com', '.supabase.co', 'rds.amazonaws.com', 'neon.tech', 'render.com'];

function isTruthy(value) {
  return TRUE_VALUES.has((value ?? '').trim().toLowerCase());
}

function isDeploymentRuntime(env) {
  return (
    (env.NODE_ENV ?? '').trim().toLowerCase() === 'production'
    || isTruthy(env.CI)
    || isTruthy(env.VERCEL)
  );
}

function looksLikeHostedDatabaseUrl(databaseUrl) {
  const normalized = (databaseUrl ?? '').toLowerCase();
  return HOSTED_DATABASE_HINTS.some((hint) => normalized.includes(hint));
}

function assertSafeRuntime(env) {
  if (isDeploymentRuntime(env)) {
    throw new Error(
      'Refusing to populate demo catalog data in production/deployment-like runtime. This script is local/dev only.',
    );
  }

  const databaseUrl = (env.DATABASE_URL ?? '').trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Add a local/dev database URL before running the catalog populator.');
  }

  if (looksLikeHostedDatabaseUrl(databaseUrl) && !isTruthy(env.PRISMA_ALLOW_HOSTED_DEV_SEED)) {
    throw new Error(
      'Hosted database URL detected. Refusing by default. For intentional disposable remote dev usage, set PRISMA_ALLOW_HOSTED_DEV_SEED=true.',
    );
  }
}

async function upsertCategory(category) {
  return prisma.category.upsert({
    where: { slug: category.slug },
    update: {
      name: category.name,
      description: category.description,
      status: category.status,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      seoCanonicalUrl: category.seoCanonicalUrl,
      seoOgTitle: category.seoOgTitle,
      seoOgDescription: category.seoOgDescription,
      seoImageUrl: category.seoImageUrl,
      seoNoIndex: false,
      seoSchemaNotes: category.seoSchemaNotes,
    },
    create: {
      name: category.name,
      slug: category.slug,
      description: category.description,
      status: category.status,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      seoCanonicalUrl: category.seoCanonicalUrl,
      seoOgTitle: category.seoOgTitle,
      seoOgDescription: category.seoOgDescription,
      seoImageUrl: category.seoImageUrl,
      seoNoIndex: false,
      seoSchemaNotes: category.seoSchemaNotes,
    },
  });
}

async function upsertProductWithVariant(input) {
  const product = await prisma.product.upsert({
    where: { slug: input.product.slug },
    update: {
      masterSku: `DEV-${input.product.slug.toUpperCase()}`,
      name: input.product.name,
      shortDescription: input.product.shortDescription,
      description: input.product.description,
      status: input.product.status,
      categoryId: input.categoryId,
      metadata: input.product.metadata,
      seoTitle: input.product.seoTitle,
      seoDescription: input.product.seoDescription,
      seoCanonicalUrl: input.product.seoCanonicalUrl,
      seoOgTitle: input.product.seoOgTitle,
      seoOgDescription: input.product.seoOgDescription,
      seoImageUrl: input.product.seoImageUrl,
      seoNoIndex: false,
      seoSchemaNotes: input.product.seoSchemaNotes,
    },
    create: {
      masterSku: `DEV-${input.product.slug.toUpperCase()}`,
      name: input.product.name,
      slug: input.product.slug,
      shortDescription: input.product.shortDescription,
      description: input.product.description,
      status: input.product.status,
      categoryId: input.categoryId,
      metadata: input.product.metadata,
      seoTitle: input.product.seoTitle,
      seoDescription: input.product.seoDescription,
      seoCanonicalUrl: input.product.seoCanonicalUrl,
      seoOgTitle: input.product.seoOgTitle,
      seoOgDescription: input.product.seoOgDescription,
      seoImageUrl: input.product.seoImageUrl,
      seoNoIndex: false,
      seoSchemaNotes: input.product.seoSchemaNotes,
    },
  });

  const variant = await prisma.productVariant.upsert({
    where: { sku: input.product.variant.sku },
    update: {
      productId: product.id,
      title: input.product.variant.title,
      price: input.product.variant.price,
      compareAtPrice: input.product.variant.compareAtPrice,
      currency: input.product.variant.currency,
      isDefault: input.product.variant.isDefault,
    },
    create: {
      productId: product.id,
      sku: input.product.variant.sku,
      title: input.product.variant.title,
      price: input.product.variant.price,
      compareAtPrice: input.product.variant.compareAtPrice,
      currency: input.product.variant.currency,
      isDefault: input.product.variant.isDefault,
    },
  });

  await prisma.inventory.upsert({
    where: {
      productVariantId: variant.id,
    },
    update: {
      quantity: input.product.variant.inventory.quantity,
      reserved: input.product.variant.inventory.reserved,
      safetyStock: input.product.variant.inventory.safetyStock,
      location: 'KARACHI',
    },
    create: {
      productVariantId: variant.id,
      quantity: input.product.variant.inventory.quantity,
      reserved: input.product.variant.inventory.reserved,
      safetyStock: input.product.variant.inventory.safetyStock,
      location: 'KARACHI',
    },
  });

  await prisma.productImage.deleteMany({
    where: {
      productId: product.id,
      productVariantId: null,
    },
  });

  await prisma.productImage.createMany({
    data: input.product.images.map((url, index) => ({
      productId: product.id,
      url,
      alt: `${input.product.name} image ${index + 1}`,
      position: index,
    })),
  });

  return {
    productId: product.id,
    variantId: variant.id,
  };
}

async function main() {
  assertSafeRuntime(process.env);

  const dataset = createDeterministicDevCatalogData();
  console.log(
    `Populating local/dev demo catalog: ${dataset.totals.categories} categories, ${dataset.totals.products} products...`,
  );

  let createdOrUpdatedCategories = 0;
  let createdOrUpdatedProducts = 0;

  for (const entry of dataset.categoryProducts) {
    const categoryRecord = await upsertCategory(entry.category);
    createdOrUpdatedCategories += 1;

    for (const product of entry.products) {
      await upsertProductWithVariant({
        categoryId: categoryRecord.id,
        product,
      });
      createdOrUpdatedProducts += 1;
    }
  }

  console.log('Demo catalog population completed successfully.');
  console.log(`Categories upserted: ${createdOrUpdatedCategories}`);
  console.log(`Products upserted: ${createdOrUpdatedProducts}`);
  console.log(`Party Heaven eligible products (<= Rs. 280): ${dataset.totals.partyHeavenEligibleProducts}`);
}

main()
  .catch((error) => {
    console.error('Catalog population failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
