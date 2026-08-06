import crypto from "crypto";

const isMock = () => process.env.PAYMENTS_MOCK_MODE === "true";

const PAYNOW_INITIATE_URL = "https://www.paynow.co.zw/interface/initiatetransaction";
const PAYNOW_MOBILE_URL = "https://www.paynow.co.zw/interface/remotetransaction";

function paynowHash(fields: Record<string, string>, integrationKey: string) {
  const values = Object.values(fields).join("");
  return crypto
    .createHash("sha512")
    .update(values + integrationKey)
    .digest("hex")
    .toUpperCase();
}

function parsePaynowResponse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("&")) {
    const [k, ...rest] = line.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

export interface PaynowChargeParams {
  amount: number;
  reference: string;
  buyerEmail: string;
  resultUrl: string;
  returnUrl: string;
  /** If provided, initiates a direct EcoCash mobile push instead of a web redirect. */
  ecocashPhone?: string;
}

/**
 * Initiates a Paynow transaction (web redirect, or direct EcoCash mobile
 * money push if a phone number is supplied). In PAYMENTS_MOCK_MODE, skips
 * the real API call and returns an instantly-successful mock result so the
 * rest of the app is fully testable without live Paynow credentials.
 */
export async function initiatePaynowCharge(params: PaynowChargeParams) {
  if (isMock()) {
    return {
      mock: true as const,
      status: "Ok",
      redirectUrl: `${params.returnUrl}?mock=1&ref=${encodeURIComponent(params.reference)}`,
      pollUrl: null as string | null,
      instructions: params.ecocashPhone
        ? "Mock mode: simulated EcoCash prompt approved automatically."
        : null,
    };
  }

  const integrationId = process.env.PAYNOW_INTEGRATION_ID || "";
  const integrationKey = process.env.PAYNOW_INTEGRATION_KEY || "";

  const fields: Record<string, string> = {
    id: integrationId,
    reference: params.reference,
    amount: params.amount.toFixed(2),
    additionalinfo: "Vuma driver subscription / ride payment",
    returnurl: params.returnUrl,
    resulturl: params.resultUrl,
    authemail: params.buyerEmail,
    status: "Message",
    ...(params.ecocashPhone
      ? { method: "ecocash", phone: params.ecocashPhone }
      : {}),
  };

  const hash = paynowHash(fields, integrationKey);
  const url = params.ecocashPhone ? PAYNOW_MOBILE_URL : PAYNOW_INITIATE_URL;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...fields, hash }).toString(),
  });

  const parsed = parsePaynowResponse(await res.text());

  return {
    mock: false as const,
    status: parsed.status,
    redirectUrl: parsed.browserurl || null,
    pollUrl: parsed.pollurl || null,
    instructions: parsed.instructions || null,
  };
}

/** Polls a Paynow transaction status URL to check if payment succeeded. */
export async function pollPaynowStatus(pollUrl: string): Promise<string> {
  if (isMock()) return "Paid";
  const res = await fetch(pollUrl, { method: "POST" });
  const parsed = parsePaynowResponse(await res.text());
  return parsed.status || "Unknown";
}
