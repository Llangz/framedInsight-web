-- ============================================================
-- Migration: Orphan farm_managers cleanup in create_farm_with_manager
-- framedInsight — 20260704b_create_farm_with_manager_orphan_cleanup.sql
--
-- CONTEXT:
--   farm_managers has no FK from farm_id -> farms.id and no unique
--   constraint on user_id alone (PK is composite: farm_id + user_id).
--   That means a user can end up with a farm_managers row pointing at a
--   farm that no longer exists (deleted farm, or a row left behind by an
--   earlier bug) — an "orphaned" row. lib/get-farm-status.ts (app-side)
--   now detects this state explicitly rather than crashing on it, and
--   the dashboard/onboarding UI offers those users a "Start Fresh Setup"
--   button that sends them back through onboarding.
--
--   That button is only safe if onboarding actually cleans up the stale
--   row instead of inserting a second one next to it. This RPC
--   (create_farm_with_manager — the function app/onboarding/actions.ts
--   actually calls, via supabaseAdmin.rpc(...)) previously had no
--   awareness of pre-existing farm_managers rows for p_user_id at all —
--   it only ever checked for a phone collision on the farms table. This
--   migration adds a one-line cleanup at the top: before doing anything
--   else, delete any farm_managers row for this user_id whose farm_id
--   does not correspond to a real, existing farm. Rows pointing at a
--   REAL farm are left untouched — this only ever removes rows that are
--   already dangling.
--
--   Everything below the cleanup step is otherwise IDENTICAL to the
--   20260621_claim_flow_and_rpc_fixes.sql version of this function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_farm_with_manager(
  p_farm_name text,
  p_owner_name text,
  p_phone text,
  p_county text,
  p_sub_county text,
  p_ward text,
  p_farm_types text[],
  p_primary_enterprise text,
  p_user_id uuid,
  p_subscription_end_date timestamp with time zone,
  p_email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farm_id uuid;
  v_existing record;
  v_already_has_manager boolean;
BEGIN
  -- ── Orphan cleanup (new in this migration) ────────────────────────────
  -- Remove any farm_managers row for this user that points at a farm
  -- which no longer exists. Never touches rows pointing at a real farm —
  -- if one is found, the phone-collision / existing-manager checks below
  -- still apply as before.
  DELETE FROM public.farm_managers fm
   WHERE fm.user_id = p_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.farms f WHERE f.id = fm.farm_id
     );

  -- Lock any existing row for this phone so two concurrent signups (or a
  -- signup racing a coop officer's farmer-mapping insert) can't both pass
  -- the check below.
  SELECT id, is_coop_managed, claim_token
    INTO v_existing
    FROM public.farms
   WHERE phone = p_phone
   FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.is_coop_managed IS TRUE AND v_existing.claim_token IS NOT NULL THEN
      -- This phone matches an unclaimed cooperative-mapped farm. Treat this
      -- signup as the claim: attach the verified user as owner instead of
      -- inserting a duplicate row.
      v_farm_id := v_existing.id;

      SELECT EXISTS (
        SELECT 1 FROM public.farm_managers WHERE farm_id = v_farm_id
      ) INTO v_already_has_manager;

      IF v_already_has_manager THEN
        -- Defensive: claim_token said "unclaimed" but a manager already
        -- exists. Don't silently reassign someone else's farm.
        RAISE EXCEPTION 'duplicate key value violates unique constraint "farms_phone_key"'
          USING ERRCODE = '23505';
      END IF;

      UPDATE public.farms
         SET owner_name           = p_owner_name,
             email                = COALESCE(p_email, email),
             claim_token          = NULL,
             farm_types           = p_farm_types,
             primary_enterprise   = COALESCE(primary_enterprise, p_primary_enterprise),
             subscription_tier    = 'smallholder',
             subscription_end_date = p_subscription_end_date,
             updated_at           = now()
       WHERE id = v_farm_id;

      INSERT INTO public.farm_managers (user_id, farm_id, role)
      VALUES (p_user_id, v_farm_id, 'owner');

      RETURN v_farm_id;
    ELSE
      -- Phone already belongs to a standalone or already-claimed farm.
      -- Surface the same error shape the app already handles (23505).
      RAISE EXCEPTION 'duplicate key value violates unique constraint "farms_phone_key"'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- No existing farm for this phone — normal fresh signup.
  INSERT INTO public.farms (
    farm_name, owner_name, phone, email, county, sub_county, ward,
    is_active, subscription_tier, subscription_end_date,
    farm_types, primary_enterprise
  ) VALUES (
    p_farm_name, p_owner_name, p_phone, p_email, p_county, p_sub_county, p_ward,
    true, 'smallholder', p_subscription_end_date,
    p_farm_types, p_primary_enterprise
  ) RETURNING id INTO v_farm_id;

  INSERT INTO public.farm_managers (user_id, farm_id, role)
  VALUES (p_user_id, v_farm_id, 'owner');

  RETURN v_farm_id;
END;
$$;

-- ============================================================
-- VERIFICATION (run manually after applying):
--
--   1. Confirm the function body includes the DELETE cleanup step:
--        SELECT prosrc FROM pg_proc WHERE proname = 'create_farm_with_manager';
--
--   2. One-time manual cleanup for accounts affected BEFORE this migration
--      (this migration only prevents new orphaned rows from surviving a
--      fresh onboarding call — it does not retroactively clean up rows
--      for users who are not going through onboarding again):
--
--        SELECT fm.user_id, fm.farm_id, fm.role, fm.created_at
--        FROM public.farm_managers fm
--        LEFT JOIN public.farms f ON f.id = fm.farm_id
--        WHERE f.id IS NULL;
--
--      Review that list before deleting anything — confirm each row is
--      genuinely stale (not, e.g., evidence of a farm that was deleted in
--      error and should be restored instead).
-- ============================================================


