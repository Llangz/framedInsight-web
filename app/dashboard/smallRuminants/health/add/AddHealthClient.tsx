'use client'

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recordHealth } from "../actions";
import { supabase } from "@/lib/supabase";

interface Animal {
  id: string;
  animal_tag: string;
  name: string | null;
  species: string;
}

type EventType = "vaccination" | "treatment" | "deworming" | "checkup";

const VACCINE_SCHEDULES: Record<string, number> = {
  "PPR": 365, "CCPP": 365, "Foot Rot": 180, "Anthrax": 365, "Rift Valley Fever": 365,
};

const WITHDRAWAL_PERIODS: Record<string, { meat: number; milk: number }> = {
  "Oxytetracycline": { meat: 28, milk: 7 },
  "Penicillin": { meat: 10, milk: 4 },
  "Ivermectin": { meat: 35, milk: 28 },
  "Albendazole": { meat: 7, milk: 3 },
  "Levamisole": { meat: 7, milk: 2 },
};

export default function AddHealthClient({ animals, farmId }: { animals: Animal[], farmId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventType, setEventType] = useState<EventType>("vaccination");
  const [selectedAnimals, setSelectedAnimals] = useState<Set<string>>(new Set());
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [vaccineType, setVaccineType] = useState("");
  const [vaccineName, setVaccineName] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [disease, setDisease] = useState("");
  const [treatment, setTreatment] = useState("");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [withdrawalMeat, setWithdrawalMeat] = useState("");
  const [withdrawalMilk, setWithdrawalMilk] = useState("");
  const [vetName, setVetName] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (eventType === "vaccination" && vaccineType && eventDate) {
      const due = new Date(eventDate);
      due.setDate(due.getDate() + (VACCINE_SCHEDULES[vaccineType] || 365));
      setNextDueDate(due.toISOString().split("T")[0]);
    }
  }, [eventType, vaccineType, eventDate]);

  const toggleAnimal = (id: string) => {
    const s = new Set(selectedAnimals);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedAnimals(s);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAnimals.size === 0) { setError("Select at least one animal"); return; }
    setLoading(true);
    try {
      const eventRecords = Array.from(selectedAnimals).map(animalId => ({
        animal_id: animalId,
        event_date: eventDate,
        event_type: eventType,
        vet_name: vetName || null,
        cost_per_animal: cost ? parseFloat(cost) / selectedAnimals.size : null,
        notes: notes || null,
        vaccine_type: eventType === "vaccination" ? vaccineType : null,
        vaccine_name: eventType === "vaccination" ? vaccineName : null,
        next_vaccination_due: eventType === "vaccination" ? nextDueDate : null,
        disease: eventType === "treatment" ? disease : null,
        treatment: eventType === "treatment" ? treatment : null,
        drug_name: (eventType === "treatment" || eventType === "deworming") ? drugName : null,
        dosage: (eventType === "treatment" || eventType === "deworming") ? dosage : null,
        withdrawal_period_meat_days: withdrawalMeat ? parseInt(withdrawalMeat) : null,
        withdrawal_period_milk_days: withdrawalMilk ? parseInt(withdrawalMilk) : null,
      }));
      await recordHealth(eventRecords);
      router.push("/dashboard/smallRuminants/health");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/smallRuminants/health" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">←</Link>
            <div><h1 className="text-lg font-bold">Record Health Event</h1><p className="text-xs text-slate-500 mt-0.5">Vaccination · Treatment · Deworming</p></div>
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <label className="block text-sm font-semibold mb-2">Event Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {["vaccination", "treatment", "deworming", "checkup"].map(type => (
                <button key={type} type="button" onClick={() => setEventType(type as any)} className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${eventType === type ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600"}`}>{type}</button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <label className="block text-sm font-semibold mb-2">Animals ({selectedAnimals.size}) *</label>
            <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-lg p-2">
              {animals.map(a => (
                <label key={a.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${selectedAnimals.has(a.id) ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-100"}`}>
                  <input type="checkbox" checked={selectedAnimals.has(a.id)} onChange={() => toggleAnimal(a.id)} />
                  <span className="text-sm">{a.animal_tag} · {a.species}</span>
                </label>
              ))}
            </div>
          </div>
          {eventType === "vaccination" && (
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Vaccine Type *</label>
                <select value={vaccineType} onChange={e => setVaccineType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required>
                <option value="">Choose vaccine...</option>
                  <option value="PPR">PPR (Peste des Petits Ruminants)</option>
                  <option value="CCPP">CCPP (Contagious Caprine Pleuropneumonia)</option>
                  <option value="Foot Rot">Foot Rot Vaccine</option>
                  <option value="Anthrax">Anthrax Vaccine</option>
                  <option value="Rift Valley Fever">Rift Valley Fever Vaccine</option>
                  <option value="Enterotoxemia">Enterotoxemia (Overeating)</option>
                  <option value="Other">Other</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">PPR and CCPP are critical vaccines in Kenya.</p>
            </div>
            </div>
          )}

          {(eventType === "treatment" || eventType === "deworming") && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{eventType === "deworming" ? "Deworming" : "Treatment"} Details</p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Condition / Disease</label>
                <input type="text" value={disease} onChange={e => setDisease(e.target.value)} placeholder="e.g. Worms, Pneumonia, Diarrhea" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Drug Name</label>
                  <input type="text" value={drugName} onChange={e => setDrugName(e.target.value)} placeholder="e.g. Albendazole" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Dosage</label>
                  <input type="text" value={dosage} onChange={e => setDosage(e.target.value)} placeholder="e.g. 5ml per animal" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Withdrawal (meat, days)</label>
                  <input type="number" value={withdrawalMeat} onChange={e => setWithdrawalMeat(e.target.value)} placeholder="7" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Withdrawal (milk, days)</label>
                  <input type="number" value={withdrawalMilk} onChange={e => setWithdrawalMilk(e.target.value)} placeholder="3" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              <p className="text-xs text-amber-600">Withdrawal periods ensure meat/milk is safe for consumption.</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Event Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Event Date *</label>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} max={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Vet / Agrovet Name</label>
                <input type="text" value={vetName} onChange={e => setVetName(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total Cost (KES)</label>
                <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="e.g. 500" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Next Due Date</label>
                <input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any observations, batch numbers, etc." rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3">
            <Link href="/dashboard/smallRuminants/health" className="flex-1 px-4 py-3 rounded-lg border text-sm text-center">Cancel</Link>
            <button type="submit" disabled={loading || selectedAnimals.size === 0} className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-semibold disabled:opacity-50 transition-colors">
              {loading ? "Saving..." : `Record for ${selectedAnimals.size} Animals`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
