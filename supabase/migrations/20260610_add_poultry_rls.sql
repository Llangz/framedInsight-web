-- ============================================================================
-- Poultry Tables RLS (Row Level Security)
-- Must be deployed BEFORE the app goes live with poultry features
-- ============================================================================

-- ============================================================================
-- 1. PHONE OTP CODES
-- ============================================================================
ALTER TABLE phone_otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage OTP codes"
ON phone_otp_codes
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- No one else can read/write OTP codes (only service role via API routes)

-- ============================================================================
-- 2. POULTRY BATCHES
-- ============================================================================
ALTER TABLE poultry_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm managers can view own poultry batches"
ON poultry_batches
FOR SELECT
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can insert own poultry batches"
ON poultry_batches
FOR INSERT
WITH CHECK (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can update own poultry batches"
ON poultry_batches
FOR UPDATE
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
)
WITH CHECK (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can delete own poultry batches"
ON poultry_batches
FOR DELETE
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

-- ============================================================================
-- 3. POULTRY EGG RECORDS
-- ============================================================================
ALTER TABLE poultry_egg_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm managers can view own egg records"
ON poultry_egg_records
FOR SELECT
USING (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
);

CREATE POLICY "Farm managers can insert own egg records"
ON poultry_egg_records
FOR INSERT
WITH CHECK (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
);

CREATE POLICY "Farm managers can update own egg records"
ON poultry_egg_records
FOR UPDATE
USING (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
)
WITH CHECK (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
);

CREATE POLICY "Farm managers can delete own egg records"
ON poultry_egg_records
FOR DELETE
USING (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
);

-- ============================================================================
-- 4. POULTRY MORTALITY
-- ============================================================================
ALTER TABLE poultry_mortality ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm managers can view own mortality records"
ON poultry_mortality
FOR SELECT
USING (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
);

CREATE POLICY "Farm managers can insert own mortality records"
ON poultry_mortality
FOR INSERT
WITH CHECK (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
);

CREATE POLICY "Farm managers can update own mortality records"
ON poultry_mortality
FOR UPDATE
USING (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
)
WITH CHECK (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
);

CREATE POLICY "Farm managers can delete own mortality records"
ON poultry_mortality
FOR DELETE
USING (
  batch_id IN (SELECT id FROM poultry_batches WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
);

-- ============================================================================
-- 5. POULTRY HEALTH RECORDS
-- ============================================================================
ALTER TABLE poultry_health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm managers can view own health records"
ON poultry_health_records
FOR SELECT
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can insert own health records"
ON poultry_health_records
FOR INSERT
WITH CHECK (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can update own health records"
ON poultry_health_records
FOR UPDATE
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
)
WITH CHECK (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can delete own health records"
ON poultry_health_records
FOR DELETE
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

-- ============================================================================
-- 6. POULTRY FEED RECORDS
-- ============================================================================
ALTER TABLE poultry_feed_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm managers can view own feed records"
ON poultry_feed_records
FOR SELECT
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can insert own feed records"
ON poultry_feed_records
FOR INSERT
WITH CHECK (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can update own feed records"
ON poultry_feed_records
FOR UPDATE
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
)
WITH CHECK (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can delete own feed records"
ON poultry_feed_records
FOR DELETE
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

-- ============================================================================
-- 7. POULTRY SALES
-- ============================================================================
ALTER TABLE poultry_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm managers can view own poultry sales"
ON poultry_sales
FOR SELECT
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can insert own poultry sales"
ON poultry_sales
FOR INSERT
WITH CHECK (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can update own poultry sales"
ON poultry_sales
FOR UPDATE
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
)
WITH CHECK (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Farm managers can delete own poultry sales"
ON poultry_sales
FOR DELETE
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

-- ============================================================================
-- 8. WHATSAPP MESSAGES
-- ============================================================================
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm managers can view own WhatsApp messages"
ON whatsapp_messages
FOR SELECT
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

CREATE POLICY "Service role can manage WhatsApp messages"
ON whatsapp_messages
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 9. AUDIT LOG TABLE (create if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  farm_id UUID REFERENCES farms(id),
  resource TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage audit logs"
ON audit_logs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Farm managers can view own audit logs"
ON audit_logs
FOR SELECT
USING (
  farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())
);

-- Indexes for audit querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_farm ON audit_logs(farm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================================================
-- 10. ADD MISSING DATABASE INDEXES FOR QUERY PERFORMANCE
-- ============================================================================

-- Farms
CREATE INDEX IF NOT EXISTS idx_farms_phone ON farms(phone);
CREATE INDEX IF NOT EXISTS idx_farms_subscription ON farms(subscription_tier, subscription_end_date) 
WHERE subscription_end_date IS NOT NULL;

-- Farm Managers
CREATE INDEX IF NOT EXISTS idx_farm_managers_user ON farm_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_farm_managers_farm ON farm_managers(farm_id);

-- Poultry Batches (main query pattern: active batches for a farm)
CREATE INDEX IF NOT EXISTS idx_poultry_batches_farm_status ON poultry_batches(farm_id, status) 
WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_poultry_batches_placement ON poultry_batches(farm_id, date_of_placement DESC);

-- Poultry Egg Records (most frequent query: recent eggs per batch)
CREATE INDEX IF NOT EXISTS idx_poultry_eggs_batch_date ON poultry_egg_records(batch_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_poultry_eggs_date_range ON poultry_egg_records(record_date, batch_id);

-- Poultry Mortality (common query: recent deaths per batch)
CREATE INDEX IF NOT EXISTS idx_poultry_mortality_batch_date ON poultry_mortality(batch_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_poultry_mortality_date ON poultry_mortality(record_date, batch_id);

-- Poultry Health Records (next due date queries for alerts)
CREATE INDEX IF NOT EXISTS idx_poultry_health_next_due ON poultry_health_records(farm_id, next_due_date) 
WHERE next_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_poultry_health_event ON poultry_health_records(batch_id, event_type);

-- Poultry Feed Records (most recent feed per farm)
CREATE INDEX IF NOT EXISTS idx_poultry_feed_farm_date ON poultry_feed_records(farm_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_poultry_feed_batch_date ON poultry_feed_records(batch_id, record_date DESC);

-- Poultry Sales
CREATE INDEX IF NOT EXISTS idx_poultry_sales_farm_date ON poultry_sales(farm_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_poultry_sales_batch ON poultry_sales(batch_id, sale_date DESC);

-- WhatsApp Messages
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(sender_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_farm ON whatsapp_messages(farm_id, created_at DESC) 
WHERE farm_id IS NOT NULL;
"