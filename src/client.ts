import { randomUUID } from "node:crypto";
import type { components, operations, paths } from "./generated/openapi.js";
import { PitchAPIError } from "./errors.js";

type Path = keyof paths;
type Method<P extends Path> = Extract<keyof paths[P], "get" | "post" | "put" | "patch" | "delete">;
type JSONBody<P extends Path, M extends Method<P>> = paths[P][M] extends {
  requestBody: { content: { "application/json": infer Body } };
} ? Body : paths[P][M] extends {
  requestBody?: { content: { "application/json": infer Body } };
} ? Body : never;

type SuccessStatus = 200 | 201 | 202 | 204 | 207;
type JSONContent<Response> = Response extends { content: { "application/json": infer Body } } ? Body : void;
export type SuccessResponse<OperationID extends keyof operations> = {
  [Status in keyof operations[OperationID]["responses"]]: Status extends SuccessStatus
    ? JSONContent<operations[OperationID]["responses"][Status]>
    : never;
}[keyof operations[OperationID]["responses"]];

type OperationQuery<OperationID extends keyof operations> =
  NonNullable<operations[OperationID]["parameters"]["query"]>;

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

export type DeliveryListQuery = OperationQuery<"listDeliveryLogs">;
type DeliveryTraceQuery = OperationQuery<"getDeliveryTrace">;
export type DeliveryTraceOptions = RequestOptions & DeliveryTraceQuery;

export interface AudioUploadInput {
  file: Blob;
  filename: string;
  metadata: components["schemas"]["AudioUploadMetadata"];
}

export interface AudioBulkUploadFile {
  file: Blob;
  filename: string;
}

export interface AudioBulkUploadInput {
  files: AudioBulkUploadFile[];
  metadata?: {
    defaults?: Partial<components["schemas"]["AudioUploadMetadata"]>;
    items?: Array<Partial<components["schemas"]["AudioUploadMetadata"]>>;
  };
}

export type PronunciationTermKey = OperationQuery<"deleteTTSPronunciationTerm">;

type Query = Record<string, string | number | boolean | undefined>;
const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_BULK_UPLOAD_FILES = 5;
const MAX_BULK_RAW_UPLOAD_BYTES = 125 * 1024 * 1024;
type InternalRequestOptions = RequestOptions & {
  idempotencyKey?: string | undefined;
  query?: Query | undefined;
};

export class PitchClient {
  readonly audio;
  readonly tts;
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

    this.audio = {
      list: (query?: Query, options?: RequestOptions) => this.request<"listAudioAssets">("GET", "/v1/audio", undefined, { ...options, query }),
      get: (id: string, options?: RequestOptions) => this.request<"getAudioAsset">("GET", `/v1/audio/${segment(id)}`, undefined, options),
      upload: (input: AudioUploadInput, options?: RequestOptions) => {
        if (!(input.file instanceof Blob)) throw new TypeError("audio upload file must be a Blob");
        if (input.file.size === 0) throw new RangeError("audio upload file must not be empty");
        if (input.file.size > MAX_AUDIO_UPLOAD_BYTES) throw new RangeError("audio upload file must not exceed 25 MiB");
        if (!input.filename.trim()) throw new TypeError("audio upload filename must not be empty");
        if (!input.metadata.name.trim()) throw new TypeError("audio upload metadata.name must not be empty");
        const form = new FormData();
        form.append("file", input.file, input.filename);
        form.append("metadata", JSON.stringify(input.metadata));
        return this.request<"uploadAudioAsset">("POST", "/v1/audio", form, options);
      },
      bulkUpload: (input: AudioBulkUploadInput, options?: RequestOptions) => {
        if (input.files.length === 0) throw new TypeError("audio bulk upload requires at least one file");
        if (input.files.length > MAX_BULK_UPLOAD_FILES) throw new RangeError("audio bulk upload supports at most 5 files");
        let rawUploadBytes = 0;
        for (const item of input.files) {
          if (!(item.file instanceof Blob)) throw new TypeError("audio bulk upload files must be Blob instances");
          if (item.file.size === 0) throw new RangeError("audio bulk upload files must not be empty");
          if (item.file.size > MAX_AUDIO_UPLOAD_BYTES) throw new RangeError("audio bulk upload files must not exceed 25 MiB each");
          if (!item.filename.trim()) throw new TypeError("audio bulk upload filenames must not be empty");
          rawUploadBytes += item.file.size;
        }
        if (rawUploadBytes > MAX_BULK_RAW_UPLOAD_BYTES) throw new RangeError("audio bulk upload raw file bytes must not exceed 125 MiB");
        for (const metadata of [input.metadata?.defaults, ...(input.metadata?.items ?? [])]) {
          if (metadata?.name !== undefined && !metadata.name.trim()) throw new TypeError("audio bulk upload metadata names must not be empty");
        }
        const form = new FormData();
        for (const item of input.files) form.append("files", item.file, item.filename);
        form.append("metadata", JSON.stringify(input.metadata ?? {}));
        return this.request<"bulkUploadAudioAssets">("POST", "/v1/audio/bulk-upload", form, options);
      },
      createFromTTS: (body: JSONBody<"/v1/audio/from-tts", "post">, options?: RequestOptions) => this.request<"createAudioFromTTS">("POST", "/v1/audio/from-tts", body, options),
      createFromTTSBatch: (body: JSONBody<"/v1/audio/from-tts-batch", "post">, options?: RequestOptions) => this.request<"createAudioFromTTSBatch">("POST", "/v1/audio/from-tts-batch", body, options),
      update: (id: string, body: JSONBody<"/v1/audio/{id}", "patch">, options?: RequestOptions) => this.request<"updateAudioAsset">("PATCH", `/v1/audio/${segment(id)}`, body, options),
      delete: (id: string, options?: RequestOptions) => this.request<"deleteAudioAsset">("DELETE", `/v1/audio/${segment(id)}`, undefined, options),
      download: (id: string, options?: RequestOptions) => this.request<"getAudioDownload">("GET", `/v1/audio/${segment(id)}/download`, undefined, options),
      move: (id: string, body: JSONBody<"/v1/audio/{id}/move", "post">, options?: RequestOptions) => this.request<"moveAudioAsset">("POST", `/v1/audio/${segment(id)}/move`, body, options),
      copy: (id: string, body: JSONBody<"/v1/audio/{id}/copy", "post">, options?: RequestOptions) => this.request<"copyAudioAsset">("POST", `/v1/audio/${segment(id)}/copy`, body, options),
      getEditContext: (id: string, options?: RequestOptions) => this.request<"getAudioTTSEditContext">("GET", `/v1/audio/${segment(id)}/edit-context`, undefined, options),
      createTTSRevision: (id: string, body: JSONBody<"/v1/audio/{id}/tts-revisions", "post">, options?: RequestOptions) => this.request<"createAudioTTSRevision">("POST", `/v1/audio/${segment(id)}/tts-revisions`, body, options),
      folders: {
        list: (query?: Query, options?: RequestOptions) => this.request<"listAudioFolders">("GET", "/v1/audio/folders", undefined, { ...options, query }),
        tree: (query?: Query, options?: RequestOptions) => this.request<"listAudioFolderTree">("GET", "/v1/audio/folders/tree", undefined, { ...options, query }),
        create: (body: JSONBody<"/v1/audio/folders", "post">, options?: RequestOptions) => this.request<"createAudioFolder">("POST", "/v1/audio/folders", body, options),
        rename: (id: string, body: JSONBody<"/v1/audio/folders/{folderId}", "patch">, options?: RequestOptions) => this.request<"renameAudioFolder">("PATCH", `/v1/audio/folders/${segment(id)}`, body, options),
        delete: (id: string, options?: RequestOptions) => this.request<"deleteAudioFolder">("DELETE", `/v1/audio/folders/${segment(id)}`, undefined, options),
      },
    };
    this.tts = {
      compose: (body: JSONBody<"/v1/tts/compose", "post">, options?: RequestOptions) => this.request<"composeTTS">("POST", "/v1/tts/compose", body, options),
      composeBatch: (body: JSONBody<"/v1/tts/compose-batch", "post">, options?: RequestOptions) => this.request<"composeTTSBatch">("POST", "/v1/tts/compose-batch", body, options),
      preview: (body: JSONBody<"/v1/tts/generate", "post">, options?: RequestOptions) => this.request<"generateTTSPreview">("POST", "/v1/tts/generate", body, options),
      previewBatch: (body: JSONBody<"/v1/tts/generate-batch", "post">, options?: RequestOptions) => this.request<"generateTTSPreviewBatch">("POST", "/v1/tts/generate-batch", body, options),
      pronunciation: {
        get: (options?: RequestOptions) => this.request<"getTTSPronunciation">("GET", "/v1/tts/pronunciation", undefined, options),
        upsertTerm: (body: JSONBody<"/v1/tts/pronunciation/terms", "put">, options?: RequestOptions) => this.request<"upsertTTSPronunciationTerm">("PUT", "/v1/tts/pronunciation/terms", body, options),
        deleteTerm: ({ language, word }: PronunciationTermKey, options?: RequestOptions) => this.request<"deleteTTSPronunciationTerm">("DELETE", "/v1/tts/pronunciation/terms", undefined, { ...options, query: { language, word } }),
        applyTemplate: (industry: string, options?: RequestOptions) => this.request<"applyTTSPronunciationTemplate">("POST", `/v1/tts/pronunciation/templates/${segment(industry)}/apply`, undefined, options),
      },
    };
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
      list: (query?: DeliveryListQuery, options?: RequestOptions) => this.request<"listDeliveryLogs">("GET", "/v1/logs/deliveries", undefined, { ...options, query }),
      getTrace: (correlationId: string, { limit, ...options }: DeliveryTraceOptions = {}) => this.request<"getDeliveryTrace">("GET", `/v1/logs/deliveries/trace/${segment(correlationId)}`, undefined, { ...options, query: { limit } }),
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
    if (body !== undefined && !(body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (options.idempotencyKey !== undefined) headers.set("X-Idempotency-Key", options.idempotencyKey);
    if (this.#userAgent !== undefined) headers.set("User-Agent", this.#userAgent);
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = body instanceof FormData ? body : JSON.stringify(body);
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
