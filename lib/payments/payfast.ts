import crypto from "crypto";

const isMock = () => process.env.PAYMENTS_MOCK_MODE === "true";

function pfHost() {
  return process.env.PAYFAST_SANDBOX === "true"
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";
}

/** PayFast requires fields in a specific, non-alphabetical insertion order. */
function buildSignatureString(fields: Record<string, string>, passphrase?: string) {
  let str = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v.toString().trim()).replace(/%20/g, "+")}`)
    .join("&");
  if (passphrase) {
    str += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`;
  }
  return str;
}

function md5(input: string) {
  return crypto.createHash("md5").update(input).digest("hex");
}

export interface PayfastChargeParams {
  amount: number;
  itemName: string;
  reference: string; // your internal id — e.g. subscription id
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  buyerEmail?: string;
  buyerFirstName?: string;
}

/**
 * Builds the field set + signature needed to auto-submit a redirect form to
 * PayFast. In PAYMENTS_MOCK_MODE, returns a flag telling the caller to skip
 * the real gateway and treat the charge as instantly successful — useful for
 * demoing the full flow before you have live merchant credentials.
 */
export function buildPayfastCharge(params: PayfastChargeParams) {
  if (isMock()) {
    return {
      mock: true as const,
      redirectUrl: `${params.returnUrl}?mock=1&ref=${encodeURIComponent(params.reference)}`,
    };
  }

  const fields: Record<string, string> = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID || "",
    merchant_key: process.env.PAYFAST_MERCHANT_KEY || "",
    return_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    notify_url: params.notifyUrl,
    name_first: params.buyerFirstName || "Vuma",
    email_address: params.buyerEmail || "",
    m_payment_id: params.reference,
    amount: params.amount.toFixed(2),
    item_name: params.itemName,
  };

  const signature = md5(buildSignatureString(fields, process.env.PAYFAST_PASSPHRASE));

  return {
    mock: false as const,
    actionUrl: pfHost(),
    fields: { ...fields, signature },
  };
}

/** Verifies an Instant Transaction Notification (ITN) webhook payload. */
export function verifyPayfastItn(body: Record<string, string>): boolean {
  if (isMock()) return true;
  const { signature, ...rest } = body;
  const expected = md5(buildSignatureString(rest, process.env.PAYFAST_PASSPHRASE));
  return expected === signature;
}
