-- ============================================================================
-- cooperative_officers — missing INSERT policy
-- ============================================================================
-- 20260620_create_cooperatives.sql enabled RLS on cooperative_officers and
-- added a SELECT policy ("Cooperative officers can view fellow officers"),
-- but no INSERT policy. The only existing write path is the SECURITY DEFINER
-- RPC create_cooperative_with_officer, which bypasses RLS entirely to insert
-- the first ('admin') officer row at signup — so this gap hasn't surfaced as
-- a live bug yet because nothing else currently inserts into this table.
--
-- It does block any future "invite a field officer" feature from working
-- under RLS (e.g. a cooperative admin adding a colleague directly via the
-- authenticated client rather than through a RPC), so closing it now.
--
-- Scope: an existing 'admin' officer of a cooperative can insert new officer
-- rows for that SAME cooperative only — they cannot insert themselves into a
-- different cooperative they don't belong to, and a non-admin 'officer' role
-- cannot invite further officers.
-- ============================================================================

CREATE POLICY "Cooperative admins can add officers" ON public.cooperative_officers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers co
      WHERE co.cooperative_id = cooperative_officers.cooperative_id
        AND co.user_id = auth.uid()
        AND co.role = 'admin'
    )
  );