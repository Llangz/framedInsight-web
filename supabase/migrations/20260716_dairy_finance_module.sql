-- ============================================================================
-- Migration: Dairy Finance Module — milk_sales, dairy_expenses
-- framedInsight — 20260716_dairy_finance_module.sql
--
-- CONTEXT:
--   Coffee has app/dashboard/coffee/finance, poultry has
--   app/dashboard/poultry/finance, small ruminants has
--   app/dashboard/smallRuminants/sales — dairy has neither a finance nor
--   a sales module, and no milk_sales (or equivalent) table exists.
--   Dairy farmers can record production (milk_records) but have nowhere
--   to record what they were actually paid for it, so there is no
--   profitability picture for the enterprise most smallholder users are
--   likely to run day-to-day.
--
--   This migration adds the two tables that were missing and a summary
--   view that ties them to existing production data (milk_records),
--   mirroring the RLS pattern used for small_ruminant_sales
--   (20260704_small_ruminants_rls_fix.sql) — can_manage_farm(farm_id) for
--   owner/manager access, plus an explicit service-role bypass for
--   background jobs (EWS cron, WhatsApp intent processor, offline sync
--   edge function).
--
--   Deliberately a plain VIEW, not a materialized one — this is a new,
--   low-traffic aggregation (one farmer, one finance page load at a
--   time), and the last two migrations touching this codebase's existing
--   materialized views (20260708_fix_farm_summary_refresh_trigger.sql,
--   20260711_fix_secondary_materialized_views.sql) were both fixing
--   refresh-trigger bugs. A plain view has no staleness class of bug to
--   introduce in exchange for a saving that doesn't matter at this scale.
-- ============================================================================

-- ── milk_sales ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.milk_sales (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  -- Optional: a sale can be tied to a specific cow's production, or left
  -- null for a bulk/whole-herd sale (the common case for a cooperative
  -- milk collection point) — same optionality small_ruminant_sales uses
  -- for animal_id on milk-type sales.
  cow_id            uuid REFERENCES public.cows(id) ON DELETE SET NULL,
  sale_date         date NOT NULL,
  quantity_liters   numeric(10,2) NOT NULL CHECK (quantity_liters > 0),
  price_per_liter   numeric(10,2) NOT NULL CHECK (price_per_liter >= 0),
  total_amount      numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  buyer_name        text,
  buyer_contact     text,
  channel           text NOT NULL DEFAULT 'cooperative'
                      CHECK (channel IN ('cooperative', 'processor', 'hawker', 'direct_consumer', 'other')),
  payment_method    text DEFAULT 'cash'
                      CHECK (payment_method IN ('cash', 'mpesa', 'bank_transfer', 'cooperative_account', 'credit')),
  payment_status    text DEFAULT 'paid'
                      CHECK (payment_status IN ('paid', 'pending', 'partial')),
  notes             text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milk_sales_farm_date ON public.milk_sales(farm_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_milk_sales_cow ON public.milk_sales(cow_id) WHERE cow_id IS NOT NULL;

ALTER TABLE public.milk_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Farm managers can access their milk sales" ON public.milk_sales;
CREATE POLICY "Farm managers can access their milk sales"
  ON public.milk_sales
  FOR ALL
  USING (public.can_manage_farm(farm_id))
  WITH CHECK (public.can_manage_farm(farm_id));

DROP POLICY IF EXISTS "milk_sales_service_admin_all" ON public.milk_sales;
CREATE POLICY "milk_sales_service_admin_all" ON public.milk_sales
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── dairy_expenses ──────────────────────────────────────────────────────────
-- The cost side of the P&L. Deliberately a flat category enum rather than
-- coffee_activities' richer activity-type/application-method modeling —
-- dairy doesn't have an agronomic-input compliance surface (no EUDR, no
-- chemical-application tracking) riding on this table the way coffee's
-- finance data does, so it doesn't need that structure yet.

CREATE TABLE IF NOT EXISTS public.dairy_expenses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  expense_date      date NOT NULL,
  category          text NOT NULL
                      CHECK (category IN ('feed', 'veterinary', 'breeding', 'labor', 'transport', 'equipment', 'other')),
  amount            numeric(12,2) NOT NULL CHECK (amount >= 0),
  description       text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dairy_expenses_farm_date ON public.dairy_expenses(farm_id, expense_date DESC);

ALTER TABLE public.dairy_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Farm managers can access their dairy expenses" ON public.dairy_expenses;
CREATE POLICY "Farm managers can access their dairy expenses"
  ON public.dairy_expenses
  FOR ALL
  USING (public.can_manage_farm(farm_id))
  WITH CHECK (public.can_manage_farm(farm_id));

DROP POLICY IF EXISTS "dairy_expenses_service_admin_all" ON public.dairy_expenses;
CREATE POLICY "dairy_expenses_service_admin_all" ON public.dairy_expenses
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── v_dairy_monthly_finance ─────────────────────────────────────────────────
-- One row per farm per calendar month: revenue, costs, net profit, and
-- production-vs-sold volume so a farmer (or a loan officer reading their
-- statement) can see not just "what came in" but "what fraction of what
-- the herd produced actually got sold."
--
-- security_invoker so the view runs under the querying user's own RLS
-- (their can_manage_farm() grants), not the view owner's — it does not
-- widen access beyond what the three underlying tables already allow.

DROP VIEW IF EXISTS public.v_dairy_monthly_finance;
CREATE VIEW public.v_dairy_monthly_finance
WITH (security_invoker = true) AS
WITH production AS (
  SELECT
    farm_id,
    date_trunc('month', record_date)::date AS month,
    SUM(COALESCE(total_milk, 0)) AS liters_produced
  FROM public.milk_records
  GROUP BY farm_id, date_trunc('month', record_date)
),
sales AS (
  SELECT
    farm_id,
    date_trunc('month', sale_date)::date AS month,
    SUM(quantity_liters) AS liters_sold,
    SUM(total_amount) AS total_revenue
  FROM public.milk_sales
  GROUP BY farm_id, date_trunc('month', sale_date)
),
expenses AS (
  SELECT
    farm_id,
    date_trunc('month', expense_date)::date AS month,
    SUM(amount) AS total_expenses
  FROM public.dairy_expenses
  GROUP BY farm_id, date_trunc('month', expense_date)
)
SELECT
  COALESCE(production.farm_id, sales.farm_id, expenses.farm_id) AS farm_id,
  COALESCE(production.month, sales.month, expenses.month) AS month,
  COALESCE(production.liters_produced, 0) AS liters_produced,
  COALESCE(sales.liters_sold, 0) AS liters_sold,
  COALESCE(sales.total_revenue, 0) AS total_revenue,
  COALESCE(expenses.total_expenses, 0) AS total_expenses,
  COALESCE(sales.total_revenue, 0) - COALESCE(expenses.total_expenses, 0) AS net_profit,
  CASE WHEN COALESCE(sales.liters_sold, 0) > 0
    THEN ROUND((COALESCE(sales.total_revenue, 0) / sales.liters_sold)::numeric, 2)
    ELSE NULL
  END AS avg_price_per_liter,
  CASE WHEN COALESCE(production.liters_produced, 0) > 0
    THEN ROUND((COALESCE(sales.liters_sold, 0) / production.liters_produced * 100)::numeric, 1)
    ELSE NULL
  END AS pct_production_sold
FROM production
FULL OUTER JOIN sales ON sales.farm_id = production.farm_id AND sales.month = production.month
FULL OUTER JOIN expenses ON expenses.farm_id = COALESCE(production.farm_id, sales.farm_id)
  AND expenses.month = COALESCE(production.month, sales.month);

GRANT SELECT ON public.v_dairy_monthly_finance TO authenticated;

-- ============================================================================
-- VERIFICATION (run manually after applying):
--
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('milk_sales', 'dairy_expenses') ORDER BY tablename;
--   -- Should show 2 policies per table (owner-scoped ALL + service_role ALL).
--
--   SELECT * FROM public.v_dairy_monthly_finance LIMIT 5;
-- ============================================================================
