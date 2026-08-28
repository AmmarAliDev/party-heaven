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
