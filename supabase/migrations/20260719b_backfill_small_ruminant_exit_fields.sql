-- 📁 FILE PATH: supabase/migrations/20260719b_backfill_small_ruminant_exit_fields.sql
--
-- app/dashboard/smallRuminants/sales/actions.ts's recordSale previously only
-- set status = 'sold' on the animal when a non-milk sale was recorded — it
-- never wrote exit_value/exit_date/exit_reason back, so the sale-profit
-- calculation on AnimalDetailClient.tsx and the financial-analysis page had
-- nothing to read. That's fixed going forward, but every animal sold before
-- the fix is stuck with status = 'sold' and exit_value = null, so historical
-- sales are invisible to Livestock Sale Profit.
--
-- This backfills those animals from their own small_ruminant_sales history:
--   exit_value  = sum of total_price across the animal's non-milk sales
--   exit_date   = sale_date of the most recent non-milk sale
--   exit_reason = sale_type of that most recent non-milk sale
--
-- Milk sales are excluded throughout — a milk sale doesn't represent the
-- animal leaving the flock, mirroring the sale_type !== 'milk' check in
-- recordSale.
--
-- Only touches status = 'sold' animals with exit_value still null, so this
-- is idempotent and safe to re-run: once backfilled (or once a farmer
-- records a fresh post-fix sale), a row no longer matches the where clause.
-- Animals with status = 'sold' but no matching sales record at all (e.g. an
-- exit logged by hand outside the sales flow) are left untouched — there's
-- no sale to backfill from, and assuming a value would misstate profit.

with candidate_sales as (
  select
    s.animal_id,
    sum(s.total_price)                                    as total_exit_value,
    (array_agg(s.sale_date order by s.sale_date desc))[1]  as latest_sale_date,
    (array_agg(s.sale_type order by s.sale_date desc))[1]  as latest_sale_type
  from public.small_ruminant_sales s
  where s.sale_type <> 'milk'
    and s.animal_id is not null
  group by s.animal_id
)
update public.small_ruminants sr
set
  exit_value  = cs.total_exit_value,
  exit_date   = cs.latest_sale_date,
  exit_reason = coalesce(sr.exit_reason, cs.latest_sale_type)
from candidate_sales cs
where sr.id = cs.animal_id
  and sr.status = 'sold'
  and sr.exit_value is null;
