-- Deal bundle lines in the cart: a deal is treated as ONE cart line item
-- (quantity controls the whole bundle). unit_price snapshots the deal price at
-- add time; at checkout each deal line expands into order items for every
-- included product (see orders service).
-- NOTE: this repo's ID convention uses TEXT PKs.

CREATE TABLE IF NOT EXISTS "DealCartItem" (
  id text PRIMARY KEY,
  cart_id text NOT NULL,
  deal_id text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_dealcartitem_cart FOREIGN KEY(cart_id) REFERENCES "Cart"(id) ON DELETE CASCADE,
  CONSTRAINT fk_dealcartitem_deal FOREIGN KEY(deal_id) REFERENCES "Deal"(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DealCartItem_cartId_dealId_key" ON "DealCartItem"("cart_id", "deal_id");
CREATE INDEX IF NOT EXISTS "DealCartItem_cartId_idx" ON "DealCartItem"("cart_id");
CREATE INDEX IF NOT EXISTS "DealCartItem_dealId_idx" ON "DealCartItem"("deal_id");
