'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, Check, Copy, User, MapPinned } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { OfflineActionNotice } from '@/components/ui/OfflineActionNotice'
import { createCoopManagedFarm } from './actions'
import { validateName, KENYAN_COUNTIES } from '@/lib/validation'
import type { BoundaryResult } from '@/components/coffee/PlotBoundaryMapper'

const PlotBoundaryMapper = dynamic(
  () => import('@/components/coffee/PlotBoundaryMapper'),
  { ssr: false, loading: () => (
    <div className="h-64 bg-[#0A0C10] rounded-lg flex items-center justify-center">
      <p className="text-[#6B7280] text-sm">Loading satellite map…</p>
    </div>
  )}
)

const FIELD = "w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-white placeholder-[#4B5563]"
const LABEL = "block text-sm font-semibold text-[#9CA3AF] mb-1.5"

type Step = 'details' | 'mapping' | 'done'

interface FactoryOption { id: string; factory_name: string }

export default function MapFarmerClient({ factories }: { factories: FactoryOption[] }) {
  const router = useRouter()
  const isOnline = useOnlineStatus()
  const [step, setStep] = useState<Step>('details')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [farmerData, setFarmerData] = useState({
    ownerName: '',
    phone: '',
    farmName: '',
    county: '',
    subCounty: '',
    ward: '',
    coopFactoryId: '',
    coopMemberNumber: '',
  })

  const [plotData, setPlotData] = useState({
    plotName: '',
    variety: '',
    totalTrees: '',
    establishmentYear: '',
  })

  const [boundary, setBoundary] = useState<BoundaryResult | null>(null)
  const [skipMapping, setSkipMapping] = useState(false)
  const [result, setResult] = useState<{ farmId: string; claimToken: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const validateDetails = () => {
    const e: Record<string, string> = {}
    const nameV = validateName(farmerData.ownerName)
    if (!nameV.isValid) e.ownerName = nameV.error || 'Required'
    if (!farmerData.farmName.trim()) e.farmName = 'Farm name is required'
    if (!farmerData.county) e.county = 'County is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const goToMapping = () => {
    if (!validateDetails()) return
    setStep('mapping')
    window.scrollTo(0, 0)
  }

  const handleBoundaryComplete = (r: BoundaryResult) => {
    setBoundary(r)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setErrors({})

    const res = await createCoopManagedFarm({
      ownerName: farmerData.ownerName,
      phone: farmerData.phone || undefined,
      farmName: farmerData.farmName,
      county: farmerData.county,
      subCounty: farmerData.subCounty || undefined,
      ward: farmerData.ward || undefined,
      coopFactoryId: farmerData.coopFactoryId || undefined,
      coopMemberNumber: farmerData.coopMemberNumber || undefined,
      plot: (!skipMapping && boundary && plotData.plotName) ? {
        plotName: plotData.plotName,
        variety: plotData.variety || undefined,
        totalTrees: plotData.totalTrees ? Number(plotData.totalTrees) : undefined,
        establishmentYear: plotData.establishmentYear ? Number(plotData.establishmentYear) : undefined,
        polygon: boundary.polygon,
        areaHa: boundary.areaHa,
        centroidLat: boundary.centroid.lat,
        centroidLng: boundary.centroid.lng,
        eudrGeolocationFormat: boundary.eudrGeolocationFormat,
      } : undefined,
    })

    if (!res.success || !res.farmId || !res.claimToken) {
      setErrors({ submit: res.error || 'Failed to save farm' })
      setLoading(false)
      return
    }

    setResult({ farmId: res.farmId, claimToken: res.claimToken })
    setStep('done')
    setLoading(false)
  }

  const copyClaimCode = () => {
    if (!result) return
    navigator.clipboard.writeText(result.claimToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [linkCopied, setLinkCopied] = useState(false)
  const copyClaimLink = () => {
    if (!result) return
    const url = `${window.location.origin}/claim/${result.claimToken}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] p-4 md:p-8 font-['Outfit']">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard/cooperative/farmers"
            className="w-10 h-10 flex items-center justify-center bg-[#0D0F14] border border-[#2A2D35] rounded-lg hover:bg-[#161921] text-[#9CA3AF] transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Map a member farmer</h1>
            <p className="text-[#6B7280] text-sm mt-0.5">For farmers without a smartphone</p>
          </div>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-2 mb-8">
          {(['details', 'mapping', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                step === s ? 'bg-green-600 text-white'
                : (['details', 'mapping', 'done'].indexOf(step) > i) ? 'bg-green-900 text-green-400'
                : 'bg-[#161921] text-[#4B5563]'
              }`}>
                {(['details', 'mapping', 'done'].indexOf(step) > i) ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < 2 && <div className={`h-0.5 flex-1 ${['details', 'mapping', 'done'].indexOf(step) > i ? 'bg-green-950' : 'bg-[#2A2D35]'}`} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Farmer + farm details ── */}
        {step === 'details' && (
          <div className="space-y-6">
            <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4.5 h-4.5 text-green-500" />
                <h2 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-widest">Farmer details</h2>
              </div>

              <div>
                <label className={LABEL}>Farmer's full name *</label>
                <input
                  type="text"
                  className={FIELD}
                  placeholder="e.g. Mary Wanjiku Kamau"
                  value={farmerData.ownerName}
                  onChange={e => setFarmerData({ ...farmerData, ownerName: e.target.value })}
                />
                {errors.ownerName && <p className="mt-1 text-xs text-red-400">{errors.ownerName}</p>}
              </div>

              <div>
                <label className={LABEL}>Phone number <span className="font-normal text-[#4B5563]">(optional — for ledger or claim SMS)</span></label>
                <input
                  type="tel"
                  className={FIELD}
                  placeholder="07XX XXX XXX"
                  value={farmerData.phone}
                  onChange={e => setFarmerData({ ...farmerData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className={LABEL}>Farm name *</label>
                <input
                  type="text"
                  className={FIELD}
                  placeholder="e.g. Kamau Family Farm"
                  value={farmerData.farmName}
                  onChange={e => setFarmerData({ ...farmerData, farmName: e.target.value })}
                />
                {errors.farmName && <p className="mt-1 text-xs text-red-400">{errors.farmName}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>County *</label>
                  <select
                    className={FIELD}
                    value={farmerData.county}
                    onChange={e => setFarmerData({ ...farmerData, county: e.target.value })}
                  >
                    <option value="">Select</option>
                    {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.county && <p className="mt-1 text-xs text-red-400">{errors.county}</p>}
                </div>
                <div>
                  <label className={LABEL}>Ward</label>
                  <input
                    type="text"
                    className={FIELD}
                    placeholder="Optional"
                    value={farmerData.ward}
                    onChange={e => setFarmerData({ ...farmerData, ward: e.target.value })}
                  />
                </div>
              </div>

              {factories.length > 0 && (
                <div>
                  <label className={LABEL}>Factory / washing station</label>
                  <select
                    className={FIELD}
                    value={farmerData.coopFactoryId}
                    onChange={e => setFarmerData({ ...farmerData, coopFactoryId: e.target.value })}
                  >
                    <option value="">Not assigned yet</option>
                    {factories.map(f => <option key={f.id} value={f.id}>{f.factory_name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className={LABEL}>Member number <span className="font-normal text-[#4B5563]">(your society's ledger number, if known)</span></label>
                <input
                  type="text"
                  className={FIELD}
                  placeholder="e.g. 0452"
                  value={farmerData.coopMemberNumber}
                  onChange={e => setFarmerData({ ...farmerData, coopMemberNumber: e.target.value })}
                />
              </div>
            </div>

            <button
              onClick={goToMapping}
              className="w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition cursor-pointer"
            >
              Continue to plot mapping
            </button>
          </div>
        )}

        {/* ── Step 2: GPS boundary mapping ── */}
        {step === 'mapping' && (
          <div className="space-y-6">
            <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPinned className="w-4.5 h-4.5 text-green-500" />
                <h2 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-widest">Plot boundary</h2>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Walk the boundary of the farmer's coffee plot with them, or tap each corner on the satellite view.
                This becomes the GPS evidence required for EUDR — six decimal places, recorded automatically.
              </p>

              {!skipMapping && (
                <PlotBoundaryMapper onComplete={handleBoundaryComplete} className="h-80" />
              )}

              {(!skipMapping && boundary) ? (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className={LABEL}>Plot name *</label>
                    <input
                      type="text"
                      className={FIELD}
                      placeholder="e.g. Main plot"
                      value={plotData.plotName}
                      onChange={e => setPlotData({ ...plotData, plotName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Variety</label>
                    <input
                      type="text"
                      className={FIELD}
                      placeholder="e.g. SL28"
                      value={plotData.variety}
                      onChange={e => setPlotData({ ...plotData, variety: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Total trees</label>
                    <input
                      type="number"
                      className={FIELD}
                      placeholder="e.g. 150"
                      value={plotData.totalTrees}
                      onChange={e => setPlotData({ ...plotData, totalTrees: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Year planted</label>
                    <input
                      type="number"
                      className={FIELD}
                      placeholder="e.g. 2018"
                      value={plotData.establishmentYear}
                      onChange={e => setPlotData({ ...plotData, establishmentYear: e.target.value })}
                    />
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => { setSkipMapping(prev => !prev); setBoundary(null) }}
                className="text-xs text-[#6B7280] hover:text-[#9CA3AF] underline cursor-pointer"
              >
                {skipMapping ? "I want to add coordinates/boundary now" : "Skip mapping for now — I'll add the plot boundary later"}
              </button>
            </div>

            {errors.submit && (
              <div className="bg-red-950 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">{errors.submit}</p>
              </div>
            )}

            <OfflineActionNotice reason="registering a farmer generates a claim code and farmer record and needs a live connection" />

            <div className="flex gap-3">
              <button
                onClick={() => setStep('details')}
                className="flex-1 bg-[#161921] hover:bg-[#1C202A] text-[#9CA3AF] py-3 rounded-lg font-semibold transition cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !isOnline || (!skipMapping && (!boundary || !plotData.plotName))}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Saving…' : 'Save farmer'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done — claim code ── */}
        {step === 'done' && result && (
          <div className="space-y-6">
            <div className="bg-green-950/40 border border-green-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-900 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-white font-bold text-lg">Farmer mapped successfully</h2>
              <p className="text-[#9CA3AF] text-sm mt-1">{farmerData.ownerName}'s farm is now part of your cooperative fleet</p>
            </div>

            <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-6">
              <p className="text-sm font-bold text-[#9CA3AF] mb-2">Claim code for {farmerData.ownerName.split(' ')[0]}</p>
              <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
                If this farmer gets a smartphone later, send them the link below (e.g. via SMS or WhatsApp) —
                or they can type the code in manually at sign up. Either way, they verify their own phone
                and take over managing their farm; your cooperative keeps visibility for fleet reporting.
              </p>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 bg-[#0A0C10] border border-[#2A2D35] rounded-lg px-4 py-3 text-center">
                  <span className="text-2xl font-mono font-bold text-green-400 tracking-widest">{result.claimToken}</span>
                </div>
                <button
                  onClick={copyClaimCode}
                  className="w-12 h-12 flex items-center justify-center bg-[#161921] hover:bg-[#1C202A] border border-[#2A2D35] rounded-lg text-[#9CA3AF] transition cursor-pointer"
                  title="Copy code"
                >
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <button
                onClick={copyClaimLink}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#161921] hover:bg-[#1C202A] border border-[#2A2D35] rounded-lg text-sm font-semibold text-[#9CA3AF] transition cursor-pointer"
              >
                {linkCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {linkCopied ? 'Link copied' : 'Copy claim link to share'}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('details')
                  setFarmerData({
                    ownerName: '',
                    phone: '',
                    farmName: '',
                    county: '',
                    subCounty: '',
                    ward: '',
                    coopFactoryId: '',
                    coopMemberNumber: '',
                  })
                  setPlotData({
                    plotName: '',
                    variety: '',
                    totalTrees: '',
                    establishmentYear: '',
                  })
                  setBoundary(null)
                  setResult(null)
                }}
                className="flex-1 text-center bg-[#161921] hover:bg-[#1C202A] text-[#9CA3AF] py-3 rounded-lg font-semibold transition cursor-pointer"
              >
                Map another farmer
              </button>
              <Link
                href="/dashboard/cooperative/farmers"
                className="flex-1 text-center bg-green-700 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center"
              >
                View farmers list
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}