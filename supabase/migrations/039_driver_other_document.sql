-- ============================================================================
-- VUMA — optional "other document" slot for driver verification
-- Run after 038_tax_levy_charges.sql
-- ============================================================================

alter table driver_profiles
  add column if not exists other_document_path text;
