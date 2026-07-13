'use client'

import { useState, useTransition } from 'react'
import { Trash2, UserCog } from 'lucide-react'
import { removeOfficer, changeOfficerRole } from './actions'

const ROLES = ['chairman', 'secretary', 'treasurer', 'officer']

export default function CoopDetailClient({ coopId, officers }: { coopId: string; officers: any[] }) {
  const [isPending, startTransition] = useTransition()
  const [notice, setNotice] = useState<string | null>(null)

  const handleRoleChange = (officerId: string, role: string) => {
    startTransition(async () => {
      try {
        await changeOfficerRole(coopId, officerId, role)
        setNotice('Role updated.')
      } catch (e: any) {
        setNotice(`Error: ${e.message}`)
      }
    })
  }

  const handleRemove = (officerId: string) => {
    if (!confirm('Remove this officer from the cooperative? They will lose access to the cooperative dashboard.')) return
    startTransition(async () => {
      try {
        await removeOfficer(coopId, officerId)
        setNotice('Officer removed.')
      } catch (e: any) {
        setNotice(`Error: ${e.message}`)
      }
    })
  }

  return (
    <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5 space-y-3">
      <h2 className="text-sm font-semibold text-white flex items-center gap-1.5"><UserCog size={14} /> Officers</h2>
      {notice && <p className="text-xs text-zinc-400">{notice}</p>}

      {officers.length === 0 && <p className="text-sm text-zinc-600">No officers on record.</p>}

      <div className="space-y-2">
        {officers.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 text-sm border-b border-[#2A2D35] last:border-0 pb-2 last:pb-0">
            <div className="min-w-0">
              <p className="text-white truncate">{o.email || o.user_id}</p>
              <p className="text-xs text-zinc-500">Since {new Date(o.created_at).toLocaleDateString('en-KE')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                defaultValue={o.role || 'officer'}
                onChange={(e) => handleRoleChange(o.id, e.target.value)}
                disabled={isPending}
                className="bg-zinc-900 border border-[#2A2D35] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-700 capitalize"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                onClick={() => handleRemove(o.id)}
                disabled={isPending}
                className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-50"
                title="Remove officer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-600 pt-1">
        Adding a new officer isn't wired up here yet — officers currently only get created through
        the cooperative signup flow (app/auth/verify/coop-actions.ts). Worth a follow-up: a claim-link
        invite for existing cooperatives, the same shape as the farmer claim flow at /claim/[token].
      </p>
    </div>
  )
}
