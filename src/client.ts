import { randomUUID } from "node:crypto";
import type { operations, paths } from "./generated/openapi.js";
import { PitchAPIError } from "./errors.js";

type Path = keyof paths;
type Method<P extends Path> = Extract<keyof paths[P], "get" | "post" | "put" | "patch" | "delete">;
type JSONBody<P extends Path, M extends Method<P>> = paths[P][M] extends {
  requestBody: { content: { "application/json": infer Body } };
} ? Body : paths[P][M] extends {
  requestBody?: { content: { "application/json": infer Body } };
} ? Body : never;

type SuccessStatus = 200 | 201 | 202 | 204;
type JSONContent<Response> = Response extends { content: { "application/json": infer Body } } ? Body : void;
export type SuccessResponse<OperationID extends keyof operations> = {
  [Status in keyof operations[OperationID]["responses"]]: Status extends SuccessStatus
    ? JSONContent<operations[OperationID]["responses"][Status]>
    : never;
}[keyof operations[OperationID]["responses"]];

interface PitchClientBaseOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  userAgent?: string;
  allowInsecureLocalhost?: boolean;
}

export type PitchClientOptions = PitchClientBaseOptions & (
  | { apiKey: string; bearerToken?: never }
  | { bearerToken: string; apiKey?: never }
);

export interface RequestOptions {
  correlationId?: string | undefined;
  signal?: AbortSignal | undefined;
}

type Query = Record<string, string | number | boolean | undefined>;
type InternalRequestOptions = RequestOptions & {
  idempotencyKey?: string | undefined;
  query?: Query | undefined;
};

export class PitchClient {
  readonly devices;
  readonly announcements;
  readonly events;
  readonly deliveries;
  readonly webhooks;
  readonly controls;
  readonly zones;
  readonly targetBindings;
  readonly schedules;

  readonly #baseUrl: URL;
  readonly #apiKey: string | undefined;
  readonly #bearerToken: string | undefined;
  readonly #fetch: typeof globalThis.fetch;
  readonly #userAgent: string | undefined;

  constructor(options: PitchClientOptions) {
    const baseUrl = new URL(options.baseUrl);
    const local = baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1" || baseUrl.hostname === "[::1]";
    if (baseUrl.protocol !== "https:" && !(baseUrl.protocol === "http:" && local && options.allowInsecureLocalhost === true)) {
      throw new TypeError("PITCH baseUrl must use HTTPS (localhost HTTP requires allowInsecureLocalhost)");
    }
    if (baseUrl.username || baseUrl.password) throw new TypeError("PITCH baseUrl must not contain credentials");
    const apiKey = options.apiKey;
    const bearerToken = options.bearerToken;
    if (apiKey !== undefined && !apiKey.trim()) throw new TypeError("PITCH apiKey must not be empty");
    if (bearerToken !== undefined && !bearerToken.trim()) throw new TypeError("PITCH bearerToken must not be empty");
    if ((apiKey === undefined) === (bearerToken === undefined)) throw new TypeError("Provide exactly one of apiKey or bearerToken");
    this.#baseUrl = new URL(baseUrl.toString().replace(/\/?$/, "/"));
    this.#apiKey = apiKey;
    this.#bearerToken = bearerToken;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#userAgent = options.userAgent;

    this.devices = {
      list: (query?: Query, options?: RequestOptions) => this.request<"listDevices">("GET", "/v1/devices", undefined, { ...options, query }),
      get: (deviceId: string, options?: RequestOptions) => this.request<"getDevice">("GET", `/v1/devices/${segment(deviceId)}`, undefined, options),
      preflightTargets: (body: JSONBody<"/v1/targets/preflight", "post">, options?: RequestOptions) => this.request<"preflightTargets">("POST", "/v1/targets/preflight", body, options),
    };
    this.announcements = {
      announceInstant: (body: JSONBody<"/v1/announce", "post">, idempotencyKey: string, options?: RequestOptions) => this.requiredIdempotent<"createInstantAnnouncement">("POST", "/v1/announce", body, idempotencyKey, options),
      list: (query?: Query, options?: RequestOptions) => this.request<"listAnnouncements">("GET", "/v1/announcements", undefined, { ...options, query }),
      create: (body: JSONBody<"/v1/announcements", "post">, idempotencyKey: string, options?: RequestOptions) => this.requiredIdempotent<"createAnnouncement">("POST", "/v1/announcements", body, idempotencyKey, options),
      get: (announcementId: string, options?: RequestOptions) => this.request<"getAnnouncement">("GET", `/v1/announcements/${segment(announcementId)}`, undefined, options),
      updateStatus: (announcementId: string, body: JSONBody<"/v1/announcements/{announcementId}/status", "patch">, options?: RequestOptions) => this.request<"updateAnnouncementStatus">("PATCH", `/v1/announcements/${segment(announcementId)}/status`, body, options),
      activate: (announcementId: string, body?: JSONBody<"/v1/announcements/{announcementId}/activate", "post">, options?: RequestOptions) => this.request<"activateAnnouncement">("POST", `/v1/announcements/${segment(announcementId)}/activate`, body, options),
      delete: (announcementId: string, options?: RequestOptions) => this.request<"deleteAnnouncement">("DELETE", `/v1/announcements/${segment(announcementId)}`, undefined, options),

      // Compatibility aliases retained for the original pre-1.0 SDK shape.
      updateSchedule: (announcementId: string, body: JSONBody<"/v1/schedules/{announcementId}", "patch">, options?: RequestOptions) => this.request<"updateSchedule">("PATCH", `/v1/schedules/${segment(announcementId)}`, body, options),
      preview: (body: JSONBody<"/v1/schedules/preview", "post">, options?: RequestOptions) => this.request<"previewSchedule">("POST", "/v1/schedules/preview", body, options),
      pause: (announcementId: string, options?: RequestOptions) => this.request<"updateScheduleStatus">("PATCH", `/v1/schedules/${segment(announcementId)}/status`, { status: "paused" }, options),
      deleteSchedule: (announcementId: string, options?: RequestOptions) => this.request<"deleteSchedule">("DELETE", `/v1/schedules/${segment(announcementId)}`, undefined, options),
    };
    this.schedules = {
      list: (query?: Query, options?: RequestOptions) => this.request<"listSchedules">("GET", "/v1/schedules", undefined, { ...options, query }),
      update: (announcementId: string, body: JSONBody<"/v1/schedules/{announcementId}", "patch">, options?: RequestOptions) => this.request<"updateSchedule">("PATCH", `/v1/schedules/${segment(announcementId)}`, body, options),
      preview: (body: JSONBody<"/v1/schedules/preview", "post">, options?: RequestOptions) => this.request<"previewSchedule">("POST", "/v1/schedules/preview", body, options),
      updateStatus: (announcementId: string, body: JSONBody<"/v1/schedules/{announcementId}/status", "patch">, options?: RequestOptions) => this.request<"updateScheduleStatus">("PATCH", `/v1/schedules/${segment(announcementId)}/status`, body, options),
      pause: (announcementId: string, options?: RequestOptions) => this.request<"updateScheduleStatus">("PATCH", `/v1/schedules/${segment(announcementId)}/status`, { status: "paused" }, options),
      resume: (announcementId: string, options?: RequestOptions) => this.request<"updateScheduleStatus">("PATCH", `/v1/schedules/${segment(announcementId)}/status`, { status: "active" }, options),
      delete: (announcementId: string, options?: RequestOptions) => this.request<"deleteSchedule">("DELETE", `/v1/schedules/${segment(announcementId)}`, undefined, options),
    };
    this.events = {
      createDefinition: (body: JSONBody<"/v1/announcements", "post">, idempotencyKey: string, options?: RequestOptions) => this.requiredIdempotent<"createAnnouncement">("POST", "/v1/announcements", body, idempotencyKey, options),
      publish: (body: JSONBody<"/v1/events", "post">, idempotencyKey?: string, options?: RequestOptions) => {
        const event = body as { event_id?: string };
        return this.requiredIdempotent<"publishEvent">("POST", "/v1/events", body, idempotencyKey ?? event.event_id ?? "", options);
      },
      ingestLegacy: (body: JSONBody<"/v1/webhooks/ingest", "post">, idempotencyKey?: string, options?: RequestOptions) => this.request<"ingestLegacyWebhookEvent">("POST", "/v1/webhooks/ingest", body, { ...options, idempotencyKey }),
      getOccurrence: (occurrenceId: string, options?: RequestOptions) => this.request<"getEventOccurrence">("GET", `/v1/event-occurrences/${segment(occurrenceId)}`, undefined, options),
      listOccurrences: (query?: Query, options?: RequestOptions) => this.request<"listEventOccurrences">("GET", "/v1/event-occurrences", undefined, { ...options, query }),
    };
    this.deliveries = {
      list: (query?: Query, options?: RequestOptions) => this.request<"listDeliveryLogs">("GET", "/v1/logs/deliveries", undefined, { ...options, query }),
      getTrace: (correlationId: string, options?: RequestOptions) => this.request<"getDeliveryTrace">("GET", `/v1/logs/deliveries/trace/${segment(correlationId)}`, undefined, options),
    };
    this.webhooks = {
      create: (body: JSONBody<"/v1/webhooks", "post">, options?: RequestOptions) => this.request<"createWebhook">("POST", "/v1/webhooks", body, options),
      list: (options?: RequestOptions) => this.request<"listWebhooks">("GET", "/v1/webhooks", undefined, options),
      update: (id: string, body: JSONBody<"/v1/webhooks/{id}", "patch">, options?: RequestOptions) => this.request<"updateWebhook">("PATCH", `/v1/webhooks/${segment(id)}`, body, options),
      delete: (id: string, options?: RequestOptions) => this.request<"deleteWebhook">("DELETE", `/v1/webhooks/${segment(id)}`, undefined, options),
      rotateSecret: (id: string, options?: RequestOptions) => this.request<"rotateWebhookSecret">("POST", `/v1/webhooks/${segment(id)}/rotate-secret`, undefined, options),
      test: (id: string, options?: RequestOptions) => this.request<"testWebhook">("POST", `/v1/webhooks/${segment(id)}/test`, undefined, options),
      listDeliveries: (id: string, options?: RequestOptions) => this.request<"listWebhookDeliveries">("GET", `/v1/webhooks/${segment(id)}/deliveries`, undefined, options),
    };
    this.controls = {
      create: (body: JSONBody<"/v1/output-controls", "post">, idempotencyKey: string, options?: RequestOptions) => this.requiredIdempotent<"createOutputControl">("POST", "/v1/output-controls", body, idempotencyKey, options),
      list: (query?: Query, options?: RequestOptions) => this.request<"listOutputControls">("GET", "/v1/output-controls", undefined, { ...options, query }),
      get: (controlId: string, options?: RequestOptions) => this.request<"getOutputControl">("GET", `/v1/output-controls/${segment(controlId)}`, undefined, options),
    };
    this.zones = {
      create: (body: JSONBody<"/v1/zones", "post">, options?: RequestOptions) => this.request<"createOutputZone">("POST", "/v1/zones", body, options),
      list: (query?: Query, options?: RequestOptions) => this.request<"listOutputZones">("GET", "/v1/zones", undefined, { ...options, query }),
      get: (zoneId: string, options?: RequestOptions) => this.request<"getOutputZone">("GET", `/v1/zones/${segment(zoneId)}`, undefined, options),
      update: (zoneId: string, body: JSONBody<"/v1/zones/{zoneId}", "patch">, options?: RequestOptions) => this.request<"updateOutputZone">("PATCH", `/v1/zones/${segment(zoneId)}`, body, options),
      replaceMembers: (zoneId: string, body: JSONBody<"/v1/zones/{zoneId}/members", "put">, options?: RequestOptions) => this.request<"replaceOutputZoneMembers">("PUT", `/v1/zones/${segment(zoneId)}/members`, body, options),
      delete: (zoneId: string, options?: RequestOptions) => this.request<"deleteOutputZone">("DELETE", `/v1/zones/${segment(zoneId)}`, undefined, options),
      preflight: (zoneId: string, body: JSONBody<"/v1/zones/{zoneId}/preflight", "post">, options?: RequestOptions) => this.request<"preflightOutputZone">("POST", `/v1/zones/${segment(zoneId)}/preflight`, body, options),
    };
    this.targetBindings = {
      put: (namespace: string, externalId: string, body: JSONBody<"/v1/target-bindings/{namespace}/{externalId}", "put">, options?: RequestOptions) => this.request<"putTargetBinding">("PUT", bindingPath(namespace, externalId), body, options),
      get: (namespace: string, externalId: string, options?: RequestOptions) => this.request<"getTargetBinding">("GET", bindingPath(namespace, externalId), undefined, options),
      delete: (namespace: string, externalId: string, options?: RequestOptions) => this.request<"deleteTargetBinding">("DELETE", bindingPath(namespace, externalId), undefined, options),
    };
  }

  private requiredIdempotent<OperationID extends keyof operations>(method: string, path: string, body: unknown, key: string, options?: RequestOptions): Promise<SuccessResponse<OperationID>> {
    if (!key.trim()) throw new TypeError(`X-Idempotency-Key is required for ${method} ${path}`);
    return this.request<OperationID>(method, path, body, { ...options, idempotencyKey: key });
  }

  private async request<OperationID extends keyof operations>(method: string, path: string, body?: unknown, options: InternalRequestOptions = {}): Promise<SuccessResponse<OperationID>> {
    const url = new URL(path.replace(/^\//, ""), this.#baseUrl);
    for (const [name, value] of Object.entries(options.query ?? {})) if (value !== undefined) url.searchParams.set(name, String(value));
    const correlationId = options.correlationId ?? randomUUID();
    if (!correlationId.trim()) throw new TypeError("correlationId must not be empty");
    const headers = new Headers({
      Accept: "application/json",
      "X-Correlation-ID": correlationId,
    });
    if (this.#apiKey !== undefined) headers.set("X-Pitch-Key", this.#apiKey);
    if (this.#bearerToken !== undefined) headers.set("Authorization", `Bearer ${this.#bearerToken}`);
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (options.idempotencyKey !== undefined) headers.set("X-Idempotency-Key", options.idempotencyKey);
    if (this.#userAgent !== undefined) headers.set("User-Agent", this.#userAgent);
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    if (options.signal !== undefined) init.signal = options.signal;
    const response = await this.#fetch(url, init);
    const responseBody = await readBody(response);
    if (!response.ok) {
      const object = responseBody && typeof responseBody === "object" ? responseBody as Record<string, unknown> : {};
      const nested = object.error && typeof object.error === "object" ? object.error as Record<string, unknown> : object;
      throw new PitchAPIError(typeof nested.message === "string" ? nested.message : `PITCH request failed (${response.status})`, {
        status: response.status,
        code: typeof nested.code === "string" ? nested.code : undefined,
        details: nested.details,
        body: responseBody,
        correlationId: response.headers.get("X-Correlation-ID") ?? correlationId,
        retryAfter: response.headers.get("Retry-After") ?? undefined,
        rateLimit: {
          limit: response.headers.get("X-RateLimit-Limit") ?? undefined,
          remaining: response.headers.get("X-RateLimit-Remaining") ?? undefined,
        },
      });
    }
    return responseBody as SuccessResponse<OperationID>;
  }
}

function segment(value: string): string {
  if (!value) throw new TypeError("path identifier must not be empty");
  return encodeURIComponent(value);
}

function bindingPath(namespace: string, externalId: string): string {
  return `/v1/target-bindings/${segment(namespace)}/${segment(externalId)}`;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}
