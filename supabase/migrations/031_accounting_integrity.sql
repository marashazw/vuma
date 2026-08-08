-- ============================================================================
-- VUMA — system-wide accounting integrity: no fictitious money, no
-- privilege escalation via direct client column tampering
--
-- The problem this fixes: profiles_update_own_or_admin and
-- driver_profiles_update_own_or_admin (both pre-existing policies) use
-- `using (auth.uid() = id or is_admin())` with no corresponding
-- `with check` clause. In Postgres RLS, USING controls which *rows* can
-- be targeted — it does not restrict which *columns* or *values* an
-- update may set. Practically, this meant any authenticated user could
-- update ANY column on their own row to ANY value via a direct API call
-- — including wallet_balance, is_super_admin, role, verification_status,
-- and every other financial or privilege field on their own account.
-- RLS alone can't express "block this column unless the caller is
-- service_role" cleanly, so this is enforced with BEFORE UPDATE triggers
-- instead, which can inspect old vs. new values with full flexibility.
--
-- Design principle used throughout: for purely numeric financial fields,
-- only *increases* are blocked from non-service-role callers — a
-- decrease (a user spending their own balance) is never the exploit
-- risk, and blocking only increases means a legitimate decrease (like
-- the wallet-credit deduction trigger added below) never needs a special
-- bypass mechanism to coexist with this protection. For status/privilege
-- fields, changes are blocked outright except where a narrow, genuinely
-- legitimate self-service transition exists (e.g., a driver requesting
-- verification review by setting their own status to 'pending' — but
-- never to 'verified').
--
-- Run after 030_scheduled_rides_policy_overhaul.sql
-- ============================================================================

create or replace function protect_sensitive_profile_columns()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.wallet_balance > old.wallet_balance then
    raise exception 'Wallet balance can only be increased by Vuma directly, not by the account holder.';
  end if;

  if new.is_suspended is distinct from old.is_suspended
     or new.suspended_until is distinct from old.suspended_until
     or new.is_super_admin is distinct from old.is_super_admin
     or new.role is distinct from old.role
     or new.scheduled_ride_strikes is distinct from old.scheduled_ride_strikes
     or new.country is distinct from old.country
  then
    raise exception 'This field can only be changed by Vuma directly, not by the account holder.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_profiles_sensitive_fields on profiles;
create trigger protect_profiles_sensitive_fields
  before update on profiles
  for each row execute function protect_sensitive_profile_columns();


create or replace function protect_sensitive_driver_profile_columns()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.prepaid_wallet_balance > old.prepaid_wallet_balance
     or new.credit_balance > old.credit_balance
     or new.free_ride_credits > old.free_ride_credits
  then
    raise exception 'This balance can only be increased by Vuma directly, not by the account holder.';
  end if;

  if new.total_earnings is distinct from old.total_earnings
     or new.suspended_until is distinct from old.suspended_until
     or new.suspension_reason is distinct from old.suspension_reason
     or new.duplicate_vehicle_flag is distinct from old.duplicate_vehicle_flag
  then
    raise exception 'This field can only be changed by Vuma directly, not by the account holder.';
  end if;

  -- A driver may move their own verification_status to 'pending' — that's
  -- the legitimate "submit for review" action — but never directly to
  -- 'verified', 'rejected', or any other outcome, which must come from
  -- an admin decision.
  if new.verification_status is distinct from old.verification_status
     and new.verification_status != 'pending'
  then
    raise exception 'Verification decisions can only be made by Vuma admin.';
  end if;

  -- Same pattern for Vuma Deluxe certification.
  if new.deluxe_status is distinct from old.deluxe_status
     and new.deluxe_status != 'pending'
  then
    raise exception 'Deluxe certification decisions can only be made by Vuma admin.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_driver_profiles_sensitive_fields on driver_profiles;
create trigger protect_driver_profiles_sensitive_fields
  before update on driver_profiles
  for each row execute function protect_sensitive_driver_profile_columns();


-- ---------------------------------------------------------------------------
-- Atomic, server-enforced wallet credit application at ride creation.
--
-- Previously, a rider's wallet_applied amount on a new ride was computed
-- client-side and the corresponding profiles.wallet_balance deduction was
-- a *separate* direct client update — meaning a crafted request could set
-- wallet_applied to any value with no server-side verification that the
-- rider actually had that much balance, and the balance deduction itself
-- had no relationship to any real ride at all. This trigger makes the
-- validation and the deduction one atomic, unbypassable operation: it
-- always re-reads the rider's true current balance, rejects the insert
-- outright if there isn't enough, and performs the deduction itself —
-- the application layer's own client-side deduction call has been
-- removed accordingly, since duplicating it would double-deduct.
-- ---------------------------------------------------------------------------
create or replace function validate_and_apply_wallet_credit()
returns trigger as $$
declare
  current_balance numeric;
begin
  if new.wallet_applied is not null and new.wallet_applied > 0 then
    select wallet_balance into current_balance from profiles where id = new.rider_id;

    if current_balance is null or current_balance < new.wallet_applied then
      raise exception 'Insufficient wallet balance for the amount applied to this ride.';
    end if;

    update profiles set wallet_balance = wallet_balance - new.wallet_applied where id = new.rider_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists apply_wallet_credit_on_ride_insert on rides;
create trigger apply_wallet_credit_on_ride_insert
  before insert on rides
  for each row execute function validate_and_apply_wallet_credit();


-- ---------------------------------------------------------------------------
-- Referral credit reservation — prevent an already-reserved-or-used
-- credit from being reserved again (a defense-in-depth fix; the
-- completion-time check already prevents a double-*benefit*, but the
-- reservation step itself had no guard against a confusing double-
-- reserved intermediate state).
-- ---------------------------------------------------------------------------
create or replace function protect_ride_credit_reservation()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.status = 'reserved' and old.status != 'available' then
    raise exception 'This credit is no longer available to reserve.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_ride_credit_reservation_trigger on ride_credits;
create trigger protect_ride_credit_reservation_trigger
  before update on ride_credits
  for each row execute function protect_ride_credit_reservation();
