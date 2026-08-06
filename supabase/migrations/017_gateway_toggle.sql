-- ============================================================================
-- VUMA — toggle to hide gateway (PayFast/Paynow) payments until ready
-- Run after 016_manual_payment_proof.sql
-- ============================================================================

alter table payment_instructions
  add column if not exists gateway_enabled boolean not null default true;

-- Turned off now, per explicit request, until real PayFast/Paynow gateway
-- integration is complete. Flip back to true from Admin → Subscriptions
-- whenever it's ready — no code change or redeploy needed.
update payment_instructions set gateway_enabled = false;
