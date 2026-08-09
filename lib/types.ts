export type UserRole = "rider" | "driver" | "admin";
export type CountryCode = "ZA" | "ZW" | "OTHER";

export type RideStatus =
  | "requested"
  | "negotiating"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export type OfferStatus = "pending" | "countered" | "accepted" | "rejected" | "withdrawn" | "expired";
export type CommissionMode = "per_ride" | "subscription";
export type SubscriptionStatus = "active" | "expired" | "waived" | "cancelled";
export type SubscriptionPeriod = "weekly" | "monthly" | "once_off";
export type TxnType = "ride_commission" | "subscription_payment" | "payout" | "refund";
export type TxnStatus = "pending" | "success" | "failed" | "reversed";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  country: CountryCode;
  avatar_url: string | null;
  is_suspended: boolean;
  suspended_until: string | null;
  suspension_reason: string | null;
  scheduled_ride_strikes: number;
  referred_by: string | null;
  wallet_balance: number;
  wallet_currency: string | null;
  is_super_admin: boolean;
  created_at: string;
}

export interface DriverProfile {
  user_id: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_seats: number | null;
  plate_number: string | null;
  license_number: string | null;
  verification_status: "pending" | "verified" | "rejected";
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  rating_avg: number;
  rating_count: number;
  commission_mode: CommissionMode;
  commission_override_pct: number | null;
  total_earnings: number;
  id_document_path: string | null;
  license_document_path: string | null;
  vehicle_registration_path: string | null;
  profile_photo_path: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  priority_until: string | null;
  free_ride_credits: number;
  credit_balance: number;
  prepaid_wallet_balance: number;
  reserved_balance: number;
  badges: string[];
  duplicate_vehicle_flag: boolean;
  duplicate_vehicle_matches_user_id: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  deluxe_status: "none" | "pending" | "certified" | "expired";
  deluxe_requested_at: string | null;
  deluxe_certified_at: string | null;
  deluxe_next_inspection_due: string | null;
  deluxe_notes: string | null;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  country: CountryCode;
  period: SubscriptionPeriod;
  price: number;
  currency: string;
  commission_pct_while_active: number;
  is_active: boolean;
  created_at: string;
}

export interface DriverSubscription {
  id: string;
  driver_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string;
  amount_paid: number;
  waived_by: string | null;
  waived_reason: string | null;
  gateway: string | null;
  gateway_ref: string | null;
  created_at: string;
}

export interface Ride {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_km: number | null;
  suggested_fare: number | null;
  rider_offer: number;
  seats_required: number;
  final_fare: number | null;
  currency: string;
  country: CountryCode;
  status: RideStatus;
  cancel_reason: string | null;
  cancelled_by: string | null;
  applied_credit_id: string | null;
  wallet_applied: number;
  is_deluxe: boolean;
  is_scheduled: boolean;
  scheduled_at: string | null;
  scheduled_cancel_status: "none" | "proposed" | "accepted" | "rejected";
  scheduled_cancel_proposed_by: string | null;
  scheduled_cancel_reason: string | null;
  no_show_penalty_charged: boolean;
  commission_reserved: number | null;
  tax_levy_charged: number | null;
  tax_levy_breakdown: { name: string; amount: number }[] | null;
  driver_name_snapshot: string | null;
  vehicle_snapshot: string | null;
  plate_snapshot: string | null;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface RideOffer {
  id: string;
  ride_id: string;
  driver_id: string;
  amount: number;
  message: string | null;
  status: OfferStatus;
  created_at: string;
}

export interface Transaction {
  id: string;
  ride_id: string | null;
  driver_id: string | null;
  rider_id: string | null;
  type: TxnType;
  amount: number;
  commission_pct: number | null;
  commission_amount: number | null;
  commission_source: string | null;
  currency: string;
  gateway: string | null;
  gateway_ref: string | null;
  status: TxnStatus;
  created_at: string;
}

export interface Rating {
  id: string;
  ride_id: string;
  from_user_id: string;
  to_user_id: string;
  stars: number;
  comment: string | null;
  tag_politeness: "polite" | "rude" | null;
  tag_punctuality: "on_time" | "very_late" | null;
  tag_cleanliness: "clean" | "dirty" | null;
  created_at: string;
}

export type DriverWarningCategory = "rude" | "very_late" | "dirty";

export interface DriverWarning {
  id: string;
  driver_id: string;
  category: DriverWarningCategory;
  warning_number: number;
  triggered_by_count: number;
  period_start: string;
  acknowledged: boolean;
  created_at: string;
}

export interface ReferralSettings {
  country: CountryCode;
  required_referrals: number;
  credit_amount: number;
  currency: string;
  driver_priority_days: number;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export type ReferralStatus = "pending" | "qualified" | "rewarded";

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: ReferralStatus;
  counted_toward_reward: boolean;
  qualified_at: string | null;
  created_at: string;
}

export type RideCreditStatus = "available" | "reserved" | "used" | "expired";

export interface RideCredit {
  id: string;
  rider_id: string;
  amount: number;
  currency: string;
  source: string;
  status: RideCreditStatus;
  used_ride_id: string | null;
  created_at: string;
  used_at: string | null;
}

export interface SecurityProvider {
  country: CountryCode;
  provider_name: string;
  rapid_response_number: string | null;
  control_room_number: string | null;
  account_reference: string | null;
  coverage_notes: string | null;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export type SosAlertStatus = "active" | "resolved" | "false_alarm";

export interface SosAlert {
  id: string;
  ride_id: string | null;
  triggered_by: string;
  triggered_by_role: UserRole;
  lat: number;
  lng: number;
  status: SosAlertStatus;
  involved_driver_name: string | null;
  involved_driver_phone: string | null;
  vehicle_plate: string | null;
  vehicle_description: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
  security_provider_notified: boolean;
  security_provider_notified_at: string | null;
  is_deluxe: boolean;
  created_at: string;
}

export type SosResponseStatus =
  | "notified"
  | "acknowledged"
  | "notified_police"
  | "attending"
  | "arrived"
  | "no_response";

export interface SosResponse {
  id: string;
  sos_alert_id: string;
  driver_id: string;
  distance_km: number | null;
  status: SosResponseStatus;
  police_reference: string | null;
  notes: string | null;
  responded_at: string | null;
  rewarded: boolean;
  reward_type: string | null;
  created_at: string;
}

export interface RoadAlert {
  id: string;
  driver_id: string;
  country: CountryCode;
  road_name: string;
  message: string;
  lat: number;
  lng: number;
  cleared_at: string | null;
  cleared_by: string | null;
  created_at: string;
}

export interface RoadQuestion {
  id: string;
  driver_id: string;
  country: CountryCode;
  road_name: string;
  question: string;
  created_at: string;
}

export interface RoadQuestionReply {
  id: string;
  question_id: string;
  driver_id: string;
  reply: string;
  logged_as_alert_id: string | null;
  created_at: string;
}

export type WalletTopupStatus = "pending" | "approved" | "rejected";

export interface DriverWalletTopup {
  id: string;
  driver_id: string;
  amount: number;
  currency: string;
  reference_code: string | null;
  proof_of_payment_path: string | null;
  status: WalletTopupStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export type WalletTransactionType =
  | "topup"
  | "commission_deduction"
  | "no_show_penalty"
  | "admin_adjustment"
  | "subscription_payment"
  | "wallet_applied_reimbursement"
  | "tax_levy_deduction";

export interface DriverWalletTransaction {
  id: string;
  driver_id: string;
  ride_id: string | null;
  type: WalletTransactionType;
  amount: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
}

export interface ChargeType {
  id: string;
  name: string;
  country: CountryCode;
  charge_kind: "percentage" | "flat";
  rate: number | null;
  flat_amount: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DriverNotice {
  id: string;
  label: string;
  title: string;
  body: string | null;
  link_url: string | null;
  link_label: string | null;
  position: "left" | "right";
  is_active: boolean;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RideStop {
  id: string;
  ride_id: string;
  sequence: number;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
}

export interface RideMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface FareSettings {
  country: CountryCode;
  base_fare: number;
  per_km: number;
  low_multiplier: number;
  high_multiplier: number;
  round_to: number;
  deluxe_multiplier: number;
  scheduled_multiplier: number;
  change_credit_per_rider_monthly: number | null;
  change_credit_driver_monthly: number | null;
  rider_wallet_accrual_monthly: number | null;
  currency: string;
  updated_by: string | null;
  updated_at: string;
}

export interface PaymentInstructions {
  country: CountryCode;
  method_label: string;
  account_name: string | null;
  account_number: string | null;
  instructions: string | null;
  link_url: string | null;
  link_label: string | null;
  gateway_enabled: boolean;
  updated_by: string | null;
  updated_at: string;
}

export type ManualPaymentStatus = "pending" | "approved" | "rejected";

export interface ManualPaymentSubmission {
  id: string;
  driver_id: string;
  plan_id: string;
  reference_code: string | null;
  proof_of_payment_path: string | null;
  amount_claimed: number | null;
  status: ManualPaymentStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export type WalletTxnType = "change_credit" | "reserved" | "redeemed" | "refunded" | "admin_adjustment";

export interface WalletTransaction {
  id: string;
  rider_id: string;
  ride_id: string | null;
  type: WalletTxnType;
  amount: number;
  currency: string;
  created_by: string | null;
  notes: string | null;
  created_at: string;
}

export type DriverCreditTxnType =
  | "issued_change_credit"
  | "redeemed_change_credit"
  | "spent_subscription"
  | "spent_priority"
  | "referral_reward";

export interface DriverCreditTransaction {
  id: string;
  driver_id: string;
  type: DriverCreditTxnType;
  amount: number;
  currency: string;
  ride_id: string | null;
  rider_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface DriverReferralSettings {
  country: CountryCode;
  required_referrals: number;
  credit_amount: number;
  currency: string;
  min_rides_to_qualify: number;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export type DriverReferralStatus = "pending" | "qualified" | "rewarded" | "flagged";

export interface DriverReferral {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: DriverReferralStatus;
  counted_toward_reward: boolean;
  qualified_at: string | null;
  created_at: string;
}
