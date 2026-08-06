import type { CountryCode } from "./types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Vuma";

export const COUNTRIES: Record<
  CountryCode,
  {
    label: string;
    currency: string;
    currencySymbol: string;
    center: [number, number]; // default map center [lat, lng]
    fallbackBaseFare: number; // used only if fare_settings can't be fetched from the DB
    fallbackPerKm: number; // same — see lib/geo.ts suggestedFareRange and Admin → Commissions
    fallbackRoundTo: number; // same — nearest $1/R5/etc increment for the displayed range
    fareSteps: number[]; // small, medium, large adjustment increments in this currency
    changeCreditPerRiderMonthly: number; // max a driver can credit one rider per month
    changeCreditDriverMonthly: number; // max a driver can issue OR redeem in total per month
    priorityBoostPerDay: number; // credit_balance cost to buy one day of priority ranking
  }
> = {
  ZA: {
    label: "South Africa",
    currency: "ZAR",
    currencySymbol: "R",
    center: [-26.2041, 28.0473], // Johannesburg
    fallbackBaseFare: 12.5,
    fallbackPerKm: 4.25,
    fallbackRoundTo: 5,
    fareSteps: [5, 10, 20],
    changeCreditPerRiderMonthly: 20,
    changeCreditDriverMonthly: 50,
    priorityBoostPerDay: 10,
  },
  ZW: {
    label: "Zimbabwe",
    currency: "USD",
    currencySymbol: "$",
    center: [-17.8292, 31.0522], // Harare
    fallbackBaseFare: 1,
    fallbackPerKm: 0.28,
    fallbackRoundTo: 1,
    fareSteps: [0.5, 1],
    changeCreditPerRiderMonthly: 2,
    changeCreditDriverMonthly: 5,
    priorityBoostPerDay: 1,
  },
  OTHER: {
    label: "Other",
    currency: "USD",
    currencySymbol: "$",
    center: [0, 0],
    fallbackBaseFare: 1,
    fallbackPerKm: 0.25,
    fallbackRoundTo: 1,
    fareSteps: [0.5, 1],
    changeCreditPerRiderMonthly: 2,
    changeCreditDriverMonthly: 5,
    priorityBoostPerDay: 1,
  },
};

export const DEFAULT_COUNTRY = (process.env.NEXT_PUBLIC_DEFAULT_COUNTRY as CountryCode) || "ZA";

export const EMERGENCY_NUMBERS: Record<CountryCode, { label: string; number: string }[]> = {
  ZA: [
    { label: "Police (SAPS)", number: "10111" },
    { label: "Emergency (mobile)", number: "112" },
  ],
  ZW: [
    { label: "Police", number: "995" },
    { label: "Emergency (mobile)", number: "112" },
  ],
  OTHER: [{ label: "Emergency", number: "112" }],
};

// Nearest online, verified drivers notified when an SOS is triggered
export const SOS_RESPONDER_COUNT = 5;

// Minimum a driver counter-offer may differ by, in local currency, to avoid
// spam counters of 0.01
export const MIN_COUNTER_STEP = 2;

// How long (ms) a ride stays open for driver bids before the rider is
// nudged to raise their offer
export const NEGOTIATION_NUDGE_MS = 90_000;
