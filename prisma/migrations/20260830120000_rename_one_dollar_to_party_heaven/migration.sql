-- Rebrand: "One Dollar" → "Party Heaven"
--
-- Data migration that brings live databases in line with the brand rename:
--   1. Store settings singleton → Party Heaven (name + support email).
--   2. Blog post SEO titles that mention the old brand → Party Heaven.
--   3. Removes the leftover PUBLISHED "One Dollar" category (slug `one-dollar`)
--      that collided with the reserved virtual category slug, along with its
--      orphaned "Testing product". The Party Heaven virtual category is
--      system-level (never persisted), so no Category row should exist for it.
--
-- Idempotent: statements are scoped by slug/name, so environments without the
-- leftover rows are unaffected.

-- 1. Store settings
UPDATE "store_settings"
SET "store_name" = 'Party Heaven',
    "support_email" = 'support@partyheaven.co',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'default';

-- 2. Blog post SEO titles
UPDATE "blog_post"
SET "seo_title" = REPLACE("seo_title", 'One Dollar', 'Party Heaven')
WHERE "seo_title" LIKE '%One Dollar%';

-- 3a. Clean up dependent rows for any product still attached to the legacy
--     "One Dollar" category before the category/product are deleted.
DELETE FROM "CartItem"
WHERE "product_variant_id" IN (
  SELECT pv."id"
  FROM "ProductVariant" pv
  JOIN "Product" p ON p."id" = pv."product_id"
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
);

DELETE FROM "WishlistItem"
WHERE "product_variant_id" IN (
  SELECT pv."id"
  FROM "ProductVariant" pv
  JOIN "Product" p ON p."id" = pv."product_id"
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
);

DELETE FROM "ProductImage"
WHERE "product_id" IN (
  SELECT p."id"
  FROM "Product" p
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
)
OR "product_variant_id" IN (
  SELECT pv."id"
  FROM "ProductVariant" pv
  JOIN "Product" p ON p."id" = pv."product_id"
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
);

DELETE FROM "ProductSpecification"
WHERE "product_id" IN (
  SELECT p."id"
  FROM "Product" p
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
);

DELETE FROM "Review"
WHERE "product_id" IN (
  SELECT p."id"
  FROM "Product" p
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
);

DELETE FROM "DealCampaignProduct"
WHERE "product_id" IN (
  SELECT p."id"
  FROM "Product" p
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
);

DELETE FROM "Inventory"
WHERE "product_variant_id" IN (
  SELECT pv."id"
  FROM "ProductVariant" pv
  JOIN "Product" p ON p."id" = pv."product_id"
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
);

DELETE FROM "ProductVariant"
WHERE "product_id" IN (
  SELECT p."id"
  FROM "Product" p
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
);

DELETE FROM "Product"
WHERE "id" IN (
  SELECT p."id"
  FROM "Product" p
  JOIN "Category" c ON c."id" = p."category_id"
  WHERE c."slug" = 'one-dollar' AND c."name" = 'One Dollar'
);

-- 3b. Remove the leftover PUBLISHED "One Dollar" category.
DELETE FROM "Category"
WHERE "slug" = 'one-dollar' AND "name" = 'One Dollar';
