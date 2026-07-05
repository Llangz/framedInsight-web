# Supabase manual deployment guide

This project does not rely on the Supabase CLI for migrations. When a migration must be applied in the live project, use the Supabase dashboard SQL editor.

## Apply the RLS recursion fix

1. Open the Supabase dashboard for the FramedInsight project.
2. Go to SQL Editor.
3. Create a new query.
4. Paste the contents of [supabase/migrations/20260705_fix_cooperative_officers_rls_recursion.sql](../supabase/migrations/20260705_fix_cooperative_officers_rls_recursion.sql).
5. Run the query and wait for success.

## Verify the fix

Run these checks in the same SQL editor after the migration completes:

```sql
select *
from public.cooperative_officers
limit 5;

select *
from public.farms
limit 5;
```

You should see rows returned without the "infinite recursion detected in policy" error.

## Optional smoke test in the app

After the migration is live:

1. Sign in with a cooperative officer account.
2. Open the dashboard.
3. Confirm the account verification step completes and the dashboard loads.
4. Request an OTP and confirm the flow behaves normally.
