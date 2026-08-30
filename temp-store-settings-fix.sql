CREATE TABLE IF NOT EXISTS "store_settings" (
    "id" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "store_tagline" TEXT,
    "support_email" TEXT NOT NULL,
    "support_phone" TEXT,
    "support_whatsapp" TEXT,
    "support_hours" TEXT,
    "shipping_origin_city" TEXT NOT NULL,
    "shipping_flat_rate" INTEGER NOT NULL DEFAULT 250,
    "shipping_free_threshold" INTEGER,
    "dispatch_lead_time_days" INTEGER NOT NULL DEFAULT 1,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "allow_backorders" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_store_settings ON "store_settings";
CREATE TRIGGER trg_set_updated_at_store_settings
BEFORE UPDATE ON "store_settings"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO "store_settings" (
  "id",
  "store_name",
  "support_email",
  "shipping_origin_city"
)
VALUES (
  'default',
  'Party Heaven',
  'support@partyheaven.co',
  'Karachi'
)
ON CONFLICT ("id") DO NOTHING;
