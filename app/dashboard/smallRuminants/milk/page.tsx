'use client'

// 📁 FILE PATH: app/dashboard/smallRuminants/breeding/kidding/KiddingRecordClient.tsx

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recordKidding } from "./actions";

interface PregnantDam {
  id: string; dam_id: string; dam_tag: string; dam_name: string | null;
  dam_species: string; expected_delivery_date: string;
}

interface KidLamb {
  sex: "male" | "female";
  birth_weight: string;
  vigor_score: "strong" | "normal" | "weak";
  colostrum_given: boolean;
  tag: string;
  notes: string;
}

const EMPTY_KID: KidLamb = {
  sex: "female", birth_weight: "", vigor_score: "normal",
  colostrum_given: true, tag: "", notes: "",
};

const FIELD = "w-full px-3 py-2.5 rounded-lg border border-[#2A2D35] bg-[#17191F] text-white text-sm placeholder-[#4B5563] focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors";
const LABEL = "block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1.5";
const CARD  = "bg-[#17191F] rounded-xl border border-[#2A2D35] p-4";

export default function KiddingRecordClient({
  pregnantDams, farmId,
}: {
  pregnantDams: PregnantDam[]; farmId: string;
}) {
  const router = useRouter();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const [breedingId, setBreedingId]         = useState("");
  const [deliveryDate, setDeliveryDate]     = useState(new Date().toISOString().split("T")[0]);
  const [numberOfOffspring, setNumberOfOffspring] = useState(1);
  const [offspring, setOffspring]           = useState<KidLamb[]>([{ ...EMPTY_KID }]);
  const [deliveryNote, setDeliveryNote]     = useState("");
  const [damCondition, setDamCondition]     = useState("");

  const selectedDam = pregnantDams.find(d => d.id === breedingId);

  // Sync offspring array length to numberOfOffspring
  useEffect(() => {
    setOffspring(prev => {
      if (numberOfOffspring > prev.length) {
        return [...prev, ...Array(numberOfOffspring - prev.length).fill(null).map(() => ({ ...EMPTY_KID }))];
      }
      return prev.slice(0, numberOfOffspring);
    });
  }, [numberOfOffspring]);

  const updateKid = (index: number, field: keyof KidLamb, value: any) => {
    setOffspring(prev => prev.map((k, i) => i === index ? { ...k, [field]: value } : k));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breedingId) { setError("Select a dam"); return; }
    if (!selectedDam) { setError("Dam not found"); return; }

    setLoading(true);
    setError(null);
    try {
      const kiddingData = {
        breeding_id:          breedingId,
        dam_id:               selectedDam.dam_id,
        delivery_date:        deliveryDate,
        number_of_offspring:  numberOfOffspring,
        notes:                deliveryNote || null,
      };
      await recordKidding(kiddingData, offspring, breedingId);
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/smallRuminants/breeding"), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const VIGOR_LABELS = {
    strong: { label: "Strong", color: "text-emerald-400", bg: "bg-emerald-900/30 border-emerald-700" },
    normal: { label: "Normal", color: "text-blue-400",    bg: "bg-blue-900/30 border-blue-700"    },
    weak:   { label: "Weak",   color: "text-amber-400",   bg: "bg-amber-900/30 border-amber-700"  },
  };

  return (
    <div className="min-h-screen bg-[#0D0F14]">
      {/* Header */}
      <div className="bg-[#17191F] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard/smallRuminants/breeding"
            className="w-8 h-8 rounded-full bg-[#2A2D35] flex items-center justify-center text-[#9CA3AF] hover:bg-[#3A3D45] transition-colors">
            ←
          </Link>
          <div>
            <h1 className="text-base font-bold text-white">Record Birth</h1>
            <p className="text-xs text-[#6B7280]">Kidding · Lambing</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {success && (
          <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-3 text-sm text-emerald-400 text-center">
            ✓ Birth recorded successfully
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Dam Selection */}
          <div className={CARD}>
            <label className={LABEL}>Select Dam *</label>
            {pregnantDams.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-[#6B7280]">No pregnant dams found.</p>
                <Link href="/dashboard/smallRuminants/breeding/service"
                  className="text-xs text-emerald-500 underline mt-1 inline-block">
                  Record a breeding service first
                </Link>
              </div>
            ) : (
              <select value={breedingId} onChange={e => setBreedingId(e.target.value)}
                className={FIELD} required>
                <option value="">Choose dam…</option>
                {pregnantDams.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.dam_tag}{d.dam_name ? ` (${d.dam_name})` : ""} · {d.dam_species} · Due: {new Date(d.expected_delivery_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </option>
                ))}
              </select>
            )}
            {selectedDam && (
              <div className="mt-3 bg-[#0D0F14] rounded-lg border border-[#2A2D35] px-3 py-2 flex gap-4 text-xs text-[#9CA3AF]">
                <span>🐐 <span className="text-white font-medium">{selectedDam.dam_tag}</span></span>
                <span>Species: <span className="text-white">{selectedDam.dam_species}</span></span>
                <span>Expected: <span className="text-white">{new Date(selectedDam.expected_delivery_date).toLocaleDateString("en-KE")}</span></span>
              </div>
            )}
          </div>

          {/* Delivery Details */}
          <div className={CARD}>
            <p className={LABEL}>Delivery Details</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>Birth Date *</label>
                <input type="date" value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className={FIELD} required />
              </div>
              <div>
                <label className={LABEL}>Number of Offspring</label>
                <select value={numberOfOffspring}
                  onChange={e => setNumberOfOffspring(parseInt(e.target.value))}
                  className={FIELD}>
                  {[1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? "kid/lamb" : "kids/lambs"}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL}>Dam Condition Post-Delivery</label>
              <select value={damCondition} onChange={e => setDamCondition(e.target.value)} className={FIELD}>
                <option value="">Select…</option>
                <option value="normal">Normal — no complications</option>
                <option value="assisted">Assisted delivery required</option>
                <option value="caesarean">Caesarean section</option>
                <option value="complications">Post-delivery complications</option>
                <option value="retained_placenta">Retained placenta</option>
              </select>
            </div>
            {(damCondition === "complications" || damCondition === "retained_placenta") && (
              <div className="mt-2 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-400">⚠ Flag for veterinary follow-up. Record any treatment in the Health module.</p>
              </div>
            )}
          </div>

          {/* Per-Offspring Cards */}
          {offspring.map((kid, i) => (
            <div key={i} className={CARD}>
              <p className={LABEL}>
                {selectedDam?.dam_species === "sheep" ? "Lamb" : "Kid"} {i + 1} of {numberOfOffspring}
              </p>

              {/* Sex */}
              <div className="mb-3">
                <label className={LABEL}>Sex *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["female", "male"] as const).map(s => (
                    <button key={s} type="button"
                      onClick={() => updateKid(i, "sex", s)}
                      className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                        kid.sex === s
                          ? s === "female"
                            ? "bg-pink-900/40 border-pink-600 text-pink-300"
                            : "bg-blue-900/40 border-blue-600 text-blue-300"
                          : "bg-[#0D0F14] border-[#2A2D35] text-[#9CA3AF]"
                      }`}>
                      {s === "female" ? "♀ Female" : "♂ Male"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight + Vigor */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={LABEL}>Birth Weight (kg)</label>
                  <input type="number" step="0.1" min="0" value={kid.birth_weight}
                    onChange={e => updateKid(i, "birth_weight", e.target.value)}
                    placeholder="e.g. 3.2"
                    className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>Tag / ID (optional)</label>
                  <input type="text" value={kid.tag}
                    onChange={e => updateKid(i, "tag", e.target.value)}
                    placeholder="e.g. K-2025-001"
                    className={FIELD} />
                </div>
              </div>

              {/* Vigor Score */}
              <div className="mb-3">
                <label className={LABEL}>Vigor at Birth</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(VIGOR_LABELS) as [keyof typeof VIGOR_LABELS, typeof VIGOR_LABELS[keyof typeof VIGOR_LABELS]][]).map(([v, meta]) => (
                    <button key={v} type="button"
                      onClick={() => updateKid(i, "vigor_score", v)}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                        kid.vigor_score === v
                          ? meta.bg + " " + meta.color
                          : "bg-[#0D0F14] border-[#2A2D35] text-[#9CA3AF]"
                      }`}>
                      {meta.label}
                    </button>
                  ))}
                </div>
                {kid.vigor_score === "weak" && (
                  <p className="text-xs text-amber-400 mt-1.5">
                    ⚠ Weak vigor: ensure colostrum within 1 hour. Keep warm and monitor closely.
                  </p>
                )}
              </div>

              {/* Colostrum */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={kid.colostrum_given}
                    onChange={e => updateKid(i, "colostrum_given", e.target.checked)}
                    className="accent-emerald-500 w-4 h-4" />
                  <span className="text-sm text-[#D1D5DB]">Colostrum given within 2 hours</span>
                </label>
              </div>
              {!kid.colostrum_given && (
                <p className="text-xs text-red-400 mt-1.5">
                  ⚠ Colostrum is critical for passive immunity — ensure intake within 6 hours of birth.
                </p>
              )}

              {/* Kid notes */}
              <div className="mt-3">
                <label className={LABEL}>Notes (optional)</label>
                <input type="text" value={kid.notes}
                  onChange={e => updateKid(i, "notes", e.target.value)}
                  placeholder="Any observations about this kid/lamb…"
                  className={FIELD} />
              </div>
            </div>
          ))}

          {/* Delivery notes */}
          <div className={CARD}>
            <label className={LABEL}>Delivery Notes</label>
            <textarea value={deliveryNote}
              onChange={e => setDeliveryNote(e.target.value)}
              placeholder="Overall delivery notes, vet involvement, any complications…"
              rows={2}
              className={FIELD + " resize-none"} />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pb-6">
            <Link href="/dashboard/smallRuminants/breeding"
              className="flex-1 px-4 py-3 rounded-xl border border-[#2A2D35] text-[#9CA3AF] text-sm font-semibold text-center hover:bg-[#1C1E26] transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#2A2D35] disabled:text-[#4B5563] text-white text-sm font-semibold transition-colors">
              {loading ? "Saving…" : `Record Birth (${numberOfOffspring} offspring)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}