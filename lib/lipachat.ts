/**
 * LipaChat WhatsApp API Utility
 * Gateway: https://gateway.lipachat.com/api/v1/
 */

const BASE_URL = 'https://gateway.lipachat.com/api/v1'

export interface LipachatMessageResponse {
  status: string
  messageId?: string
}

// Read env vars at call time, not module load time (safer on serverless)
function getConfig() {
  const apiKey = process.env.LIPACHAT_API_KEY
  const fromNumber = process.env.LIPACHAT_WHATSAPP_NUMBER
  if (!apiKey) throw new Error('LIPACHAT_API_KEY env var is not set')
  if (!fromNumber) throw new Error('LIPACHAT_WHATSAPP_NUMBER env var is not set')
  return { apiKey, fromNumber }
}

function cleanNumber(num: string) {
  return num.replace(/^\+/, '').trim()
}

async function lipachatPost(path: string, body: object): Promise<LipachatMessageResponse> {
  const { apiKey } = getConfig()

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apiKey': apiKey,
    },
    body: JSON.stringify(body),
  })

  // Read body once
  const data = await response.json()

  console.log(`LipaChat ${path} response:`, JSON.stringify(data))

  // LipaChat returns HTTP 200 even for errors, so check the status field
  if (!response.ok || data?.status === 'error') {
    const msg = data?.message || data?.errors || response.statusText || 'Unknown error'
    throw new Error(`LipaChat API Error (${path}): ${msg}`)
  }

  return data
}

/**
 * Send a plain text message via WhatsApp
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<LipachatMessageResponse> {
  const { fromNumber } = getConfig()
  return lipachatPost('/whatsapp/message/text', {
    message,
    to: cleanNumber(to),
    from: fromNumber,
    messageId: crypto.randomUUID(),
  })
}

/**
 * Send an image via WhatsApp
 */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<LipachatMessageResponse> {
  const { fromNumber } = getConfig()
  return lipachatPost('/whatsapp/message/image', {
    url: imageUrl,
    caption,
    to: cleanNumber(to),
    from: fromNumber,
    messageId: crypto.randomUUID(),
  })
}

/**
 * Send a document/PDF via WhatsApp
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string
): Promise<LipachatMessageResponse> {
  const { fromNumber } = getConfig()
  return lipachatPost('/whatsapp/message/document', {
    url: documentUrl,
    filename,
    to: cleanNumber(to),
    from: fromNumber,
    messageId: crypto.randomUUID(),
  })
}

/**
 * Send interactive buttons via WhatsApp (production only — not supported on sandbox)
 * Max 3 buttons allowed by WhatsApp
 */
export async function sendWhatsAppButtons(
  to: string,
  text: string,
  buttons: { id: string; title: string }[]
): Promise<LipachatMessageResponse> {
  const { fromNumber } = getConfig()
  return lipachatPost('/whatsapp/message/interactive', {
    to: cleanNumber(to),
    from: fromNumber,
    messageId: crypto.randomUUID(),
    type: 'button',
    body: { text },
    action: {
      buttons: buttons.map(b => ({
        type: 'reply',
        reply: { id: b.id, title: b.title },
      })),
    },
  })
}