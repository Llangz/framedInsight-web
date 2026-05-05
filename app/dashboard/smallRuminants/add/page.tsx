"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Add / Register New Animal
// Location: /app/dashboard/smallRuminants/add/page.tsx
//
// Form to register a new goat or sheep, covering all fields in
// the small_ruminants table. Progressive disclosure: basic fields
// always shown, advanced fields (parentage, physical description)
// behind an expand toggle to keep the form lightweight on mobile.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ─── Kenyan breed options ─────────────────────────────────────────────────────

const GOAT_BREEDS = [
  "Galla", "Small East African (SEA)", "Toggenburg", "Saanen",
  "Alpine", "Boer", "Kalahari Red", "Galla × Toggenburg", "Crossbred", "Other",
];
const SHEEP_BREEDS = [
  "Red Maasai", "Dorper", "Blackhead Persian", "Hampshire Down",
  "Merino", "Corriedale", "Red Maasai × Dorper", "Crossbred", "Other",
];
const UPGRADE_LEVELS = ["Pure", "F1 (50%)", "F2 (75%)", "F3 (87.5%)", "F4 (93.75%)", "Grade"];

// ─── Field helpers ────────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-slate-700 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:bg-slate-50"
    />
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300"
    >
      {children}
    </select>
  );
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
    />
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  animal_tag: string;
  name: string;
  species: "goat" | "sheep";
  breed: string;
  upgrade_level: string;
  sex: "female" | "male";
  birth_date: string;
  birth_weight: string;
  status: string;
  purpose: string;
  source: string;
  purchase_price: string;
  purchase_date: string;
  breeding_type: string;
  ear_notch_pattern: string;
  qr_code: string;
  coat_color: string;
  distinguishing_marks: string;
  sire_id: string;
  dam_id: string;
  notes: string;
}

const EMPTY: FormState = {
  animal_tag: "", name: "", species: "goat", breed: "", upgrade_level: "",
  sex: "female", birth_date: "", birth_weight: "", status: "active", purpose: "meat",
  source: "born on farm", purchase_price: "", purchase_date: "",
  breeding_type: "natural", ear_notch_pattern: "", qr_code: "",
  coat_color: "", distinguishing_marks: "", sire_id: "", dam_id: "", notes: "",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AddAnimalPage() {
  const router = useRouter();
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [farmId, setFarmId]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // For sire/dam autocomplete
  const [existingAnimals, setExistingAnimals] = useState<{ id: string; animal_tag: string; name: string | null; sex: string }[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      supabase.from("farm_managers").select("farm_id").eq("user_id", user.id).limit(1).single()
        .then(({ data: fm }) => {
          if (fm?.farm_id) {
            setFarmId(fm.farm_id);
            // Load existing animals for sire/dam selection
            supabase.from("small_ruminants").select("id, animal_tag, name, sex")
              .eq("farm_id", fm.farm_id).eq("status", "active")
              .then(({ data }) => setExistingAnimals((data as any) ?? []));
          }
        });
    });
  }, [router]);

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const breedOptions = form.species === "goat" ? GOAT_BREEDS : SHEEP_BREEDS;
  const sires = existingAnimals.filter(a => a.sex === "male");
  const dams  = existingAnimals.filter(a => a.sex === "female");

  async function handleSubmit() {
    setError(null);
    if (!form.animal_tag.trim()) { setError("Animal tag is required"); return; }
    if (!form.birth_date)        { setError("Birth date is required");  return; }
    if (!farmId)                 { setError("Farm not found");           return; }

    setSaving(true);
    try {
      const payload = {
        farm_id:               farmId,
        animal_tag:            form.animal_tag.trim().toUpperCase(),
        name:                  form.name.trim() || null,
        species:               form.species,
        breed:                 form.breed || null,
        upgrade_level:         form.upgrade_level || null,
        sex:                   form.sex,
        birth_date:            form.birth_date,
        birth_weight:          form.birth_weight ? parseFloat(form.birth_weight) : null,
        status:                form.status,
        purpose:               form.purpose || null,
        source:                form.source || null,
        purchase_price:        form.purchase_price ? parseFloat(form.purchase_price) : null,
        purchase_date:         form.purchase_date || null,
        breeding_type:         form.breeding_type || null,
        ear_notch_pattern:     form.ear_notch_pattern.trim() || null,
        qr_code:               form.qr_code.trim() || null,
        coat_color:            form.coat_color.trim() || null,
        distinguishing_marks:  form.distinguishing_marks.trim() || null,
        sire_id:               form.sire_id || null,
        dam_id:                form.dam_id || null,
        notes:                 form.notes.trim() || null,
      };

      const { error: insertErr } = await supabase.from("small_ruminants").insert(payload);
      if (insertErr) throw insertErr;

      router.push("/dashboard/smallRuminants");
    } catch (e: any) {
      setError(e.message ?? "Failed to save animal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/smallRuminants" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">←</Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">Register Animal</h1>
                <p className="text-xs text-slate-500 mt-0.5">New goat or sheep</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Species toggle */}
        <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
          {(["goat", "sheep"] as const).map(s => (
            <button key={s} onClick={() => { set("species", s); set("breed", ""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all capitalize ${
                form.species === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >{s === "goat" ? "🐐 Goat" : "🐑 Sheep"}</button>
          ))}
        </div>

        {/* Basic identification */}
        <SectionCard title="Identification">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label required>Tag / ID number</Label>
              <Input placeholder="e.g. G001" value={form.animal_tag} onChange={e => set("animal_tag", e.target.value)} />
            </div>
            <div>
              <Label>Name (optional)</Label>
              <Input placeholder="e.g. Mama" value={form.name} onChange={e => set("name", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label required>Sex</Label>
              <Select value={form.sex} onChange={e => set("sex", e.target.value)}>
                <option value="female">♀ Female</option>
                <option value="male">♂ Male</option>
              </Select>
            </div>
            <div>
              <Label required>Birth date</Label>
              <Input type="date" value={form.birth_date} onChange={e => set("birth_date", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Breed</Label>
              <Select value={form.breed} onChange={e => set("breed", e.target.value)}>
                <option value="">Select breed</option>
                {breedOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </div>
            <div>
              <Label>Upgrade level</Label>
              <Select value={form.upgrade_level} onChange={e => set("upgrade_level", e.target.value)}>
                <option value="">Select</option>
                {UPGRADE_LEVELS.map(u => <option key={u} value={u}>{u}</option>)}
              </Select>
            </div>
          </div>
        </SectionCard>

        {/* Management */}
        <SectionCard title="Management">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Purpose</Label>
              <Select value={form.purpose} onChange={e => set("purpose", e.target.value)}>
                <option value="meat">Meat</option>
                <option value="dairy">Dairy</option>
                <option value="breeding">Breeding</option>
                <option value="dual">Dual purpose</option>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="deceased">Deceased</option>
                <option value="culled">Culled</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Select value={form.source} onChange={e => set("source", e.target.value)}>
                <option value="born on farm">Born on farm</option>
                <option value="purchased">Purchased</option>
                <option value="donated">Donated</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <Label>Birth weight (kg)</Label>
              <Input type="number" step="0.1" min="0" placeholder="e.g. 2.5" value={form.birth_weight} onChange={e => set("birth_weight", e.target.value)} />
            </div>
          </div>

          {form.source === "purchased" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Purchase price (KES)</Label>
                <Input type="number" placeholder="e.g. 8000" value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} />
              </div>
              <div>
                <Label>Purchase date</Label>
                <Input type="date" value={form.purchase_date} onChange={e => set("purchase_date", e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <Label>Breeding type</Label>
            <Select value={form.breeding_type} onChange={e => set("breeding_type", e.target.value)}>
              <option value="natural">Natural service</option>
              <option value="AI">Artificial insemination (AI)</option>
              <option value="unknown">Unknown</option>
            </Select>
          </div>
        </SectionCard>

        {/* Advanced — parentage, physical */}
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full text-xs font-semibold text-slate-500 flex items-center justify-center gap-2 py-2 hover:text-emerald-600 transition-colors"
        >
          {showAdvanced ? "▲ Hide" : "▼ Show"} parentage & physical details
        </button>

        {showAdvanced && (
          <>
            <SectionCard title="Parentage">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sire (father)</Label>
                  <Select value={form.sire_id} onChange={e => set("sire_id", e.target.value)}>
                    <option value="">Unknown / External</option>
                    {sires.map(a => (
                      <option key={a.id} value={a.id}>{a.animal_tag}{a.name ? ` — ${a.name}` : ""}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Dam (mother)</Label>
                  <Select value={form.dam_id} onChange={e => set("dam_id", e.target.value)}>
                    <option value="">Unknown</option>
                    {dams.map(a => (
                      <option key={a.id} value={a.id}>{a.animal_tag}{a.name ? ` — ${a.name}` : ""}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Physical Description">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ear notch pattern</Label>
                  <Input placeholder="e.g. R1L2" value={form.ear_notch_pattern} onChange={e => set("ear_notch_pattern", e.target.value)} />
                </div>
                <div>
                  <Label>QR code ID</Label>
                  <Input placeholder="Scan or type QR" value={form.qr_code} onChange={e => set("qr_code", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Coat color</Label>
                <Input placeholder="e.g. Brown and white" value={form.coat_color} onChange={e => set("coat_color", e.target.value)} />
              </div>
              <div>
                <Label>Distinguishing marks</Label>
                <Textarea placeholder="e.g. White patch on left ear, broken horn" value={form.distinguishing_marks} onChange={e => set("distinguishing_marks", e.target.value)} />
              </div>
            </SectionCard>
          </>
        )}

        {/* Notes */}
        <SectionCard title="Notes">
          <Textarea placeholder="Any additional notes about this animal…" value={form.notes} onChange={e => set("notes", e.target.value)} />
        </SectionCard>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pb-8">
          <Link href="/dashboard/smallRuminants"
            className="flex-1 py-3 text-sm font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-center"
          >Cancel</Link>
          <button
            onClick={handleSubmit}
            disabled={saving || !farmId}
            className="flex-1 py-3 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : `Register ${form.species === "goat" ? "Goat" : "Sheep"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
