import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/lipachat'
import { processFarmerIntent, executeIntent } from '@/lib/ai/intent-processor'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Greeting menu as plain text (sandbox doesn't support interactive buttons)
async function sendMainMenu(to: string) {
  await sendWhatsAppMessage(to,
    `Jambo! 👋 Mimi ni *framedInsight AI* - msaidizi wako wa kilimo.\n\n` +
    `Chagua huduma:\n` +
    `1️⃣ *Coffee* - Rekodi mavuno, hali ya mimea, EUDR\n` +
    `2️⃣ *Dairy* - Rekodi maziwa, afya ya ng'ombe, AI warnings\n` +
    `3️⃣ *Goats/Sheep* - Rekodi uzito, afya, mauzo\n\n` +
    `Au andika ombi lako moja kwa moja, k.m:\n` +
    `_"Cow 01 ametoa 12L asubuhi"_\n` +
    `_"Niliokota 50kg cherry kutoka Hillside plot"_`
  )
}

export async function POST(req: NextRequest) {
  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Log full payload for debugging
  console.log('LIPACHAT PAYLOAD:', JSON.stringify(body))

  try {
    // ── Extract fields — LipaChat sends type in UPPERCASE e.g. "TEXT"
    const senderNumber: string = body.from
    const messageText: string  = body.text || body.message || body.body || ''
    const messageType: string  = (body.type || '').toUpperCase()

    if (!senderNumber) {
      console.error('No sender number in payload')
      return NextResponse.json({ error: 'No sender' }, { status: 400 })
    }

    console.log(`MSG from ${senderNumber} | type: ${messageType} | text: "${messageText}"`)

    // ── Greeting / menu trigger
    const lower = messageText.toLowerCase().trim()
    const greetingWords = ['hi', 'hello', 'habari', 'mambo', 'menu', 'help',
                           'msaada', 'sasa', 'niaje', 'oya', 'start', 'hujambo']
    const isGreeting = greetingWords.some(g => lower.startsWith(g))

    if (isGreeting || !lower) {
      await sendMainMenu(senderNumber)
      return NextResponse.json({ success: true })
    }

    // ── Number shortcut: user replies "1", "2", "3" to the menu
    if (lower === '1' || lower.includes('coffee')) {
      await sendWhatsAppMessage(senderNumber,
        `☕ *Coffee Menu*\n\n` +
        `Andika moja:\n` +
        `• _"Niliokota [kg] kutoka [plot name]"_ - rekodi mavuno\n` +
        `• _"EUDR status ya [plot name]"_ - angalia compliance\n` +
        `• _"[plot name] ina ugonjwa wa CBD"_ - ripoti ugonjwa`)
      return NextResponse.json({ success: true })
    }

    if (lower === '2' || lower.includes('dairy') || lower.includes("ng'ombe") || lower.includes('maziwa')) {
      await sendWhatsAppMessage(senderNumber,
        `🐄 *Dairy Menu*\n\n` +
        `Andika moja:\n` +
        `• _"[Cow tag] ametoa [L] [asubuhi/jioni]"_ - rekodi maziwa\n` +
        `• _"AI warnings"_ - angalia tahadhari za AI\n` +
        `• _"[Cow tag] ana tatizo la [ugonjwa]"_ - ripoti afya`)
      return NextResponse.json({ success: true })
    }

    if (lower === '3' || lower.includes('goat') || lower.includes('mbuzi') || lower.includes('kondoo')) {
      await sendWhatsAppMessage(senderNumber,
        `🐏 *Small Ruminants Menu*\n\n` +
        `Andika moja:\n` +
        `• _"[Animal tag] ana uzito [kg]"_ - rekodi uzito\n` +
        `• _"[Animal tag] ana tatizo"_ - ripoti afya\n` +
        `• _"Niuzie [Animal tag] kwa [KES]"_ - rekodi mauzo`)
      return NextResponse.json({ success: true })
    }

    // ── Resolve farmer by phone number
    const formattedPhone = senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`

    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .select('id, farm_name, phone')
      .eq('phone', formattedPhone)
      .single()

    if (farmError || !farm) {
      console.log('Unregistered number:', formattedPhone)
      await sendWhatsAppMessage(senderNumber,
        `Karibu framedInsight! 🌿\n\n` +
        `Naona hujasajiliwa bado.\n` +
        `Tembelea: https://framed-insight-web.vercel.app\n` +
        `kusajili shamba lako na kuanza kupata huduma za AI za kilimo.`)
      return NextResponse.json({ success: true })
    }

    // ── AI intent processing
    console.log(`Farm found: ${farm.farm_name} (${farm.id})`)
    const parsedIntent = await processFarmerIntent(messageText, farm.id)
    console.log('Parsed intent:', JSON.stringify(parsedIntent))

    const confirmationText = await executeIntent(farm.id, parsedIntent)
    await sendWhatsAppMessage(senderNumber, confirmationText)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Webhook error:', error?.message || error)
    // Still return 200 to LipaChat so it doesn't retry endlessly
    // but log the full error for our debugging
    try {
      if (body?.from) {
        await sendWhatsAppMessage(body.from,
          'Samahani, kuna tatizo kidogo. 😅 Tafadhali jaribu tena baadaye.')
      }
    } catch (replyErr) {
      console.error('Failed to send error reply:', replyErr)
    }
    return NextResponse.json({ error: 'Internal Error', details: error?.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook active', version: '2.0' })
}