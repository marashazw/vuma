-- ============================================================================
-- VUMA — manual mobile wallet payments for driver subscriptions
-- Run after 007_receipt_snapshot.sql
-- ============================================================================

-- Admin-configured "pay to this number/account" instructions, per country.
-- Shown to drivers who choose to pay manually (e.g. EcoCash, bank transfer)
-- instead of the automated PayFast/Paynow gateways.
create table if not exists payment_instructions (
  country country_code primary key,
  method_label text not null default 'Mobile wallet transfer',
  account_name text,
  account_number text,
  instructions text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into payment_instructions (country, method_label, account_name, account_number, instructions)
values
  ('ZA', 'EFT / mobile wallet', 'Vuma (Pty) Ltd', '000-000-0000', 'Add your driver ID as the payment reference.'),
  ('ZW', 'EcoCash', 'Vuma Zimbabwe', '077 000 0000', 'Send via EcoCash, then paste the confirmation SMS reference code below.'),
  ('OTHER', 'Mobile wallet transfer', 'Vuma', '', 'Contact support for payment details.')
on conflict (country) do nothing;

alter table payment_instructions enable row level security;
drop policy if exists "payment_instructions_select_all" on payment_instructions;
create policy "payment_instructions_select_all" on payment_instructions for select using (true);
drop policy if exists "payment_instructions_admin_write" on payment_instructions;
create policy "payment_instructions_admin_write" on payment_instructions for update using (is_admin());

-- A driver's manual payment claim — pending until an admin reviews the
-- reference code and approves or rejects it.
create table if not exists manual_payment_submissions (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  reference_code text not null,
  amount_claimed numeric(10,2),
  status text not null default 'pending', -- pending | approved | rejected
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_manual_payments_status on manual_payment_submissions(status);

alter table manual_payment_submissions enable row level security;

drop policy if exists "manual_payments_select" on manual_payment_submissions;
create policy "manual_payments_select" on manual_payment_submissions
  for select using (auth.uid() = driver_id or is_admin());

drop policy if exists "manual_payments_insert" on manual_payment_submissions;
create policy "manual_payments_insert" on manual_payment_submissions
  for insert with check (auth.uid() = driver_id);

-- Approval/rejection happens via a server route using the service role, so
-- no separate update policy is needed for regular users.

do $$ begin
  alter publication supabase_realtime add table manual_payment_submissions;
exception when duplicate_object then null; end $$;
