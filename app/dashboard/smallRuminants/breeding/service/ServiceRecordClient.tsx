'use client'

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recordBreedingService } from "../actions";
import { queueSmallRuminantEvent } from "@/lib/offline-db";

interface Animal {
  id: string;
  animal_tag: string;
  name: string | null;
  species: string;
  breed: string | null;
}

export default function ServiceRecordClient({ females, males, farmId, preselectedAnimalId }: { females: Animal[], males: Animal[], farmId: string, preselectedAnimalId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);

  // AnimalDetailClient links here with ?animal=<id> so "Record Breeding"
  // from an animal's page doesn't force re-picking her from the dropdown.
  // Only preselect if she's actually in the eligible females list.
  const [damId, setDamId] = useState(
    preselectedAnimalId && females.some(f => f.id === preselectedAnimalId) ? preselectedAnimalId : ""
  );
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
      // OFFLINE FALLBACK: recordBreedingService() is a server action — a
      // plain fetch under the hood — so calling it with no connection just
      // throws a raw "Failed to fetch" that setError() would show verbatim
      // to the farmer. Queue it locally instead, same as every other
      // offline-queued form in the app.
      if (!navigator.onLine) {
        await queueSmallRuminantEvent({
          eventId: crypto.randomUUID(),
          entityType: "small_ruminant_breeding",
          farmId,
          referenceId: damId,
          payload: breedingData,
        });
        setSavedOffline(true);
        setTimeout(() => router.push("/dashboard/smallRuminants/breeding"), 1200);
        return;
      }

      const result = await recordBreedingService(breedingData);
      if (!result.success) {
        setError(result.error || 'Failed to record breeding service');
        return;
      }
      router.push("/dashboard/smallRuminants/breeding");
    } catch (e: any) {
      // A submit that started online but lost connection mid-request lands
      // here too — fall back to the same offline queue rather than
      // showing a raw network error.
      if (!navigator.onLine) {
        try {
          await queueSmallRuminantEvent({
            eventId: crypto.randomUUID(),
            entityType: "small_ruminant_breeding",
            farmId,
            referenceId: damId,
            payload: {
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
          {savedOffline && <div className="text-emerald-600 text-sm">Saved offline — will sync when connected.</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold">{loading ? "Saving..." : "Record Service"}</button>
        </form>
      </div>
    </div>
  );
}
