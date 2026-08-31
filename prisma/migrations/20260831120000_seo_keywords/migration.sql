-- SEO keywords
-- Adds an optional `seo_keywords` column to all content entities so admins
-- can provide meta keywords from their forms. Column is nullable and
-- text-typed; metadata rendering emits a <meta name="keywords"> tag when set.

ALTER TABLE IF EXISTS "Category" ADD COLUMN IF NOT EXISTS seo_keywords text;
ALTER TABLE IF EXISTS "BlogPost" ADD COLUMN IF NOT EXISTS seo_keywords text;
ALTER TABLE IF EXISTS "Product" ADD COLUMN IF NOT EXISTS seo_keywords text;
ALTER TABLE IF EXISTS "Deal" ADD COLUMN IF NOT EXISTS seo_keywords text;
