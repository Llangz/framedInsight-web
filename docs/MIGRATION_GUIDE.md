# FramedInsight Migration Deployment Guide

## Current Status
- Event Sourcing schema ready for deployment
- Materialized views designed for EUDR compliance hot paths
- RLS policies configured for multi-tenant security

## Deployment Steps

### Step 1: Deploy farm_events Table (2026-04-28)
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to your FramedInsight project
3. Open **SQL Editor**
4. Create a new query and copy the entire contents of:
   ```
   supabase/migrations/20260428_create_farm_events.sql
   ```
5. Click **Execute** and wait for success ✅

**What this does:**
- Creates `farm_events` table with event sourcing schema
- Adds indexes for common query patterns (farm_id, plot_id, event_type, actor_id, synced_to_server)
- Enables Row-Level Security (RLS) so users can only see their own farm events
- Creates `v_eudr_assessment_stream` view for reading latest assessments

---

### Step 2: Deploy Materialized Views & Triggers
1. In the same **SQL Editor**, create a new query
2. Copy the entire contents of:
   ```
   supabase/migrations/materialized-views.sql
   ```
3. Click **Execute** and wait for all views to be created ✅

**What this does:**
- Creates `v_eudr_summary` - summary counts of EUDR assessments by farm
- Creates `v_plot_status` - enriched plot data with latest satellite + EUDR status
- Creates `v_daily_production_new` - dairy production summaries
- Creates `v_compliance_timeline` - audit trail for compliance disputes (uses farm_events)
- Creates `v_active_alerts` - high-priority alerts not yet acknowledged
- Creates triggers to auto-refresh views when underlying tables change

---

### Step 3: Verify Deployment
Run these queries in SQL Editor to verify:

```sql
-- Check farm_events table exists
SELECT COUNT(*) as event_count FROM farm_events;

-- Check views are created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'v_%';

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'farm_events';
```

---

### Step 4: Regenerate TypeScript Types
Once migrations are deployed:

```bash
cd framedinsight-web

# Option A: Using Supabase CLI (if available)
supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts

# Option B: Manual regeneration via API
# See CLAUDE.md for instructions
```

---

### Step 5: Update Your Code
The codebase is ready to use the event store:

```typescript
import { EventStore, PlotAggregate } from '@/lib/event-sourcing'

// Record an event
const store = new EventStore()
const event = await store.recordEvent({
  id: crypto.randomUUID(),
  farm_id: farmId,
  event_type: 'eudr_assessment_run',
  actor_id: userId,
  actor_type: 'system',
  created_at: new Date().toISOString(),
  event_data: {
    plot_id: plotId,
    assessment_service: 'afa_api',
    risk_level: 'low',
    forest_cover_pct: 25,
    // ... more fields
  }
})

// Get audit trail for compliance
const auditTrail = await store.getPlotAuditTrail(plotId)
```

---

## Rollback Plan

If deployment fails:

1. Drop views first (in reverse order):
   ```sql
   DROP MATERIALIZED VIEW IF EXISTS v_active_alerts;
   DROP MATERIALIZED VIEW IF EXISTS v_compliance_timeline;
   DROP MATERIALIZED VIEW IF EXISTS v_daily_production_new;
   DROP MATERIALIZED VIEW IF EXISTS v_plot_status;
   DROP MATERIALIZED VIEW IF EXISTS v_eudr_summary;
   DROP VIEW IF EXISTS v_eudr_assessment_stream;
   ```

2. Drop table:
   ```sql
   DROP TABLE IF EXISTS farm_events;
   ```

---

## References
- DDIA Chapter 11: Stream Processing (event sourcing patterns)
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Materialized Views: https://www.postgresql.org/docs/current/sql-creatematerializedview.html
