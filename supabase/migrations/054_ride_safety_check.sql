-- ============================================================================
-- SAFETY CHECK — "is everything OK?" prompt when a trip runs far longer
-- than its own estimated duration
-- Run after 053_payment_instructions.sql
-- ============================================================================

alter table rides
  add column if not exists estimated_duration_min numeric(6,1),
  add column if not exists safety_check_status text not null default 'none'
    check (safety_check_status in ('none', 'triggered', 'responded')),
  add column if not exists safety_check_triggered_at timestamptz;
