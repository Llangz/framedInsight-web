import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, sendWhatsAppButtons } from '@/lib/lipachat'
import { processFarmerIntent, executeIntent } from '@/lib/ai/intent-processor'

/**
 * Safe wrapper: tries interactive buttons first, falls back to plain text menu.
 * The sandbox number (+254110090747) does not support interactive messages,
 * so we need this fallback for testing.
 */
async function sendMenuOrText(
  to: string,
  text: string,
  buttons: { id: string; title: string }[]
) {
  try {
    await sendWhatsAppButtons(to, text, buttons)
  } catch (err: any) {
    const menuText = `${text}\n\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}\n\nReply with the number or type your request.`
    await sendWhatsAppMessage(to, menuText)
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // ── RAW PAYLOAD LOGGER ──────────────────────────────────────────────────
    // Logs the FULL body so we can see exactly what LipaChat sends.
    // Remove this block once the payload shape is confirmed.
    const rawBody = await req.text()
    console.log('=== LIPACHAT RAW PAYLOAD ===')
    console.log(rawBody)
    console.log('=== END PAYLOAD ===')

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      console.error('Failed to parse JSON body:', rawBody)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    // ── END RAW LOGGER ──────────────────────────────────────────────────────

    // LipaChat may nest the message inside an 'entry' or 'messages' array
    // (Meta-style), or send it flat. We handle both shapes here.
    const normalised = normalisePayload(body)
    console.log('Normalised payload:', JSON.stringify(normalised))

    const { senderNumber, messageText, messageType, interactive } = normalised

    if (!senderNumber) {
      console.error('No sender number found in payload:', body)
      return NextResponse.json({ error: 'Invalid payload — no sender' }, { status: 400 })
    }

    // --- Handle Button Clicks ---
    if (messageType === 'interactive' && interactive?.button_reply) {
      const buttonId = interactive.button_reply.id
      console.log('Button Clicked:', buttonId)

      if (buttonId === 'MENU_MAIN') {
        await sendMenuOrText(senderNumber, "Karibu! Ungependa kufanya nini leo?", [
          { id: 'MENU_COFFEE', title: '☕ Coffee' },
          { id: 'MENU_DAIRY', title: '🐄 Dairy' },
          { id: 'MENU_GOATS', title: '🐏 Small Ruminants' }
        ])
        return NextResponse.json({ success: true })
      }
      if (buttonId === 'MENU_COFFEE') {
        await sendMenuOrText(senderNumber, "Huduma za Kahawa (Coffee):", [
          { id: 'MENU_COFFEE_HARVEST', title: '🍒 Record Harvest' },
          { id: 'MENU_COFFEE_DISEASE', title: '🔬 Disease Check' },
          { id: 'MENU_COFFEE_EUDR',    title: '🛡️ EUDR Status' }
        ])
        return NextResponse.json({ success: true })
      }
      if (buttonId === 'MENU_DAIRY') {
        await sendMenuOrText(senderNumber, "Huduma za Ng'ombe (Dairy):", [
          { id: 'MENU_DAIRY_MILK',    title: '🍼 Record Milk' },
          { id: 'MENU_DAIRY_WARNING', title: '🤖 AI Warnings' },
          { id: 'MENU_DAIRY_HEALTH',  title: '💉 Health/Vet' }
        ])
        return NextResponse.json({ success: true })
      }
      if (buttonId === 'MENU_GOATS') {
        await sendMenuOrText(senderNumber, "Huduma za Small Ruminants (Mbuzi/Kondoo):", [
          { id: 'MENU_GOATS_WEIGHT',  title: '⚖️ Record Weight' },
          { id: 'MENU_GOATS_WARNING', title: '🤖 AI Warnings' },
          { id: 'MENU_GOATS_SALES',   title: '💰 Sales' }
        ])
        return NextResponse.json({ success: true })
      }
      if (buttonId === 'MENU_DAIRY_MILK') {
        await sendWhatsAppMessage(senderNumber, "Sawa! Tafadhali tuma kiasi cha maziwa kwa lita (mfano: 'Cow 01 ametoa 10L asubuhi')")
        return NextResponse.json({ success: true })
      }
    }

    if (!messageText) {
      console.log('No message text found — ignoring non-text message')
      return NextResponse.json({ success: true, note: 'No text content' })
    }

    // --- Handle Greeting / Help ---
    const greetings = ['hi', 'hello', 'habari', 'mambo', 'menu', 'help', 'msaada']
    if (greetings.includes(messageText.toLowerCase().trim())) {
      await sendMenuOrText(senderNumber, "Jambo! Mimi ni framedInsight AI. Chagua huduma unayohitaji:", [
        { id: 'MENU_COFFEE', title: '☕ Coffee' },
        { id: 'MENU_DAIRY', title: '🐄 Dairy' },
        { id: 'MENU_GOATS', title: '🐏 Small Ruminants' }
      ])
      return NextResponse.json({ success: true })
    }

    // --- Resolve Farmer by Phone ---
    let formattedPhone = senderNumber
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone
    }

    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .select('id, farm_name, phone')
      .eq('phone', formattedPhone)
      .single()

    if (farmError || !farm) {
      console.error('Farmer not found for number:', formattedPhone)
      await sendWhatsAppMessage(senderNumber,
        "Karibu framedInsight! 🌿\n\nHujasajiliwa bado. Tembelea https://framed-insight-web.vercel.app kusajili shamba lako na kuanza kutumia huduma zetu za kilimo.")
      return NextResponse.json({ success: true, status: 'unrecognized_sender' })
    }

    // --- AI Intent + DB Action ---
    const parsedIntent = await processFarmerIntent(messageText, farm.id)
    const confirmationText = await executeIntent(farm.id, parsedIntent)
    await sendWhatsAppMessage(senderNumber, confirmationText)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Webhook Error:', error)
    return NextResponse.json({ error: 'Internal Error', details: error.message }, { status: 500 })
  }
}

/**
 * Normalises the incoming LipaChat payload into a consistent shape.
 *
 * LipaChat can send two formats:
 *
 * FORMAT A — Flat (simple/sandbox):
 * { from: "254...", text: "hi", type: "text", messageId: "..." }
 *
 * FORMAT B — Meta-style nested:
 * { entry: [{ changes: [{ value: { messages: [{ from, text: { body }, type }] } }] }] }
 *
 * We extract { senderNumber, messageText, messageType, interactive } from either.
 */
function normalisePayload(body: any) {
  // Format A — flat payload (most likely for LipaChat)
  if (body.from) {
    return {
      senderNumber: body.from,
      messageText: body.text || body.body || body.message || null,
      messageType: body.type || 'text',
      interactive: body.interactive || null,
    }
  }

  // Format B — Meta-style nested payload
  try {
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (message) {
      return {
        senderNumber: message.from,
        messageText: message.text?.body || message.body || null,
        messageType: message.type || 'text',
        interactive: message.interactive || null,
      }
    }
  } catch {}

  // Format C — some providers wrap differently
  if (body.message?.from || body.sender) {
    return {
      senderNumber: body.message?.from || body.sender,
      messageText: body.message?.text || body.text || null,
      messageType: body.type || 'text',
      interactive: body.interactive || null,
    }
  }

  // Unknown format — return empty so we can log and debug
  return { senderNumber: null, messageText: null, messageType: null, interactive: null }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Webhook active' })
}