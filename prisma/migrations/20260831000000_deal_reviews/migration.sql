-- Deal reviews
-- Generalizes the Review table so a review can target either a product or a
-- deal bundle (exactly one of product_id / deal_id must be set — enforced in
-- the service layer). Deal reviews flow through the same moderation pipeline.

-- 1. Reviews may omit a product (deal reviews leave product_id NULL).
ALTER TABLE IF EXISTS "Review" ALTER COLUMN product_id DROP NOT NULL;

-- 2. Add the deal target column.
ALTER TABLE IF EXISTS "Review" ADD COLUMN IF NOT EXISTS deal_id text;

-- 3. Foreign keys — CASCADE keeps reviews aligned with their subject's
--    lifecycle (deleting a product/deal removes its reviews).
ALTER TABLE IF EXISTS "Review" DROP CONSTRAINT IF EXISTS "Review_product_id_fkey";
ALTER TABLE IF EXISTS "Review" ADD CONSTRAINT "Review_product_id_fkey" FOREIGN KEY (product_id) REFERENCES "Product"(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS "Review" DROP CONSTRAINT IF EXISTS "Review_deal_id_fkey";
ALTER TABLE IF EXISTS "Review" ADD CONSTRAINT "Review_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES "Deal"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Indexes for deal-targeted lookups and moderation filtering.
CREATE INDEX IF NOT EXISTS "Review_deal_id_idx" ON "Review"("deal_id");
CREATE INDEX IF NOT EXISTS "Review_deal_id_status_idx" ON "Review"("deal_id", "status");
