-- supabase/migrations/20260630_buyer_data_room.sql
--
-- High-entropy buyer access links for lot-scoped due diligence data rooms.
-- These columns unlock a specific export lot without exposing exact farm
-- geolocation through the public QR-code passport route.

ALTER TABLE public.export_lots
  ADD COLUMN IF NOT EXISTS buyer_access_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS buyer_access_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_access_revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_export_lots_buyer_token
  ON public.export_lots (buyer_access_token)
  WHERE buyer_access_token IS NOT NULL AND buyer_access_revoked_at IS NULL;
