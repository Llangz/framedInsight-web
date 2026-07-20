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
            : "bg-[#0D0F14] text-[#9CA3AF] border-[#2A2D35] hover:bg-[#17191F] hover:text-white"
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
        className="w-full text-sm border border-[#2A2D35] rounded-lg px-3 py-2 bg-[#0A0C10] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40"
      />

      <div className="flex gap-2 flex-wrap">
        {(["all", "goat", "sheep"] as FilterSpecies[]).map(s =>
          pill(
            filters.species === s,
            s === "all" ? `All (${total})` : s === "goat" ? "Goats" : "Sheep",
            () => onChange({ ...filters, species: s })
          )
        )}
        <span className="text-[#2A2D35] self-center">|</span>
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
