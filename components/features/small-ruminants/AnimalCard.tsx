'use client';

import Link from 'next/link';
import { Rabbit, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

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
  
  // Calculate age. Was `animal.date_of_birth` only — every caller in this
  // codebase (SmallRuminantsClient, AnimalDetailClient, etc.) passes
  // `birth_date`, so `date_of_birth` was always undefined and every card
  // showed "Unknown age" regardless of the animal's actual birth date.
  const dob = animal.date_of_birth ?? animal.birth_date;
  const age = dob
    ? `${Math.floor((new Date().getTime() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44))} months`
    : "Unknown age";

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });

  // Dark-card badge convention (bg-*-950/50 text-*-300) matches the
  // payment/sale-status badges used elsewhere (e.g. dairy FinanceClient's
  // sales table) rather than the light pastel-fill badges this card used.
  const purposeBadge = (p: string | null) => {
    if (!p) p = 'dual';
    const colors: any = {
      meat: "bg-orange-950/50 text-orange-300",
      dairy: "bg-blue-950/50 text-blue-300",
      breeding: "bg-purple-950/50 text-purple-300",
      dual: "bg-[#17191F] text-[#9CA3AF]",
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
      className="block bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4 hover:border-emerald-500 transition-colors"
    >
      <div className="flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[#D1D5DB]">
              <Rabbit size={20} />
              <span className="text-[10px] font-semibold uppercase text-[#4B5563]">{animal.species}</span>
            </div>
            <div>
              <p className="font-bold text-white">
                #{animal.animal_tag} {animal.name && <span className="text-[#6B7280] font-medium">({animal.name})</span>}
              </p>
              {animal.breed && (
                <p className="text-[10px] text-[#4B5563] uppercase tracking-tighter">{animal.breed}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {purposeBadge(animal.purpose)}
            {hasAlert && (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold"><AlertTriangle size={11} /> Check</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-[#6B7280]">
          <span className={`font-medium ${isFemale ? "text-pink-400" : "text-blue-400"}`}>
            {isFemale ? "♀" : "♂"} {animal.sex}
          </span>
          <span>·</span>
          <span>{age}</span>
          {animal.upgrade_level && (
            <span className="text-purple-400">· {animal.upgrade_level}</span>
          )}
        </div>

        {latestWeight && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-[#D1D5DB] font-semibold">
              {latestWeight.weight_kg}kg
            </span>
            <span className="text-[#4B5563] text-xs">{formatDate(latestWeight.record_date)}</span>
            {latestWeight.average_daily_gain !== null && (
              <span className={`flex items-center gap-0.5 font-medium ${adgAlert ? "text-amber-400" : "text-emerald-400"}`}>
                {adgAlert ? <TrendingDown size={12} /> : <TrendingUp size={12} />} {latestWeight.average_daily_gain}g/day
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
