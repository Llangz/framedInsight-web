'use client'

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { recordScouting } from "../actions";
import { supabase } from "@/lib/supabase";

type ObservationType =
  | "cbd" | "clr" | "antestia" | "thrips" | "mealybugs"
  | "stem_borer" | "leaf_miner" | "root_disease" | "other_pest" | "healthy";

type SeverityLevel = "none" | "light" | "moderate" | "severe";
type ActionTaken = "none" | "sprayed_immediately" | "scheduled_spray" | "calendar_spray_sufficient";
type WeatherContext = "dry_sunny" | "wet_rainy" | "cloudy_humid" | "mixed";

interface Plot {
  id: string;
  plot_name: string;
  area_hectares: number | null;
  region_name: string | null;
}

interface RegionalThreshold {
  watch_threshold: string | null;
  action_threshold: string | null;
  emergency_threshold: string | null;
  watch_count: number | null;
  action_count: number | null;
  emergency_count: number | null;
  recommended_product: string | null;
  application_notes: string | null;
}

interface PestLibraryEntry {
  common_name_english: string;
  symptoms_description: string | null;
  early_stage_symptoms: string | null;
  yield_loss_potential: string | null;
  quality_impact: string | null;
}

interface FormData {
  farm_id: string;
  plot_id: string;
  scouting_date: string;
  scouted_by: string;
  observation_type: ObservationType | "";
  severity_level: SeverityLevel | "";
  trees_sampled: string;
  pest_count_total: string;
  cbd_green_berries_affected: string;
  cbd_yellow_berries_affected: string;
  cbd_red_berries_affected: string;
  clr_leaves_affected: string;
  clr_defoliation_observed: boolean;
  percentage_plot_affected: string;
  weather_past_week: WeatherContext | "";
  action_taken: ActionTaken | "";
  symptoms_description: string;
  notes: string;
}

const PEST_OPTIONS = [
  { type: "cbd", emoji: "🟤", label: "CBD", sublabel: "Coffee Berry Disease", category: "disease" },
  { type: "clr", emoji: "🟡", label: "Leaf Rust", sublabel: "Yellow spots on leaves", category: "disease" },
  { type: "antestia", emoji: "🐛", label: "Antestia Bug", sublabel: "Shield-shaped bug", category: "pest" },
  { type: "thrips", emoji: "🔴", label: "Thrips", sublabel: "Tiny insects on flowers", category: "pest" },
  { type: "mealybugs", emoji: "⚪", label: "Mealybugs", sublabel: "White cottony clusters", category: "pest" },
  { type: "stem_borer", emoji: "🟠", label: "Stem Borer", sublabel: "Holes + sawdust on stem", category: "pest" },
  { type: "leaf_miner", emoji: "🍃", label: "Leaf Miner", sublabel: "Tunnels in leaves", category: "pest" },
  { type: "root_disease", emoji: "🟣", label: "Root Disease", sublabel: "Wilting, root rot", category: "disease" },
  { type: "other_pest", emoji: "❓", label: "Other", sublabel: "Something else", category: "pest" },
  { type: "healthy", emoji: "✅", label: "All Clear", sublabel: "No problems found", category: "clean" },
];

const SEVERITY_OPTIONS: { value: SeverityLevel; label: string; desc: string; color: string }[] = [
  { value: "light", label: "Light", desc: "A few affected plants, localised", color: "border-yellow-300 bg-yellow-50 text-yellow-800" },
  { value: "moderate", label: "Moderate", desc: "Spreading — many plants affected", color: "border-orange-300 bg-orange-50 text-orange-800" },
  { value: "severe", label: "Severe", desc: "Heavy damage across most of the plot", color: "border-red-300 bg-red-50 text-red-800" },
];

const WEATHER_OPTIONS: { value: WeatherContext; label: string; emoji: string }[] = [
  { value: "dry_sunny", label: "Dry & Sunny", emoji: "☀️" },
  { value: "wet_rainy", label: "Wet & Rainy", emoji: "🌧️" },
  { value: "cloudy_humid", label: "Cloudy & Humid", emoji: "🌫️" },
  { value: "mixed", label: "Mixed Weather", emoji: "🌤️" },
];

const ACTION_OPTIONS: { value: ActionTaken; label: string; desc: string; emoji: string }[] = [
  { value: "none", label: "Just recording", desc: "No action yet", emoji: "📝" },
  { value: "sprayed_immediately", label: "Sprayed today", desc: "Emergency spray done", emoji: "🚿" },
  { value: "scheduled_spray", label: "Will spray in 2–3 days", desc: "Spray is planned", emoji: "📅" },
  { value: "calendar_spray_sufficient", label: "Already on calendar spray", desc: "Last spray covers this", emoji: "✅" },
];

function computeAlertLevel(
  obsType: ObservationType,
  severity: SeverityLevel | "",
  bugsPerTree: number | null,
  threshold: RegionalThreshold | null
): { level: "none" | "watch" | "action_required" | "emergency"; breached: boolean } {
  if (obsType === "healthy" || !threshold) return { level: "none", breached: false };
  if (bugsPerTree != null && threshold.action_count != null) {
    if (bugsPerTree >= (threshold.emergency_count ?? 9999)) return { level: "emergency", breached: true };
    if (bugsPerTree >= threshold.action_count) return { level: "action_required", breached: true };
    if (bugsPerTree >= (threshold.watch_count ?? 0)) return { level: "watch", breached: false };
    return { level: "none", breached: false };
  }
  if (severity === "severe") return { level: "emergency", breached: true };
  if (severity === "moderate") return { level: "action_required", breached: true };
  if (severity === "light") return { level: "watch", breached: false };
  return { level: "none", breached: false };
}

const STEPS = ["Plot", "What did you see?", "How bad?", "Action", "Confirm"];

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < step ? "bg-emerald-500" : i === step ? "bg-emerald-300" : "bg-slate-200"}`} />
      ))}
    </div>
  );
}

function ScoutingForm({ plots, farmId }: { plots: Plot[], farmId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillPlot = searchParams.get("plot_id") ?? "";

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<RegionalThreshold | null>(null);
  const [pestInfo, setPestInfo] = useState<PestLibraryEntry | null>(null);

  const [form, setForm] = useState<FormData>({
    farm_id: farmId,
    plot_id: prefillPlot || (plots.length > 0 ? plots[0].id : ""),
    scouting_date: new Date().toISOString().split("T")[0],
    scouted_by: "",
    observation_type: "",
    severity_level: "",
    trees_sampled: "10",
    pest_count_total: "",
    cbd_green_berries_affected: "",
    cbd_yellow_berries_affected: "",
    cbd_red_berries_affected: "",
    clr_leaves_affected: "",
    clr_defoliation_observed: false,
    percentage_plot_affected: "",
    weather_past_week: "",
    action_taken: "",
    symptoms_description: "",
    notes: "",
  });

  const set = (key: keyof FormData, value: any) => setForm(f => ({ ...f, [key]: value }));

  useEffect(() => {
    async function loadThreshold() {
      if (!form.observation_type || form.observation_type === "healthy" || !form.plot_id) return;
      const plot = plots.find(p => p.id === form.plot_id);
      const region = plot?.region_name;
      if (!region) return;
      const { data } = await supabase.from("coffee_disease_thresholds").select("*").eq("region_name", region).eq("disease_pest_type", form.observation_type).single();
      setThreshold((data as any) ?? null);
    }
    loadThreshold();
  }, [form.observation_type, form.plot_id, plots]);

  useEffect(() => {
    async function loadPest() {
      if (!form.observation_type || form.observation_type === "healthy") { setPestInfo(null); return; }
      const { data } = await supabase.from("coffee_pest_library").select("*").eq("pest_disease_code", form.observation_type).single();
      setPestInfo((data as any) ?? null);
    }
    loadPest();
  }, [form.observation_type]);

  const bugsPerTree = (() => {
    const s = parseInt(form.trees_sampled);
    const t = parseInt(form.pest_count_total);
    return !isNaN(s) && !isNaN(t) && s > 0 ? t / s : null;
  })();

  const alertPreview = form.observation_type && form.observation_type !== "healthy" ? computeAlertLevel(form.observation_type as any, form.severity_level, bugsPerTree, threshold) : null;

  async function handleSubmit() {
    setSubmitting(true);
    const { level, breached } = alertPreview ?? { level: "none", breached: false };
    
    // Convert numeric fields from strings to numbers
    const payload = {
      farm_id: form.farm_id,
      plot_id: form.plot_id,
      scouting_date: form.scouting_date,
      scouted_by: form.scouted_by,
      observation_type: form.observation_type,
      severity_level: form.severity_level,
      trees_sampled: form.trees_sampled ? parseInt(form.trees_sampled) : null,
      pest_count_total: form.pest_count_total ? parseInt(form.pest_count_total) : null,
      pest_count_per_tree: bugsPerTree,
      cbd_green_berries_affected: form.cbd_green_berries_affected ? parseInt(form.cbd_green_berries_affected) : null,
      cbd_yellow_berries_affected: form.cbd_yellow_berries_affected ? parseInt(form.cbd_yellow_berries_affected) : null,
      cbd_red_berries_affected: form.cbd_red_berries_affected ? parseInt(form.cbd_red_berries_affected) : null,
      clr_leaves_affected: form.clr_leaves_affected ? parseInt(form.clr_leaves_affected) : null,
      clr_defoliation_observed: form.clr_defoliation_observed,
      percentage_plot_affected: form.percentage_plot_affected ? parseFloat(form.percentage_plot_affected) : null,
      weather_past_week: form.weather_past_week,
      action_taken: form.action_taken,
      symptoms_description: form.symptoms_description,
      alert_level: level,
      threshold_breached: breached,
      notes: form.notes,
    };
    try {
      await recordScouting(payload as any);
      router.push("/dashboard/coffee/disease?saved=1");
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <ProgressBar step={step} total={STEPS.length} />
        </div>
      </div>
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Select Plot</h2>
            {plots.map(p => (
              <button key={p.id} onClick={() => set("plot_id", p.id)} className={`w-full p-4 rounded-xl border-2 text-left ${form.plot_id === p.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                {p.plot_name}
              </button>
            ))}
          </div>
        )}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            {PEST_OPTIONS.map(opt => (
              <button key={opt.type} onClick={() => set("observation_type", opt.type)} className={`p-4 rounded-xl border-2 text-left ${form.observation_type === opt.type ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <span className="text-2xl">{opt.emoji}</span>
                <p className="font-bold text-sm">{opt.label}</p>
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Severity</h2>
            <div className="grid grid-cols-1 gap-2">
              {SEVERITY_OPTIONS.map(o => (
                <button key={o.value} onClick={() => set("severity_level", o.value)} className={`p-4 rounded-xl border-2 text-left ${form.severity_level === o.value ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="px-6 py-3 rounded-xl border border-slate-200">Back</button>}
          <button onClick={() => step < 4 ? setStep(step + 1) : handleSubmit()} className="flex-1 px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold">
            {step < 4 ? "Continue" : "Save Record"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ScoutingClient({ plots, farmId }: { plots: Plot[], farmId: string }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ScoutingForm plots={plots} farmId={farmId} />
    </Suspense>
  )
}
