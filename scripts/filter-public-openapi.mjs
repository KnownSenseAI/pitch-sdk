import { isDeepStrictEqual } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";

const sourcePath = process.argv[2];
const mode = process.argv[3];
if (!sourcePath || (mode !== "--write" && mode !== "--check")) {
  console.error("usage: node scripts/filter-public-openapi.mjs <openapi.yaml> --write|--check");
  process.exit(2);
}

const source = parse(readFileSync(sourcePath, "utf8"));
const filtered = publicContract(source);

if (mode === "--check") {
  if (!isDeepStrictEqual(source, filtered)) {
    console.error("public OpenAPI contains non-partner paths, development servers, or unreachable components");
    process.exit(1);
  }
} else {
  writeFileSync(sourcePath, stringify(filtered, { lineWidth: 0 }));
}

function publicContract(document) {
  const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
  const paths = {};

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    const publicItem = {};
    for (const [key, value] of Object.entries(item ?? {})) {
      if (methods.has(key) && value?.["x-pitch-partner"] === true) {
        publicItem[key] = structuredClone(value);
        if (Array.isArray(publicItem[key].security)) {
          publicItem[key].security = preferApiKey(publicItem[key].security);
        }
      }
    }
    if (Object.keys(publicItem).length > 0) paths[path] = publicItem;
  }

  const securityNames = new Set();
  collectSecurityNames(document.security, securityNames);
  for (const item of Object.values(paths)) {
    for (const operation of Object.values(item)) collectSecurityNames(operation.security, securityNames);
  }

  const components = {};
  const visited = new Set();
  const pending = [];
  collectRefs(paths, pending);

  while (pending.length > 0) {
    const ref = pending.pop();
    if (visited.has(ref)) continue;
    visited.add(ref);
    const match = /^#\/components\/([^/]+)\/(.+)$/.exec(ref);
    if (!match) continue;
    const [, category, encodedName] = match;
    const name = decodePointer(encodedName);
    const value = document.components?.[category]?.[name];
    if (value === undefined) throw new Error(`unresolved component reference: ${ref}`);
    components[category] ??= {};
    components[category][name] = structuredClone(value);
    collectRefs(value, pending);
  }

  for (const name of securityNames) {
    const value = document.components?.securitySchemes?.[name];
    if (value === undefined) throw new Error(`unresolved security scheme: ${name}`);
    components.securitySchemes ??= {};
    components.securitySchemes[name] = structuredClone(value);
  }

  sanitizePublicComponents(components);
  rewriteDescriptions(paths);

  return {
    ...document,
    security: preferApiKey(document.security ?? []),
    servers: (document.servers ?? []).filter((server) => server.description === "Production"),
    paths,
    components,
  };
}

function sanitizePublicComponents(components) {
  const schemas = components.schemas ?? {};

  keepProperties(schemas.Device, [
    "id", "name", "group_id", "audio_outputs", "status",
    "last_seen", "firmware_version", "content_readiness", "timezone", "version",
    "created_at", "updated_at",
  ]);
  keepProperties(schemas.AudioOutputSlot, [
    "id", "label", "enabled", "ready",
    "supports_independent_playback", "supports_parallel_cached_playback",
    "supports_parallel_mixed_playback", "supports_parallel_live_playback",
    "volume", "playback_active", "last_reported_at", "targetable", "available",
    "availability_reason",
  ]);
  keepProperties(schemas.DecisionPreviewCandidateDevice, [
    "id", "known", "supports_offline_schedule", "supports_offline_schedule_known",
    "max_audio_bytes", "max_duration_ms",
  ]);
  removeProperties(schemas.DecisionPreviewCandidate, ["cache"]);
  delete schemas.DecisionPreviewCandidateCache;
  removeProperties(schemas.DecisionPreviewCandidateContent, ["codec"]);
  removeProperties(schemas.Announcement, ["tenant_id", "created_by"]);
  removeProperties(schemas.Webhook, ["tenant_id"]);
  removeProperties(schemas.WebhookDeliveryLog, ["tenant_id"]);
  removeProperties(schemas.TargetBinding, ["created_by"]);
  removeProperties(schemas.OutputZone, ["created_by"]);

  const historyItem = schemas.Announcement?.properties?.status_history?.items;
  removeProperties(historyItem, ["changed_by"]);

  if (schemas.TriggerConfig?.properties?.type?.enum) {
    schemas.TriggerConfig.properties.type.enum = schemas.TriggerConfig.properties.type.enum.filter(
      (value) => !["geo_triggered", "sensor_triggered", "subscription", "interactive"].includes(value),
    );
  }

  if (schemas.ErrorResponse?.properties?.error?.properties?.details) {
    schemas.ErrorResponse.properties.error.properties.details.example = {
      validation_issues: [{
        code: "unsupported_value",
        severity: "warning",
        message: "The requested value is not supported.",
        field: "content_config.type",
      }],
    };
  }
  if (schemas.ErrorResponse?.properties?.error?.properties?.message) {
    schemas.ErrorResponse.properties.error.properties.message.example = "authentication context is missing";
  }

  if (schemas.WebhookDeliveryLog?.properties?.attempt_number) {
    schemas.WebhookDeliveryLog.properties.attempt_number.description = "Current delivery attempt number, starting at 1.";
  }
  if (schemas.OutputControlResult?.properties?.decision_id) {
    schemas.OutputControlResult.properties.decision_id.description = "Durable decision identifier for emergency playback proof.";
  }
  if (schemas.AnnouncementCreateRequest?.properties?.content_config) {
    schemas.AnnouncementCreateRequest.properties.content_config.description = "Announcement content configuration, such as an uploaded asset, HTTPS audio, text-to-speech, or chained content. Event-driven announcements require durable playable content; prefer asset_id, and include a checksum for URL content.";
  }
  if (schemas.AudioOutputSlot) {
    schemas.AudioOutputSlot.description = "Child audio output target on a physical device. When a request names a device without output_id, the PITCH service targets the main output slot.";
  }
  if (schemas.Device?.properties?.id) {
    schemas.Device.properties.id.example = "pitch_device_001";
  }
  if (components.securitySchemes?.bearerAuth) {
    components.securitySchemes.bearerAuth.bearerFormat = "PITCH access token";
    components.securitySchemes.bearerAuth.description = "PITCH access token for supported owner/admin operations.";
  }

  rewriteDescriptions(components);
}

function keepProperties(schema, names) {
  if (!schema?.properties) return;
  const allowed = new Set(names);
  for (const name of Object.keys(schema.properties)) {
    if (!allowed.has(name)) delete schema.properties[name];
  }
  trimRequired(schema);
}

function removeProperties(schema, names) {
  if (!schema?.properties) return;
  for (const name of names) delete schema.properties[name];
  trimRequired(schema);
}

function trimRequired(schema) {
  if (!Array.isArray(schema?.required)) return;
  schema.required = schema.required.filter((name) => Object.hasOwn(schema.properties ?? {}, name));
  if (schema.required.length === 0) delete schema.required;
}

function rewriteDescriptions(value) {
  if (Array.isArray(value)) {
    for (const item of value) rewriteDescriptions(item);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if ((key === "description" || key === "summary") && typeof child === "string") {
      value[key] = child
        .replaceAll("Current River delivery", "Current delivery")
        .replaceAll("current backend", "current PITCH service")
        .replaceAll("The backend", "The PITCH service")
        .replaceAll("the backend", "the PITCH service")
        .replaceAll("Backend ", "PITCH service ")
        .replaceAll("PITCH JWT", "PITCH access token")
        .replaceAll("JWT auth", "access-token authentication")
        .replaceAll("JWT role", "access token")
        .replaceAll("Tenant-owned", "Customer-owned")
        .replaceAll("tenant-owned", "customer-owned")
        .replaceAll("tenant-scoped", "customer-scoped")
        .replaceAll("Tenant device", "Device")
        .replaceAll("tenant devices", "devices")
        .replaceAll("tenant output", "output")
        .replaceAll("Tenant webhooks", "Webhook endpoints")
        .replaceAll("authenticated tenant", "authenticated customer")
        .replaceAll("inside the tenant", "for the customer");
    } else {
      rewriteDescriptions(child);
    }
  }
}

function preferApiKey(security) {
  return [...security].sort((left, right) => Number("apiKeyAuth" in right) - Number("apiKeyAuth" in left));
}

function collectRefs(value, pending) {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, pending);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (typeof value.$ref === "string") pending.push(value.$ref);
  for (const child of Object.values(value)) collectRefs(child, pending);
}

function collectSecurityNames(security, names) {
  for (const requirement of security ?? []) {
    for (const name of Object.keys(requirement)) names.add(name);
  }
}

function decodePointer(value) {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}
