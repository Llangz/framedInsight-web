// 📁 FILE PATH: lib/agrochemical-compliance.ts
// ============================================================================
// framedInsight Agrochemical Compliance Engine
// ============================================================================
// Sources:
//   - PCPB / Ministry of Agriculture press statement, 23 June 2025
//     (77 banned, 202 restricted, 151 under review pending Dec 2025)
//   - EU MRL Regulation (EC) No 396/2005 — coffee-specific residue limits
//   - Pest Control Products Act (Cap 346) Kenya
// ============================================================================

export type ComplianceStatus =
  | 'banned_kenya'          // withdrawn from Kenyan market entirely
  | 'restricted_kenya'      // allowed only under specific crop/use conditions
  | 'under_review'          // importation/use suspended pending PCPB decision
  | 'banned_eu_export'      // banned/zero-MRL in EU — direct export risk
  | 'ok'

export type EnterpriseType = 'coffee' | 'dairy' | 'smallRuminants' | 'poultry' | 'general'

export interface ChemicalEntry {
  /** Canonical active ingredient name */
  activeIngredient: string
  /** Common trade/brand names used in Kenya (for fuzzy matching) */
  aliases: string[]
  /** Chemical class */
  class: 'insecticide' | 'herbicide' | 'fungicide' | 'miticide' | 'fumigant' | 'nematicide' | 'acaricide'
  /** Overall PCPB status */
  kenyaStatus: ComplianceStatus
  /** If restricted: which enterprises/uses are specifically banned */
  restrictedFrom?: EnterpriseType[]
  /** If restricted: which uses are still allowed */
  allowedUseOnly?: string
  /** Is this banned in the EU for use on coffee (export market risk) */
  euExportRisk: boolean
  /** Human-readable reason shown to farmer */
  reason: string
  /** Recommended alternatives relevant to Kenyan smallholders */
  alternatives?: string[]
  /** PCPB reference or regulatory note */
  regulatoryNote?: string
}

// ============================================================================
// THE CANONICAL LIST
// ============================================================================
// Structure: one entry per active ingredient. Aliases cover common brand names
// and misspellings Kenyan farmers commonly use.
// ============================================================================

export const AGROCHEMICAL_COMPLIANCE_LIST: ChemicalEntry[] = [

  // ── FULLY BANNED FROM KENYAN MARKET (PCPB June 2025) ───────────────────────

  {
    activeIngredient: 'Acephate',
    aliases: ['acefate', 'orthene', 'asataf', 'acetamidophos'],
    class: 'insecticide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned in Kenya (PCPB June 2025). Linked to neurodevelopmental disorders. Also banned in EU — any residue in coffee will trigger rejection at EU border.',
    alternatives: ['Spinosad', 'Neem oil', 'Cypermethrin (with care)'],
    regulatoryNote: 'PCPB withdrawal gazette, June 2025. Was responsible for >50% of Kenya EU green bean interceptions in 2024.',
  },

  {
    activeIngredient: 'Chlorothalonil',
    aliases: ['daconil', 'bravo', 'chloronil', 'chlorothalonyl'],
    class: 'fungicide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned in Kenya (PCPB June 2025) and banned in EU since 2019. Classified as possibly carcinogenic. Zero MRL tolerance in EU — any residue in exported coffee is grounds for rejection.',
    alternatives: ['Copper Oxychloride', 'Bordeaux Mixture', 'Sulfur-based fungicides'],
    regulatoryNote: 'Banned EU since Reg. (EU) 2019/677.',
  },

  {
    activeIngredient: 'Thiacloprid',
    aliases: ['calypso', 'biscaya', 'thiaclopride'],
    class: 'insecticide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned in Kenya (PCPB June 2025). Neonicotinoid linked to pollinator collapse and reproductive harm. EU MRL set at minimum detection limit (0.01 mg/kg) for most crops.',
    alternatives: ['Spinosad', 'Beauveria bassiana biological spray'],
    regulatoryNote: 'EU ban Reg. (EU) 2020/23.',
  },

  {
    activeIngredient: 'Diuron',
    aliases: ['diuron 80', 'herbatop', 'karmex', 'diurex'],
    class: 'herbicide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned in Kenya (PCPB June 2025). Persistent soil contaminant linked to endocrine disruption. Banned in EU with zero MRL on food crops.',
    alternatives: ['Manual slashing', 'Glyphosate (restricted use)', 'Mulching'],
  },

  {
    activeIngredient: 'DDT',
    aliases: ['ddt', 'dichlorodiphenyltrichloroethane', 'dicofol'],
    class: 'insecticide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned in Kenya under Stockholm Convention on Persistent Organic Pollutants. Extremely long soil and tissue persistence. Zero tolerance in any food export.',
    regulatoryNote: 'Stockholm Convention, ratified by Kenya.',
  },

  {
    activeIngredient: 'Chlordane',
    aliases: ['chlordane', 'octachlor', 'velsicol'],
    class: 'insecticide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned in Kenya. Persistent organic pollutant (POP) under Stockholm Convention.',
  },

  {
    activeIngredient: 'Alachlor',
    aliases: ['lasso', 'alanex', 'alachlore'],
    class: 'herbicide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned in Kenya (PCPB June 2025). Classified as possible carcinogen. Banned in EU.',
    alternatives: ['Manual weeding', 'Mulching with coffee husks'],
  },

  {
    activeIngredient: 'Glufosinate',
    aliases: ['basta', 'challenge', 'finale', 'glufosinat', 'liberty'],
    class: 'herbicide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned in EU since 2018 for reproductive toxicity. Zero MRL in EU for coffee — shipments will be rejected. Imported into Kenya from EU despite ban.',
    alternatives: ['Glyphosate (restricted use)', 'Manual slashing', 'Mulching'],
    regulatoryNote: 'EU ban Reg. (EU) 2018/1043.',
  },

  {
    activeIngredient: 'Mancozeb',
    aliases: ['dithane', 'mancozep', 'mancozebe', 'pennfleb', 'manzate', 'vondozeb'],
    class: 'fungicide',
    kenyaStatus: 'under_review',
    euExportRisk: true,
    reason: 'Under PCPB review — importation and use suspended pending decision (expected December 2025). Also banned in EU since 2020 as endocrine disruptor. Any use on coffee now is both legally uncertain in Kenya and an EU export risk.',
    alternatives: ['Copper Oxychloride', 'Bordeaux Mixture', 'Propiconazole (where registered)'],
    regulatoryNote: 'EU ban Reg. (EU) 2020/2087. PCPB review ongoing.',
  },

  {
    activeIngredient: '2,4,5-T',
    aliases: ['2 4 5 t', '2,4,5-trichlorophenoxyacetic acid', 'brush killer'],
    class: 'herbicide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned in Kenya. Associated with severe environmental and health hazards. Contains dioxin contaminants.',
  },

  {
    activeIngredient: 'Ethylene Dibromide',
    aliases: ['edb', 'ethylene dibromide', 'dibrome'],
    class: 'fumigant',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned highly toxic soil fumigant. PCPB withdrawal June 2025.',
  },

  {
    activeIngredient: 'Dibromochloropropane',
    aliases: ['dbcp', 'dibromochloropropane', 'nemagon'],
    class: 'nematicide',
    kenyaStatus: 'banned_kenya',
    euExportRisk: true,
    reason: 'Banned highly toxic soil fumigant. Causes reproductive toxicity. PCPB withdrawal June 2025.',
  },

  // ── RESTRICTED — CROP/USE SPECIFIC ────────────────────────────────────────

  {
    activeIngredient: '2,4-D Amine',
    aliases: ['2 4 d', '2,4-d', 'weedmaster', 'hedonal', 'salvo', 'weed killer 2-4-d', 'aminamine'],
    class: 'herbicide',
    kenyaStatus: 'restricted_kenya',
    restrictedFrom: ['coffee'],
    allowedUseOnly: 'Non-coffee crops only (e.g. maize, pasture). Completely banned for use in coffee.',
    euExportRisk: true,
    reason: 'Banned for use in coffee by PCPB (June 2025). Soil persistence can lead to residues in coffee cherries. EU MRL for coffee is at default limit (0.01 mg/kg).',
    alternatives: ['Manual slashing', 'Mulching with coffee husks', 'Metsulfuron-methyl (on label)'],
    regulatoryNote: 'PCPB restriction: NOT for use in coffee.',
  },

  {
    activeIngredient: 'Chlorpyrifos',
    aliases: ['dursban', 'lorsban', 'chlorpyriphos', 'chlorpyrifas', 'pyrinex'],
    class: 'insecticide',
    kenyaStatus: 'restricted_kenya',
    allowedUseOnly: 'Termiticide use only (soil treatment for termites). Banned for foliar application and all food crops.',
    euExportRisk: true,
    reason: 'Restricted to termiticide use only (PCPB June 2025). If used as foliar spray on coffee, it violates PCPB rules and will cause EU MRL failures — EU MRL is 0.01 mg/kg (default minimum) for coffee.',
    alternatives: ['Spinosad', 'Neem oil', 'Pyrethrin-based products'],
    regulatoryNote: 'PCPB restriction: termiticide only.',
  },

  {
    activeIngredient: 'Dimethoate',
    aliases: ['rogor', 'dimethoat', 'cygon', 'perfekthion', 'systoate'],
    class: 'insecticide',
    kenyaStatus: 'restricted_kenya',
    allowedUseOnly: 'Termiticide use only. Banned for foliar application on food crops.',
    euExportRisk: true,
    reason: 'Restricted to termiticide use only (PCPB June 2025). Foliar use on coffee violates PCPB rules and EU MRL (0.02 mg/kg for coffee). Commonly misused on Antestia bug — do not use.',
    alternatives: ['Spinosad', 'Neem oil', 'Pyrethrin', 'Beauveria bassiana'],
    regulatoryNote: 'PCPB restriction: termiticide only.',
  },

  {
    activeIngredient: 'Imidacloprid',
    aliases: ['confidor', 'gaucho', 'admire', 'imidaclopride', 'provado', 'bayer imida'],
    class: 'insecticide',
    kenyaStatus: 'restricted_kenya',
    allowedUseOnly: 'Non-open-field use only (e.g. seedling treatment, greenhouse). Banned for outdoor/foliar application.',
    euExportRisk: true,
    reason: 'Restricted to non-open-field use (PCPB June 2025). Neonicotinoid — bee and pollinator toxicity. EU MRL for coffee: 0.05 mg/kg. Open-field foliar spray violates Kenya restriction and risks EU rejection.',
    alternatives: ['Spinosad', 'Pyrethrin-based products'],
  },

  {
    activeIngredient: 'Omethoate',
    aliases: ['folimat', 'omethoat'],
    class: 'insecticide',
    kenyaStatus: 'restricted_kenya',
    allowedUseOnly: 'Non-edible crops only.',
    restrictedFrom: ['coffee', 'dairy', 'smallRuminants', 'poultry'],
    euExportRisk: true,
    reason: 'Restricted to non-edible crops only (PCPB June 2025). Must not be used on coffee or any food crop. EU MRL for coffee: 0.01 mg/kg (minimum detection).',
    alternatives: ['Neem oil', 'Pyrethrin'],
  },

  {
    activeIngredient: 'Propineb',
    aliases: ['antracol', 'propinebe', 'metiram'],
    class: 'fungicide',
    kenyaStatus: 'restricted_kenya',
    allowedUseOnly: 'Non-edible crops only.',
    restrictedFrom: ['coffee', 'dairy', 'smallRuminants', 'poultry'],
    euExportRisk: false,
    reason: 'Banned for use on edible crops (PCPB June 2025). Coffee is an edible crop — do not use.',
    alternatives: ['Copper Oxychloride', 'Bordeaux Mixture'],
  },

  {
    activeIngredient: 'Iprodione',
    aliases: ['rovral', 'iprodion', 'chipco'],
    class: 'fungicide',
    kenyaStatus: 'restricted_kenya',
    allowedUseOnly: 'Non-edible crops only.',
    restrictedFrom: ['coffee', 'dairy', 'smallRuminants', 'poultry'],
    euExportRisk: true,
    reason: 'Banned for use on edible crops (PCPB June 2025). Also banned in EU — zero MRL tolerance. Do not use on coffee.',
    alternatives: ['Copper Oxychloride', 'Carbendazim (where registered)'],
  },

  {
    activeIngredient: 'Abamectin',
    aliases: ['abamektin', 'agrimec', 'affirm', 'vertimec', 'abamec'],
    class: 'miticide',
    kenyaStatus: 'restricted_kenya',
    allowedUseOnly: 'Enclosed/protected structures only (greenhouse, indoor). Not for open-field use.',
    euExportRisk: false,
    reason: 'Restricted to non-open-field use only (PCPB June 2025). Open-field spraying on coffee violates this restriction.',
    alternatives: ['Neem oil', 'Sulfur-based miticides'],
  },

  {
    activeIngredient: 'Oxydemeton-methyl',
    aliases: ['metasystox', 'metas r', 'oxydemeton methyl'],
    class: 'insecticide',
    kenyaStatus: 'under_review',
    euExportRisk: true,
    reason: 'Importation halted pending PCPB review (June 2025). Do not use — legal status uncertain. EU MRL for coffee: 0.02 mg/kg.',
    regulatoryNote: 'PCPB: importation stopped until review concluded.',
  },

  {
    activeIngredient: 'Permethrin',
    aliases: ['ambush', 'pounce', 'permethrine', 'coopex'],
    class: 'insecticide',
    kenyaStatus: 'under_review',
    euExportRisk: false,
    reason: 'Under PCPB review (June 2025) — final decision pending. Avoid use on coffee until decision is published.',
    regulatoryNote: 'PCPB: reviewed, awaiting decision.',
  },

  // ── HIGH EU EXPORT RISK — not yet banned in Kenya but serious MRL concern ──

  {
    activeIngredient: 'Paraquat',
    aliases: ['gramoxone', 'para quat', 'paraquat dichloride', 'syngenta paraquat'],
    class: 'herbicide',
    kenyaStatus: 'ok', // still registered in Kenya
    euExportRisk: true,
    reason: 'Not banned in Kenya but banned in EU since 2007 and in many major coffee markets. Residues in coffee beans can cause EU border rejections. Use with extreme caution — prefer alternatives for export-destined coffee.',
    alternatives: ['Glyphosate (in-row, directed)', 'Manual slashing', 'Mulching'],
    regulatoryNote: 'EU ban since Dir. 2007/25/EC. High soil persistence near roots.',
  },

  {
    activeIngredient: 'Glyphosate',
    aliases: ['roundup', 'glifosato', 'glycel', 'weedoff', 'touchdown', 'wipeout'],
    class: 'herbicide',
    kenyaStatus: 'ok',
    euExportRisk: false, // MRL is 0.1 mg/kg for coffee — manageable with PHI
    reason: 'Glyphosate is still registered in Kenya and EU, but must be used as a directed spray only — never applied over coffee canopy or cherries. Observe pre-harvest interval (minimum 30 days before cherry harvest on adjacent vegetation). EU scrutiny is increasing.',
    alternatives: ['Manual slashing', 'Mulching'],
    regulatoryNote: 'EU MRL for coffee: 0.1 mg/kg. Use directed application only.',
  },
]

// ============================================================================
// LOOKUP FUNCTION
// ============================================================================

/**
 * Check a product name against the compliance list.
 * Uses normalised string matching + alias lookup.
 * Returns the matching ChemicalEntry or null if clean.
 */
export function checkChemicalCompliance(
  productName: string,
  enterprise: EnterpriseType = 'coffee'
): { entry: ChemicalEntry; enterpriseSpecific: boolean } | null {
  if (!productName || productName.trim().length < 2) return null

  const query = productName.toLowerCase().trim()

  for (const entry of AGROCHEMICAL_COMPLIANCE_LIST) {
    const names = [
      entry.activeIngredient.toLowerCase(),
      ...entry.aliases.map(a => a.toLowerCase()),
    ]

    const matched = names.some(name => {
      // Exact match
      if (name === query) return true
      // Substring match (≥4 chars to avoid false positives)
      if (query.length >= 4 && (name.includes(query) || query.includes(name))) return true
      return false
    })

    if (!matched) continue

    // Determine if this restriction is enterprise-specific
    const enterpriseSpecific =
      entry.restrictedFrom !== undefined &&
      entry.restrictedFrom.includes(enterprise)

    // If the entry is restricted but NOT from this enterprise type, skip
    // unless it's fully banned or under review
    if (
      entry.kenyaStatus === 'restricted_kenya' &&
      entry.restrictedFrom !== undefined &&
      !entry.restrictedFrom.includes(enterprise) &&
      entry.allowedUseOnly === undefined
    ) {
      continue
    }

    return { entry, enterpriseSpecific }
  }

  return null
}

/**
 * Severity level for UI display
 */
export function getComplianceSeverity(
  entry: ChemicalEntry,
  enterprise: EnterpriseType
): 'critical' | 'warning' | 'caution' {
  if (entry.kenyaStatus === 'banned_kenya') return 'critical'
  if (entry.kenyaStatus === 'under_review') return 'warning'
  if (
    entry.kenyaStatus === 'restricted_kenya' &&
    entry.restrictedFrom?.includes(enterprise)
  ) return 'critical'
  if (entry.euExportRisk) return 'warning'
  return 'caution'
}