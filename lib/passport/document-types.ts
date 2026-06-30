// lib/passport/document-types.ts
//
// Shared constant, NOT a server action — safe to import from both server
// actions files and plain React components/pages. ('use server' files can
// only export async functions, so DOCUMENT_TYPE_LABELS lives here instead
// of in documents-actions.ts.)

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  afa_milling_license: 'AFA Milling License',
  kephis_phytosanitary_certificate: 'KEPHIS Phytosanitary Certificate',
  coffee_movement_permit: 'Coffee Movement Permit',
  cupping_scorecard: 'Cupping Scorecard',
  quality_analysis_sheet: 'Quality Analysis Sheet',
  ncpb_clean_coffee_report: 'NCPB Clean Coffee Report',
  export_permit: 'Export Permit',
  other: 'Other Document',
}

export type ExportLotDocumentType = keyof typeof DOCUMENT_TYPE_LABELS
