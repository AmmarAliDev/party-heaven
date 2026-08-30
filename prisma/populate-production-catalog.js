const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const REQUIRED_CONFIRMATION_VALUE = 'LIVE_CATALOG_APPROVED';

let prisma;

function isTruthy(value) {
  return TRUE_VALUES.has((value ?? '').trim().toLowerCase());
}

async function loadPrismaEnv() {
  const { resolvePrismaEnv } = await import('../scripts/prisma-env.mjs');
  const { env } = resolvePrismaEnv(process.env, process.cwd());

  Object.assign(process.env, env);

  return env;
}

async function loadPrismaClientConstructor() {
  const prismaModule = await import('@prisma/client');
  return prismaModule.PrismaClient ?? prismaModule.default?.PrismaClient;
}

async function loadProductionCatalogFactory() {
  const catalogModule = await import('./production-catalog-data.js');
  return catalogModule.createProductionCatalogData ?? catalogModule.default?.createProductionCatalogData;
}

async function assertSafeRuntime(env) {
  const { looksLikeHostedDatabaseUrl } = await import('../scripts/prisma-env.mjs');
  const databaseUrl = (env.DATABASE_URL ?? '').trim();
  const confirmation = (env.PRODUCTION_CATALOG_SEED_CONFIRM ?? '').trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Set it before running the production catalog seed.');
  }

  if (confirmation !== REQUIRED_CONFIRMATION_VALUE) {
    throw new Error(
      `Refusing to populate the production catalog without explicit confirmation. Set PRODUCTION_CATALOG_SEED_CONFIRM=${REQUIRED_CONFIRMATION_VALUE} for this session and rerun.`,
    );
  }

  if (!looksLikeHostedDatabaseUrl(databaseUrl) && !isTruthy(env.PRISMA_ALLOW_LOCAL_PRODUCTION_CATALOG_SEED)) {
    throw new Error(
      'DATABASE_URL does not look like a hosted database. Refusing by default. For intentional local rehearsal only, set PRISMA_ALLOW_LOCAL_PRODUCTION_CATALOG_SEED=true.',
    );
  }
}

async function upsertCategory(category) {
  return prisma.category.upsert({
    where: { slug: category.slug },
    update: {
      name: category.name,
      description: category.description,
      cardImageUrl: category.cardImageUrl,
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
      cardImageUrl: category.cardImageUrl,
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

async function replaceProductSpecifications(productId, specifications) {
  await prisma.productSpecification.deleteMany({
    where: { productId },
  });

  if (specifications.length === 0) {
    return;
  }

  await prisma.productSpecification.createMany({
    data: specifications.map((specification) => ({
      productId,
      key: specification.key,
      value: specification.value,
      position: specification.position,
    })),
  });
}

async function replaceProductImages(productId, images, productName) {
  await prisma.productImage.deleteMany({
    where: {
      productId,
      productVariantId: null,
    },
  });

  if (images.length === 0) {
    return;
  }

  await prisma.productImage.createMany({
    data: images.map((url, index) => ({
      productId,
      url,
      alt: `${productName} image ${index + 1}`,
      position: index,
    })),
  });
}

async function upsertProductWithVariant(input) {
  const product = await prisma.product.upsert({
    where: { slug: input.product.slug },
    update: {
      masterSku: input.product.masterSku,
      name: input.product.name,
      shortDescription: input.product.shortDescription,
      description: input.product.description,
      status: input.product.status,
      categoryId: input.categoryId,
      weightGram: input.product.weightGram,
      heightMm: input.product.heightMm,
      widthMm: input.product.widthMm,
      depthMm: input.product.depthMm,
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
      masterSku: input.product.masterSku,
      name: input.product.name,
      slug: input.product.slug,
      shortDescription: input.product.shortDescription,
      description: input.product.description,
      status: input.product.status,
      categoryId: input.categoryId,
      weightGram: input.product.weightGram,
      heightMm: input.product.heightMm,
      widthMm: input.product.widthMm,
      depthMm: input.product.depthMm,
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
      options: input.product.variant.options,
      price: input.product.variant.price,
      compareAtPrice: input.product.variant.compareAtPrice,
      currency: input.product.variant.currency,
      isDefault: input.product.variant.isDefault,
    },
    create: {
      productId: product.id,
      sku: input.product.variant.sku,
      title: input.product.variant.title,
      options: input.product.variant.options,
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

  await replaceProductImages(product.id, input.product.images, input.product.name);
  await replaceProductSpecifications(product.id, input.product.specifications);

  return {
    productId: product.id,
    variantId: variant.id,
  };
}

async function main() {
  const env = await loadPrismaEnv();
  await assertSafeRuntime(env);

  const PrismaClient = await loadPrismaClientConstructor();
  const createProductionCatalogData = await loadProductionCatalogFactory();

  if (!PrismaClient || !createProductionCatalogData) {
    throw new Error('Failed to load production catalog dependencies.');
  }

  prisma = new PrismaClient();

  const dataset = createProductionCatalogData();
  console.log(
    `Populating production catalog: ${dataset.totals.categories} categories, ${dataset.totals.products} products...`,
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

  console.log('Production catalog population completed successfully.');
  console.log(`Categories upserted: ${createdOrUpdatedCategories}`);
  console.log(`Products upserted: ${createdOrUpdatedProducts}`);
  console.log(`Party Heaven eligible products (<= Rs. 280): ${dataset.totals.partyHeavenEligibleProducts}`);
}

main()
  .catch((error) => {
    console.error('Production catalog population failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });