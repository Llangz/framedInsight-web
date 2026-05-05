import { NextRequest, NextResponse } from 'next/server'
import { processFarmerIntent, executeIntent } from '@/lib/ai/intent-processor'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 🔹 Extract from LipaChat payload (adjust if needed)
    const message = body.message?.text || body.text
    const phone = body.from || body.phone

    if (!message || !phone) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createClient()

    // 🔹 1. Identify farm
    const { data: farm } = await supabase
      .from('farms')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (!farm) {
      return NextResponse.json({
        reply: "Hujasajiliwa bado. Tafadhali register kwanza."
      })
    }

    // 🔹 2. Parse intent
    const parsed = await processFarmerIntent(message, farm.id)

    // 🔹 3. Execute intent
    const reply = await executeIntent(farm.id, parsed)

    // 🔹 4. Return response
    return NextResponse.json({ reply })

  } catch (error) {
    console.error('WhatsApp API error:', error)

    return NextResponse.json({
      reply: 'Kuna shida kidogo 😅 Tafadhali jaribu tena.'
    })
  }
}