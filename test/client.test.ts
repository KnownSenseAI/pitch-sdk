import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { PitchAPIError, PitchClient } from "../src/index.js";
import type { components } from "../src/generated/openapi.js";

type PublishReturnIsGenerated = ReturnType<PitchClient["events"]["publish"]> extends Promise<components["schemas"]["PartnerEventPublishResponse"]> ? true : never;
type DeviceReturnIsGenerated = ReturnType<PitchClient["devices"]["get"]> extends Promise<components["schemas"]["Device"]> ? true : never;
type FolderReturnIsGenerated = ReturnType<PitchClient["audio"]["folders"]["create"]> extends Promise<components["schemas"]["AudioFolder"]> ? true : never;
type PronunciationReturnIsGenerated = ReturnType<PitchClient["tts"]["pronunciation"]["get"]> extends Promise<components["schemas"]["TTSPronunciationSummary"]> ? true : never;
type EditContextReturnIsGenerated = ReturnType<PitchClient["audio"]["getEditContext"]> extends Promise<components["schemas"]["AudioTTSEditContext"]> ? true : never;
const typedSuccessAssertions: [PublishReturnIsGenerated, DeviceReturnIsGenerated, FolderReturnIsGenerated, PronunciationReturnIsGenerated, EditContextReturnIsGenerated] = [true, true, true, true, true];
const legacyBindingRequest: components["schemas"]["PutTargetBindingRequest"] = { zone_id: "00000000-0000-0000-0000-000000000001" };
const pinnedBindingRequest: components["schemas"]["PutTargetBindingRequest"] = {
  zone_id: "00000000-0000-0000-0000-000000000001",
  resolution_mode: "pinned_snapshot",
  expected_zone_version: 7,
  expected_target_hash: "a".repeat(64),
};

function setup(response = new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
  const client = new PitchClient({ baseUrl: "http://localhost:8080", apiKey: "test-key", fetch, allowInsecureLocalhost: true });
  return { client, fetch };
}

function blobWithReportedSize(size: number): Blob {
  const blob = new Blob(["test"]);
  Object.defineProperty(blob, "size", { value: size });
  return blob;
}

describe("PitchClient", () => {
  it("keeps generated success response types", () => expect(typedSuccessAssertions).toEqual([true, true, true, true, true]));

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

  it("keeps legacy live-zone requests valid and sends pinned snapshot preconditions", async () => {
    const legacy = setup();
    await legacy.client.targetBindings.put("legacy", "one", legacyBindingRequest);
    expect(JSON.parse(String(legacy.fetch.mock.calls[0]![1]?.body))).toEqual(legacyBindingRequest);
    const pinned = setup();
    await pinned.client.targetBindings.put("mobility.vehicle-assignment", "vehicle-1", pinnedBindingRequest);
    expect(JSON.parse(String(pinned.fetch.mock.calls[0]![1]?.body))).toEqual(pinnedBindingRequest);
  });

  it("serializes typed delivery list queries", async () => {
    const { client, fetch } = setup();
    await client.deliveries.list({
      announcement_id: "announcement-1",
      device_id: "device-1",
      output_id: "platform-left",
      correlation_id: "correlation-1",
      status: "received",
      limit: 25,
      cursor: "cursor-1",
    });

    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.pathname).toBe("/v1/logs/deliveries");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      announcement_id: "announcement-1",
      device_id: "device-1",
      output_id: "platform-left",
      correlation_id: "correlation-1",
      status: "received",
      limit: "25",
      cursor: "cursor-1",
    });
  });

  it("serializes delivery trace limits without changing request options", async () => {
    const { client, fetch } = setup();
    const controller = new AbortController();
    await client.deliveries.getTrace("corr/1", {
      limit: 200,
      correlationId: "request-1",
      signal: controller.signal,
    });

    const url = new URL(String(fetch.mock.calls[0]![0]));
    const init = fetch.mock.calls[0]![1];
    expect(url.pathname).toBe("/v1/logs/deliveries/trace/corr%2F1");
    expect(url.searchParams.get("limit")).toBe("200");
    expect(new Headers(init?.headers).get("X-Correlation-ID")).toBe("request-1");
    expect(init?.signal).toBe(controller.signal);

    const compatibility = setup();
    await compatibility.client.deliveries.getTrace("c1", { correlationId: "request-2" });
    const compatibilityUrl = new URL(String(compatibility.fetch.mock.calls[0]![0]));
    expect(compatibilityUrl.searchParams.has("limit")).toBe(false);
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

  it("uploads audio as multipart data without overriding the boundary header", async () => {
    const { client, fetch } = setup();
    await client.audio.upload({
      file: new Blob(["audio-bytes"], { type: "audio/ogg" }),
      filename: "notice.ogg",
      metadata: { name: "Passenger notice", lifecycle: "permanent" },
    });
    const init = fetch.mock.calls[0]![1];
    expect(init?.body).toBeInstanceOf(FormData);
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    const form = init?.body as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(JSON.parse(String(form.get("metadata")))).toEqual({ name: "Passenger notice", lifecycle: "permanent" });
  });

  it("bulk uploads repeated files and one JSON metadata part without overriding the boundary", async () => {
    const { client, fetch } = setup(new Response(JSON.stringify({ assets: [], errors: [], total: 2, succeeded: 2, failed: 0 }), { status: 207 }));
    const result = await client.audio.bulkUpload({
      files: [
        { file: new Blob(["one"]), filename: "one.ogg" },
        { file: new Blob(["two"]), filename: "two.ogg" },
      ],
      metadata: { defaults: { language: "en" }, items: [{ name: "One" }, { name: "Two" }] },
    });
    expect(result).toMatchObject({ total: 2 });
    const init = fetch.mock.calls[0]![1];
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    const form = init?.body as FormData;
    expect(form.getAll("files")).toHaveLength(2);
    expect(JSON.parse(String(form.get("metadata")))).toEqual({ defaults: { language: "en" }, items: [{ name: "One" }, { name: "Two" }] });
  });

  it("bulk uploads one empty JSON metadata part when overrides are omitted", async () => {
    const { client, fetch } = setup(new Response(JSON.stringify({ assets: [], errors: [], total: 1, succeeded: 1, failed: 0 }), { status: 207 }));
    await client.audio.bulkUpload({
      files: [{ file: new Blob(["one"]), filename: "one.ogg" }],
    });
    const init = fetch.mock.calls[0]![1];
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    const form = init?.body as FormData;
    expect(form.getAll("metadata")).toHaveLength(1);
    expect(JSON.parse(String(form.get("metadata")))).toEqual({});
  });

  it("rejects zero-byte single and bulk upload files before fetch", () => {
    const { client, fetch } = setup();
    expect(() => client.audio.upload({
      file: new Blob([]),
      filename: "empty.ogg",
      metadata: { name: "Empty", lifecycle: "permanent", source: "upload" },
    })).toThrow(/must not be empty/);
    expect(() => client.audio.bulkUpload({
      files: [{ file: new Blob([]), filename: "empty.ogg" }],
    })).toThrow(/must not be empty/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects single and bulk file items over 25 MiB without allocating them", () => {
    const { client, fetch } = setup();
    const oversized = blobWithReportedSize((25 * 1024 * 1024) + 1);
    expect(() => client.audio.upload({
      file: oversized,
      filename: "large.ogg",
      metadata: { name: "Large", lifecycle: "permanent", source: "upload" },
    })).toThrow(/must not exceed 25 MiB/);
    expect(() => client.audio.bulkUpload({
      files: [{ file: oversized, filename: "large.ogg" }],
    })).toThrow(/must not exceed 25 MiB each/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects bulk uploads with more than five files", () => {
    const { client, fetch } = setup();
    expect(() => client.audio.bulkUpload({
      files: Array.from({ length: 6 }, (_, index) => ({ file: new Blob(["x"]), filename: `${index}.ogg` })),
    })).toThrow(/at most 5 files/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts five bulk files reported at the 125 MiB aggregate boundary without allocating them", async () => {
    const { client, fetch } = setup(new Response(JSON.stringify({ assets: [], errors: [], total: 5, succeeded: 5, failed: 0 }), { status: 201 }));
    await client.audio.bulkUpload({
      files: Array.from({ length: 5 }, (_, index) => ({
        file: blobWithReportedSize(25 * 1024 * 1024),
        filename: `${index}.ogg`,
      })),
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(((fetch.mock.calls[0]![1]?.body) as FormData).getAll("files")).toHaveLength(5);
  });

  it("validates upload files and names before fetch", () => {
    const { client, fetch } = setup();
    expect(() => client.audio.upload({ file: {} as Blob, filename: "x.ogg", metadata: { name: "X" } })).toThrow(/Blob/);
    expect(() => client.audio.bulkUpload({ files: [{ file: new Blob(["x"]), filename: " " }] })).toThrow(/filenames/);
    expect(() => client.audio.bulkUpload({ files: [{ file: new Blob(["x"]), filename: "x.ogg" }], metadata: { items: [{ name: " " }] } })).toThrow(/names/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("encodes folder, asset, template, and pronunciation values", async () => {
    const { client, fetch } = setup(new Response(null, { status: 204 }));
    await client.audio.folders.rename("folder/one", { name: "Renamed" });
    await client.audio.get("asset/one");
    await client.tts.pronunciation.deleteTerm({ language: "en IN", word: "A&B" });
    await client.tts.pronunciation.applyTemplate("public transport/rail");
    expect(String(fetch.mock.calls[0]![0])).toContain("/v1/audio/folders/folder%2Fone");
    expect(String(fetch.mock.calls[1]![0])).toContain("/v1/audio/asset%2Fone");
    const pronunciationURL = new URL(String(fetch.mock.calls[2]![0]));
    expect(pronunciationURL.searchParams.get("language")).toBe("en IN");
    expect(pronunciationURL.searchParams.get("word")).toBe("A&B");
    expect(String(fetch.mock.calls[3]![0])).toContain("public%20transport%2Frail/apply");
  });

  it("treats empty 204 delete responses as successful", async () => {
    const { client } = setup(new Response(null, { status: 204 }));
    await expect(client.audio.delete("asset-1")).resolves.toBeUndefined();
    await expect(client.audio.folders.delete("folder-1")).resolves.toBeUndefined();
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
      ["POST", "/v1/tts/compose", c => c.tts.compose({} as never), undefined],
      ["POST", "/v1/tts/compose-batch", c => c.tts.composeBatch({} as never), undefined],
      ["POST", "/v1/tts/generate", c => c.tts.preview({ text: "Next stop", language: "en" }), undefined],
      ["POST", "/v1/tts/generate-batch", c => c.tts.previewBatch({} as never), undefined],
      ["GET", "/v1/tts/pronunciation", c => c.tts.pronunciation.get(), undefined],
      ["PUT", "/v1/tts/pronunciation/terms", c => c.tts.pronunciation.upsertTerm({ language: "en", word: "PITCH", pronunciation: "pitch" }), undefined],
      ["DELETE", "/v1/tts/pronunciation/terms", c => c.tts.pronunciation.deleteTerm({ language: "en", word: "PITCH" }), undefined],
      ["POST", "/v1/tts/pronunciation/templates/transit/apply", c => c.tts.pronunciation.applyTemplate("transit"), undefined],
      ["GET", "/v1/audio", c => c.audio.list(), undefined],
      ["GET", "/v1/audio/a1", c => c.audio.get("a1"), undefined],
      ["POST", "/v1/audio", c => c.audio.upload({ file: new Blob(["audio"]), filename: "audio.ogg", metadata: { name: "Audio" } }), undefined],
      ["POST", "/v1/audio/bulk-upload", c => c.audio.bulkUpload({ files: [{ file: new Blob(["audio"]), filename: "audio.ogg" }] }), undefined],
      ["POST", "/v1/audio/from-tts", c => c.audio.createFromTTS({ text: "Next stop", language: "en" }), undefined],
      ["POST", "/v1/audio/from-tts-batch", c => c.audio.createFromTTSBatch({} as never), undefined],
      ["PATCH", "/v1/audio/a1", c => c.audio.update("a1", { name: "Updated" }), undefined],
      ["DELETE", "/v1/audio/a1", c => c.audio.delete("a1"), undefined],
      ["GET", "/v1/audio/a1/download", c => c.audio.download("a1"), undefined],
      ["POST", "/v1/audio/a1/move", c => c.audio.move("a1", {} as never), undefined],
      ["POST", "/v1/audio/a1/copy", c => c.audio.copy("a1", {} as never), undefined],
      ["GET", "/v1/audio/a1/edit-context", c => c.audio.getEditContext("a1"), undefined],
      ["POST", "/v1/audio/a1/tts-revisions", c => c.audio.createTTSRevision("a1", {} as never), undefined],
      ["GET", "/v1/audio/folders", c => c.audio.folders.list(), undefined],
      ["GET", "/v1/audio/folders/tree", c => c.audio.folders.tree(), undefined],
      ["POST", "/v1/audio/folders", c => c.audio.folders.create({ name: "Folder" }), undefined],
      ["PATCH", "/v1/audio/folders/f1", c => c.audio.folders.rename("f1", { name: "Renamed" }), undefined],
      ["DELETE", "/v1/audio/folders/f1", c => c.audio.folders.delete("f1"), undefined],
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
