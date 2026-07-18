-- ============================================================================
-- Fix dashboard/dairy/finance — "This page didn't load"
-- ============================================================================
-- Root cause: 20260716_dairy_finance_module.sql's v_dairy_monthly_finance
-- view referenced milk_records.farm_id, which does not exist — milk_records
-- only has cow_id (see lib/database.types.ts, and the join pattern every
-- other query in this codebase already uses: 20260602_add_poultry_to_view.sql
-- / 20260612_materialize_farm_summary.sql both do
-- `FROM milk_records mr JOIN cows c ON mr.cow_id = c.id WHERE c.farm_id = ...`,
-- never milk_records.farm_id directly).
--
-- CREATE VIEW with an unresolvable column fails at creation time, and
-- Supabase migrations run inside a transaction, so that failure would have
-- rolled back the ENTIRE 20260716 migration — including the milk_sales and
-- dairy_expenses CREATE TABLE statements earlier in the same file, even
-- though those two were correct on their own. That's why the finance page
-- fails outright (unwrapOr() → thrown error → app/dashboard/error.tsx)
-- rather than just rendering an empty view: none of the three objects the
-- page queries (milk_sales, dairy_expenses, v_dairy_monthly_finance) exist.
--
-- This migration is written to be safe regardless of how much of 20260716
-- actually landed: table/index/policy statements are IF NOT EXISTS /
-- DROP...IF EXISTS + CREATE, so re-running them against a DB where they
-- already exist is a no-op, and against a DB where the transaction rolled
-- everything back it creates them for the first time. Only the view
-- definition itself changes (the farm_id join fix).
-- ============================================================================

-- ── milk_sales (idempotent re-creation) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.milk_sales (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
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

-- ── dairy_expenses (idempotent re-creation) ─────────────────────────────────

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

-- ── v_dairy_monthly_finance (the actual fix — join milk_records → cows to
--    get farm_id instead of reading a column that doesn't exist) ───────────

DROP VIEW IF EXISTS public.v_dairy_monthly_finance;
CREATE VIEW public.v_dairy_monthly_finance
WITH (security_invoker = true) AS
WITH production AS (
  SELECT
    c.farm_id,
    date_trunc('month', mr.record_date)::date AS month,
    SUM(COALESCE(mr.total_milk, 0)) AS liters_produced
  FROM public.milk_records mr
  JOIN public.cows c ON c.id = mr.cow_id
  GROUP BY c.farm_id, date_trunc('month', mr.record_date)
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
