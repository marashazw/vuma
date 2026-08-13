-- ============================================================================
-- VUMA PRIVATE — transaction type for membership fee deductions
-- Run after 048_vuma_private_fee_percentage.sql
-- ============================================================================

alter type txn_type add value if not exists 'vuma_private_fee';

alter table driver_wallet_transactions drop constraint if exists driver_wallet_transactions_type_check;
alter table driver_wallet_transactions add constraint driver_wallet_transactions_type_check
  check (type in ('topup', 'commission_deduction', 'no_show_penalty', 'admin_adjustment', 'subscription_payment', 'wallet_applied_reimbursement', 'tax_levy_deduction', 'vuma_private_fee'));
