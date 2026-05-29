import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processFarmerIntent, executeIntent } from '@/lib/ai/intent-processor'

// ── Send WhatsApp text message directly (no lib dependency)
async function sendReply(to: string, message: string) {
  const apiKey = process.env.LIPACHAT_API_KEY
  const from = process.env.LIPACHAT_WHATSAPP_NUMBER

  if (!apiKey || !from) {
    throw new Error(`Missing env vars: LIPACHAT_API_KEY=${!!apiKey} LIPACHAT_WHATSAPP_NUMBER=${!!from}`)
  }

  const cleanTo = to.replace(/^\+/, '').trim()

  console.log(`Sending reply to ${cleanTo} from ${from}`)

  const res = await fetch('https://gateway.lipachat.com/api/v1/whatsapp/message/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apiKey': apiKey,
    },
    body: JSON.stringify({
      message,
      to: cleanTo,
      from,
      messageId: crypto.randomUUID(),
    }),
  })

  const data = await res.json()
  console.log('LipaChat send response:', JSON.stringify(data))

  if (data?.status === 'error') {
    throw new Error(`LipaChat error: ${data.message || JSON.stringify(data)}`)
  }

  return data
}

// ── Main menu text
function mainMenuText() {
  return (
    `Jambo! 👋 Mimi ni *framedInsight AI*\n\n` +
    `Chagua huduma:\n` +
    `1️⃣ Coffee - Mavuno, EUDR, Magonjwa\n` +
    `2️⃣ Dairy - Maziwa, Afya ya Ng'ombe\n` +
    `3️⃣ Goats/Sheep - Uzito, Afya, Mauzo\n\n` +
    `Au andika ombi moja kwa moja k.m:\n` +
    `"Cow 01 ametoa 12L asubuhi"`
  )
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook active', version: '4.0' })
}

export async function POST(req: NextRequest) {
  let body: any

  // Step 1: Parse body
  try {
    body = await req.json()
  } catch (e) {
    console.error('JSON parse error')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Step 2: Log everything
  console.log('PAYLOAD:', JSON.stringify(body))

  // Step 3: Extract fields
  // Confirmed payload format from LipaChat docs:
  // { messageId, from, to, profileName, type: "TEXT", text }
  const senderNumber: string = body.from || ''
  const messageText: string  = body.text || body.message || ''
  const messageType: string  = (body.type || '').toUpperCase()

  console.log(`FROM=${senderNumber} TYPE=${messageType} TEXT="${messageText}"`)

  if (!senderNumber) {
    console.error('No sender in payload')
    return NextResponse.json({ received: true })
  }

  // Step 4: Handle greetings — send menu
  const lower = messageText.toLowerCase().trim()
  const greetings = ['hi', 'hello', 'habari', 'mambo', 'menu', 'help', 'msaada',
                     'sasa', 'niaje', 'hujambo', 'start', 'oya']
  const isGreeting = !lower || greetings.some(g => lower.startsWith(g))

  if (isGreeting) {
    console.log('Greeting detected, sending main menu')
    try {
      await sendReply(senderNumber, mainMenuText())
      console.log('Menu sent successfully')
    } catch (err: any) {
      console.error('Failed to send menu:', err.message)
    }
    return NextResponse.json({ received: true })
  }

  // Step 5: Number shortcuts
  if (lower === '1' || lower.includes('coffee') || lower.includes('kahawa')) {
    try {
      await sendReply(senderNumber,
        `☕ *Coffee*\n\n` +
        `Mfano wa maombi:\n` +
        `• "Niliokota 50kg cherry kutoka Hillside"\n` +
        `• "EUDR status ya Block A"\n` +
        `• "Hillside plot ina CBD disease"`)
    } catch (err: any) { console.error(err.message) }
    return NextResponse.json({ received: true })
  }

  if (lower === '2' || lower.includes('dairy') || lower.includes("ng'ombe") || lower.includes('maziwa')) {
    try {
      await sendReply(senderNumber,
        `🐄 *Dairy*\n\n` +
        `Mfano wa maombi:\n` +
        `• "Cow 01 ametoa 15L asubuhi"\n` +
        `• "Daisy ana tatizo la mastitis"\n` +
        `• "AI warnings zangu"`)
    } catch (err: any) { console.error(err.message) }
    return NextResponse.json({ received: true })
  }

  if (lower === '3' || lower.includes('goat') || lower.includes('mbuzi') || lower.includes('kondoo')) {
    try {
      await sendReply(senderNumber,
        `🐏 *Small Ruminants*\n\n` +
        `Mfano wa maombi:\n` +
        `• "Nanny 01 ana uzito 35kg"\n` +
        `• "Buck 02 ana tatizo"\n` +
        `• "Niuzie Nanny 01 kwa 8000"`)
    } catch (err: any) { console.error(err.message) }
    return NextResponse.json({ received: true })
  }

  // Step 6: Resolve farmer in Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars')
    try { await sendReply(senderNumber, 'Samahani, tatizo la mfumo. Jaribu tena. 🙏') } catch {}
    return NextResponse.json({ received: true })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const formattedPhone = senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`

  try {
    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .select('id, farm_name, phone')
      .eq('phone', formattedPhone)
      .single()

    if (farmError || !farm) {
      console.log('Unregistered number:', formattedPhone, farmError?.message)
      await sendReply(senderNumber,
        `Karibu framedInsight! 🌿\n\n` +
        `Hujasajiliwa bado. Tembelea:\n` +
        `https://framed-insight-web.vercel.app\n` +
        `kusajili shamba lako.`)
      return NextResponse.json({ received: true })
    }

    console.log(`Farm: ${farm.farm_name} (${farm.id})`)
    const parsedIntent = await processFarmerIntent(messageText, farm.id)
    console.log('Intent:', JSON.stringify(parsedIntent))

    const reply = await executeIntent(farm.id, parsedIntent)
    await sendReply(senderNumber, reply)

  } catch (err: any) {
    console.error('Handler error:', err.message, err.stack)
    try { await sendReply(senderNumber, 'Samahani, kuna tatizo kidogo. 😅 Jaribu tena.') } catch {}
  }

  return NextResponse.json({ received: true })
}