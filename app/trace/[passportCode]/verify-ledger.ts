// app/trace/[passportCode]/verify-ledger.ts

export interface LedgerEvent {
  event_type: string
  event_data: unknown
  previous_hash: string | null
  current_hash: string
  hash_algorithm?: string | null
  actor_name?: string | null
  created_at: string
}

export interface LedgerVerificationResult {
  event: LedgerEvent
  ok: boolean
  verified: boolean
  reason?: string
}

function normalizeForHash(value: unknown): unknown {
  if (value === null) return null

  if (Array.isArray(value)) {
    return value.map(item => {
      const normalized = normalizeForHash(item)
      return normalized === undefined ? null : normalized
    })
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const normalized = normalizeForHash((value as Record<string, unknown>)[key])
      if (normalized !== undefined) sorted[key] = normalized
    }
    return sorted
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined
  }

  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForHash(value))
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyChain(
  entityId: string,
  events: LedgerEvent[]
): Promise<LedgerVerificationResult[]> {
  let expectedPreviousHash: string | null = null

  const results: LedgerVerificationResult[] = []

  for (const event of events) {
    if (event.previous_hash !== expectedPreviousHash) {
      results.push({
        event,
        ok: false,
        verified: false,
        reason: 'Previous hash does not match the prior ledger event.',
      })
      expectedPreviousHash = event.current_hash
      continue
    }

    if (event.hash_algorithm !== 'v2_canonical') {
      results.push({
        event,
        ok: true,
        verified: false,
        reason: 'Recorded before independent browser verification was enabled.',
      })
      expectedPreviousHash = event.current_hash
      continue
    }

    const payload = stableStringify({
      entityId,
      eventType: event.event_type,
      eventData: event.event_data,
      previousHash: event.previous_hash ?? 'GENESIS',
      createdAt: event.created_at,
    })
    const recomputedHash = await sha256Hex(payload)

    results.push({
      event,
      ok: recomputedHash === event.current_hash,
      verified: recomputedHash === event.current_hash,
      reason: recomputedHash === event.current_hash
        ? undefined
        : 'Current hash does not match the event payload.',
    })

    expectedPreviousHash = event.current_hash
  }

  return results
}
