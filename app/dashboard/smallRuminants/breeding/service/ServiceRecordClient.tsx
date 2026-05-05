'use client'

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recordBreedingService } from "../actions";

interface Animal {
  id: string;
  animal_tag: string;
  name: string | null;
  species: string;
  breed: string | null;
}

export default function ServiceRecordClient({ females, males, farmId }: { females: Animal[], males: Animal[], farmId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [damId, setDamId] = useState("");
  const [heatDate, setHeatDate] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [serviceType, setServiceType] = useState<"natural" | "AI">("natural");
  const [sireId, setSireId] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireTag, setSireTag] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (serviceDate) {
      const delivery = new Date(serviceDate);
      delivery.setDate(delivery.getDate() + 150);
      setExpectedDelivery(delivery.toISOString().split("T")[0]);
    }
  }, [serviceDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const breedingData = {
        dam_id: damId,
        heat_date: heatDate || null,
        service_date: serviceDate,
        service_type: serviceType,
        sire_id: serviceType === "natural" && sireId !== "external" ? sireId : null,
        sire_breed: serviceType === "AI" || sireId === "external" ? sireBreed : null,
        sire_tag: serviceType === "AI" || sireId === "external" ? sireTag : null,
        expected_delivery_date: expectedDelivery,
        pregnancy_result: "pending",
        notes: notes || null,
      };
      await recordBreedingService(breedingData);
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
        <h1 className="text-lg font-bold">Record Service</h1>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <label className="block text-sm font-semibold mb-2">Select Doe/Ewe *</label>
            <select value={damId} onChange={e => setDamId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Choose female...</option>
              {females.map(f => <option key={f.id} value={f.id}>{f.animal_tag} - {f.breed}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border p-4 grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-semibold mb-1">Service Date *</label><input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required /></div>
            <div><label className="block text-sm font-semibold mb-1">Due Date</label><input type="date" value={expectedDelivery} readOnly className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50" /></div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setServiceType("natural")} className={`py-2 rounded-lg border text-sm ${serviceType === "natural" ? "bg-emerald-600 text-white" : "bg-white"}`}>Natural</button>
              <button type="button" onClick={() => setServiceType("AI")} className={`py-2 rounded-lg border text-sm ${serviceType === "AI" ? "bg-emerald-600 text-white" : "bg-white"}`}>AI</button>
            </div>
          </div>
          {serviceType === "natural" && (
            <div className="bg-white rounded-xl border p-4">
              <select value={sireId} onChange={e => setSireId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select Sire...</option>
                {males.map(m => <option key={m.id} value={m.id}>{m.animal_tag} - {m.breed}</option>)}
                <option value="external">External</option>
              </select>
            </div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold">{loading ? "Saving..." : "Record Service"}</button>
        </form>
      </div>
    </div>
  );
}
