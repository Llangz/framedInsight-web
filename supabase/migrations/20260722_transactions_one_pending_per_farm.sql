-- Prevent more than one pending M-Pesa transaction per farm at the database
-- level. app/api/payments/stkpush/route.ts already checks for a recent
-- pending transaction before calling initiateSTKPush(), but that
-- check-then-insert has a race window if two requests land concurrently
-- (e.g. a double-tap that both reach the server before either has written
-- its row). This index closes that window: the second concurrent insert
-- fails at the database rather than creating a second pending row and a
-- second M-Pesa prompt to the farmer's phone.
--
-- Scoped to status = 'pending' only, so completed/failed history for a farm
-- is unaffected and farms can always pay again once their current attempt
-- resolves.
CREATE UNIQUE INDEX transactions_one_pending_per_farm
  ON public.transactions (farm_id)
  WHERE status = 'pending';
