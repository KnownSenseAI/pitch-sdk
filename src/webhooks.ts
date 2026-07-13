import { createHmac, timingSafeEqual } from "node:crypto";

export const PITCH_WEBHOOK_HEADERS = {
  signature: "X-Pitch-Signature",
  signatureVersion: "X-Pitch-Signature-Version",
  timestamp: "X-Pitch-Timestamp",
  event: "X-Pitch-Event",
} as const;

export const LEGACY_SMARTPA_WEBHOOK_HEADERS = {
  signature: "X-SmartPA-Signature",
  signatureVersion: "X-SmartPA-Signature-Version",
  timestamp: "X-SmartPA-Timestamp",
  event: "X-SmartPA-Event",
} as const;

export type WebhookHeaderSource = Headers | Record<string, string | string[] | undefined>;

export interface WebhookSignatureHeaders {
  timestamp: string;
  signature: string;
  version: string;
  event?: string;
}

/**
 * Read the current PITCH webhook headers, falling back to their legacy SmartPA
 * aliases. Conflicting aliases are rejected so an intermediary cannot make the
 * application and verifier interpret different values.
 */
export function readWebhookSignatureHeaders(headers: WebhookHeaderSource): WebhookSignatureHeaders | null {
  const timestamp = readCompatibleHeader(headers, PITCH_WEBHOOK_HEADERS.timestamp, LEGACY_SMARTPA_WEBHOOK_HEADERS.timestamp);
  const signature = readCompatibleHeader(headers, PITCH_WEBHOOK_HEADERS.signature, LEGACY_SMARTPA_WEBHOOK_HEADERS.signature);
  const version = readCompatibleHeader(headers, PITCH_WEBHOOK_HEADERS.signatureVersion, LEGACY_SMARTPA_WEBHOOK_HEADERS.signatureVersion);
  const event = readCompatibleHeader(headers, PITCH_WEBHOOK_HEADERS.event, LEGACY_SMARTPA_WEBHOOK_HEADERS.event);
  if (timestamp === null || signature === null || version === null || event === null) return null;
  if (timestamp === "" || signature === "" || version === "") return null;
  return event === "" ? { timestamp, signature, version } : { timestamp, signature, version, event };
}

function readCompatibleHeader(headers: WebhookHeaderSource, pitchName: string, legacyName: string): string | null {
  const pitch = readHeader(headers, pitchName);
  const legacy = readHeader(headers, legacyName);
  if (pitch !== "" && legacy !== "" && pitch !== legacy) return null;
  return pitch || legacy;
}

function readHeader(headers: WebhookHeaderSource, name: string): string {
  if (headers instanceof Headers) return headers.get(name)?.trim() ?? "";
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const value = key === undefined ? undefined : headers[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export interface VerifyWebhookOptions {
  secret: string | Uint8Array;
  body: string | Uint8Array;
  timestamp: string;
  signature: string;
  version: string;
  toleranceSeconds?: number;
  now?: Date | number;
}

/** Verify PITCH webhook signature v1 over timestamp + '.' + the exact raw body. */
export function verifyWebhookSignature(options: VerifyWebhookOptions): boolean {
  if (typeof options.secret === "string" ? options.secret.length === 0 : options.secret.byteLength === 0) return false;
  if (options.version !== "v1" || !/^\d+$/.test(options.timestamp)) return false;
  if (!/^sha256=[0-9a-fA-F]{64}$/.test(options.signature)) return false;
  const timestamp = Number(options.timestamp);
  if (!Number.isSafeInteger(timestamp)) return false;
  const nowSeconds = options.now instanceof Date
    ? Math.floor(options.now.getTime() / 1000)
    : Math.floor((options.now ?? Date.now()) / (typeof options.now === "number" && options.now < 10_000_000_000 ? 1 : 1000));
  const tolerance = options.toleranceSeconds ?? 300;
  if (!Number.isFinite(nowSeconds) || !Number.isFinite(tolerance) || tolerance < 0 || Math.abs(nowSeconds - timestamp) > tolerance) return false;

  const hmac = createHmac("sha256", options.secret);
  hmac.update(options.timestamp);
  hmac.update(".");
  hmac.update(options.body);
  const expected = hmac.digest();
  const supplied = Buffer.from(options.signature.slice("sha256=".length), "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
