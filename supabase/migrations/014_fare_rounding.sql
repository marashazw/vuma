-- ============================================================================
-- VUMA — fare guidance rounding increment
-- Run after 013_fare_settings.sql
-- ============================================================================

alter table fare_settings
  add column if not exists round_to numeric(10,2) not null default 1;

-- South Africa rounds to the nearest R5 (a common cash-friendly denomination);
-- Zimbabwe and other USD markets round to the nearest $1.
update fare_settings set round_to = 5 where country = 'ZA';
update fare_settings set round_to = 1 where country in ('ZW', 'OTHER');
