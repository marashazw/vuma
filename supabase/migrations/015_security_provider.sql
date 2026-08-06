-- ============================================================================
-- VUMA — third-party security provider (rapid response)
-- Run after 014_fare_rounding.sql
-- ============================================================================

-- Admin-configured private security / armed response provider, per country.
-- Kept inactive by default (is_active = false) until an admin fills in real
-- details — showing a "Call Security" button with no real number configured
-- would be worse than not showing it at all.
create table if not exists security_providers (
  country country_code primary key,
  provider_name text not null default 'Private Security Response',
  rapid_response_number text,
  control_room_number text,
  account_reference text, -- e.g. a corporate/client account number the
  -- provider uses to identify Vuma when dispatching, if applicable
  coverage_notes text, -- e.g. "Harare CBD and northern suburbs only"
  is_active boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into security_providers (country, provider_name, is_active)
values
  ('ZA', 'Private Security Response', false),
  ('ZW', 'Private Security Response', false),
  ('OTHER', 'Private Security Response', false)
on conflict (country) do nothing;

alter table security_providers enable row level security;

drop policy if exists "security_providers_select_all" on security_providers;
create policy "security_providers_select_all" on security_providers for select using (true);

drop policy if exists "security_providers_admin_write" on security_providers;
create policy "security_providers_admin_write" on security_providers for update using (is_admin());

-- Best-effort tracking of whether the security provider button was tapped
-- for a given alert — same pattern as tracking a driver's "notified police"
-- response: we can't verify the call actually happened, just that the
-- action was taken.
alter table sos_alerts
  add column if not exists security_provider_notified boolean not null default false,
  add column if not exists security_provider_notified_at timestamptz;
