// ============================================================================
// GET /api/cron/reconcile-payments
//
// Picks up M-Pesa transactions where the payment completed but the
// subsequent farm-activation write failed (activation_status = 'pending'
// stuck past its first attempt, or 'activation_failed') and retries them.
//
// This is the automated half of the fix for the payment-activation gap
// documented in supabase/migrations/20260714b_payment_activation_reconciliation.sql
// and app/api/payments/callback/route.ts's step 5 comment — a farmer who
// paid via M-Pesa but whose subscription failed to activate (a transient
// DB hiccup, a dropped connection, anything) previously had no path back
// to an active subscription short of someone noticing a support complaint
// and fixing it by hand.
//
// Scheduled every 15 minutes in vercel.json. A transaction stuck past a
// couple of cron cycles is treated the same way EWS alerts are: capped
// retries, then escalate rather than retry forever — see MAX_ATTEMPTS
// below.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { activateSubscription } from '@/lib/activate-subscription'
import { sendWhatsAppMessage } from '@/lib/lipachat'
import { auditLog } from '@/lib/security'

export const maxDuration = 60

// After this many failed attempts (initial callback attempt + cron
// retries), stop auto-retrying a row and escalate instead. Keeps a
// permanently-broken row (e.g. a farm that was deleted after paying,
// which does happen) from being retried forever every 15 minutes.
const MAX_ATTEMPTS = 5
// Rows this stuck are surfaced prominently in the admin subscriptions
// page and here (with an optional WhatsApp ping — see below) rather than
// this cron pretending it can resolve them; the fix at that point is
// usually a manual look, not another automated retry.
const BATCH_LIMIT = 50

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // Cast: activation_* columns aren't in lib/database.types.ts yet — see
    // the same note in lib/activate-subscription.ts.
    const { data: rows, error } = await (supabase.from('transactions') as any)
      .select('id, farm_id, months_added, amount, activation_attempts')
      .eq('status', 'completed')
      .in('activation_status', ['pending', 'activation_failed'])
      .lt('activation_attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT)

    if (error) throw error

    if (!rows || rows.length === 0) {
      return NextResponse.json({ message: 'No stuck activations to reconcile' })
    }

    let activated = 0
    let stillFailing = 0
    let escalated = 0

    for (const row of rows) {
      const result = await activateSubscription({
        id: row.id,
        farm_id: row.farm_id,
        months_added: row.months_added,
        amount: row.amount,
      })

      if (result.success) {
        activated++
        continue
      }

      stillFailing++

      // Re-read the attempt count activateSubscription just incremented,
      // to decide whether this row just hit the cap.
      const { data: current } = await (supabase.from('transactions') as any)
        .select('activation_attempts')
        .eq('id', row.id)
        .maybeSingle()

      const attempts = current?.activation_attempts ?? row.activation_attempts + 1

      if (attempts >= MAX_ATTEMPTS) {
        escalated++
        await auditLog({
          action: 'PAYMENT_ACTIVATION_ESCALATED',
          actorId: null,
          farmId: row.farm_id,
          resource: 'transactions',
          resourceId: row.id,
          details: { attempts, error: result.error, amount: row.amount },
          ip: null,
        })

        const adminPhone = process.env.ADMIN_ALERT_PHONE
        if (adminPhone) {
          try {
            await sendWhatsAppMessage(
              adminPhone,
              `⚠️ framedInsight: M-Pesa payment activation failed ${attempts}x for farm ${row.farm_id} ` +
              `(txn ${row.id}, KES ${row.amount}). Needs manual review in /admin/subscriptions.`
            )
          } catch (waErr: any) {
            console.error('[reconcile-payments] Failed to send admin WhatsApp escalation:', waErr?.message)
          }
        }
      }
    }

    return NextResponse.json({
      processed: rows.length,
      activated,
      stillFailing,
      escalated,
    })
  } catch (err: any) {
    console.error('[reconcile-payments] Unexpected error:', err?.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
