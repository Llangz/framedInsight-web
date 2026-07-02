-- ============================================================
-- 20260703_legality_document_support.sql
--
-- recordLegalityDocument() (app/dashboard/cooperative/legality/actions.ts)
-- reuses export_lot_documents to store cooperative-scoped supporting
-- evidence (AFA milling license, NSSF certificate, etc.) that is NOT
-- tied to any single export lot. Two schema gaps blocked this:
--
--   1. export_lot_id was NOT NULL — cooperative-level documents have
--      no export lot to reference at upload time.
--   2. document_type CHECK constraint didn't include the
--      'legality_supporting' value used by recordLegalityDocument().
--
-- RLS on this table is keyed on cooperative_id (not export_lot_id), so
-- relaxing the NOT NULL constraint does not weaken access control.
-- ============================================================

-- 1. Allow cooperative-scoped documents with no export lot yet
ALTER TABLE public.export_lot_documents
  ALTER COLUMN export_lot_id DROP NOT NULL;

COMMENT ON COLUMN public.export_lot_documents.export_lot_id IS
  'NULL for cooperative-level supporting documents (e.g. legality '
  'self-declaration evidence) not yet tied to a specific export lot.';

-- 2. Extend the document_type allow-list
ALTER TABLE public.export_lot_documents
  DROP CONSTRAINT IF EXISTS export_lot_documents_type_check;

ALTER TABLE public.export_lot_documents
  ADD CONSTRAINT export_lot_documents_type_check
  CHECK (document_type IN (
    'afa_milling_license',
    'kephis_phytosanitary_certificate',
    'coffee_movement_permit',
    'cupping_scorecard',
    'quality_analysis_sheet',
    'ncpb_clean_coffee_report',
    'export_permit',
    'legality_supporting',
    'other'
  ));
