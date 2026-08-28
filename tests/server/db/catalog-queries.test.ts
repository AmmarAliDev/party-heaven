import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryRaw = vi.fn();
const mockProductFindMany = vi.fn();
const mockProductFindFirst = vi.fn();
const mockProductImageFindMany = vi.fn();

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('@/server/db', () => ({
  getPrismaClient: () => ({
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    product: {
      findMany: (...args: unknown[]) => mockProductFindMany(...args),
      findFirst: (...args: unknown[]) => mockProductFindFirst(...args),
    },
    productImage: {
      findMany: (...args: unknown[]) => mockProductImageFindMany(...args),
    },
  }),
}));

describe('catalog queries one-dollar count', () => {
  beforeEach(() => {
    vi.resetModules();
    mockQueryRaw.mockReset();
    mockProductFindMany.mockReset();
  });

  it('uses SQL-side count result when raw query succeeds', async () => {
    mockQueryRaw.mockResolvedValue([{ count: 7 }]);

    const { countPublishedOneDollarProducts } = await import('@/server/db/catalog-queries');
    const total = await countPublishedOneDollarProducts();

    expect(total).toBe(7);
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  it('falls back to Prisma findMany when raw query fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('raw SQL unavailable'));
    mockProductFindMany.mockResolvedValue([
      { variants: [{ price: 120 }] },
      { variants: [{ price: 280 }] },
      { variants: [{ price: 281 }] },
      { variants: [] },
    ]);

    const { countPublishedOneDollarProducts } = await import('@/server/db/catalog-queries');
    const total = await countPublishedOneDollarProducts();

    expect(total).toBe(2);
    expect(mockProductFindMany).toHaveBeenCalledOnce();
  });

  it('supports bigint count values from SQL drivers', async () => {
    mockQueryRaw.mockResolvedValue([{ count: 3n }]);

    const { countPublishedOneDollarProducts } = await import('@/server/db/catalog-queries');
    const total = await countPublishedOneDollarProducts();

    expect(total).toBe(3);
  });
});

describe('catalog searchPublishedProducts query widening', () => {
  beforeEach(() => {
    vi.resetModules();
    mockQueryRaw.mockReset();
    mockProductFindMany.mockReset();
    mockProductFindMany.mockResolvedValue([]);
  });

  it('matches category names in the where clause (searching a category surfaces its products)', async () => {
    const { searchPublishedProducts } = await import('@/server/db/catalog-queries');
    await searchPublishedProducts('candles', 8);

    const [args] = mockProductFindMany.mock.calls[0];
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        { category: { name: { contains: 'candle', mode: 'insensitive' } } },
      ]),
    );
  });

  it('widens plural tokens into singular variants', async () => {
    const { searchPublishedProducts } = await import('@/server/db/catalog-queries');
    await searchPublishedProducts('chains', 8);

    const [args] = mockProductFindMany.mock.calls[0];
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: 'chain', mode: 'insensitive' } },
      ]),
    );
  });

  it('splits multi-word queries into per-token OR conditions', async () => {
    const { searchPublishedProducts } = await import('@/server/db/catalog-queries');
    await searchPublishedProducts('scented candle', 8);

    const [args] = mockProductFindMany.mock.calls[0];
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: 'scented', mode: 'insensitive' } },
        { name: { contains: 'candle', mode: 'insensitive' } },
      ]),
    );
  });

  it('keeps publish-state visibility filters in the search where clause', async () => {
    const { searchPublishedProducts } = await import('@/server/db/catalog-queries');
    await searchPublishedProducts('candle', 8);

    const [args] = mockProductFindMany.mock.calls[0];
    expect(args.where.status).toBe('PUBLISHED');
    expect(args.where.category).toEqual(expect.objectContaining({ status: 'PUBLISHED' }));
  });

  it('fetches a candidate pool larger than the requested limit', async () => {
    const { searchPublishedProducts } = await import('@/server/db/catalog-queries');

    await searchPublishedProducts('candle', 8);
    expect(mockProductFindMany.mock.calls[0][0].take).toBe(32);

    await searchPublishedProducts('candle', 1);
    expect(mockProductFindMany.mock.calls[1][0].take).toBe(24);

    await searchPublishedProducts('candle', 100);
    expect(mockProductFindMany.mock.calls[2][0].take).toBe(60);
  });

  it('returns empty for queries with no usable tokens without hitting the DB', async () => {
    const { searchPublishedProducts } = await import('@/server/db/catalog-queries');
    const result = await searchPublishedProducts('a', 8);

    expect(result).toEqual([]);
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });
});

describe('getPublishedProductBySlug variant images', () => {
  beforeEach(() => {
    vi.resetModules();
    mockProductFindFirst.mockReset();
    mockProductImageFindMany.mockReset();
  });

  it('merges product-level and variant-level images for the detail page', async () => {
    mockProductFindFirst.mockResolvedValue({
      id: 'prod-1',
      name: 'Balloons',
      slug: 'balloons',
      shortDescription: null,
      description: null,
      masterSku: null,
      metadata: { variantsEnabled: true },
      createdAt: new Date(),
      updatedAt: new Date(),
      category: { id: 'cat-1', name: 'Balloons', slug: 'balloons' },
      images: [
        { id: 'img-shared', url: '/shared.jpg', alt: 'shared', position: 0, productVariantId: null },
      ],
      specifications: [],
      variants: [],
      reviews: [],
    });
    mockProductImageFindMany.mockResolvedValue([
      { id: 'img-var-1', url: '/var-1.jpg', alt: 'variant', position: 0, productVariantId: 'var-1' },
    ]);

    const { getPublishedProductBySlug } = await import('@/server/db/catalog-queries');
    const result = await getPublishedProductBySlug('balloons');

    expect(result).not.toBeNull();
    expect(result?.images.map((img) => img.id)).toEqual(['img-shared', 'img-var-1']);
    // Variant images are fetched scoped to the product's variants.
    expect(mockProductImageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productVariant: { productId: 'prod-1' } },
      }),
    );
  });

  it('returns null for an unknown product without querying variant images', async () => {
    mockProductFindFirst.mockResolvedValue(null);

    const { getPublishedProductBySlug } = await import('@/server/db/catalog-queries');
    const result = await getPublishedProductBySlug('missing');

    expect(result).toBeNull();
    expect(mockProductImageFindMany).not.toHaveBeenCalled();
  });
});

describe('storefront listing variant images', () => {
  beforeEach(() => {
    vi.resetModules();
    mockProductFindMany.mockReset();
    mockProductImageFindMany.mockReset();
  });

  function makeListingProduct(overrides: { id: string; images?: unknown[] }) {
    return {
      id: overrides.id,
      name: `Product ${overrides.id}`,
      slug: `product-${overrides.id}`,
      shortDescription: null,
      description: null,
      masterSku: null,
      metadata: { variantsEnabled: true },
      createdAt: new Date(),
      updatedAt: new Date(),
      category: { id: 'cat-1', name: 'Apparel', slug: 'apparel' },
      images: overrides.images ?? [],
      specifications: [],
      variants: [{ id: `var-${overrides.id}` }],
      reviews: [],
    };
  }

  it('merges variant images into category listing cards', async () => {
    mockProductFindMany.mockResolvedValue([makeListingProduct({ id: 'prod-1' })]);
    mockProductImageFindMany.mockResolvedValue([
      {
        id: 'img-var-1',
        url: '/blue.jpg',
        alt: 'Blue variant',
        position: 0,
        productVariantId: 'var-prod-1',
        productVariant: { productId: 'prod-1' },
      },
    ]);

    const { listPublishedProductsByCategory } = await import('@/server/db/catalog-queries');
    const result = await listPublishedProductsByCategory('apparel');

    expect(result).toHaveLength(1);
    expect(result[0]?.images.map((img) => img.id)).toEqual(['img-var-1']);
    // Variant images are fetched batched by owning product ids.
    expect(mockProductImageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productVariant: { productId: { in: ['prod-1'] } } },
      }),
    );
  });

  it('groups each variant image back to its owning product in a batch', async () => {
    mockProductFindMany.mockResolvedValue([
      makeListingProduct({ id: 'prod-1' }),
      makeListingProduct({ id: 'prod-2' }),
    ]);
    mockProductImageFindMany.mockResolvedValue([
      {
        id: 'img-2a',
        url: '/a.jpg',
        alt: null,
        position: 0,
        productVariantId: 'var-prod-2',
        productVariant: { productId: 'prod-2' },
      },
      {
        id: 'img-1a',
        url: '/b.jpg',
        alt: null,
        position: 0,
        productVariantId: 'var-prod-1',
        productVariant: { productId: 'prod-1' },
      },
    ]);

    const { listPublishedProductsByCategory } = await import('@/server/db/catalog-queries');
    const result = await listPublishedProductsByCategory('apparel');

    expect(result[0]?.images.map((img) => img.id)).toEqual(['img-1a']);
    expect(result[1]?.images.map((img) => img.id)).toEqual(['img-2a']);
  });

  it('keeps product-level images first when variant images also exist', async () => {
    mockProductFindMany.mockResolvedValue([
      makeListingProduct({
        id: 'prod-1',
        images: [
          { id: 'img-shared', url: '/shared.jpg', alt: null, position: 0, productVariantId: null },
        ],
      }),
    ]);
    mockProductImageFindMany.mockResolvedValue([
      {
        id: 'img-var-1',
        url: '/blue.jpg',
        alt: null,
        position: 1,
        productVariantId: 'var-prod-1',
        productVariant: { productId: 'prod-1' },
      },
    ]);

    const { listPublishedProductsByCategory } = await import('@/server/db/catalog-queries');
    const result = await listPublishedProductsByCategory('apparel');

    expect(result[0]?.images.map((img) => img.id)).toEqual(['img-shared', 'img-var-1']);
  });

  it('returns products unchanged when no variant images exist', async () => {
    mockProductFindMany.mockResolvedValue([makeListingProduct({ id: 'prod-1' })]);
    mockProductImageFindMany.mockResolvedValue([]);

    const { listPublishedProductsByCategory } = await import('@/server/db/catalog-queries');
    const result = await listPublishedProductsByCategory('apparel');

    expect(result).toHaveLength(1);
    expect(result[0]?.images).toEqual([]);
  });

  it('skips the variant-image query entirely when there are no products', async () => {
    mockProductFindMany.mockResolvedValue([]);

    const { listPublishedProductsByCategory } = await import('@/server/db/catalog-queries');
    const result = await listPublishedProductsByCategory('apparel');

    expect(result).toEqual([]);
    expect(mockProductImageFindMany).not.toHaveBeenCalled();
  });
});
