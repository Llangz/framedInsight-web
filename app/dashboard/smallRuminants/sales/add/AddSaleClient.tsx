'use client'

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recordSale } from "../actions";

interface Animal {
  id: string;
  animal_tag: string;
  name: string | null;
  species: string;
  sex: string;
  breed: string | null;
}

type SaleType = "live animal" | "meat" | "milk" | "breeding";

export default function AddSaleClient({ animals, farmId }: { animals: Animal[], farmId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saleType, setSaleType] = useState<SaleType>("live animal");
  const [animalId, setAnimalId] = useState<string>("");
  const today = new Date().toISOString().split("T")[0];
  const [saleDate, setSaleDate] = useState(today);
  const [buyerName, setBuyerName] = useState("");
  const [buyerContact, setBuyerContact] = useState("");
  const [liveWeight, setLiveWeight] = useState("");
  const [dressedWeight, setDressedWeight] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [milkQuantity, setMilkQuantity] = useState("");
  const [milkPricePerLiter, setMilkPricePerLiter] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [marketLocation, setMarketLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (saleType === "meat" && dressedWeight && pricePerKg) {
      const total = parseFloat(dressedWeight) * parseFloat(pricePerKg);
      setTotalPrice(total.toFixed(2));
    } else if (saleType === "milk" && milkQuantity && milkPricePerLiter) {
      const total = parseFloat(milkQuantity) * parseFloat(milkPricePerLiter);
      setTotalPrice(total.toFixed(2));
    }
  }, [saleType, dressedWeight, pricePerKg, milkQuantity, milkPricePerLiter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (saleType !== "milk" && !animalId) throw new Error("Please select an animal");
      if (!totalPrice || parseFloat(totalPrice) <= 0) throw new Error("Total price must be greater than zero");

      const saleData = {
        farm_id: farmId,
        animal_id: saleType === "milk" ? null : animalId || null,
        sale_date: saleDate,
        sale_type: saleType,
        buyer_name: buyerName || null,
        buyer_contact: buyerContact || null,
        live_weight_kg: liveWeight ? parseFloat(liveWeight) : null,
        dressed_weight_kg: dressedWeight ? parseFloat(dressedWeight) : null,
        price_per_kg: pricePerKg ? parseFloat(pricePerKg) : null,
        total_price: parseFloat(totalPrice),
        milk_quantity_liters: milkQuantity ? parseFloat(milkQuantity) : null,
        milk_price_per_liter: milkPricePerLiter ? parseFloat(milkPricePerLiter) : null,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        market_location: marketLocation || null,
        notes: notes || null,
      };

      await recordSale(saleData);
      router.push("/dashboard/smallRuminants/sales");
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
            <Link href="/dashboard/smallRuminants/sales" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">←</Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">Record Sale</h1>
              <p className="text-xs text-slate-500 mt-0.5">Live animal · Meat · Milk</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Sale Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {(["live animal", "meat", "milk", "breeding"] as SaleType[]).map(type => (
                <button key={type} type="button" onClick={() => setSaleType(type)}
                  className={`px-4 py-2.5 rounded-lg border text-sm font-medium capitalize transition-all ${
                    saleType === type ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {type === "live animal" && "🐐"} {type === "meat" && "🥩"} {type === "milk" && "🍼"} {type === "breeding" && "🐏"} {type}
                </button>
              ))}
            </div>
          </div>

          {saleType !== "milk" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select Animal *</label>
              <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" required>
                <option value="">Choose animal...</option>
                {animals.map(a => <option key={a.id} value={a.id}>{a.animal_tag} {a.name ? `(${a.name})` : ""} - {a.species}</option>)}
              </select>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Sale Date *</label>
                <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} max={today} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Total Price (KES) *</label>
                <input type="number" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Buyer Name</label>
              <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="John Doe" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase">Payment Info</p>
            <div className="grid grid-cols-2 gap-3">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option>
              </select>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="paid">Paid</option><option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3">
            <Link href="/dashboard/smallRuminants/sales" className="flex-1 px-4 py-3 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 text-center">Cancel</Link>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
              {loading ? "Saving..." : "Record Sale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
