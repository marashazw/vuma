-- ============================================================================
-- VUMA — admin-configurable Vuma Deluxe rate multiplier
-- Run after 018_vuma_deluxe.sql
-- ============================================================================

alter table fare_settings
  add column if not exists deluxe_multiplier numeric(4,2) not null default 1.5;
