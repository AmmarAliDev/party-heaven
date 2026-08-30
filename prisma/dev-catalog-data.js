const PARTY_HEAVEN_MAX_PRICE_PKR = 280;

const CATEGORY_KEYS = [
  'HomeDecor',
  'HomeLiving',
  'KitchenDining',
  'HealthBeauty',
  'CleaningEss',
  'Tumbler',
  'StorageOrg',
  'Electronics',
  'Gadgets',
  'Cosmetics',
  'PersonalCare',
  'ToysHobbies',
  'BedroomBath',
  'LadiesCorner',
];

const CATEGORY_PRODUCT_TOPICS = {
  HomeDecor: ['Wall Accent', 'Vase Set', 'Decor Tray', 'Scented Candle', 'Table Runner', 'Photo Frame'],
  HomeLiving: ['Cushion Cover', 'Throw Blanket', 'Floor Mat', 'Room Organizer', 'Lamp Shade', 'Curtain Tie'],
  KitchenDining: ['Cutlery Rack', 'Spice Jar Set', 'Serving Spoon', 'Lunch Plate', 'Storage Box', 'Kitchen Towel'],
  HealthBeauty: ['Face Roller', 'Body Brush', 'Hair Wrap', 'Skincare Kit', 'Nail Care Set', 'Cotton Pads'],
  CleaningEss: ['Multi Surface Wipe', 'Scrub Brush', 'Dish Sponge Set', 'Glass Cloth', 'Soap Dispenser', 'Cleaning Glove'],
  Tumbler: ['Steel Tumbler', 'Travel Mug', 'Insulated Bottle', 'Coffee Flask', 'Sip Cup', 'Bottle Sleeve'],
  StorageOrg: ['Drawer Divider', 'Shelf Basket', 'Cable Box', 'Closet Organizer', 'Storage Crate', 'Hanging Pouch'],
  Electronics: ['USB Charger', 'Extension Board', 'LED Strip', 'Bluetooth Receiver', 'Power Adapter', 'Desk Fan'],
  Gadgets: ['Phone Stand', 'Mini Tripod', 'Smart Tag Holder', 'Selfie Remote', 'Laptop Riser', 'Earbud Case'],
  Cosmetics: ['Lip Tint', 'Compact Powder', 'Blush Palette', 'Makeup Brush', 'Primer Tube', 'Makeup Sponge'],
  PersonalCare: ['Toothbrush Holder', 'Body Mist', 'Comb Set', 'Shaving Razor', 'Hand Cream', 'Travel Kit'],
  ToysHobbies: ['Puzzle Pack', 'Building Blocks', 'Color Marker Set', 'Sketch Pad', 'Craft Scissors', 'Toy Car'],
  BedroomBath: ['Bath Towel', 'Bed Sheet Clip', 'Pillow Protector', 'Soap Tray', 'Laundry Bag', 'Shower Caddy'],
  LadiesCorner: ['Hair Claw Clip', 'Jewelry Box', 'Scarf Pin Set', 'Handbag Organizer', 'Makeup Pouch', 'Vanity Mirror'],
};

function toTitleCaseFromCamel(input) {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(input) {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildCategoryImageUrl(categorySlug) {
  return `https://placehold.co/1200x1200/png?text=${encodeURIComponent(`${categorySlug} category`)}`;
}

function buildProductImageUrls(input) {
  const base = `${input.categorySlug}-${input.productOrdinal}`;
  return [
    `https://placehold.co/1200x1200/png?text=${encodeURIComponent(`${input.categoryName} ${input.productName}`)}`,
    `https://placehold.co/1200x1200/png?text=${encodeURIComponent(`${input.categoryName} ${input.productName} detail`)}`,
    `https://picsum.photos/seed/${encodeURIComponent(base)}/1200/1200`,
  ];
}

function productCountForCategoryIndex(index) {
  return 4 + (index % 5);
}

function productPriceForIndex(productIndex) {
  if (productIndex === 0) {
    return 199;
  }

  if (productIndex === 1) {
    return 279;
  }

  const higherPriceLadder = [349, 429, 549, 699, 799, 999];
  return higherPriceLadder[(productIndex - 2) % higherPriceLadder.length];
}

function createCategoryRecord(categoryKey, categoryIndex) {
  const categoryName = toTitleCaseFromCamel(categoryKey);
  const categorySlug = slugify(categoryKey);

  return {
    key: categoryKey,
    name: categoryName,
    slug: categorySlug,
    description: `${categoryName} picks curated for local development demos and UI testing.`,
    seoTitle: `${categoryName} Demo Collection | Party Heaven`,
    seoDescription: `Browse ${categoryName} demo products with varied pricing and realistic merchandising data for local and dev verification.`,
    seoCanonicalUrl: `/categories/${categorySlug}`,
    seoOgTitle: `${categoryName} Deals - Party Heaven Demo`,
    seoOgDescription: `Development demo catalog for ${categoryName} with SEO-ready content and pricing variation.`,
    seoImageUrl: buildCategoryImageUrl(categorySlug),
    seoSchemaNotes: 'DEV_DEMO_CATEGORY',
    status: 'PUBLISHED',
    productCount: productCountForCategoryIndex(categoryIndex),
  };
}

function createProductRecord(input) {
  const productSlug = `${input.category.slug}-${input.productOrdinal}-${slugify(input.topic)}`;
  const productName = `${input.category.name} ${input.topic}`;
  const price = productPriceForIndex(input.productIndex);
  const isPartyHeavenEligible = price <= PARTY_HEAVEN_MAX_PRICE_PKR;

  return {
    name: productName,
    slug: productSlug,
    shortDescription: `${input.topic} for ${input.category.name} showcases in development environments.`,
    description: `${productName} is seeded for local and dev environments to validate product cards, category listings, and admin catalog workflows with realistic copy.`,
    status: 'PUBLISHED',
    seoTitle: `${productName} | ${input.category.name} | Party Heaven`,
    seoDescription: `Demo product in ${input.category.name}. Price: Rs. ${price}. Useful for validating storefront rendering and SEO behavior.`,
    seoCanonicalUrl: `/categories/${input.category.slug}/${productSlug}`,
    seoOgTitle: `${productName} - Demo Listing`,
    seoOgDescription: `Local/dev demo catalog item under ${input.category.name} with deterministic product data.`,
    seoImageUrl: buildProductImageUrls({
      categorySlug: input.category.slug,
      categoryName: input.category.name,
      productName,
      productOrdinal: input.productOrdinal,
    })[0],
    seoSchemaNotes: 'DEV_DEMO_PRODUCT',
    metadata: {
      source: 'dev-catalog-populator',
      categoryKey: input.category.key,
      seededAtVersion: 1,
      partyHeavenEligible: isPartyHeavenEligible,
    },
    images: buildProductImageUrls({
      categorySlug: input.category.slug,
      categoryName: input.category.name,
      productName,
      productOrdinal: input.productOrdinal,
    }),
    variant: {
      sku: `DEV-${input.category.slug.toUpperCase()}-${String(input.productOrdinal).padStart(2, '0')}`,
      title: 'Default',
      currency: 'PKR',
      price,
      compareAtPrice: price >= 300 ? price + 80 : price + 40,
      isDefault: true,
      inventory: {
        quantity: 24 + (input.productIndex * 3),
        reserved: input.productIndex % 2,
        safetyStock: 2,
      },
    },
  };
}

function createDeterministicDevCatalogData() {
  const categories = CATEGORY_KEYS.map((key, index) => createCategoryRecord(key, index));
  const categoryProducts = categories.map((category) => {
    const topics = CATEGORY_PRODUCT_TOPICS[category.key];
    const products = Array.from({ length: category.productCount }, (_, productIndex) =>
      createProductRecord({
        category,
        productIndex,
        productOrdinal: productIndex + 1,
        topic: topics[productIndex % topics.length],
      }),
    );

    return {
      category,
      products,
    };
  });

  const allProducts = categoryProducts.flatMap((entry) => entry.products);
  const partyHeavenEligibleCount = allProducts.filter((product) =>
    product.variant.price <= PARTY_HEAVEN_MAX_PRICE_PKR,
  ).length;

  return {
    categories,
    categoryProducts,
    totals: {
      categories: categories.length,
      products: allProducts.length,
      partyHeavenEligibleProducts: partyHeavenEligibleCount,
    },
  };
}

module.exports = {
  CATEGORY_KEYS,
  PARTY_HEAVEN_MAX_PRICE_PKR,
  createDeterministicDevCatalogData,
};
