-- ============================================================================
-- VUMA PRIVATE — percentage-based per-trip membership fee
-- Run after 047_vuma_private_cooption.sql
--
-- A monthly fee is inherently a flat charge — there's no single
-- transaction to take a percentage of. A per-trip fee can meaningfully be
-- expressed as a percentage of that trip's cost-share amount instead,
-- matching how charge_types (taxes/levies) already separates 'percentage'
-- and 'flat' into distinct fields rather than one field meaning two
-- different things depending on context. fee_amount remains what's used
-- for 'monthly'; fee_percentage is what's used for 'per_trip'.
-- ============================================================================

alter table vuma_private_fee_settings
  add column if not exists fee_percentage numeric(5,2) not null default 0 check (fee_percentage >= 0 and fee_percentage <= 100);
