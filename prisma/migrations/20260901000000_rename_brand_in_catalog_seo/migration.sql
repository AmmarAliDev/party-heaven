-- Rebrand (catalog SEO): "One Dollar" → "Party Heaven"
--
-- Follow-up to 20260830120000_rename_one_dollar_to_party_heaven, which only
-- fixed store settings + blog SEO titles. Category/product SEO titles and OG
-- titles still contained the old brand (seeded pre-rename), so every
-- category/product `<title>` and OG title advertised "One Dollar" while the
-- site is branded "Party Heaven".
--
-- Physical table names: Category/Product/Deal are unmapped PascalCase tables;
-- BlogPost maps to `blog_post`. Idempotent: REPLACE is a no-op on rows without
-- the old brand string. `seo_image_url` is intentionally NOT touched — the
-- party-heaven category image blob key still contains "one-dollar-..." and
-- changing it would break the image.

-- Categories
UPDATE "Category"
SET "seo_title" = REPLACE("seo_title", 'One Dollar', 'Party Heaven'),
    "seo_og_title" = REPLACE("seo_og_title", 'One Dollar', 'Party Heaven'),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "seo_title" LIKE '%One Dollar%' OR "seo_og_title" LIKE '%One Dollar%';

-- Products
UPDATE "Product"
SET "seo_title" = REPLACE("seo_title", 'One Dollar', 'Party Heaven'),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "seo_title" LIKE '%One Dollar%';

-- Deals (defensive; no current rows)
UPDATE "Deal"
SET "seo_title" = REPLACE("seo_title", 'One Dollar', 'Party Heaven'),
    "seo_og_title" = REPLACE("seo_og_title", 'One Dollar', 'Party Heaven'),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "seo_title" LIKE '%One Dollar%' OR "seo_og_title" LIKE '%One Dollar%';

-- Blog posts (defensive; already handled in the earlier migration)
UPDATE "blog_post"
SET "seo_title" = REPLACE("seo_title", 'One Dollar', 'Party Heaven'),
    "seo_og_title" = REPLACE("seo_og_title", 'One Dollar', 'Party Heaven'),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "seo_title" LIKE '%One Dollar%' OR "seo_og_title" LIKE '%One Dollar%';
