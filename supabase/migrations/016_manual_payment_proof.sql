-- ============================================================================
-- VUMA — manual payment: proof-of-payment upload + richer instructions
-- Run after 015_security_provider.sql
-- ============================================================================

-- Reference code becomes optional — a driver can now submit a reference
-- code, an uploaded proof-of-payment file, or both. At least one is
-- required (enforced below), matching the same "any evidence is fine"
-- flexibility as real-world manual payment verification.
alter table manual_payment_submissions
  alter column reference_code drop not null,
  add column if not exists proof_of_payment_path text;

alter table manual_payment_submissions
  add constraint manual_payment_has_evidence
  check (reference_code is not null or proof_of_payment_path is not null);

-- Clickable external link support for payment instructions (e.g. a link to
-- a payment portal, WhatsApp payment request, or EcoCash web page) —
-- separate from the free-text `instructions` field so it renders as a
-- proper button rather than requiring URL-parsing of prose text.
alter table payment_instructions
  add column if not exists link_url text,
  add column if not exists link_label text;

-- Private bucket for proof-of-payment uploads — nothing here is publicly
-- readable, same pattern as driver-documents.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "payment_proofs_insert_own" on storage.objects;
create policy "payment_proofs_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "payment_proofs_select_own_or_admin" on storage.objects;
create policy "payment_proofs_select_own_or_admin" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

drop policy if exists "payment_proofs_delete_own" on storage.objects;
create policy "payment_proofs_delete_own" on storage.objects
  for delete using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
