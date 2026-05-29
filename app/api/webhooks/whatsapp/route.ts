import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processFarmerIntent, executeIntent } from '@/lib/ai/intent-processor'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Lang = 'en' | 'sw'

/** Where in the menu tree the user currently is */
type MenuState =
  | 'LANG_SELECT'    // First-time, language not yet chosen
  | 'MAIN_MENU'      // Top-level enterprise list
  | 'COFFEE'         // Coffee sub-menu
  | 'DAIRY'          // Dairy sub-menu
  | 'GOATS'          // Goats & Sheep sub-menu
  | 'POULTRY'        // Poultry sub-menu (example of a future enterprise)
  | 'AWAITING_INPUT' // User has chosen an action and we're waiting for free text

interface SessionState {
  lang: Lang
  menuState: MenuState
  /** Last enterprise visited — lets "Back" return to the right sub-menu */
  lastEnterprise?: string
}

interface Button { id: string; title: string }

// ─────────────────────────────────────────────
// Enterprise registry
// Adding a new enterprise = add ONE block here + i18n strings below.
// Nothing else in the routing logic needs to touch.
// ─────────────────────────────────────────────
interface EnterpriseConfig {
  /** Button ID used in MAIN_MENU */
  menuId: string
  /** MenuState value for this enterprise's sub-menu */
  state: MenuState
  /** Keys into the i18n strings object */
  promptKey: string
  buttonsKey: string
  /** Map of action button IDs → i18n key for the prompt text */
  actions: Record<string, string>
}

const ENTERPRISES: EnterpriseConfig[] = [
  {
    menuId:     'MENU_COFFEE',
    state:      'COFFEE',
    promptKey:  'coffeePrompt',
    buttonsKey: 'coffeeButtons',
    actions: {
      ACT_COFFEE_HARVEST: 'coffeeHarvest',
      ACT_COFFEE_DISEASE: 'coffeeDisease',
      ACT_COFFEE_EUDR:    'coffeeEudr',
    },
  },
  {
    menuId:     'MENU_DAIRY',
    state:      'DAIRY',
    promptKey:  'dairyPrompt',
    buttonsKey: 'dairyButtons',
    actions: {
      ACT_DAIRY_MILK:   'dairyMilk',
      ACT_DAIRY_HEALTH: 'dairyHealth',
      ACT_DAIRY_WARN:   'dairyWarn',
    },
  },
  {
    menuId:     'MENU_GOATS',
    state:      'GOATS',
    promptKey:  'goatsPrompt',
    buttonsKey: 'goatsButtons',
    actions: {
      ACT_GOATS_WEIGHT: 'goatsWeight',
      ACT_GOATS_HEALTH: 'goatsHealth',
      ACT_GOATS_SALES:  'goatsSales',
    },
  },
  // ─── ADD NEW ENTERPRISE HERE ────────────────────────────────────────────
  // {
  //   menuId:     'MENU_POULTRY',
  //   state:      'POULTRY',
  //   promptKey:  'poultryPrompt',
  //   buttonsKey: 'poultryButtons',
  //   actions: {
  //     ACT_POULTRY_EGGS:   'poultryEggs',
  //     ACT_POULTRY_HEALTH: 'poultryHealth',
  //     ACT_POULTRY_FEED:   'poultryFeed',
  //   },
  // },
  // ────────────────────────────────────────────────────────────────────────
]

// ─────────────────────────────────────────────
// i18n strings
// Rule: every key referenced in an EnterpriseConfig.actions value must exist here.
// ─────────────────────────────────────────────
type Strings = {
  langPrompt:    string
  langButtons:   Button[]
  langSet:        string
  menuPrompt:    string
  menuButtons:   Button[]
  // Coffee
  coffeePrompt:  string
  coffeeButtons: Button[]
  coffeeHarvest: string
  coffeeDisease: string
  coffeeEudr:    string
  // Dairy
  dairyPrompt:   string
  dairyButtons:  Button[]
  dairyMilk:     string
  dairyHealth:   string
  dairyWarn:     string
  // Goats
  goatsPrompt:   string
  goatsButtons:  Button[]
  goatsWeight:   string
  goatsHealth:   string
  goatsSales:    string
  // Shared UI
  backButton:    Button
  notRegistered: string
  error:         string
  fallbackMenu:  string
  // Poultry (uncomment when enterprise is added above)
  // poultryPrompt:  string
  // poultryButtons: Button[]
  // poultryEggs:    string
  // poultryHealth:  string
  // poultryFeed:    string
}

const t: Record<Lang, Strings> = {
  en: {
    langPrompt:    `Welcome to *framedInsight* 🌿\n\nPlease choose your language:`,
    langButtons:   [{ id: 'LANG_EN', title: '🇬🇧 English' }, { id: 'LANG_SW', title: '🇰🇪 Kiswahili' }],
    langSet:       `Great! I'll reply in English from now on. 👍\n\nSend *menu* any time to see options.`,
    menuPrompt:    `Hello! 👋 I'm *framedInsight AI* — your farming assistant.\n\nWhat would you like to do?`,
    menuButtons:   [
      { id: 'MENU_COFFEE', title: '☕ Coffee' },
      { id: 'MENU_DAIRY',  title: '🐄 Dairy' },
      { id: 'MENU_GOATS',  title: '🐏 Goats & Sheep' },
      // { id: 'MENU_POULTRY', title: '🐔 Poultry' }, // Uncomment when enterprise is added
    ],
    coffeePrompt:  `☕ *Coffee*\n\nChoose an action:`,
    coffeeButtons: [
      { id: 'ACT_COFFEE_HARVEST', title: '🍒 Record Harvest' },
      { id: 'ACT_COFFEE_DISEASE', title: '🔬 Report Disease' },
      { id: 'ACT_COFFEE_EUDR',   title: '🛡️ EUDR Status' },
    ],
    dairyPrompt:   `🐄 *Dairy*\n\nChoose an action:`,
    dairyButtons:  [
      { id: 'ACT_DAIRY_MILK',   title: '🍼 Record Milk' },
      { id: 'ACT_DAIRY_HEALTH', title: '💉 Health Issue' },
      { id: 'ACT_DAIRY_WARN',   title: '🤖 AI Warnings' },
    ],
    goatsPrompt:   `🐏 *Goats & Sheep*\n\nChoose an action:`,
    goatsButtons:  [
      { id: 'ACT_GOATS_WEIGHT', title: '⚖️ Record Weight' },
      { id: 'ACT_GOATS_HEALTH', title: '💉 Health Issue' },
      { id: 'ACT_GOATS_SALES',  title: '💰 Record Sale' },
    ],
    coffeeHarvest: `🍒 *Record Coffee Harvest*\n\nType naturally, e.g:\n_"I picked 80kg cherry from Hillside plot"_\n_"Collected 2 bags from Block A today"_\n\nOr send *back* to go back.`,
    coffeeDisease: `🔬 *Report Disease*\n\nDescribe what you see, e.g:\n_"Hillside plot has CBD on 3 trees"_\n_"Block A showing leaf rust symptoms"_\n\nOr send *back* to go back.`,
    coffeeEudr:    `🛡️ *EUDR Status*\n\nWhich plot? e.g:\n_"EUDR status for Hillside plot"_\n\nOr send *back* to go back.`,
    dairyMilk:     `🍼 *Record Milk*\n\nType naturally, e.g:\n_"Daisy gave 18L this morning"_\n_"Cow 02 produced 12L evening session"_\n\nOr send *back* to go back.`,
    dairyHealth:   `💉 *Health Issue*\n\nDescribe the problem, e.g:\n_"Daisy has mastitis symptoms"_\n_"Cow 03 is limping on front left leg"_\n\nOr send *back* to go back.`,
    dairyWarn:     `🤖 *AI Warnings*\n\nType:\n_"Show my AI warnings"_\nor\n_"Latest alerts for my herd"_\n\nOr send *back* to go back.`,
    goatsWeight:   `⚖️ *Record Weight*\n\nType naturally, e.g:\n_"Nanny 01 weighs 38kg"_\n_"Buck 02 is 55kg"_\n\nOr send *back* to go back.`,
    goatsHealth:   `💉 *Health Issue*\n\nDescribe the problem, e.g:\n_"Nanny 03 has diarrhoea"_\n_"Buck 01 is not eating"_\n\nOr send *back* to go back.`,
    goatsSales:    `💰 *Record Sale*\n\nType naturally, e.g:\n_"Sold Nanny 02 for KES 9,000"_\n\nOr send *back* to go back.`,
    backButton:    { id: 'NAV_BACK', title: '⬅️ Back' },
    notRegistered: `Welcome to framedInsight! 🌿\n\nYou're not registered yet. Visit:\nhttps://framed-insight-web.vercel.app\nto set up your farm and start using AI-powered farming tools.`,
    error:         `Sorry, something went wrong 😅 Please try again or send *menu*.`,
    fallbackMenu:  `Reply with a number to navigate:\n{{shortcuts}}\n\nOr just type your request freely.`,
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
      // { id: 'MENU_POULTRY', title: '🐔 Kuku' }, // Uncomment when enterprise is added
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
      { id: 'ACT_DAIRY_HEALTH', title: '💉 Tatizo la Afya' },
      { id: 'ACT_DAIRY_WARN',   title: '🤖 Tahadhari za AI' },
    ],
    goatsPrompt:   `🐏 *Mbuzi/Kondoo*\n\nChagua hatua:`,
    goatsButtons:  [
      { id: 'ACT_GOATS_WEIGHT', title: '⚖️ Rekodi Uzito' },
      { id: 'ACT_GOATS_HEALTH', title: '💉 Tatizo la Afya' },
      { id: 'ACT_GOATS_SALES',  title: '💰 Rekodi Mauzo' },
    ],
    coffeeHarvest: `🍒 *Rekodi Mavuno ya Kahawa*\n\nAndika kwa kawaida, k.m:\n_"Niliokota 80kg cherry kutoka Hillside"_\n\nAu tuma *rudi* kurudi nyuma.`,
    coffeeDisease: `🔬 *Ripoti Ugonjwa*\n\nElezea unachokiona, k.m:\n_"Hillside ina CBD kwenye miti 3"_\n\nAu tuma *rudi* kurudi nyuma.`,
    coffeeEudr:    `🛡️ *Hali ya EUDR*\n\nPlot ipi? k.m:\n_"Hali ya EUDR ya Hillside plot"_\n\nAu tuma *rudi* kurudi nyuma.`,
    dairyMilk:     `🍼 *Rekodi Maziwa*\n\nAndika kwa kawaida, k.m:\n_"Daisy ametoa 18L asubuhi"_\n\nAu tuma *rudi* kurudi nyuma.`,
    dairyHealth:   `💉 *Tatizo la Afya*\n\nElezea tatizo, k.m:\n_"Daisy ana dalili za mastitis"_\n\nAu tuma *rudi* kurudi nyuma.`,
    dairyWarn:     `🤖 *Tahadhari za AI*\n\nAndika:\n_"Nionyeshe tahadhari zangu za AI"_\n\nAu tuma *rudi* kurudi nyuma.`,
    goatsWeight:   `⚖️ *Rekodi Uzito*\n\nAndika kwa kawaida, k.m:\n_"Nanny 01 ana uzito 38kg"_\n\nAu tuma *rudi* kurudi nyuma.`,
    goatsHealth:   `💉 *Tatizo la Afya*\n\nElezea tatizo, k.m:\n_"Nanny 03 ana kuhara"_\n\nAu tuma *rudi* kurudi nyuma.`,
    goatsSales:    `💰 *Rekodi Mauzo*\n\nAndika kwa kawaida, k.m:\n_"Nilimuuza Nanny 02 kwa KES 9,000"_\n\nAu tuma *rudi* kurudi nyuma.`,
    backButton:    { id: 'NAV_BACK', title: '⬅️ Rudi' },
    notRegistered: `Karibu framedInsight! 🌿\n\nHujasajiliwa bado. Tembelea:\nhttps://framed-insight-web.vercel.app\nkusajili shamba lako.`,
    error:         `Samahani, kuna tatizo kidogo 😅 Tafadhali jaribu tena au tuma *menu*.`,
    fallbackMenu:  `Jibu kwa nambari:\n{{shortcuts}}\n\nAu andika ombi lako moja kwa moja.`,
  },
}

// ─────────────────────────────────────────────
// Derived lookup maps (computed once at startup)
// ─────────────────────────────────────────────

/** menuId → EnterpriseConfig */
const ENTERPRISE_BY_MENU_ID = new Map(ENTERPRISES.map(e => [e.menuId, e]))

/** action button ID → EnterpriseConfig that owns it */
const ENTERPRISE_BY_ACTION_ID = new Map(
  ENTERPRISES.flatMap(e => Object.keys(e.actions).map(id => [id, e]))
)

/** Build number shortcut map dynamically from ENTERPRISES array */
function buildShortcutMap(strings: Strings): Map<string, () => Promise<void>> {
  const map = new Map<string, () => Promise<void>>()
  // We need `to` and `sendMenu` in scope — these are created in the handler.
  // This factory function is called inside the POST handler.
  return map
}

// ─────────────────────────────────────────────
// LipaChat API helpers
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
  // WhatsApp interactive messages support up to 3 buttons per message.
  // If we have more than 3 (e.g. main menu grows), we send multiple messages.
  const chunks: Button[][] = []
  for (let i = 0; i < buttons.length; i += 3) {
    chunks.push(buttons.slice(i, i + 3))
  }

  for (const chunk of chunks) {
    const res = await fetch('https://gateway.lipachat.com/api/v1/whatsapp/message/interactive', {
      method: 'POST',
      headers: lipachatHeaders(),
      body: JSON.stringify({
        to: cleanPhone(to),
        from: getFrom(),
        messageId: crypto.randomUUID(),
        type: 'button',
        body: { text: chunks.indexOf(chunk) === 0 ? bodyText : '…continued' },
        action: {
          buttons: chunk.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      }),
    })
    const data = await res.json()
    console.log('sendButtons response:', JSON.stringify(data))
    if (data?.status === 'error') throw new Error(data.message || 'LipaChat error')
  }
}

/**
 * Try interactive buttons first; fall back to a numbered text list.
 * `buttons` can be any length — sendButtons handles chunking internally.
 */
async function sendMenu(to: string, bodyText: string, buttons: Button[]) {
  try {
    await sendButtons(to, bodyText, buttons)
  } catch (err: any) {
    console.warn('Buttons failed, falling back to text menu:', err.message)
    const numbered = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')
    await sendText(to, `${bodyText}\n\n${numbered}`)
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
// Session state helpers
// We store session in whatsapp_messages.conversation_context on the
// most recent record for this phone number. This avoids needing a
// migration to add columns to the farms table.
// ─────────────────────────────────────────────
async function getSession(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  farmLang: Lang | null
): Promise<SessionState> {
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('conversation_context')
    .eq('sender_phone', phone)
    .not('conversation_context', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const stored = data?.conversation_context as SessionState | null

  // Build a valid session, preferring stored values then DB farm lang then default
  return {
    lang:           stored?.lang          ?? farmLang ?? 'en',
    menuState:      stored?.menuState     ?? (farmLang ? 'MAIN_MENU' : 'LANG_SELECT'),
    lastEnterprise: stored?.lastEnterprise ?? undefined,
  }
}

async function saveSession(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  farmId: string | null,
  session: SessionState,
  messageText: string
) {
  await supabase.from('whatsapp_messages').insert({
    sender_phone:         phone,
    farm_id:              farmId ?? undefined,
    message_type:         'INBOUND',
    message_text:         messageText,
    conversation_context: session as any,
  })
}

// ─────────────────────────────────────────────
// GET — health check
// ─────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ status: 'Webhook active', version: '7.0' })
}

// ─────────────────────────────────────────────
// POST — main handler
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  console.log('PAYLOAD:', JSON.stringify(body))

  const senderNumber: string = body.from || ''
  const rawText: string      = body.text || body.message || ''
  const msgType: string      = (body.type || '').toUpperCase()
  const interactive          = body.interactive || null

  console.log(`FROM=${senderNumber} TYPE=${msgType} TEXT="${rawText}"`)

  if (!senderNumber) return NextResponse.json({ ok: true })

  const supabase = getSupabase()
  const phone    = senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`

  // ── Resolve farm
  const { data: farm } = await supabase
    .from('farms')
    .select('id, farm_name, phone')
    .eq('phone', phone)
    .single()

  // ── Resolve session (lang + menu state)
  const session = await getSession(supabase, phone, null)
  const strings = t[session.lang]

  // ── Convenience: persist session and return 200
  const done = async (newSession: Partial<SessionState>, logText = rawText) => {
    const merged: SessionState = { ...session, ...newSession }
    await saveSession(supabase, phone, farm?.id ?? null, merged, logText)
    return NextResponse.json({ ok: true })
  }

  // ── Navigate to the main enterprise menu
  const goMainMenu = async () => {
    const s = t[session.lang]
    await sendMenu(senderNumber, s.menuPrompt, s.menuButtons)
    return done({ menuState: 'MAIN_MENU' })
  }

  // ── Navigate into an enterprise sub-menu
  const goEnterprise = async (enterprise: EnterpriseConfig) => {
    const s = t[session.lang]
    const prompt  = (s as any)[enterprise.promptKey]  as string
    const buttons = (s as any)[enterprise.buttonsKey] as Button[]
    // Append a Back button to every sub-menu
    await sendMenu(senderNumber, prompt, [...buttons, s.backButton])
    return done({ menuState: enterprise.state, lastEnterprise: enterprise.menuId })
  }

  // ── Navigate back — from enterprise sub-menu → main menu
  const goBack = async () => {
    if (session.menuState === 'MAIN_MENU' || session.menuState === 'LANG_SELECT') {
      return goMainMenu()
    }
    // AWAITING_INPUT → back to last enterprise sub-menu
    if (session.menuState === 'AWAITING_INPUT' && session.lastEnterprise) {
      const enterprise = ENTERPRISE_BY_MENU_ID.get(session.lastEnterprise)
      if (enterprise) return goEnterprise(enterprise)
    }
    // All enterprise sub-menus → main menu
    return goMainMenu()
  }

  // ─────────────────────────────────
  // 1. INTERACTIVE BUTTON REPLY
  // ─────────────────────────────────
  if (msgType === 'INTERACTIVE' && interactive?.button_reply) {
    const btnId: string = interactive.button_reply.id
    console.log('Button clicked:', btnId)

    try {
      // ── Language selection
      if (btnId === 'LANG_EN' || btnId === 'LANG_SW') {
        const chosenLang: Lang = btnId === 'LANG_EN' ? 'en' : 'sw'
        const chosenStrings = t[chosenLang]
        await sendText(senderNumber, chosenStrings.langSet)
        await sendMenu(senderNumber, chosenStrings.menuPrompt, chosenStrings.menuButtons)
        return done({ lang: chosenLang, menuState: 'MAIN_MENU' }, btnId)
      }

      // ── Back navigation
      if (btnId === 'NAV_BACK') {
        return goBack()
      }

      // ── Enterprise menu buttons (MENU_COFFEE, MENU_DAIRY, etc.)
      const enterprise = ENTERPRISE_BY_MENU_ID.get(btnId)
      if (enterprise) {
        return goEnterprise(enterprise)
      }

      // ── Action buttons (ACT_COFFEE_HARVEST, ACT_DAIRY_MILK, etc.)
      const ownerEnterprise = ENTERPRISE_BY_ACTION_ID.get(btnId)
      if (ownerEnterprise) {
        const actionKey = ownerEnterprise.actions[btnId]
        const promptText = (strings as any)[actionKey] as string
        await sendText(senderNumber, promptText)
        return done({ menuState: 'AWAITING_INPUT', lastEnterprise: ownerEnterprise.menuId }, btnId)
      }

    } catch (err: any) {
      console.error('Button handler error:', err.message)
      try { await sendText(senderNumber, strings.error) } catch {}
    }

    return NextResponse.json({ ok: true })
  }

  // ─────────────────────────────────
  // 2. TEXT MESSAGE
  // ─────────────────────────────────
  const lower = rawText.toLowerCase().trim()

  // ── Back navigation via text
  const backWords = ['back', 'rudi', 'nyuma', '<']
  if (backWords.includes(lower)) {
    try { return goBack() } catch (err: any) { console.error(err.message) }
    return NextResponse.json({ ok: true })
  }

  // ── Greeting / menu reset
  const greetings = ['hi', 'hello', 'habari', 'mambo', 'menu', 'help',
                     'msaada', 'sasa', 'niaje', 'hujambo', 'start', 'hey', 'oya']
  const isGreeting = !lower || greetings.some(g => lower.startsWith(g))

  if (isGreeting) {
    try {
      if (session.menuState === 'LANG_SELECT') {
        await sendMenu(senderNumber, strings.langPrompt, strings.langButtons)
        return done({ menuState: 'LANG_SELECT' })
      }
      return goMainMenu()
    } catch (err: any) { console.error('Greeting error:', err.message) }
    return NextResponse.json({ ok: true })
  }

  // ── Number shortcuts — dynamically built from ENTERPRISES array
  const enterpriseIndex = parseInt(lower, 10)
  if (!isNaN(enterpriseIndex) && enterpriseIndex >= 1 && enterpriseIndex <= ENTERPRISES.length) {
    const enterprise = ENTERPRISES[enterpriseIndex - 1]
    try { return goEnterprise(enterprise) } catch (err: any) { console.error(err.message) }
    return NextResponse.json({ ok: true })
  }

  // ── Unregistered farmer
  if (!farm) {
    try {
      await sendText(senderNumber, strings.notRegistered)
    } catch (err: any) { console.error(err.message) }
    return done({ menuState: session.menuState })
  }

  // ── AI intent processing for registered farmers
  try {
    console.log(`Farm: ${farm.farm_name} (${farm.id}) | lang: ${session.lang} | state: ${session.menuState}`)
    const parsedIntent = await processFarmerIntent(rawText, farm.id)
    console.log('Intent:', JSON.stringify(parsedIntent))
    const reply = await executeIntent(farm.id, parsedIntent)
    await sendText(senderNumber, reply)

    // After AI responds, if the user was in AWAITING_INPUT,
    // offer to return to their last enterprise sub-menu or main menu
    if (session.menuState === 'AWAITING_INPUT' && session.lastEnterprise) {
      const enterprise = ENTERPRISE_BY_MENU_ID.get(session.lastEnterprise)
      if (enterprise) {
        const s = t[session.lang]
        const continuationButtons: Button[] = [
          { id: enterprise.menuId, title: '🔄 Continue here' },
          { id: 'NAV_BACK',        title: '🏠 Main Menu' },
        ]
        await sendMenu(senderNumber, `What would you like to do next?`, continuationButtons)
      }
    }
  } catch (err: any) {
    console.error('AI handler error:', err.message, err.stack)
    try { await sendText(senderNumber, strings.error) } catch {}
  }

  return done({ menuState: session.menuState })
}