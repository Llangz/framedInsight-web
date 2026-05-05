'use client';

export type FilterSpecies = "all" | "goat" | "sheep";
export type FilterSex     = "all" | "female" | "male";
export type FilterPurpose = "all" | "meat" | "dairy" | "breeding" | "dual";

export interface Filters {
  species: FilterSpecies;
  sex:     FilterSex;
  purpose: FilterPurpose;
  search:  string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  total: number;
}

export function FilterBar({ filters, onChange, total }: FilterBarProps) {
  function pill(active: boolean, label: string, onClick: () => void) {
    return (
      <button
        key={label}
        onClick={onClick}
        className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
          active
            ? "bg-emerald-600 text-white border-emerald-600"
            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Search by tag, name, breed…"
        value={filters.search}
        onChange={e => onChange({ ...filters, search: e.target.value })}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
      />

      <div className="flex gap-2 flex-wrap">
        {(["all", "goat", "sheep"] as FilterSpecies[]).map(s =>
          pill(
            filters.species === s,
            s === "all" ? `All (${total})` : s === "goat" ? "🐐 Goats" : "🐑 Sheep",
            () => onChange({ ...filters, species: s })
          )
        )}
        <span className="text-slate-200 self-center">|</span>
        {(["all", "female", "male"] as FilterSex[]).map(s =>
          pill(
            filters.sex === s,
            s === "all" ? "All sexes" : s === "female" ? "♀ Female" : "♂ Male",
            () => onChange({ ...filters, sex: s })
          )
        )}
      </div>
    </div>
  );
}
