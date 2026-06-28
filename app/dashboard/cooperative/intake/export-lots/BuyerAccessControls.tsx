'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Copy, ExternalLink, KeyRound, RotateCw, ShieldOff } from 'lucide-react'
import { generateBuyerAccessLink, revokeBuyerAccessLink } from './actions'

interface Props {
  exportLotId: string
  token: string | null
  revokedAt: string | null
}

export default function BuyerAccessControls({ exportLotId, token, revokedAt }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const activeUrl = useMemo(() => {
    if (generatedUrl) return generatedUrl
    if (!token || revokedAt) return null
    if (!origin) return null
    return `${origin}/buyer/${token}`
  }, [generatedUrl, origin, token, revokedAt])

  const generate = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await generateBuyerAccessLink(exportLotId)
      if (!res.success) {
        setMessage(res.error ?? 'Could not generate link')
        return
      }
      setGeneratedUrl(res.url)
      await navigator.clipboard.writeText(res.url)
      setMessage('Link copied')
    })
  }

  const revoke = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await revokeBuyerAccessLink(exportLotId)
      if (!res.success) {
        setMessage(res.error ?? 'Could not revoke link')
        return
      }
      setGeneratedUrl(null)
      setMessage('Revoked')
    })
  }

  const copy = async () => {
    if (!activeUrl) return
    await navigator.clipboard.writeText(activeUrl)
    setMessage('Copied')
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {activeUrl ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-950/50"
          >
            <Copy size={10} /> Copy
          </button>
          <a
            href={activeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-[#2A2D35] px-2 py-1 text-zinc-400 hover:text-[#C9A96E]"
            aria-label="Open buyer data room"
          >
            <ExternalLink size={11} />
          </a>
          <button
            type="button"
            onClick={generate}
            disabled={isPending}
            className="inline-flex items-center rounded-lg border border-[#2A2D35] px-2 py-1 text-zinc-500 hover:text-[#C9A96E] disabled:opacity-50"
            aria-label="Rotate buyer access link"
          >
            <RotateCw size={11} />
          </button>
          <button
            type="button"
            onClick={revoke}
            disabled={isPending}
            className="inline-flex items-center rounded-lg border border-red-900/30 px-2 py-1 text-red-300 hover:bg-red-950/30 disabled:opacity-50"
            aria-label="Revoke buyer access link"
          >
            <ShieldOff size={11} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-lg border border-[#C9A96E]/30 bg-[#C9A96E]/10 px-2.5 py-1.5 text-[10px] font-bold text-[#C9A96E] hover:bg-[#C9A96E]/15 disabled:opacity-50"
        >
          <KeyRound size={11} />
          {isPending ? 'Creating...' : 'Create buyer link'}
        </button>
      )}
      {message && <span className="text-[10px] text-zinc-500">{message}</span>}
    </div>
  )
}
