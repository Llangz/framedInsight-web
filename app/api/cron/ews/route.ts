import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/lipachat'

// Vercel Cron timeout
export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Validate Cron Secret
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
        // 1. Fetch pending alerts with farm details
    // We only fetch alerts that haven't been sent yet and are not acknowledged.
    // LIMIT 200 + oldest-first: without a limit, a backlog (e.g. after an
    // outage) grows unbounded and risks a single cron run timing out or
    // hammering the WhatsApp API in one burst. Oldest-first means the
    // backlog clears in order instead of newest alerts perpetually jumping
    // the queue ahead of older unsent ones.
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('id, farm_id, alert_type, alert_priority, message, created_at, farms(phone, farm_name)')
      .is('sent_at', null)
      .is('acknowledged_at', null)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) throw error

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({ message: 'No pending alerts to push' })
    }

    // 2. Group by farm
    const farmsMap = new Map<string, any>()
    for (const alert of alerts) {
      const phone = (alert.farms as any)?.phone
      const farmName = (alert.farms as any)?.farm_name
      if (!phone) continue // Skip if no phone

      if (!farmsMap.has(alert.farm_id)) {
        farmsMap.set(alert.farm_id, {
          phone,
          farmName,
          alerts: [],
          alertIds: []
        })
      }
      
      const farmGroup = farmsMap.get(alert.farm_id)
      farmGroup.alerts.push(alert)
      farmGroup.alertIds.push(alert.id)
    }

    // 3. Send WhatsApp messages
    const sentAlertIds: string[] = []
    
    for (const [farmId, data] of farmsMap.entries()) {
      try {
        const criticals = data.alerts.filter((a: any) => a.alert_priority === 'critical' || a.alert_priority === 'high')
        const others = data.alerts.filter((a: any) => a.alert_priority !== 'critical' && a.alert_priority !== 'high')
        
        let msg = `🌅 *Good Morning from framedInsight EWS*\n`
        msg += `Daily Briefing for *${data.farmName || 'Your Farm'}*\n\n`
        
        if (criticals.length > 0) {
          msg += `🚨 *URGENT ALERTS:*\n`
          criticals.forEach((a: any) => {
            msg += `• [${a.alert_type}] ${a.message}\n`
          })
          msg += `\n`
        }
        
        if (others.length > 0) {
          msg += `⚠️ *NOTICES:*\n`
          others.slice(0, 5).forEach((a: any) => {
            msg += `• ${a.message}\n`
          })
          if (others.length > 5) {
            msg += `_...and ${others.length - 5} more. Check dashboard._\n`
          }
          msg += `\n`
        }
        
        msg += `Please review these items on your dashboard today.`
        
        await sendWhatsAppMessage(data.phone, msg)
        sentAlertIds.push(...data.alertIds)
      } catch (err) {
        console.error(`Failed to send WA for farm ${farmId}:`, err)
      }
    }

    // 4. Mark as sent
    if (sentAlertIds.length > 0) {
      await supabase
        .from('alerts')
        .update({ 
          sent_at: new Date().toISOString(),
          delivery_channels: ['whatsapp'] 
        })
        .in('id', sentAlertIds)
    }

    return NextResponse.json({ 
      success: true, 
      farmsNotified: farmsMap.size,
      alertsProcessed: sentAlertIds.length 
    })

  } catch (error: any) {
    console.error('EWS Cron Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
