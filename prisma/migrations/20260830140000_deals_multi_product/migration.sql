-- Deals multi-product redesign:
-- 1. Deals now bundle MULTIPLE catalog products (each with an optional variant
--    and quantity) via a new DealProduct join table.
-- 2. Deals gain deal-level pricing (price + compare_at_price), a short
--    description, specifications (DealSpecification), SEO fields, and metadata
--    (related deal ids).
-- 3. The old single-product columns (product_id, product_variant_id, quantity,
--    show_product_cover) are migrated into DealProduct rows and then dropped.
-- NOTE: all primary/foreign key columns are TEXT (this repo's ID convention).

-- 1) Add new Deal columns (all nullable/defaulted so existing rows stay valid).
ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compare_at_price integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_canonical_url text,
  ADD COLUMN IF NOT EXISTS seo_og_title text,
  ADD COLUMN IF NOT EXISTS seo_og_description text,
  ADD COLUMN IF NOT EXISTS seo_image_url text,
  ADD COLUMN IF NOT EXISTS seo_no_index boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_schema_notes text;

-- 2) Create the DealProduct join table (one row per included product).
CREATE TABLE IF NOT EXISTS "DealProduct" (
  id text PRIMARY KEY,
  deal_id text NOT NULL,
  product_id text NOT NULL,
  product_variant_id text,
  quantity integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_dealproduct_deal FOREIGN KEY(deal_id) REFERENCES "Deal"(id) ON DELETE CASCADE,
  CONSTRAINT fk_dealproduct_product FOREIGN KEY(product_id) REFERENCES "Product"(id) ON DELETE CASCADE,
  CONSTRAINT fk_dealproduct_variant FOREIGN KEY(product_variant_id) REFERENCES "ProductVariant"(id) ON DELETE SET NULL
);

-- 3) Create the DealSpecification table (mirrors ProductSpecification).
CREATE TABLE IF NOT EXISTS "DealSpecification" (
  id text PRIMARY KEY,
  deal_id text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_dealspecification_deal FOREIGN KEY(deal_id) REFERENCES "Deal"(id) ON DELETE CASCADE
);

-- 4) Migrate existing single-product deal rows into DealProduct.
INSERT INTO "DealProduct" (id, deal_id, product_id, product_variant_id, quantity, position)
SELECT
  'dp_' || id AS id,
  id AS deal_id,
  product_id,
  product_variant_id,
  quantity,
  0 AS position
FROM "Deal"
WHERE product_id IS NOT NULL;

-- 5) Drop the old single-product columns (and their indexes/constraints).
ALTER TABLE "Deal" DROP CONSTRAINT IF EXISTS fk_deal_product;
ALTER TABLE "Deal" DROP CONSTRAINT IF EXISTS fk_deal_variant;
ALTER TABLE "Deal" DROP CONSTRAINT IF EXISTS chk_deal_quantity_positive;
DROP INDEX IF EXISTS "Deal_productId_idx";
DROP INDEX IF EXISTS "Deal_productVariantId_idx";

ALTER TABLE "Deal"
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS product_variant_id,
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS show_product_cover;

-- 6) New indexes.
CREATE INDEX IF NOT EXISTS "Deal_categoryId_idx" ON "Deal"("category_id");
CREATE INDEX IF NOT EXISTS "Deal_status_idx" ON "Deal"("status");
CREATE INDEX IF NOT EXISTS "DealProduct_dealId_idx" ON "DealProduct"("deal_id");
CREATE INDEX IF NOT EXISTS "DealProduct_productId_idx" ON "DealProduct"("product_id");
CREATE INDEX IF NOT EXISTS "DealProduct_productVariantId_idx" ON "DealProduct"("product_variant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "DealProduct_dealId_productId_productVariantId_key"
  ON "DealProduct"("deal_id", "product_id", "product_variant_id");
CREATE INDEX IF NOT EXISTS "DealSpecification_dealId_idx" ON "DealSpecification"("deal_id");

-- 7) Deal product quantities must always be positive.
DO $$ BEGIN
  ALTER TABLE "DealProduct" ADD CONSTRAINT chk_dealproduct_quantity_positive CHECK (quantity >= 1);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
