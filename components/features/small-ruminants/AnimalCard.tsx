'use client';

import Link from 'next/link';

export interface Animal {
  id: string;
  animal_tag: string;
  name?: string | null;
  species: 'goat' | 'sheep';
  sex: 'female' | 'male';
  breed?: string | null;
  upgrade_level?: string | null;
  purpose: 'meat' | 'dairy' | 'breeding' | 'dual' | null;
  ear_notch_pattern?: string | null;
  qr_code?: string | null;
  date_of_birth?: string | null;
  birth_date?: string | null; // Support both naming conventions
}

interface LatestWeight {
  weight_kg: number;
  record_date: string;
  average_daily_gain?: number | null;
  body_condition_score?: number | null;
}

interface AnimalCardProps {
  animal: Animal;
  latestWeight: LatestWeight | null;
}

export function AnimalCard({ animal, latestWeight }: AnimalCardProps) {
  const isFemale = animal.sex === "female";
  
  // Calculate age
  const age = animal.date_of_birth 
    ? `${Math.floor((new Date().getTime() - new Date(animal.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 30.44))} months`
    : "Unknown age";

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });

  const purposeBadge = (p: string | null) => {
    if (!p) p = 'dual';
    const colors: any = {
      meat: "bg-orange-100 text-orange-700",
      dairy: "bg-blue-100 text-blue-700",
      breeding: "bg-purple-100 text-purple-700",
      dual: "bg-slate-100 text-slate-700",
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors[p] || colors.dual}`}>
        {p}
      </span>
    );
  };

  // Warnings
  const adgAlert = latestWeight?.average_daily_gain != null && latestWeight.average_daily_gain < 50;
  const bcsAlert = latestWeight?.body_condition_score != null && (latestWeight.body_condition_score < 2 || latestWeight.body_condition_score > 4.5);
  const hasAlert = adgAlert || bcsAlert;

  return (
    <Link
      href={`/dashboard/smallRuminants/animal/${animal.id}`}
      className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-500 transition-colors shadow-sm"
    >
      <div className="flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{animal.species === "goat" ? "🐐" : "🐑"}</div>
            <div>
              <p className="font-bold text-slate-900">
                #{animal.animal_tag} {animal.name && <span className="text-slate-500 font-medium">({animal.name})</span>}
              </p>
              {animal.breed && (
                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{animal.breed}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {purposeBadge(animal.purpose)}
            {hasAlert && (
              <span className="text-xs text-amber-600 font-semibold">⚠ Check</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-slate-500">
          <span className={`font-medium ${isFemale ? "text-pink-600" : "text-blue-600"}`}>
            {isFemale ? "♀" : "♂"} {animal.sex}
          </span>
          <span>·</span>
          <span>{age}</span>
          {animal.upgrade_level && (
            <span className="text-purple-600">· {animal.upgrade_level}</span>
          )}
        </div>

        {latestWeight && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-slate-700 font-semibold">
              {latestWeight.weight_kg}kg
            </span>
            <span className="text-slate-400 text-xs">{formatDate(latestWeight.record_date)}</span>
            {latestWeight.average_daily_gain !== null && (
              <span className={`font-medium ${adgAlert ? "text-amber-600" : "text-emerald-600"}`}>
                {adgAlert ? "↓" : "↑"} {latestWeight.average_daily_gain}g/day
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
