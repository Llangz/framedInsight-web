import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processFarmerIntent, executeIntent } from '@/lib/ai/intent-processor'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Lang = 'en' | 'sw'

interface Button { id: string; title: string }

// ─────────────────────────────────────────────
// i18n strings
// ─────────────────────────────────────────────
const t = {
  en: {
    langPrompt:    `Welcome to *framedInsight* \n\nPlease choose your language:`,
    langButtons:   [{ id: 'LANG_EN', title: '🇬🇧 English' }, { id: 'LANG_SW', title: '🇰🇪 Kiswahili' }],
    langSet:       `Great! I'll reply in English from now on. 👍\n\nSend *menu* any time to see options.`,
    menuPrompt:    `Hello! 👋 I'm *framedInsight AI* — your farming assistant.\n\nWhat would you like to do?`,
    menuButtons:   [
      { id: 'MENU_COFFEE', title: '☕ Coffee' },
      { id: 'MENU_DAIRY',  title: '🐄 Dairy' },
      { id: 'MENU_GOATS',  title: '🐏 Goats & Sheep' },
    ],
    coffeePrompt:  `☕ *Coffee*\n\nChoose an action:`,
    coffeeButtons: [
      { id: 'ACT_COFFEE_HARVEST', title: '🍒 Record Harvest' },
      { id: 'ACT_COFFEE_DISEASE', title: '🔬 Report Disease' },
      { id: 'ACT_COFFEE_EUDR',   title: '🛡️ EUDR Status' },
    ],
    dairyPrompt:   `🐄 *Dairy*\n\nChoose an action:`,
    dairyButtons:  [
      { id: 'ACT_DAIRY_MILK',    title: '🍼 Record Milk' },
      { id: 'ACT_DAIRY_HEALTH',  title: '💉 Report Health Issue' },
      { id: 'ACT_DAIRY_WARN',    title: '🤖 AI Warnings' },
    ],
    goatsPrompt:   `🐏 *Goats & Sheep*\n\nChoose an action:`,
    goatsButtons:  [
      { id: 'ACT_GOATS_WEIGHT', title: '⚖️ Record Weight' },
      { id: 'ACT_GOATS_HEALTH', title: '💉 Report Health Issue' },
      { id: 'ACT_GOATS_SALES',  title: '💰 Record Sale' },
    ],
    coffeeHarvest: `🍒 *Record Coffee Harvest*\n\nJust type naturally, e.g:\n_"I picked 80kg cherry from Hillside plot"_\n_"Collected 2 bags from Block A today"_`,
    coffeeDisease: `🔬 *Report Disease*\n\nDescribe what you see, e.g:\n_"Hillside plot has CBD on 3 trees"_\n_"Block A showing leaf rust symptoms"_`,
    coffeeEudr:    `🛡️ *EUDR Status*\n\nWhich plot? e.g:\n_"EUDR status for Hillside plot"_`,
    dairyMilk:     `🍼 *Record Milk*\n\nType it naturally, e.g:\n_"Daisy gave 18L this morning"_\n_"Cow 02 produced 12L evening session"_`,
    dairyHealth:   `💉 *Health Issue*\n\nDescribe the problem, e.g:\n_"Daisy has mastitis symptoms"_\n_"Cow 03 is limping on front left leg"_`,
    dairyWarn:     `🤖 *AI Warnings*\n\nType:\n_"Show my AI warnings"_\nor\n_"Latest alerts for my herd"_`,
    goatsWeight:   `⚖️ *Record Weight*\n\nType it naturally, e.g:\n_"Nanny 01 weighs 38kg"_\n_"Buck 02 is 55kg"_`,
    goatsHealth:   `💉 *Health Issue*\n\nDescribe the problem, e.g:\n_"Nanny 03 has diarrhoea"_\n_"Buck 01 is not eating"_`,
    goatsSales:    `💰 *Record Sale*\n\nType it naturally, e.g:\n_"Sold Nanny 02 for KES 9,000"_`,
    notRegistered: `Welcome to framedInsight! 🌿\n\nYou're not registered yet. Visit:\nhttps://framed-insight-web.vercel.app\nto set up your farm and start using AI-powered farming tools.`,
    error:         `Sorry, something went wrong 😅 Please try again.`,
    fallbackMenu:  `Reply with a number:\n1️⃣ Coffee\n2️⃣ Dairy\n3️⃣ Goats & Sheep\n\nOr just type your request freely.`,
  },
  sw: {
    langPrompt:    `Karibu *framedInsight* 🌿\n\nChagua lugha yako:`,
    langButtons:   [{ id: 'LANG_EN', title: '🇬🇧 English' }, { id: 'LANG_SW', title: '🇰🇪 Kiswahili' }],
    langSet:       `Sawa! Nitajibu kwa Kiswahili. 👍\n\nTuma *menu* wakati wowote kuona chaguo.`,
    menuPrompt:    `Jambo! 👋 Mimi ni *framedInsight AI* — msaidizi wako wa kilimo.\n\nUnataka kufanya nini?`,
    menuButtons:   [
      { id: 'MENU_COFFEE', title: '☕ Kahawa' },
      { id: 'MENU_DAIRY',  title: '🐄 Ng\'ombe' },
      { id: 'MENU_GOATS',  title: '🐏 Mbuzi/Kondoo' },
    ],
    coffeePrompt:  `☕ *Kahawa*\n\nChagua hatua:`,
    coffeeButtons: [
      { id: 'ACT_COFFEE_HARVEST', title: '🍒 Rekodi Mavuno' },
      { id: 'ACT_COFFEE_DISEASE', title: '🔬 Ripoti Ugonjwa' },
      { id: 'ACT_COFFEE_EUDR',   title: '🛡️ Hali ya EUDR' },
    ],
    dairyPrompt:   `🐄 *Ng'ombe*\n\nChagua hatua:`,
    dairyButtons:  [
      { id: 'ACT_DAIRY_MILK',   title: '🍼 Rekodi Maziwa' },
      { id: 'ACT_DAIRY_HEALTH', title: '💉 Ripoti Tatizo la Afya' },
      { id: 'ACT_DAIRY_WARN',   title: '🤖 Tahadhari za AI' },
    ],
    goatsPrompt:   `🐏 *Mbuzi/Kondoo*\n\nChagua hatua:`,
    goatsButtons:  [
      { id: 'ACT_GOATS_WEIGHT', title: '⚖️ Rekodi Uzito' },
      { id: 'ACT_GOATS_HEALTH', title: '💉 Ripoti Tatizo la Afya' },
      { id: 'ACT_GOATS_SALES',  title: '💰 Rekodi Mauzo' },
    ],
    coffeeHarvest: `🍒 *Rekodi Mavuno ya Kahawa*\n\nAndika kwa kawaida, k.m:\n_"Niliokota 80kg cherry kutoka Hillside"_\n_"Nimechuma magunia 2 kutoka Block A leo"_`,
    coffeeDisease: `🔬 *Ripoti Ugonjwa*\n\nElezea unachokiona, k.m:\n_"Hillside ina CBD kwenye miti 3"_\n_"Block A inaonyesha dalili za kutu"_`,
    coffeeEudr:    `🛡️ *Hali ya EUDR*\n\nPlot ipi? k.m:\n_"Hali ya EUDR ya Hillside plot"_`,
    dairyMilk:     `🍼 *Rekodi Maziwa*\n\nAndika kwa kawaida, k.m:\n_"Daisy ametoa 18L asubuhi"_\n_"Cow 02 ametoa 12L jioni"_`,
    dairyHealth:   `💉 *Tatizo la Afya*\n\nElezea tatizo, k.m:\n_"Daisy ana dalili za mastitis"_\n_"Cow 03 anachelewa mguu wa mbele"_`,
    dairyWarn:     `🤖 *Tahadhari za AI*\n\nAndika:\n_"Nionyeshe tahadhari zangu za AI"_\nau\n_"Arifa za hivi karibuni"_`,
    goatsWeight:   `⚖️ *Rekodi Uzito*\n\nAndika kwa kawaida, k.m:\n_"Nanny 01 ana uzito 38kg"_\n_"Buck 02 ni 55kg"_`,
    goatsHealth:   `💉 *Tatizo la Afya*\n\nElezea tatizo, k.m:\n_"Nanny 03 ana kuhara"_\n_"Buck 01 hakula chakula"_`,
    goatsSales:    `💰 *Rekodi Mauzo*\n\nAndika kwa kawaida, k.m:\n_"Nilimuuza Nanny 02 kwa KES 9,000"_`,
    notRegistered: `Karibu framedInsight! 🌿\n\nHujasajiliwa bado. Tembelea:\nhttps://framed-insight-web.vercel.app\nkusajili shamba lako na kuanza kutumia huduma za AI za kilimo.`,
    error:         `Samahani, kuna tatizo kidogo 😅 Tafadhali jaribu tena.`,
    fallbackMenu:  `Jibu kwa nambari:\n1️⃣ Kahawa\n2️⃣ Ng'ombe\n3️⃣ Mbuzi/Kondoo\n\nAu andika ombi lako moja kwa moja.`,
  },
}

// ─────────────────────────────────────────────
// LipaChat API helpers (self-contained, no lib import)
// ─────────────────────────────────────────────
function lipachatHeaders() {
  const apiKey = process.env.LIPACHAT_API_KEY
  if (!apiKey) throw new Error('LIPACHAT_API_KEY not set')
  return { 'Content-Type': 'application/json', 'apiKey': apiKey }
}

function cleanPhone(n: string) { return n.replace(/^\+/, '').trim() }

function getFrom() {
  const f = process.env.LIPACHAT_WHATSAPP_NUMBER
  if (!f) throw new Error('LIPACHAT_WHATSAPP_NUMBER not set')
  return f
}

async function sendText(to: string, message: string) {
  const res = await fetch('https://gateway.lipachat.com/api/v1/whatsapp/message/text', {
    method: 'POST',
    headers: lipachatHeaders(),
    body: JSON.stringify({
      message, to: cleanPhone(to), from: getFrom(), messageId: crypto.randomUUID(),
    }),
  })
  const data = await res.json()
  console.log('sendText response:', JSON.stringify(data))
  if (data?.status === 'error') throw new Error(data.message || 'LipaChat error')
  return data
}

async function sendButtons(to: string, bodyText: string, buttons: Button[]) {
  // WhatsApp allows max 3 buttons per message
  const res = await fetch('https://gateway.lipachat.com/api/v1/whatsapp/message/interactive', {
    method: 'POST',
    headers: lipachatHeaders(),
    body: JSON.stringify({
      to: cleanPhone(to),
      from: getFrom(),
      messageId: crypto.randomUUID(),
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    }),
  })
  const data = await res.json()
  console.log('sendButtons response:', JSON.stringify(data))
  if (data?.status === 'error') throw new Error(data.message || 'LipaChat error')
  return data
}

// Try buttons first; fall back to numbered text list (sandbox / older numbers)
async function sendMenu(to: string, bodyText: string, buttons: Button[], fallbackSuffix = '') {
  try {
    await sendButtons(to, bodyText, buttons)
  } catch (err: any) {
    console.warn('Buttons failed, falling back to text menu:', err.message)
    const numbered = buttons.map((b, i) => `${i + 1}️⃣ ${b.title}`).join('\n')
    await sendText(to, `${bodyText}\n\n${numbered}${fallbackSuffix}`)
  }
}

// ─────────────────────────────────────────────
// Supabase helper
// ─────────────────────────────────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error(`Missing Supabase env vars: url=${!!url} key=${!!key}`)
  return createClient(url, key)
}

// ─────────────────────────────────────────────
// GET — health check
// ─────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ status: 'Webhook active', version: '6.0' })
}

// ─────────────────────────────────────────────
// POST — main handler
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  console.log('PAYLOAD:', JSON.stringify(body))

  // ── Extract fields from confirmed LipaChat payload shape:
  // { messageId, from, to, profileName, type: "TEXT"|"INTERACTIVE", text, interactive? }
  const senderNumber: string = body.from || ''
  const rawText: string      = body.text || body.message || ''
  const msgType: string      = (body.type || '').toUpperCase()
  const interactive          = body.interactive || null

  console.log(`FROM=${senderNumber} TYPE=${msgType} TEXT="${rawText}"`)

  if (!senderNumber) return NextResponse.json({ ok: true })

  // ── Resolve farm + language from Supabase
  const supabase    = getSupabase()
  const phone       = senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`
  const { data: farm } = await supabase
    .from('farms')
    .select('id, farm_name, phone, whatsapp_language')
    .eq('phone', phone)
    .single()

  // Default language: English until user picks
  const lang: Lang = (farm?.whatsapp_language as Lang) || 'en'
  const strings    = t[lang]

  // ── Helper: persist language choice
  async function setLang(l: Lang) {
    if (!farm) return
    await supabase.from('farms').update({ whatsapp_language: l }).eq('id', farm.id)
  }

  // ─────────────────────────────────
  // INTERACTIVE BUTTON REPLY
  // ─────────────────────────────────
  if (msgType === 'INTERACTIVE' && interactive?.button_reply) {
    const btnId: string = interactive.button_reply.id
    console.log('Button clicked:', btnId)

    try {
      // Language selection
      if (btnId === 'LANG_EN') {
        await setLang('en')
        await sendMenu(senderNumber, t.en.menuPrompt, t.en.menuButtons)
        return NextResponse.json({ ok: true })
      }
      if (btnId === 'LANG_SW') {
        await setLang('sw')
        await sendMenu(senderNumber, t.sw.menuPrompt, t.sw.menuButtons)
        return NextResponse.json({ ok: true })
      }

      // Category menus
      if (btnId === 'MENU_COFFEE') {
        await sendMenu(senderNumber, strings.coffeePrompt, strings.coffeeButtons)
        return NextResponse.json({ ok: true })
      }
      if (btnId === 'MENU_DAIRY') {
        await sendMenu(senderNumber, strings.dairyPrompt, strings.dairyButtons)
        return NextResponse.json({ ok: true })
      }
      if (btnId === 'MENU_GOATS') {
        await sendMenu(senderNumber, strings.goatsPrompt, strings.goatsButtons)
        return NextResponse.json({ ok: true })
      }

      // Action prompts — tell user what to type
      const actionMap: Record<string, string> = {
        ACT_COFFEE_HARVEST: strings.coffeeHarvest,
        ACT_COFFEE_DISEASE: strings.coffeeDisease,
        ACT_COFFEE_EUDR:    strings.coffeeEudr,
        ACT_DAIRY_MILK:     strings.dairyMilk,
        ACT_DAIRY_HEALTH:   strings.dairyHealth,
        ACT_DAIRY_WARN:     strings.dairyWarn,
        ACT_GOATS_WEIGHT:   strings.goatsWeight,
        ACT_GOATS_HEALTH:   strings.goatsHealth,
        ACT_GOATS_SALES:    strings.goatsSales,
      }
      if (actionMap[btnId]) {
        await sendText(senderNumber, actionMap[btnId])
        return NextResponse.json({ ok: true })
      }

    } catch (err: any) {
      console.error('Button handler error:', err.message)
      try { await sendText(senderNumber, strings.error) } catch {}
    }

    return NextResponse.json({ ok: true })
  }

  // ─────────────────────────────────
  // TEXT MESSAGE
  // ─────────────────────────────────
  const lower = rawText.toLowerCase().trim()

  // Greeting — show language picker first if farm has no language set,
  // otherwise go straight to menu
  const greetings = ['hi', 'hello', 'habari', 'mambo', 'menu', 'help',
                     'msaada', 'sasa', 'niaje', 'hujambo', 'start', 'oya', 'hey']
  const isGreeting = !lower || greetings.some(g => lower.startsWith(g))

  if (isGreeting) {
    try {
      if (!farm?.whatsapp_language) {
        // First time — ask for language
        await sendMenu(senderNumber, strings.langPrompt, strings.langButtons)
      } else {
        await sendMenu(senderNumber, strings.menuPrompt, strings.menuButtons)
      }
    } catch (err: any) {
      console.error('Greeting error:', err.message)
    }
    return NextResponse.json({ ok: true })
  }

  // Number shortcuts (text fallback for sandbox/older numbers)
  const shortcutMap: Record<string, () => Promise<void>> = {
    '1': () => sendMenu(senderNumber, strings.coffeePrompt, strings.coffeeButtons),
    '2': () => sendMenu(senderNumber, strings.dairyPrompt, strings.dairyButtons),
    '3': () => sendMenu(senderNumber, strings.goatsPrompt, strings.goatsButtons),
  }
  if (shortcutMap[lower]) {
    try { await shortcutMap[lower]() } catch (err: any) { console.error(err.message) }
    return NextResponse.json({ ok: true })
  }

  // ── Unregistered farmer
  if (!farm) {
    try {
      await sendText(senderNumber, lang === 'sw' ? t.sw.notRegistered : t.en.notRegistered)
    } catch (err: any) { console.error(err.message) }
    return NextResponse.json({ ok: true })
  }

  // ── AI intent processing for registered farmers
  try {
    console.log(`Farm: ${farm.farm_name} (${farm.id}) | lang: ${lang}`)
    const parsedIntent = await processFarmerIntent(rawText, farm.id)
    console.log('Intent:', JSON.stringify(parsedIntent))
    const reply = await executeIntent(farm.id, parsedIntent)
    await sendText(senderNumber, reply)
  } catch (err: any) {
    console.error('AI handler error:', err.message, err.stack)
    try { await sendText(senderNumber, strings.error) } catch {}
  }

  return NextResponse.json({ ok: true })
}