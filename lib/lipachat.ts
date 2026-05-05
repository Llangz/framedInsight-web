/**
 * LipaChat WhatsApp API Utility
 * Gateway: https://gateway.lipachat.com/api/v1/
 */

const LIPACHAT_API_KEY = process.env.LIPACHAT_API_KEY;
const LIPACHAT_FROM_NUMBER = process.env.LIPACHAT_WHATSAPP_NUMBER;
const BASE_URL = 'https://gateway.lipachat.com/api/v1';

export interface LipachatMessageResponse {
  status: string;
  messageId: string;
}

/**
 * Send a plain text message via WhatsApp
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<LipachatMessageResponse> {
  if (!LIPACHAT_API_KEY) throw new Error('LIPACHAT_API_KEY is not configured');

  const cleanTo = to.replace('+', '').trim();

  const response = await fetch(`${BASE_URL}/whatsapp/message/text`, {
    method: 'POST',
    headers: {
      'apiKey': LIPACHAT_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      to: cleanTo,
      from: LIPACHAT_FROM_NUMBER,
      messageId: crypto.randomUUID(), // Unique ID for tracking
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`LipaChat API Error: ${errorData.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Send an image via WhatsApp
 */
export async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string): Promise<LipachatMessageResponse> {
  if (!LIPACHAT_API_KEY) throw new Error('LIPACHAT_API_KEY is not configured');

  const cleanTo = to.replace('+', '').trim();

  const response = await fetch(`${BASE_URL}/whatsapp/message/image`, {
    method: 'POST',
    headers: {
      'apiKey': LIPACHAT_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: imageUrl,
      caption,
      to: cleanTo,
      from: LIPACHAT_FROM_NUMBER,
      messageId: crypto.randomUUID(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`LipaChat API Error: ${errorData.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Send a document/PDF via WhatsApp
 */
export async function sendWhatsAppDocument(to: string, documentUrl: string, filename: string): Promise<LipachatMessageResponse> {
  if (!LIPACHAT_API_KEY) throw new Error('LIPACHAT_API_KEY is not configured');

  const cleanTo = to.replace('+', '').trim();

  const response = await fetch(`${BASE_URL}/whatsapp/message/document`, {
    method: 'POST',
    headers: {
      'apiKey': LIPACHAT_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: documentUrl,
      filename,
      to: cleanTo,
      from: LIPACHAT_FROM_NUMBER,
      messageId: crypto.randomUUID(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`LipaChat API Error: ${errorData.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Send interactive buttons via WhatsApp
 * Max 3 buttons allowed by WhatsApp
 */
export async function sendWhatsAppButtons(
  to: string, 
  text: string, 
  buttons: { id: string; title: string }[]
): Promise<LipachatMessageResponse> {
  if (!LIPACHAT_API_KEY) throw new Error('LIPACHAT_API_KEY is not configured');

  const cleanTo = to.replace('+', '').trim();

  const response = await fetch(`${BASE_URL}/whatsapp/message/interactive`, {
    method: 'POST',
    headers: {
      'apiKey': LIPACHAT_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: cleanTo,
      from: LIPACHAT_FROM_NUMBER,
      messageId: crypto.randomUUID(),
      type: 'button',
      body: { text },
      action: {
        buttons: buttons.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title }
        }))
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`LipaChat API Error: ${errorData.message || response.statusText}`);
  }

  return response.json();
}
