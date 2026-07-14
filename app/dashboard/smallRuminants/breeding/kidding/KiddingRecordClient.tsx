'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recordKidding } from "./actions";
import { queueSmallRuminantEvent } from "@/lib/offline-db";

interface PregnantDam {
  id: string; dam_id: string; dam_tag: string; dam_name: string | null;
  dam_species: string; expected_delivery_date: string;
}

interface KidLamb {
  sex: "male" | "female"; birth_weight: string; vigor_score: "strong" | "normal" | "weak"; colostrum_given: boolean;
}

export default function KiddingRecordClient({ pregnantDams, farmId }: { pregnantDams: PregnantDam[], farmId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);

  const [breedingId, setBreedingId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [numberOfOffspring, setNumberOfOffspring] = useState(1);
  const [offspring, setOffspring] = useState<KidLamb[]>([{ sex: "female", birth_weight: "", vigor_score: "normal", colostrum_given: true }]);

  useEffect(() => {
    const current = offspring.length;
    if (numberOfOffspring > current) {
      setOffspring([...offspring, ...Array(numberOfOffspring - current).fill({ sex: "female", birth_weight: "", vigor_score: "normal", colostrum_given: true })]);
    } else {
      setOffspring(offspring.slice(0, numberOfOffspring));
    }
  }, [numberOfOffspring]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selected = pregnantDams.find(d => d.id === breedingId);
      if (!selected) throw new Error("Select a dam");
      const kiddingData = { breeding_id: breedingId, dam_id: selected.dam_id, delivery_date: deliveryDate, number_of_offspring: numberOfOffspring };

      // OFFLINE FALLBACK: recordKidding() is a server action — a plain
      // fetch under the hood — so calling it with no connection just
      // throws a raw "Failed to fetch" that setError() would show verbatim
      // to the farmer. Queue a single small_ruminant_kidding event instead;
      // sync-offline-events' handler does both writes recordKidding does
      // (kidding_lambing_records insert + small_ruminant_breeding update)
      // once this reaches the database. referenceId is the breeding record
      // being closed out, same as `breedingId` passed to recordKidding
      // here.
      if (!navigator.onLine) {
        await queueSmallRuminantEvent({
          eventId: crypto.randomUUID(),
          entityType: "small_ruminant_kidding",
          farmId,
          referenceId: breedingId,
          payload: {
            dam_id: selected.dam_id,
            delivery_date: deliveryDate,
            number_of_offspring: numberOfOffspring,
          },
        });
        setSavedOffline(true);
        setTimeout(() => router.push("/dashboard/smallRuminants/breeding"), 1200);
        return;
      }

      const result = await recordKidding(kiddingData, offspring, breedingId);
      if (!result.success) {
        setError(result.error || 'Failed to record kidding');
        return;
      }
      router.push("/dashboard/smallRuminants/breeding");
    } catch (e: any) {
      // A submit that started online but lost connection mid-request lands
      // here too — fall back to the same offline queue rather than
      // showing a raw network error.
      if (!navigator.onLine) {
        const selected = pregnantDams.find(d => d.id === breedingId);
        if (selected) {
          try {
            await queueSmallRuminantEvent({
              eventId: crypto.randomUUID(),
              entityType: "small_ruminant_kidding",
              farmId,
              referenceId: breedingId,
              payload: {
                dam_id: selected.dam_id,
                delivery_date: deliveryDate,
                number_of_offspring: numberOfOffspring,
              },
            });
            setSavedOffline(true);
            setTimeout(() => router.push("/dashboard/smallRuminants/breeding"), 1200);
            return;
          } catch (queueErr: any) {
            setError(queueErr.message || 'Could not save offline');
            return;
          }
        }
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/smallRuminants/breeding" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">←</Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Record Birth</h1>
            <p className="text-xs text-slate-500 mt-0.5">Register kidding or lambing event</p>
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <label className="block text-sm font-semibold mb-2">Select Dam *</label>
            <select value={breedingId} onChange={e => setBreedingId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Choose dam...</option>
              {pregnantDams.map(d => <option key={d.id} value={d.id}>{d.dam_tag} - Due: {new Date(d.expected_delivery_date).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border p-4 grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-semibold mb-1">Birth Date *</label><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required /></div>
            <div><label className="block text-sm font-semibold mb-1">Offspring Count</label><select value={numberOfOffspring} onChange={e => setNumberOfOffspring(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm">{[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
          </div>
          {/* Offspring details */}
          {numberOfOffspring > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Offspring Details</p>
              <div className="space-y-3">
                {offspring.map((kid, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Offspring #{idx + 1}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Sex</label>
                        <select value={kid.sex} onChange={e => { const u = [...offspring]; u[idx] = {...kid, sex: e.target.value as any}; setOffspring(u); }} className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm">
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Birth Weight (kg)</label>
                        <input type="number" step="0.1" min="0.5" value={kid.birth_weight} onChange={e => { const u = [...offspring]; u[idx] = {...kid, birth_weight: e.target.value}; setOffspring(u); }} placeholder="2.5" className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
          {savedOffline && <div className="text-emerald-600 text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3">Saved offline — will sync when connected.</div>}
          <div className="flex gap-3">
            <Link href="/dashboard/smallRuminants/breeding" className="flex-1 px-4 py-3 rounded-xl border text-sm text-center hover:bg-slate-50">Cancel</Link>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold">{loading ? "Saving..." : "Record Birth"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
