'use client'

// 📁 FILE PATH: app/dashboard/coffee/disease/scout/ScoutingClient.tsx

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { recordScouting } from "../actions";
import { createClient } from "@/lib/supabase/client";

type ObservationType =
  | "cbd" | "clr" | "antestia" | "thrips" | "mealybugs"
  | "stem_borer" | "leaf_miner" | "root_disease" | "other_pest" | "healthy";

type SeverityLevel   = "none" | "light" | "moderate" | "severe";
type ActionTaken     = "none" | "sprayed_immediately" | "scheduled_spray" | "calendar_spray_sufficient";
type WeatherContext  = "dry_sunny" | "wet_rainy" | "cloudy_humid" | "mixed";

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

// ── Design tokens ────────────────────────────────────────────────────────────
const FIELD = "w-full px-3 py-2.5 rounded-lg border border-[#2A2D35] bg-[#17191F] text-white text-sm placeholder-[#6B7280] focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors";
const LABEL = "block text-xs font-bold text-[#D1D5DB] uppercase tracking-wide mb-1.5";
const CARD  = "bg-[#17191F] rounded-xl border border-[#2A2D35] p-4";

const PEST_OPTIONS: { type: ObservationType; emoji: string; label: string; sublabel: string; category: string }[] = [
  { type: "cbd",        emoji: "🟤", label: "CBD",          sublabel: "Coffee Berry Disease — dark rotting berries", category: "disease" },
  { type: "clr",        emoji: "🟡", label: "Leaf Rust",    sublabel: "Yellow powdery spots on leaf underside",      category: "disease" },
  { type: "antestia",   emoji: "🐛", label: "Antestia Bug", sublabel: "Shield-shaped bug — causes star-bean defect", category: "pest"    },
  { type: "thrips",     emoji: "🔴", label: "Thrips",       sublabel: "Tiny insects on flowers and young berries",   category: "pest"    },
  { type: "mealybugs",  emoji: "⚪", label: "Mealybugs",    sublabel: "White cottony clusters on stems / berries",   category: "pest"    },
  { type: "stem_borer", emoji: "🟠", label: "Stem Borer",   sublabel: "Holes + sawdust trails on main stem",         category: "pest"    },
  { type: "leaf_miner", emoji: "🍃", label: "Leaf Miner",   sublabel: "Pale serpentine tunnels in leaf tissue",      category: "pest"    },
  { type: "root_disease",emoji:"🟣", label: "Root Disease", sublabel: "Wilting, yellowing — possible root rot",      category: "disease" },
  { type: "other_pest", emoji: "❓", label: "Other",        sublabel: "Something else — describe below",             category: "pest"    },
  { type: "healthy",    emoji: "", label: "All Clear",    sublabel: "No problems found on this plot",              category: "clean"   },
];

const SEVERITY_OPTIONS: { value: SeverityLevel; label: string; desc: string; borderActive: string; bgActive: string; textActive: string }[] = [
  { value: "light",    label: "Light",    desc: "A few affected trees / berries — isolated and localised",       borderActive: "border-yellow-500", bgActive: "bg-yellow-900/30", textActive: "text-yellow-300" },
  { value: "moderate", label: "Moderate", desc: "Spreading — multiple sections of the plot affected",           borderActive: "border-orange-500", bgActive: "bg-orange-900/30", textActive: "text-orange-300" },
  { value: "severe",   label: "Severe",   desc: "Heavy damage across most or all trees in this plot",           borderActive: "border-red-500",    bgActive: "bg-red-900/30",    textActive: "text-red-300"    },
];

const WEATHER_OPTIONS: { value: WeatherContext; label: string; emoji: string; desc: string }[] = [
  { value: "dry_sunny",    label: "Dry & Sunny",    emoji: "☀️",  desc: "Favours thrips, mites, stem borer" },
  { value: "wet_rainy",    label: "Wet & Rainy",    emoji: "🌧️", desc: "High CBD & CLR risk"               },
  { value: "cloudy_humid", label: "Cloudy & Humid", emoji: "🌫️", desc: "Sustained CLR pressure"            },
  { value: "mixed",        label: "Mixed",          emoji: "🌤️", desc: "Variable — monitor all"            },
];

const ACTION_OPTIONS: { value: ActionTaken; label: string; desc: string; emoji: string }[] = [
  { value: "none",                        label: "Just recording",              desc: "No action yet — monitoring only",  emoji: "📝" },
  { value: "sprayed_immediately",         label: "Sprayed today",               desc: "Emergency spray already done",      emoji: "🚿" },
  { value: "scheduled_spray",             label: "Will spray in 2–3 days",      desc: "Spray scheduled and upcoming",      emoji: "📅" },
  { value: "calendar_spray_sufficient",   label: "Already on calendar spray",   desc: "Routine spray schedule covers this", emoji: "" },
];

const STEPS = ["Plot & Scout", "What did you see?", "How severe?", "Action taken", "Confirm & save"];

function computeAlertLevel(
  obsType: ObservationType,
  severity: SeverityLevel | "",
  bugsPerTree: number | null,
  threshold: RegionalThreshold | null
): { level: "none" | "watch" | "action_required" | "emergency"; breached: boolean } {
  if (obsType === "healthy" || !threshold) return { level: "none", breached: false };
  if (bugsPerTree != null && threshold.action_count != null) {
    if (bugsPerTree >= (threshold.emergency_count ?? 9999)) return { level: "emergency",       breached: true  };
    if (bugsPerTree >= threshold.action_count)               return { level: "action_required", breached: true  };
    if (bugsPerTree >= (threshold.watch_count ?? 0))         return { level: "watch",           breached: false };
    return { level: "none", breached: false };
  }
  if (severity === "severe")   return { level: "emergency",       breached: true  };
  if (severity === "moderate") return { level: "action_required", breached: true  };
  if (severity === "light")    return { level: "watch",           breached: false };
  return { level: "none", breached: false };
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center gap-1 mb-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            i < step ? "bg-emerald-500" : i === step ? "bg-emerald-400" : "bg-[#2A2D35]"
          }`} />
        ))}
      </div>
      <p className="text-xs text-[#6B7280]">
        Step {step + 1} of {total} — <span className="text-[#9CA3AF] font-medium">{STEPS[step]}</span>
      </p>
    </div>
  );
}

function AlertBanner({ level, threshold }: { level: "none" | "watch" | "action_required" | "emergency"; threshold: RegionalThreshold | null }) {
  if (level === "none") return null;
  const cfg = {
    watch:           { bg: "bg-amber-900/20", border: "border-amber-700", text: "text-amber-400", icon: "", label: "Watch threshold reached" },
    action_required: { bg: "bg-orange-900/20", border: "border-orange-700", text: "text-orange-400", icon: "", label: "Action threshold breached — spray recommended" },
    emergency:       { bg: "bg-red-900/20",   border: "border-red-700",   text: "text-red-400",   icon: "🆘", label: "Emergency threshold — immediate spray required" },
  }[level];
  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3 space-y-1`}>
      <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.icon} {cfg.label}</p>
      {threshold?.recommended_product && (
        <p className="text-xs text-[#9CA3AF]">Recommended: <span className="text-white">{threshold.recommended_product}</span></p>
      )}
      {threshold?.application_notes && (
        <p className="text-xs text-[#6B7280]">{threshold.application_notes}</p>
      )}
    </div>
  );
}

function ScoutingForm({ plots, farmId }: { plots: Plot[]; farmId: string }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const prefillPlot  = searchParams.get("plot_id") ?? "";
  const supabase     = createClient();

  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [threshold, setThreshold] = useState<RegionalThreshold | null>(null);
  const [pestInfo, setPestInfo]   = useState<PestLibraryEntry | null>(null);

  const [form, setForm] = useState<FormData>({
    farm_id:                    farmId,
    plot_id:                    prefillPlot || (plots[0]?.id ?? ""),
    scouting_date:              new Date().toISOString().split("T")[0],
    scouted_by:                 "",
    observation_type:           "",
    severity_level:             "",
    trees_sampled:              "10",
    pest_count_total:           "",
    cbd_green_berries_affected: "",
    cbd_yellow_berries_affected:"",
    cbd_red_berries_affected:   "",
    clr_leaves_affected:        "",
    clr_defoliation_observed:   false,
    percentage_plot_affected:   "",
    weather_past_week:          "",
    action_taken:               "",
    symptoms_description:       "",
    notes:                      "",
  });

  const set = (key: keyof FormData, value: any) => setForm(f => ({ ...f, [key]: value }));

  const selectedPlot = plots.find(p => p.id === form.plot_id);

  useEffect(() => {
    async function loadThreshold() {
      if (!form.observation_type || form.observation_type === "healthy" || !form.plot_id) return;
      const region = selectedPlot?.region_name;
      if (!region) return;
      const { data } = await supabase
        .from("coffee_disease_thresholds")
        .select("*")
        .eq("region_name", region)
        .eq("disease_pest_type", form.observation_type)
        .single();
      setThreshold((data as any) ?? null);
    }
    loadThreshold();
  }, [form.observation_type, form.plot_id]);

  useEffect(() => {
    async function loadPest() {
      if (!form.observation_type || form.observation_type === "healthy") { setPestInfo(null); return; }
      const { data } = await supabase
        .from("coffee_pest_library")
        .select("*")
        .eq("pest_disease_code", form.observation_type)
        .single();
      setPestInfo((data as any) ?? null);
    }
    loadPest();
  }, [form.observation_type]);

  const bugsPerTree = (() => {
    const s = parseInt(form.trees_sampled);
    const t = parseInt(form.pest_count_total);
    return !isNaN(s) && !isNaN(t) && s > 0 ? t / s : null;
  })();

  const alertPreview = form.observation_type && form.observation_type !== "healthy"
    ? computeAlertLevel(form.observation_type as ObservationType, form.severity_level, bugsPerTree, threshold)
    : null;

  const canProceed = () => {
    if (step === 0) return !!form.plot_id;
    if (step === 1) return !!form.observation_type;
    if (step === 2) return form.observation_type === "healthy" || !!form.severity_level;
    if (step === 3) return !!form.action_taken;
    return true;
  };

  async function handleSubmit() {
    setSubmitting(true);
    const { level, breached } = alertPreview ?? { level: "none", breached: false };
    const payload = {
      farm_id:                    form.farm_id,
      plot_id:                    form.plot_id,
      scouting_date:              form.scouting_date,
      scouted_by:                 form.scouted_by || null,
      observation_type:           form.observation_type,
      severity_level:             form.severity_level || null,
      trees_sampled:              form.trees_sampled              ? parseInt(form.trees_sampled)               : null,
      pest_count_total:           form.pest_count_total           ? parseInt(form.pest_count_total)            : null,
      // pest_count_per_tree intentionally omitted — it's a GENERATED ALWAYS
      // column on the live coffee_scouting_records table (confirmed via a
      // live information_schema query), same bug class as
      // coffee_activities.total_cost and milk_records.total_milk
      // elsewhere in this app. bugsPerTree itself is still used above for
      // computeAlertLevel() and the live "Pests per tree" preview further
      // down — only the DB write is affected.
      cbd_green_berries_affected: form.cbd_green_berries_affected ? parseInt(form.cbd_green_berries_affected)  : null,
      cbd_yellow_berries_affected:form.cbd_yellow_berries_affected? parseInt(form.cbd_yellow_berries_affected) : null,
      cbd_red_berries_affected:   form.cbd_red_berries_affected   ? parseInt(form.cbd_red_berries_affected)    : null,
      clr_leaves_affected:        form.clr_leaves_affected        ? parseInt(form.clr_leaves_affected)         : null,
      clr_defoliation_observed:   form.clr_defoliation_observed,
      percentage_plot_affected:   form.percentage_plot_affected   ? parseFloat(form.percentage_plot_affected)  : null,
      weather_past_week:          form.weather_past_week          || null,
      action_taken:               form.action_taken               || null,
      symptoms_description:       form.symptoms_description       || null,
      alert_level:                level,
      threshold_breached:         breached,
      notes:                      form.notes                      || null,
    };
    try {
      const result = await recordScouting(payload as any);
      if (!result.success) {
        setError(result.error || 'Failed to save scouting record');
        setSubmitting(false);
        return;
      }
      router.push("/dashboard/coffee/disease?saved=1");
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  const selectedPest = PEST_OPTIONS.find(p => p.type === form.observation_type);

  return (
    <div className="min-h-screen bg-[#0D0F14] flex flex-col">
      {/* Header */}
      <div className="bg-[#17191F] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 px-4 pt-4 pb-1">
            <button onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
              className="w-8 h-8 rounded-full bg-[#2A2D35] flex items-center justify-center text-[#9CA3AF] hover:bg-[#3A3D45] transition-colors flex-shrink-0">
              ←
            </button>
            <div>
              <h1 className="text-base font-bold text-white">Field Scouting</h1>
              <p className="text-xs text-[#6B7280]">Record pest / disease observations</p>
            </div>
          </div>
          <ProgressBar step={step} total={STEPS.length} />
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-4">

        {/* ── STEP 0: Plot & Scout Info ─────────────────────────────────── */}
        {step === 0 && (
          <>
            <h2 className="text-lg font-bold text-white">Which plot are you scouting?</h2>

            {/* Plot selection */}
            {plots.length === 0 ? (
              <div className={CARD + " text-center"}>
                <p className="text-[#6B7280] text-sm">No plots found. Add plots first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plots.map(p => (
                  <button key={p.id} onClick={() => set("plot_id", p.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      form.plot_id === p.id
                        ? "border-emerald-500 bg-emerald-900/20"
                        : "border-[#2A2D35] bg-[#17191F] hover:border-[#3A3D45]"
                    }`}>
                    <p className="font-semibold text-white">{p.plot_name}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {p.area_hectares ? `${p.area_hectares} ha` : ""}
                      {p.area_hectares && p.region_name ? " · " : ""}
                      {p.region_name ?? ""}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Scout details */}
            <div className={CARD + " space-y-3"}>
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Scout Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Scouting Date *</label>
                  <input type="date"
                    value={form.scouting_date}
                    onChange={e => set("scouting_date", e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>Scouted By</label>
                  <input type="text"
                    value={form.scouted_by}
                    onChange={e => set("scouted_by", e.target.value)}
                    placeholder="Your name / worker name"
                    className={FIELD} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Trees Sampled</label>
                  <input type="number" step="1" min="1"
                    value={form.trees_sampled}
                    onChange={e => set("trees_sampled", e.target.value)}
                    placeholder="e.g. 10"
                    className={FIELD} />
                  <p className="text-xs text-[#6B7280] mt-1">How many trees you checked</p>
                </div>
                <div>
                  <label className={LABEL}>Weather This Week</label>
                  <select value={form.weather_past_week}
                    onChange={e => set("weather_past_week", e.target.value)}
                    className={FIELD}>
                    <option value="">Select…</option>
                    {WEATHER_OPTIONS.map(w => (
                      <option key={w.value} value={w.value}>{w.emoji} {w.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 1: What did you see? ─────────────────────────────────── */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">What did you observe?</h2>
              <p className="text-sm text-[#6B7280]">
                Scouting <span className="text-emerald-400 font-medium">{selectedPlot?.plot_name}</span> · {new Date(form.scouting_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PEST_OPTIONS.map(opt => (
                <button key={opt.type} onClick={() => set("observation_type", opt.type)}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                    form.observation_type === opt.type
                      ? "border-emerald-500 bg-emerald-900/20"
                      : "border-[#2A2D35] bg-[#17191F] hover:border-[#3A3D45]"
                  }`}>
                  <span className="text-2xl block mb-1">{opt.emoji}</span>
                  <p className="font-bold text-sm text-white leading-tight">{opt.label}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5 leading-tight">{opt.sublabel}</p>
                </button>
              ))}
            </div>

            {/* Pest info card from library */}
            {pestInfo && (
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Field Guide — {pestInfo.common_name_english}</p>
                {pestInfo.early_stage_symptoms && (
                  <p className="text-xs text-[#9CA3AF]"><span className="text-white font-medium">Early signs:</span> {pestInfo.early_stage_symptoms}</p>
                )}
                {pestInfo.yield_loss_potential && (
                  <p className="text-xs text-[#9CA3AF]"><span className="text-white font-medium">Yield risk:</span> {pestInfo.yield_loss_potential}</p>
                )}
              </div>
            )}

            {/* Symptoms / custom description */}
            {form.observation_type && form.observation_type !== "healthy" && (
              <div className={CARD}>
                <label className={LABEL}>Describe what you saw <span className="text-[#4B5563] normal-case font-normal">(optional)</span></label>
                <textarea
                  value={form.symptoms_description}
                  onChange={e => set("symptoms_description", e.target.value)}
                  placeholder={`Describe visible symptoms on ${selectedPlot?.plot_name ?? "this plot"}…`}
                  rows={3}
                  className={FIELD + " resize-none"} />
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: Severity + counts ─────────────────────────────────── */}
        {step === 2 && (
          <>
            {form.observation_type === "healthy" ? (
              <div className={CARD + " text-center py-6"}>
                <p className="text-4xl mb-3"></p>
                <p className="text-white font-semibold">All Clear — no action needed</p>
                <p className="text-sm text-[#6B7280] mt-1">Good scouting practice. Continue monitoring regularly.</p>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">How severe is it?</h2>
                  <p className="text-sm text-[#6B7280]">
                    <span className="text-emerald-400">{selectedPest?.label}</span> on {selectedPlot?.plot_name}
                  </p>
                </div>

                {/* Severity buttons */}
                <div className="space-y-2">
                  {SEVERITY_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => set("severity_level", o.value)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        form.severity_level === o.value
                          ? `${o.borderActive} ${o.bgActive}`
                          : "border-[#2A2D35] bg-[#17191F] hover:border-[#3A3D45]"
                      }`}>
                      <p className={`font-bold text-sm ${form.severity_level === o.value ? o.textActive : "text-white"}`}>
                        {o.label}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-0.5">{o.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Count inputs */}
                <div className={CARD + " space-y-3"}>
                  <p className={LABEL}>Count Details <span className="text-[#4B5563] normal-case font-normal">(optional — improves threshold accuracy)</span></p>

                  {/* CBD-specific berry counts */}
                  {form.observation_type === "cbd" && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={LABEL}>🟢 Green berries<br/>affected</label>
                          <input type="number" step="1" min="0"
                            value={form.cbd_green_berries_affected}
                            onChange={e => set("cbd_green_berries_affected", e.target.value)}
                            placeholder="0"
                            className={FIELD} />
                        </div>
                        <div>
                          <label className={LABEL}>🟡 Yellow berries<br/>affected</label>
                          <input type="number" step="1" min="0"
                            value={form.cbd_yellow_berries_affected}
                            onChange={e => set("cbd_yellow_berries_affected", e.target.value)}
                            placeholder="0"
                            className={FIELD} />
                        </div>
                        <div>
                          <label className={LABEL}>🔴 Red berries<br/>affected</label>
                          <input type="number" step="1" min="0"
                            value={form.cbd_red_berries_affected}
                            onChange={e => set("cbd_red_berries_affected", e.target.value)}
                            placeholder="0"
                            className={FIELD} />
                        </div>
                      </div>
                      <p className="text-xs text-[#6B7280]">Count affected berries per tree across your sampled trees ({form.trees_sampled || "?"} trees).</p>
                    </>
                  )}

                  {/* CLR-specific */}
                  {form.observation_type === "clr" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL}>Leaves affected (count)</label>
                          <input type="number" step="1" min="0"
                            value={form.clr_leaves_affected}
                            onChange={e => set("clr_leaves_affected", e.target.value)}
                            placeholder="e.g. 25"
                            className={FIELD} />
                        </div>
                        <div>
                          <label className={LABEL}>% Plot affected</label>
                          <input type="number" step="1" min="0" max="100"
                            value={form.percentage_plot_affected}
                            onChange={e => set("percentage_plot_affected", e.target.value)}
                            placeholder="e.g. 30"
                            className={FIELD} />
                        </div>
                      </div>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox"
                          checked={form.clr_defoliation_observed}
                          onChange={e => set("clr_defoliation_observed", e.target.checked)}
                          className="accent-emerald-500 w-4 h-4" />
                        <span className="text-sm text-[#D1D5DB]">Defoliation (leaf drop) observed</span>
                      </label>
                      {form.clr_defoliation_observed && (
                        <p className="text-xs text-red-400">⚠ Defoliation indicates severe CLR — consider emergency spray with copper-based fungicide.</p>
                      )}
                    </>
                  )}

                  {/* Generic insect count */}
                  {! ["cbd", "clr"].includes(form.observation_type) && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL}>Total pests counted</label>
                          <input type="number" step="1" min="0"
                            value={form.pest_count_total}
                            onChange={e => set("pest_count_total", e.target.value)}
                            placeholder="e.g. 24"
                            className={FIELD} />
                          <p className="text-xs text-[#6B7280] mt-1">Across all sampled trees</p>
                        </div>
                        <div>
                          <label className={LABEL}>% Plot affected</label>
                          <input type="number" step="1" min="0" max="100"
                            value={form.percentage_plot_affected}
                            onChange={e => set("percentage_plot_affected", e.target.value)}
                            placeholder="e.g. 15"
                            className={FIELD} />
                        </div>
                      </div>
                      {bugsPerTree !== null && (
                        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-lg px-3 py-2 flex items-center justify-between">
                          <span className="text-xs text-[#6B7280]">Average pests per tree</span>
                          <span className="text-white font-bold">{bugsPerTree.toFixed(1)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Threshold alert */}
                {alertPreview && <AlertBanner level={alertPreview.level} threshold={threshold} />}
              </>
            )}
          </>
        )}

        {/* ── STEP 3: Action taken ─────────────────────────────────────── */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">What action did you take?</h2>
              <p className="text-sm text-[#6B7280]">Record what happened after scouting this plot</p>
            </div>

            <div className="space-y-2">
              {ACTION_OPTIONS.map(o => (
                <button key={o.value} onClick={() => set("action_taken", o.value)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    form.action_taken === o.value
                      ? "border-emerald-500 bg-emerald-900/20"
                      : "border-[#2A2D35] bg-[#17191F] hover:border-[#3A3D45]"
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{o.emoji}</span>
                    <div>
                      <p className={`font-semibold text-sm ${form.action_taken === o.value ? "text-emerald-300" : "text-white"}`}>
                        {o.label}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-0.5">{o.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className={CARD}>
              <label className={LABEL}>Notes <span className="text-[#4B5563] normal-case font-normal">(optional)</span></label>
              <textarea
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                placeholder="Spray product used, rate applied, areas treated, any other observations…"
                rows={3}
                className={FIELD + " resize-none"} />
            </div>
          </>
        )}

        {/* ── STEP 4: Review & confirm ──────────────────────────────────── */}
        {step === 4 && (
          <>
            <h2 className="text-lg font-bold text-white">Confirm & save</h2>

            {alertPreview && alertPreview.level !== "none" && (
              <AlertBanner level={alertPreview.level} threshold={threshold} />
            )}

            <div className={CARD + " divide-y divide-[#2A2D35] space-y-0"}>
              {[
                ["Plot",          selectedPlot?.plot_name ?? "—"],
                ["Date",          new Date(form.scouting_date).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "long" })],
                ["Scouted by",    form.scouted_by || "Not specified"],
                ["Observation",   selectedPest?.label ?? form.observation_type],
                ["Severity",      form.severity_level || (form.observation_type === "healthy" ? "All Clear " : "Not specified")],
                ["Trees sampled", form.trees_sampled ? `${form.trees_sampled} trees` : "—"],
                bugsPerTree != null ? ["Pests per tree", bugsPerTree.toFixed(1)] : null,
                ["Weather",       WEATHER_OPTIONS.find(w => w.value === form.weather_past_week)?.label ?? "—"],
                ["Action taken",  (ACTION_OPTIONS.find(a => a.value === form.action_taken)?.label) ?? "—"],
                form.notes ? ["Notes", form.notes] : null,
              ].filter((x): x is [string, string] => x !== null).map(([key, val]) => (
                <div key={key as string} className="flex justify-between items-start py-2.5 first:pt-0 last:pb-0">
                  <span className="text-xs text-[#6B7280] flex-shrink-0 w-32">{key}</span>
                  <span className="text-sm text-white text-right">{val as string}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </>
        )}

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <div className="flex gap-3 pb-6">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-5 py-3 rounded-xl border border-[#2A2D35] text-[#9CA3AF] text-sm font-semibold hover:bg-[#1C1E26] transition-colors">
              Back
            </button>
          )}
          <button
            onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : handleSubmit()}
            disabled={!canProceed() || submitting}
            className="flex-1 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#2A2D35] disabled:text-[#4B5563] text-white font-semibold text-sm transition-colors">
            {submitting ? "Saving…" : step < STEPS.length - 1 ? "Continue" : "Save Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScoutingClient({ plots, farmId }: { plots: Plot[]; farmId: string }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0D0F14] flex items-center justify-center">
        <p className="text-[#6B7280] text-sm">Loading…</p>
      </div>
    }>
      <ScoutingForm plots={plots} farmId={farmId} />
    </Suspense>
  );
}