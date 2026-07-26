-- ============================================================================
-- WhatsApp inbound message dedup
--
-- app/api/webhooks/whatsapp/route.ts awaits an LLM classification call
-- (processFarmerIntent) plus a DB write before it can reply to LipaChat. If
-- that round trip is slow enough to trip LipaChat/WhatsApp's retry-on-
-- timeout behaviour, the same inbound message can be delivered to our
-- webhook more than once — without a way to recognise the repeat, that
-- means duplicate milk_records/coffee_harvests/etc. rows for one farmer
-- message.
--
-- LipaChat includes a stable messageId on every inbound webhook delivery
-- (see docs.lipachat.com/api/webhooks). We store it here and check it
-- before processing (see the idempotency guard in route.ts). The partial
-- unique index below is a backstop for a genuine concurrent race — the
-- application-level check handles the common case (sequential retry after
-- a timeout) on its own.
-- ============================================================================

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

-- Partial (not a full UNIQUE column constraint) because older rows and any
-- future non-webhook inserts may legitimately have no messageId — Postgres
-- allows unlimited NULLs through a plain unique index/constraint anyway,
-- but being explicit here documents the intent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_dedup
  ON whatsapp_messages(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;
