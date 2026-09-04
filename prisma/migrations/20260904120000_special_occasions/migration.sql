-- Special Occasions: editorial collections that curate existing catalog
-- products and/or deals around a theme (Birthday, Wedding, Baby Shower, ...).
-- An occasion is intentionally NOT a category — the products/deals keep their
-- own categories/status and are simply re-surfaced through two join tables.
-- NOTE: all primary/foreign key columns are TEXT (this repo's ID convention).

-- 1) Occasion status enum (mirrors product_status/deal_status lifecycle).
CREATE TYPE occasion_status AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');

-- 2) Occasion record: name/slug/cover media/description, status, an
--    is_special flag (seasonal/hero collections) and SEO fields.
CREATE TABLE IF NOT EXISTS "Occasion" (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  short_description text,
  description text,
  cover_image_url text,
  cover_image_alt text,
  status occasion_status NOT NULL DEFAULT 'DRAFT',
  is_special boolean NOT NULL DEFAULT false,
  seo_title text,
  seo_description text,
  seo_canonical_url text,
  seo_og_title text,
  seo_og_description text,
  seo_image_url text,
  seo_keywords text,
  seo_no_index boolean NOT NULL DEFAULT false,
  seo_schema_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Occasion -> Product join (one row per curated product).
CREATE TABLE IF NOT EXISTS "OccasionProduct" (
  id text PRIMARY KEY,
  occasion_id text NOT NULL,
  product_id text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_occasionproduct_occasion FOREIGN KEY(occasion_id) REFERENCES "Occasion"(id) ON DELETE CASCADE,
  CONSTRAINT fk_occasionproduct_product FOREIGN KEY(product_id) REFERENCES "Product"(id) ON DELETE CASCADE
);

-- 4) Occasion -> Deal join (one row per curated deal).
CREATE TABLE IF NOT EXISTS "OccasionDeal" (
  id text PRIMARY KEY,
  occasion_id text NOT NULL,
  deal_id text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_occasiondeal_occasion FOREIGN KEY(occasion_id) REFERENCES "Occasion"(id) ON DELETE CASCADE,
  CONSTRAINT fk_occasiondeal_deal FOREIGN KEY(deal_id) REFERENCES "Deal"(id) ON DELETE CASCADE
);

-- 5) Indexes (names follow Prisma's generated conventions).
CREATE INDEX IF NOT EXISTS "Occasion_slug_idx" ON "Occasion"("slug");
CREATE INDEX IF NOT EXISTS "Occasion_status_idx" ON "Occasion"("status");
CREATE INDEX IF NOT EXISTS "Occasion_status_isSpecial_idx" ON "Occasion"("status", "is_special");
CREATE INDEX IF NOT EXISTS "OccasionProduct_occasionId_idx" ON "OccasionProduct"("occasion_id");
CREATE INDEX IF NOT EXISTS "OccasionProduct_productId_idx" ON "OccasionProduct"("product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "OccasionProduct_occasionId_productId_key"
  ON "OccasionProduct"("occasion_id", "product_id");
CREATE INDEX IF NOT EXISTS "OccasionDeal_occasionId_idx" ON "OccasionDeal"("occasion_id");
CREATE INDEX IF NOT EXISTS "OccasionDeal_dealId_idx" ON "OccasionDeal"("deal_id");
CREATE UNIQUE INDEX IF NOT EXISTS "OccasionDeal_occasionId_dealId_key"
  ON "OccasionDeal"("occasion_id", "deal_id");
