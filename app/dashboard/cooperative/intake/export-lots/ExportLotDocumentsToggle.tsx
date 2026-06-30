'use client'

/**
 * app/dashboard/cooperative/intake/export-lots/ExportLotDocumentsToggle.tsx
 *
 * Small client-side wrapper so the (server-component) export lots table
 * can offer a "Documents" expand/collapse per row without converting the
 * whole page to a client component.
 *
 * Exports two pieces used together in the table:
 *   - DocumentsToggleButton: the small link/button placed inside a <td>
 *   - DocumentsRow: the full-width expandable <tr> rendered right after
 *     the row, sharing the same `open` state via a tiny shared store keyed
 *     by exportLotId (avoids prop-drilling state between two non-nested
 *     table rows in a server-rendered table body).
 */

import { useSyncExternalStore } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
import DocumentManager from './DocumentManager'

// Minimal external store: a Set of currently-open exportLotIds, shared by
// both components below. Avoids lifting state into the server-component
// parent (page.tsx) just to coordinate two sibling table rows.
const openRows = new Set<string>()
const listeners = new Set<() => void>()

function toggle(id: string) {
  if (openRows.has(id)) openRows.delete(id)
  else openRows.add(id)
  listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function isOpen(id: string) {
  return openRows.has(id)
}

export function DocumentsToggleButton({ exportLotId, documentCount }: { exportLotId: string; documentCount?: number }) {
  const open = useSyncExternalStore(subscribe, () => isOpen(exportLotId), () => false)
  return (
    <button
      onClick={() => toggle(exportLotId)}
      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[#C9A96E] transition font-semibold"
    >
      <FileText size={12} />
      Docs{documentCount ? ` (${documentCount})` : ''}
      {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
    </button>
  )
}

export function DocumentsRow({ exportLotId, cooperativeId, colSpan }: { exportLotId: string; cooperativeId: string; colSpan: number }) {
  const open = useSyncExternalStore(subscribe, () => isOpen(exportLotId), () => false)
  if (!open) return null
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 pb-5 pt-0 bg-[#0A0C10]/40">
        <DocumentManager exportLotId={exportLotId} cooperativeId={cooperativeId} />
      </td>
    </tr>
  )
}
