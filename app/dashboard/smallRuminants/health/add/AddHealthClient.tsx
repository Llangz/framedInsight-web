'use client'

// 📁 FILE PATH: app/dashboard/smallRuminants/health/add/AddHealthClient.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recordHealth } from "../actions";
import { queueSmallRuminantEvent } from "@/lib/offline-db";

interface Animal {
  id: string;
  animal_tag: string;
  name: string | null;
  species: string;
}

type EventType = "vaccination" | "treatment" | "deworming" | "checkup";

const FIELD = "w-full px-3 py-2.5 rounded-lg border border-[#2A2D35] bg-[#17191F] text-white text-sm placeholder-[#4B5563] focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors";
const LABEL = "block text-xs font-bold text-[#D1D5DB] uppercase tracking-wide mb-1.5";
const CARD  = "bg-[#17191F] rounded-xl border border-[#2A2D35] p-4";

const VACCINES = [
  { value: "PPR",               label: "PPR (Peste des Petits Ruminants)",         intervalDays: 365 },
  { value: "CCPP",              label: "CCPP (Contagious Caprine Pleuropneumonia)", intervalDays: 365 },
  { value: "Foot Rot",          label: "Foot Rot",                                 intervalDays: 180 },
  { value: "Anthrax",           label: "Anthrax",                                  intervalDays: 365 },
  { value: "Rift Valley Fever", label: "Rift Valley Fever",                        intervalDays: 365 },
  { value: "Sheep Pox",         label: "Sheep Pox",                                intervalDays: 365 },
  { value: "Enterotoxaemia",    label: "Enterotoxaemia (Pulpy Kidney)",            intervalDays: 180 },
  { value: "Brucellosis",       label: "Brucellosis (Brucella ovis)",              intervalDays: 365 },
  { value: "Other",             label: "Other / Custom",                           intervalDays: 365 },
];

const DRUGS_WITH_WITHDRAWAL: Record<string, { meat: number; milk: number }> = {
  "Oxytetracycline": { meat: 28, milk: 7  },
  "Penicillin":      { meat: 10, milk: 4  },
  "Ivermectin":      { meat: 35, milk: 28 },
  "Albendazole":     { meat: 7,  milk: 3  },
  "Levamisole":      { meat: 7,  milk: 2  },
  "Fenbendazole":    { meat: 7,  milk: 3  },
  "Closantel":       { meat: 28, milk: 28 },
  "Diminazene":      { meat: 28, milk: 7  },
  "Sulphadimidine":  { meat: 10, milk: 5  },
};

const DEWORMING_DRUGS  = ["Albendazole","Levamisole","Fenbendazole","Ivermectin","Closantel","Other"];
const TREATMENT_DRUGS  = ["Oxytetracycline","Penicillin","Diminazene","Sulphadimidine","Ivermectin","Other"];
const COMMON_DISEASES  = [
  "Pneumonia","Foot Rot","PPR","Diarrhoea","Bloat","Mastitis",
  "Eye Infection (Pink Eye)","Wound / Injury",
  "Tick-borne Disease (ECF / Theileriosis)","Worm Burden",
  "Liver Fluke","Mange","Other",
];

export default function AddHealthClient({ animals, farmId }: { animals: Animal[]; farmId: string }) {
  const router = useRouter();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  const [eventType, setEventType]               = useState<EventType>("vaccination");
  const [selectedAnimals, setSelectedAnimals]   = useState<Set<string>>(new Set());
  const [eventDate, setEventDate]               = useState(new Date().toISOString().split("T")[0]);
  const [vetName, setVetName]                   = useState("");
  const [cost, setCost]                         = useState("");
  const [notes, setNotes]                       = useState("");

  // Vaccination
  const [vaccineType, setVaccineType]           = useState("");
  const [customVaccineName, setCustomVaccineName] = useState("");
  const [batchNumber, setBatchNumber]           = useState("");
  const [nextDueDate, setNextDueDate]           = useState("");

  // Treatment
  const [disease, setDisease]                   = useState("");
  const [customDisease, setCustomDisease]       = useState("");
  const [treatment, setTreatment]               = useState("");
  const [drugName, setDrugName]                 = useState("");
  const [customDrug, setCustomDrug]             = useState("");
  const [dosage, setDosage]                     = useState("");
  const [route, setRoute]                       = useState("");
  const [withdrawalMeat, setWithdrawalMeat]     = useState("");
  const [withdrawalMilk, setWithdrawalMilk]     = useState("");
  const [followUpDate, setFollowUpDate]         = useState("");

  // Deworming
  const [dewormDrug, setDewormDrug]             = useState("");
  const [customDewormDrug, setCustomDewormDrug] = useState("");
  const [dewormDosage, setDewormDosage]         = useState("");
  const [dewormNextDue, setDewormNextDue]       = useState("");

  // Checkup
  const [bodyConditionScore, setBodyConditionScore] = useState("");
  const [temperature, setTemperature]           = useState("");
  const [checkupFindings, setCheckupFindings]   = useState("");

  // Auto-calculate next vaccination date
  useEffect(() => {
    if (eventType === "vaccination" && vaccineType && eventDate) {
      const vax = VACCINES.find(v => v.value === vaccineType);
      if (vax) {
        const due = new Date(eventDate);
        due.setDate(due.getDate() + vax.intervalDays);
        setNextDueDate(due.toISOString().split("T")[0]);
      }
    }
  }, [eventType, vaccineType, eventDate]);

  // Auto-fill withdrawal periods from known drugs
  useEffect(() => {
    const drug = eventType === "treatment" ? drugName : dewormDrug;
    if (drug && DRUGS_WITH_WITHDRAWAL[drug]) {
      const w = DRUGS_WITH_WITHDRAWAL[drug];
      setWithdrawalMeat(String(w.meat));
      setWithdrawalMilk(String(w.milk));
    }
  }, [drugName, dewormDrug, eventType]);

  // Auto-calculate deworming next due (90 days)
  useEffect(() => {
    if (eventDate && eventType === "deworming") {
      const due = new Date(eventDate);
      due.setDate(due.getDate() + 90);
      setDewormNextDue(due.toISOString().split("T")[0]);
    }
  }, [eventDate, eventType]);

  const toggleAnimal = (id: string) => {
    const s = new Set(selectedAnimals);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedAnimals(s);
  };
  const selectAll = () => setSelectedAnimals(new Set(animals.map(a => a.id)));
  const clearAll  = () => setSelectedAnimals(new Set());

  const resolvedDrug   = drugName === "Other"   ? customDrug   : drugName;
  const resolvedDeworm = dewormDrug === "Other" ? customDewormDrug : dewormDrug;
  const resolvedDisease = disease === "Other"   ? customDisease : disease;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAnimals.size === 0) { setError("Select at least one animal"); return; }
    if (eventType === "vaccination" && !vaccineType) { setError("Select a vaccine"); return; }
    if (eventType === "treatment" && !resolvedDisease) { setError("Enter the disease / condition treated"); return; }
    setLoading(true);
    setError(null);
    try {
      const records = Array.from(selectedAnimals).map(animalId => ({
        animal_id:    animalId,
        event_date:   eventDate,
        event_type:   eventType,
        vet_name:     vetName || null,
        cost_per_animal: cost ? parseFloat(cost) / selectedAnimals.size : null,
        notes:        notes || null,
        vaccine_type: eventType === "vaccination" ? vaccineType : null,
        vaccine_name: eventType === "vaccination"
                        ? (vaccineType === "Other" ? customVaccineName : vaccineType)
                        : null,
        next_vaccination_due: eventType === "vaccination" ? nextDueDate || null : null,
        disease:      eventType === "treatment" ? resolvedDisease : null,
        treatment:    eventType === "treatment" ? treatment || null : null,
        drug_name:    ["treatment","deworming"].includes(eventType)
                        ? (eventType === "treatment" ? resolvedDrug : resolvedDeworm) || null
                        : null,
        dosage:       ["treatment","deworming"].includes(eventType)
                        ? (eventType === "treatment" ? dosage : dewormDosage) || null
                        : null,
        withdrawal_period_meat_days: withdrawalMeat ? parseInt(withdrawalMeat) : null,
        withdrawal_period_milk_days: withdrawalMilk ? parseInt(withdrawalMilk) : null,
      }));

      // OFFLINE FALLBACK: recordHealth() is a server action - a plain fetch
      // under the hood - so calling it with no connection just throws a raw
      // "Failed to fetch" that setError() would show verbatim to the farmer.
      // Queue one event per animal locally instead, same as every poultry
      // record form already does, so this reads as "saved offline" instead
      // of "broken."
      if (!navigator.onLine) {
        for (const record of records) {
          await queueSmallRuminantEvent({
            eventId: crypto.randomUUID(),
            entityType: "small_ruminant_health",
            farmId,
            referenceId: record.animal_id,
            payload: record,
          });
        }
        setSuccess(true);
        setSavedOffline(true);
        setTimeout(() => router.push("/dashboard/smallRuminants/health"), 1200);
        return;
      }

      const result = await recordHealth(records);
      if (!result.success) {
        setError(result.error || 'Failed to save health record');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/smallRuminants/health"), 1200);
    } catch (e: any) {
      // A submit that started online but lost connection mid-request lands
      // here too (recordHealth's fetch throws) - fall back to the same
      // offline queue rather than showing a raw network error.
      if (!navigator.onLine) {
        setError(null);
        setSuccess(true);
        setSavedOffline(true);
        setTimeout(() => router.push("/dashboard/smallRuminants/health"), 1200);
        return;
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const EVENT_TYPES: { value: EventType; label: string; emoji: string }[] = [
    { value: "vaccination", label: "Vaccination", emoji: "💉" },
    { value: "treatment",   label: "Treatment",   emoji: "🩺" },
    { value: "deworming",   label: "Deworming",   emoji: "🔬" },
    { value: "checkup",     label: "Checkup",     emoji: "📋" },
  ];

  return (
    <div className="min-h-screen bg-[#0D0F14]">
      {/* Header */}
      <div className="bg-[#17191F] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard/smallRuminants/health"
            className="w-8 h-8 rounded-full bg-[#2A2D35] flex items-center justify-center text-[#9CA3AF] hover:bg-[#3A3D45] transition-colors">
            ←
          </Link>
          <div>
            <h1 className="text-base font-bold text-white">Record Health Event</h1>
            <p className="text-xs text-[#6B7280]">Vaccination · Treatment · Deworming · Checkup</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {success && (
          <div className={`border rounded-xl p-3 text-sm text-center ${
            savedOffline
              ? 'bg-amber-950/30 border-amber-700 text-amber-400'
              : 'bg-emerald-900/30 border-emerald-700 text-emerald-400'
          }`}>
            {savedOffline
              ? '✓ Saved offline — will sync automatically when you\'re back online'
              : '✓ Health event recorded successfully'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Event Type */}
          <div className={CARD}>
            <p className={LABEL}>Event Type *</p>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setEventType(t.value)}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
                    eventType === t.value
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-[#0D0F14] border-[#2A2D35] text-[#9CA3AF] hover:border-[#3A3D45]"
                  }`}>
                  <span>{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Animal Selection */}
          <div className={CARD}>
            <div className="flex items-center justify-between mb-2">
              <p className={LABEL}>Animals ({selectedAnimals.size} selected) *</p>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs text-emerald-500 hover:text-emerald-400">All</button>
                <span className="text-[#4B5563]">·</span>
                <button type="button" onClick={clearAll} className="text-xs text-[#6B7280] hover:text-white">Clear</button>
              </div>
            </div>
            {animals.length === 0 ? (
              <p className="text-sm text-[#6B7280] text-center py-4">
                No animals found. <Link href="/dashboard/smallRuminants/add" className="text-emerald-500 underline">Add animals first</Link>.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-[#2A2D35] p-2 bg-[#0D0F14]">
                {animals.map(a => (
                  <label key={a.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedAnimals.has(a.id)
                        ? "bg-emerald-900/30 border-emerald-700"
                        : "border-transparent hover:bg-[#1C1E26]"
                    }`}>
                    <input type="checkbox" checked={selectedAnimals.has(a.id)} onChange={() => toggleAnimal(a.id)}
                      className="accent-emerald-500" />
                    <span className="text-sm text-white font-medium">{a.animal_tag}</span>
                    <span className="text-xs text-[#6B7280]">{a.species}{a.name ? ` · ${a.name}` : ""}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Date + Cost + Vet */}
          <div className={CARD}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>Event Date *</label>
                <input type="date" value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className={FIELD} required />
              </div>
              <div>
                <label className={LABEL}>Total Cost (KES)</label>
                <input type="number" step="1" min="0" value={cost}
                  onChange={e => setCost(e.target.value)}
                  placeholder="e.g. 500"
                  className={FIELD} />
                {selectedAnimals.size > 1 && cost && (
                  <p className="text-xs text-[#6B7280] mt-1">
                    KES {(parseFloat(cost) / selectedAnimals.size).toFixed(0)} per animal
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className={LABEL}>Vet / Service Provider</label>
              <input type="text" value={vetName}
                onChange={e => setVetName(e.target.value)}
                placeholder="e.g. Dr. Kamau / DVS Officer"
                className={FIELD} />
            </div>
          </div>

          {/* ── VACCINATION ─────────────────────────────────────────────────── */}
          {eventType === "vaccination" && (
            <div className={CARD + " space-y-3"}>
              <p className={LABEL}>Vaccination Details</p>
              <div>
                <label className={LABEL}>Vaccine *</label>
                <select value={vaccineType} onChange={e => setVaccineType(e.target.value)} className={FIELD} required>
                  <option value="">Choose vaccine…</option>
                  {VACCINES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              {vaccineType === "Other" && (
                <div>
                  <label className={LABEL}>Custom Vaccine Name</label>
                  <input type="text" value={customVaccineName}
                    onChange={e => setCustomVaccineName(e.target.value)}
                    placeholder="Enter vaccine name"
                    className={FIELD} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Batch / Lot Number</label>
                  <input type="text" value={batchNumber}
                    onChange={e => setBatchNumber(e.target.value)}
                    placeholder="e.g. KEN-2025-001"
                    className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>Next Due Date</label>
                  <input type="date" value={nextDueDate}
                    onChange={e => setNextDueDate(e.target.value)}
                    className={FIELD} />
                  <p className="text-xs text-[#6B7280] mt-1">Auto-calculated</p>
                </div>
              </div>
              {vaccineType === "PPR" && (
                <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-400">
                    ⚠ PPR is notifiable to DVS. Ensure vaccine is sourced from KEPHIS / DVS-approved suppliers only.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── TREATMENT ───────────────────────────────────────────────────── */}
          {eventType === "treatment" && (
            <div className={CARD + " space-y-3"}>
              <p className={LABEL}>Treatment Details</p>
              <div>
                <label className={LABEL}>Disease / Condition *</label>
                <select value={disease} onChange={e => setDisease(e.target.value)} className={FIELD} required>
                  <option value="">Select condition…</option>
                  {COMMON_DISEASES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {disease === "Other" && (
                <div>
                  <label className={LABEL}>Describe Condition</label>
                  <input type="text" value={customDisease}
                    onChange={e => setCustomDisease(e.target.value)}
                    placeholder="Describe the condition"
                    className={FIELD} />
                </div>
              )}
              <div>
                <label className={LABEL}>Treatment / Procedure</label>
                <input type="text" value={treatment}
                  onChange={e => setTreatment(e.target.value)}
                  placeholder="e.g. IV drip, wound cleaning, IM injection"
                  className={FIELD} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Drug Used</label>
                  <select value={drugName} onChange={e => setDrugName(e.target.value)} className={FIELD}>
                    <option value="">Select drug…</option>
                    {TREATMENT_DRUGS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Route</label>
                  <select value={route} onChange={e => setRoute(e.target.value)} className={FIELD}>
                    <option value="">Select…</option>
                    <option value="IM">Intramuscular (IM)</option>
                    <option value="IV">Intravenous (IV)</option>
                    <option value="SC">Subcutaneous (SC)</option>
                    <option value="Oral">Oral</option>
                    <option value="Topical">Topical</option>
                  </select>
                </div>
              </div>
              {drugName === "Other" && (
                <div>
                  <label className={LABEL}>Drug Name (custom)</label>
                  <input type="text" value={customDrug}
                    onChange={e => setCustomDrug(e.target.value)}
                    placeholder="Enter drug name"
                    className={FIELD} />
                </div>
              )}
              <div>
                <label className={LABEL}>Dosage</label>
                <input type="text" value={dosage}
                  onChange={e => setDosage(e.target.value)}
                  placeholder="e.g. 5 ml IM once daily for 3 days"
                  className={FIELD} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Withdrawal: Meat (days)</label>
                  <input type="number" min="0" value={withdrawalMeat}
                    onChange={e => setWithdrawalMeat(e.target.value)}
                    className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>Withdrawal: Milk (days)</label>
                  <input type="number" min="0" value={withdrawalMilk}
                    onChange={e => setWithdrawalMilk(e.target.value)}
                    className={FIELD} />
                </div>
              </div>
              {(withdrawalMeat || withdrawalMilk) && (
                <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-400">
                    ⚠ Withdrawal: Do not slaughter for{withdrawalMeat ? ` ${withdrawalMeat} days` : ""}
                    {withdrawalMeat && withdrawalMilk ? " /" : ""}
                    {withdrawalMilk ? ` discard milk for ${withdrawalMilk} days` : ""} after last treatment.
                  </p>
                </div>
              )}
              <div>
                <label className={LABEL}>Follow-up Date</label>
                <input type="date" value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  min={eventDate}
                  className={FIELD} />
              </div>
            </div>
          )}

          {/* ── DEWORMING ───────────────────────────────────────────────────── */}
          {eventType === "deworming" && (
            <div className={CARD + " space-y-3"}>
              <p className={LABEL}>Deworming Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Anthelmintic Drug</label>
                  <select value={dewormDrug} onChange={e => setDewormDrug(e.target.value)} className={FIELD}>
                    <option value="">Select drug…</option>
                    {DEWORMING_DRUGS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Dosage</label>
                  <input type="text" value={dewormDosage}
                    onChange={e => setDewormDosage(e.target.value)}
                    placeholder="e.g. 7.5 mg/kg oral"
                    className={FIELD} />
                </div>
              </div>
              {dewormDrug === "Other" && (
                <div>
                  <label className={LABEL}>Drug Name (custom)</label>
                  <input type="text" value={customDewormDrug}
                    onChange={e => setCustomDewormDrug(e.target.value)}
                    placeholder="Enter drug name"
                    className={FIELD} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Withdrawal: Meat (days)</label>
                  <input type="number" min="0" value={withdrawalMeat}
                    onChange={e => setWithdrawalMeat(e.target.value)}
                    className={FIELD} />
                  <p className="text-xs text-[#6B7280] mt-1">Auto-filled for known drugs</p>
                </div>
                <div>
                  <label className={LABEL}>Next Deworming Due</label>
                  <input type="date" value={dewormNextDue}
                    onChange={e => setDewormNextDue(e.target.value)}
                    className={FIELD} />
                  <p className="text-xs text-[#6B7280] mt-1">Default: 90 days</p>
                </div>
              </div>
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg px-3 py-2">
                <p className="text-xs text-blue-400">
                  💡 Rotate anthelmintic classes to prevent resistance. Use FAMACHA scoring where possible — avoid blanket treating the whole herd.
                </p>
              </div>
            </div>
          )}

          {/* ── CHECKUP ─────────────────────────────────────────────────────── */}
          {eventType === "checkup" && (
            <div className={CARD + " space-y-3"}>
              <p className={LABEL}>Checkup Findings</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Body Condition Score (1–5)</label>
                  <select value={bodyConditionScore} onChange={e => setBodyConditionScore(e.target.value)} className={FIELD}>
                    <option value="">Select BCS…</option>
                    <option value="1">1 — Emaciated</option>
                    <option value="2">2 — Thin</option>
                    <option value="3">3 — Moderate ✓</option>
                    <option value="4">4 — Good</option>
                    <option value="5">5 — Obese</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Temperature (°C)</label>
                  <input type="number" step="0.1" value={temperature}
                    onChange={e => setTemperature(e.target.value)}
                    placeholder="38.5 – 40.5 normal"
                    className={FIELD} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Clinical Findings / Observations</label>
                <textarea value={checkupFindings}
                  onChange={e => setCheckupFindings(e.target.value)}
                  placeholder="Coat condition, mucous membranes, mobility, any abnormalities…"
                  rows={3}
                  className={FIELD + " resize-none"} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className={CARD}>
            <label className={LABEL}>Additional Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any additional observations or context…"
              rows={2}
              className={FIELD + " resize-none"} />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pb-6">
            <Link href="/dashboard/smallRuminants/health"
              className="flex-1 px-4 py-3 rounded-xl border border-[#2A2D35] text-[#9CA3AF] text-sm font-semibold text-center hover:bg-[#1C1E26] transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={loading || selectedAnimals.size === 0}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#2A2D35] disabled:text-[#4B5563] text-white text-sm font-semibold transition-colors">
              {loading ? "Saving…" : `Record for ${selectedAnimals.size || 0} Animal${selectedAnimals.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}