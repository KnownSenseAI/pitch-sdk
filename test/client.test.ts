import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { PitchAPIError, PitchClient } from "../src/index.js";
import type { components } from "../src/generated/openapi.js";

type PublishReturnIsGenerated = ReturnType<PitchClient["events"]["publish"]> extends Promise<components["schemas"]["PartnerEventPublishResponse"]> ? true : never;
type DeviceReturnIsGenerated = ReturnType<PitchClient["devices"]["get"]> extends Promise<components["schemas"]["Device"]> ? true : never;
const typedSuccessAssertions: [PublishReturnIsGenerated, DeviceReturnIsGenerated] = [true, true];

function setup(response = new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
  const client = new PitchClient({ baseUrl: "http://localhost:8080", apiKey: "test-key", fetch, allowInsecureLocalhost: true });
  return { client, fetch };
}

describe("PitchClient", () => {
  it("keeps generated success response types", () => expect(typedSuccessAssertions).toEqual([true, true]));

  it("rejects insecure non-local base URLs", () => {
    expect(() => new PitchClient({ baseUrl: "http://example.com", apiKey: "key" })).toThrow(/HTTPS/);
  });

  it("rejects credentials embedded in the base URL", () => {
    expect(() => new PitchClient({ baseUrl: "https://user:secret@pitch.knownsense.ai", apiKey: "key" })).toThrow(/must not contain credentials/);
  });

  it("sends auth, JSON, correlation, route, and required idempotency headers", async () => {
    const { client, fetch } = setup();
    await client.events.publish({ event_type: "bus.stop.approaching", event_id: "event-1", occurred_at: "2026-07-12T00:00:00Z", interrupt_active: false });
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8080/v1/events");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("X-Pitch-Key")).toBe("test-key");
    expect(headers.has("X-SmartPA-Key")).toBe(false);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-Idempotency-Key")).toBe("event-1");
    expect(headers.get("X-Correlation-ID")).toBeTruthy();
    expect(JSON.parse(String(init?.body))).toMatchObject({ event_type: "bus.stop.approaching" });
  });

  it("supports server-side PITCH bearer auth without sending an API key", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const client = new PitchClient({ baseUrl: "https://pitch.knownsense.ai", bearerToken: "jwt-test-token", fetch });
    await client.webhooks.list();
    const headers = new Headers(fetch.mock.calls[0]![1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer jwt-test-token");
    expect(headers.has("X-Pitch-Key")).toBe(false);
  });

  it("encodes path segments and query values", async () => {
    const { client, fetch } = setup();
    await client.targetBindings.get("fleet source", "bus/12");
    expect(String(fetch.mock.calls[0]![0])).toBe("http://localhost:8080/v1/target-bindings/fleet%20source/bus%2F12");
  });

  it("forwards caller correlation IDs and abort signals", async () => {
    const { client, fetch } = setup();
    const controller = new AbortController();
    await client.devices.get("dev-1", { correlationId: "partner-trace-1", signal: controller.signal });
    const init = fetch.mock.calls[0]![1];
    expect(new Headers(init?.headers).get("X-Correlation-ID")).toBe("partner-trace-1");
    expect(init?.signal).toBe(controller.signal);
  });

  it("rejects an empty caller correlation ID", async () => {
    const { client } = setup();
    await expect(client.devices.get("dev-1", { correlationId: "  " })).rejects.toThrow(/correlationId/);
  });

  it("allows activation without an optional JSON body", async () => {
    const { client, fetch } = setup();
    await client.announcements.activate("announcement-1");
    const init = fetch.mock.calls[0]![1];
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });

  it("requires caller idempotency keys for unsafe creates", () => {
    const { client } = setup();
    expect(() => client.controls.create({} as never, "")).toThrow(/Idempotency/);
  });

  it("returns structured errors and operational headers without exposing the key", async () => {
    const body = { error: { code: "RATE_LIMITED", message: "slow down", details: { bucket: "tenant" } } };
    const { client } = setup(new Response(JSON.stringify(body), {
      status: 429,
      headers: { "Retry-After": "2", "X-RateLimit-Limit": "10", "X-RateLimit-Remaining": "0", "X-Correlation-ID": "corr-1" },
    }));
    const error = await client.devices.list().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(PitchAPIError);
    expect(error).toMatchObject({ message: "slow down", status: 429, code: "RATE_LIMITED", details: { bucket: "tenant" }, body, retryAfter: "2", correlationId: "corr-1", rateLimit: { limit: "10", remaining: "0" } });
    expect(String(error)).not.toContain("test-key");
  });

  it("keeps the request correlation ID when an error response does not echo it", async () => {
    const { client } = setup(new Response(JSON.stringify({ error: { code: "FAILED", message: "failed" } }), { status: 503 }));
    await expect(client.devices.list(undefined, { correlationId: "request-corr-1" })).rejects.toMatchObject({ correlationId: "request-corr-1" });
  });

  it.each([400, 409, 422, 429, 503])("preserves structured %i errors", async (status) => {
    const body = { error: { code: `E_${status}`, message: "request failed", details: { status } } };
    const { client } = setup(new Response(JSON.stringify(body), { status }));
    await expect(client.devices.list()).rejects.toMatchObject({ status, code: `E_${status}`, message: "request failed", details: { status }, body });
  });

  it("does not include either selected credential in errors", async () => {
    for (const options of [{ apiKey: "api-secret" }, { bearerToken: "jwt-secret" }] as const) {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "forbidden" } }), { status: 403 }));
      const client = new PitchClient({ baseUrl: "https://pitch.knownsense.ai", fetch, ...options });
      const error = await client.devices.list().catch((value: unknown) => value);
      expect(String(error)).not.toContain("api-secret");
      expect(String(error)).not.toContain("jwt-secret");
    }
  });

  it("maps every public wrapper to its frozen method and route", async () => {
    const calls: Array<[string, string, (client: PitchClient) => Promise<unknown>, string | undefined]> = [
      ["GET", "/v1/devices", c => c.devices.list(), undefined],
      ["GET", "/v1/devices/dev%2F1", c => c.devices.get("dev/1"), undefined],
      ["POST", "/v1/targets/preflight", c => c.devices.preflightTargets({} as never), undefined],
      ["POST", "/v1/announce", c => c.announcements.announceInstant({} as never, "idem"), "idem"],
      ["GET", "/v1/announcements", c => c.announcements.list(), undefined],
      ["POST", "/v1/announcements", c => c.announcements.create({} as never, "idem"), "idem"],
      ["GET", "/v1/announcements/a1", c => c.announcements.get("a1"), undefined],
      ["PATCH", "/v1/announcements/a1/status", c => c.announcements.updateStatus("a1", { status: "paused" }), undefined],
      ["POST", "/v1/announcements/a1/activate", c => c.announcements.activate("a1"), undefined],
      ["DELETE", "/v1/announcements/a1", c => c.announcements.delete("a1"), undefined],
      ["PATCH", "/v1/schedules/a1", c => c.announcements.updateSchedule("a1", {} as never), undefined],
      ["POST", "/v1/schedules/preview", c => c.announcements.preview({} as never), undefined],
      ["PATCH", "/v1/schedules/a1/status", c => c.announcements.pause("a1"), undefined],
      ["DELETE", "/v1/schedules/a1", c => c.announcements.deleteSchedule("a1"), undefined],
      ["GET", "/v1/schedules", c => c.schedules.list(), undefined],
      ["PATCH", "/v1/schedules/a1", c => c.schedules.update("a1", {} as never), undefined],
      ["POST", "/v1/schedules/preview", c => c.schedules.preview({} as never), undefined],
      ["PATCH", "/v1/schedules/a1/status", c => c.schedules.updateStatus("a1", { status: "paused" }), undefined],
      ["PATCH", "/v1/schedules/a1/status", c => c.schedules.pause("a1"), undefined],
      ["PATCH", "/v1/schedules/a1/status", c => c.schedules.resume("a1"), undefined],
      ["DELETE", "/v1/schedules/a1", c => c.schedules.delete("a1"), undefined],
      ["POST", "/v1/announcements", c => c.events.createDefinition({} as never, "idem"), "idem"],
      ["POST", "/v1/events", c => c.events.publish({ event_id: "event-id" } as never), "event-id"],
      ["POST", "/v1/webhooks/ingest", c => c.events.ingestLegacy({ event: "doorbell.pressed" }), undefined],
      ["GET", "/v1/event-occurrences/o1", c => c.events.getOccurrence("o1"), undefined],
      ["GET", "/v1/event-occurrences", c => c.events.listOccurrences(), undefined],
      ["GET", "/v1/logs/deliveries", c => c.deliveries.list(), undefined],
      ["GET", "/v1/logs/deliveries/trace/c1", c => c.deliveries.getTrace("c1"), undefined],
      ["POST", "/v1/webhooks", c => c.webhooks.create({} as never), undefined],
      ["GET", "/v1/webhooks", c => c.webhooks.list(), undefined],
      ["PATCH", "/v1/webhooks/w1", c => c.webhooks.update("w1", {} as never), undefined],
      ["DELETE", "/v1/webhooks/w1", c => c.webhooks.delete("w1"), undefined],
      ["POST", "/v1/webhooks/w1/rotate-secret", c => c.webhooks.rotateSecret("w1"), undefined],
      ["POST", "/v1/webhooks/w1/test", c => c.webhooks.test("w1"), undefined],
      ["GET", "/v1/webhooks/w1/deliveries", c => c.webhooks.listDeliveries("w1"), undefined],
      ["POST", "/v1/output-controls", c => c.controls.create({} as never, "idem"), "idem"],
      ["GET", "/v1/output-controls", c => c.controls.list(), undefined],
      ["GET", "/v1/output-controls/c1", c => c.controls.get("c1"), undefined],
      ["POST", "/v1/zones", c => c.zones.create({} as never), undefined],
      ["GET", "/v1/zones", c => c.zones.list(), undefined],
      ["GET", "/v1/zones/z1", c => c.zones.get("z1"), undefined],
      ["PATCH", "/v1/zones/z1", c => c.zones.update("z1", {} as never), undefined],
      ["PUT", "/v1/zones/z1/members", c => c.zones.replaceMembers("z1", {} as never), undefined],
      ["DELETE", "/v1/zones/z1", c => c.zones.delete("z1"), undefined],
      ["POST", "/v1/zones/z1/preflight", c => c.zones.preflight("z1", {} as never), undefined],
      ["PUT", "/v1/target-bindings/ns/e1", c => c.targetBindings.put("ns", "e1", {} as never), undefined],
      ["GET", "/v1/target-bindings/ns/e1", c => c.targetBindings.get("ns", "e1"), undefined],
      ["DELETE", "/v1/target-bindings/ns/e1", c => c.targetBindings.delete("ns", "e1"), undefined],
    ];
    for (const [method, path, invoke, idempotencyKey] of calls) {
      const { client, fetch } = setup();
      await invoke(client);
      const [url, init] = fetch.mock.calls[0]!;
      expect(init?.method, path).toBe(method);
      expect(new URL(String(url)).pathname).toBe(path);
      const headers = new Headers(init?.headers);
      expect(headers.get("X-Pitch-Key"), path).toBe("test-key");
      expect(headers.get("X-Idempotency-Key"), path).toBe(idempotencyKey ?? null);
    }
  });

  it("wraps every operation in the production partner catalog", () => {
    const catalog = readFileSync(new URL("../openapi/pitch-v1.yaml", import.meta.url), "utf8");
    const clientSource = readFileSync(new URL("../src/client.ts", import.meta.url), "utf8");
    const document = parse(catalog) as {
      paths: Record<string, Record<string, { operationId?: string; "x-pitch-partner"?: boolean }>>;
    };
    const catalogOperationIds = Object.values(document.paths)
      .flatMap((path) => Object.values(path))
      .filter((operation) => operation["x-pitch-partner"] === true && operation.operationId !== undefined)
      .map((operation) => operation.operationId!)
      .sort();
    const wrappedOperationIds = [...new Set(
      [...clientSource.matchAll(/\b(?:request|requiredIdempotent)<"([^"]+)">/g)].map((match) => match[1]!),
    )].sort();
    expect(wrappedOperationIds).toEqual(catalogOperationIds);
  });
});
