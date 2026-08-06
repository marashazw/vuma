-- ============================================================================
-- VUMA — driver document verification
-- Run this after schema.sql. Adds document storage paths to driver_profiles,
-- creates a private Storage bucket for uploads, and locks it down with RLS
-- so a driver can only read/write their own folder while admins can read all.
-- ============================================================================

alter table driver_profiles
  add column if not exists id_document_path text,
  add column if not exists license_document_path text,
  add column if not exists vehicle_registration_path text,
  add column if not exists profile_photo_path text,
  add column if not exists submitted_at timestamptz,
  add column if not exists rejection_reason text;

-- Private bucket — nothing here is publicly readable. Access is only via
-- short-lived signed URLs generated for the driver themselves or an admin.
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;

-- Objects are stored under `${driverUserId}/filename.ext`, so the first
-- path segment doubles as an ownership check.
drop policy if exists "driver_documents_insert_own" on storage.objects;
create policy "driver_documents_insert_own" on storage.objects
  for insert
  with check (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "driver_documents_select_own_or_admin" on storage.objects;
create policy "driver_documents_select_own_or_admin" on storage.objects
  for select
  using (
    bucket_id = 'driver-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

drop policy if exists "driver_documents_update_own" on storage.objects;
create policy "driver_documents_update_own" on storage.objects
  for update
  using (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "driver_documents_delete_own" on storage.objects;
create policy "driver_documents_delete_own" on storage.objects
  for delete
  using (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
