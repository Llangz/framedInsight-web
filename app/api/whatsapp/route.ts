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
    // Buttons not supported (e.g. sandbox) — send as plain text menu instead
    const menuText = `${text}\n\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}\n\nReply with the number or type your request.`
    await sendWhatsAppMessage(to, menuText)
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for backend lookups
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('WhatsApp Webhook Received:', body)

    const { from: senderNumber, text: messageText, messageId: lipaId, type, interactive } = body

    if (!senderNumber) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // --- Handle Button Clicks ---
    if (type === 'interactive' && interactive?.button_reply) {
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

      // Handle terminal actions (e.g. prompt for input)
      if (buttonId === 'MENU_DAIRY_MILK') {
        await sendWhatsAppMessage(senderNumber, "Sawa! Tafadhali tuma kiasi cha maziwa kwa lita (mfano: 'Cow 01 ametoa 10L asubuhi')")
        return NextResponse.json({ success: true })
      }
      
      // ... more terminal logic
    }

    if (!messageText) {
      return NextResponse.json({ success: true, note: 'Empty text' })
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

    // 1. Resolve Farmer/Farm by Phone Number
    // Numbers usually come as 254... from LipaChat
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

    // 2. Process Intent using AI
    const parsedIntent = await processFarmerIntent(messageText, farm.id)
    
    // 3. Execute Action (Database Update)
    const confirmationText = await executeIntent(farm.id, parsedIntent)

    // 4. Respond to Farmer
    await sendWhatsAppMessage(senderNumber, confirmationText)

    // 5. Log the message (Optional - if tables existed)
    /*
    await supabase.from('whatsapp_messages').insert({
      farm_id: farm.id,
      direction: 'inbound',
      content: messageText,
      lipachat_message_id: lipaId
    })
    */

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Webhook Error:', error)
    return NextResponse.json({ error: 'Internal Error', details: error.message }, { status: 500 })
  }
}

// Verification endpoint for some services (LipaChat usually doesn't require GET verification like Meta, but good to have)
export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Webhook active' })
}