-- ============================================================================
-- VUMA — expire stale ride offers
-- Run after 020_admin_role_switch.sql
-- ============================================================================

alter type offer_status add value if not exists 'expired';
