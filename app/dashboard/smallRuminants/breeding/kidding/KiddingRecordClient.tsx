'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recordKidding } from "./actions";

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
      await recordKidding(kiddingData, offspring, breedingId);
      router.push("/dashboard/smallRuminants/breeding");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard/smallRuminants/breeding" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">←</Link>
        <h1 className="text-lg font-bold">Record Birth</h1>
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
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold">{loading ? "Saving..." : "Record Birth"}</button>
        </form>
      </div>
    </div>
  );
}
