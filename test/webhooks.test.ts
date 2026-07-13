import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readWebhookSignatureHeaders, verifyWebhookSignature } from "../src/webhooks.js";

const fixture = JSON.parse(readFileSync(new URL("../testdata/webhooks/signature_v1.json", import.meta.url), "utf8")) as {
  timestamp: number;
  body: string;
  key: string;
  headers: Record<string, string>;
};

const valid = () => ({
  secret: fixture.key,
  body: fixture.body,
  timestamp: fixture.headers["X-SmartPA-Timestamp"]!,
  signature: fixture.headers["X-SmartPA-Signature"]!,
  version: fixture.headers["X-SmartPA-Signature-Version"]!,
  now: fixture.timestamp,
});

describe("verifyWebhookSignature", () => {
  it("consumes the shared Go/TypeScript v1 fixture", () => expect(verifyWebhookSignature(valid())).toBe(true));
  it("accepts exact raw bytes", () => expect(verifyWebhookSignature({ ...valid(), body: Buffer.from(fixture.body) })).toBe(true));
  it.each([
    ["wrong body", { body: fixture.body + " " }],
    ["wrong secret", { secret: "wrong" }],
    ["empty string secret", { secret: "" }],
    ["empty byte secret", { secret: new Uint8Array() }],
    ["wrong version", { version: "v2" }],
    ["malformed signature", { signature: "sha256=nope" }],
    ["missing timestamp", { timestamp: "" }],
    ["stale", { now: fixture.timestamp + 301 }],
    ["future", { now: fixture.timestamp - 301 }],
    ["invalid Date clock", { now: new Date(Number.NaN) }],
    ["NaN clock", { now: Number.NaN }],
    ["infinite clock", { now: Number.POSITIVE_INFINITY }],
  ])("rejects %s", (_name, override) => expect(verifyWebhookSignature({ ...valid(), ...override })).toBe(false));
});

describe("readWebhookSignatureHeaders", () => {
  const pitchHeaders = {
    "x-pitch-timestamp": fixture.headers["X-SmartPA-Timestamp"],
    "x-pitch-signature": fixture.headers["X-SmartPA-Signature"],
    "x-pitch-signature-version": fixture.headers["X-SmartPA-Signature-Version"],
    "x-pitch-event": "delivery.completed",
  };

  it("reads PITCH headers case-insensitively", () => {
    expect(readWebhookSignatureHeaders(pitchHeaders)).toMatchObject({
      timestamp: valid().timestamp,
      signature: valid().signature,
      version: "v1",
      event: "delivery.completed",
    });
  });

  it("accepts legacy SmartPA aliases", () => {
    expect(readWebhookSignatureHeaders(fixture.headers)).toMatchObject({
      timestamp: valid().timestamp,
      signature: valid().signature,
      version: "v1",
    });
  });

  it("rejects conflicting aliases", () => {
    expect(readWebhookSignatureHeaders({ ...pitchHeaders, "X-SmartPA-Timestamp": "1" })).toBeNull();
  });
});
