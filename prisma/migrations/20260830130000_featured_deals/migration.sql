-- Featured Deals: admin-managed deal records linking catalog products (and
-- optionally one variant) to deal-specific media and a bundle quantity.
-- Availability always derives from the linked product/variant inventory.
-- NOTE: all primary/foreign key columns are TEXT (this repo's ID convention
-- after the 20260416 one_dollar_local migration converted ids to text).

CREATE TYPE deal_status AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');

-- Featured deal record
CREATE TABLE IF NOT EXISTS "Deal" (
  id text PRIMARY KEY,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  status deal_status NOT NULL DEFAULT 'DRAFT',
  category_id text,
  product_id text NOT NULL,
  product_variant_id text,
  quantity integer NOT NULL DEFAULT 1,
  show_product_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_deal_category FOREIGN KEY(category_id) REFERENCES "Category"(id) ON DELETE SET NULL,
  CONSTRAINT fk_deal_product FOREIGN KEY(product_id) REFERENCES "Product"(id) ON DELETE CASCADE,
  CONSTRAINT fk_deal_variant FOREIGN KEY(product_variant_id) REFERENCES "ProductVariant"(id) ON DELETE SET NULL
);

-- Deal-specific images (never deal-level variants)
CREATE TABLE IF NOT EXISTS "DealImage" (
  id text PRIMARY KEY,
  deal_id text NOT NULL,
  url text NOT NULL,
  alt text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_dealimage_deal FOREIGN KEY(deal_id) REFERENCES "Deal"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Deal_categoryId_idx" ON "Deal"("category_id");
CREATE INDEX IF NOT EXISTS "Deal_productId_idx" ON "Deal"("product_id");
CREATE INDEX IF NOT EXISTS "Deal_productVariantId_idx" ON "Deal"("product_variant_id");
CREATE INDEX IF NOT EXISTS "Deal_status_idx" ON "Deal"("status");
CREATE INDEX IF NOT EXISTS "DealImage_dealId_position_idx" ON "DealImage"("deal_id", "position");

-- Deal quantities must always be positive.
DO $$ BEGIN
  ALTER TABLE IF EXISTS "Deal" ADD CONSTRAINT chk_deal_quantity_positive CHECK (quantity >= 1);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
