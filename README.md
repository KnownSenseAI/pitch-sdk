# PITCH TypeScript SDK

The official server-side Node.js SDK for the PITCH Partner API v1. It supports Node.js 22+ and ESM.

## Install

Until an npm-registry release is available, pin the public GitHub release in your application's `package.json`:

```json
{
  "dependencies": {
      "@KnownSenseAI/pitch-sdk": "github:KnownSenseAI/pitch-sdk#v0.3.2"
  }
}
```

Then run `npm install`.

For production audio workflows, see [Audio library and TTS](./docs/guides/audio-library-and-tts.md) and [Production TTS](./docs/guides/production-tts.md). For observability, see [Delivery monitoring](./docs/guides/delivery-monitoring.md) and [Data retention](./docs/guides/data-retention.md).

## Use

```ts
import { PitchClient } from "@KnownSenseAI/pitch-sdk";

const pitch = new PitchClient({
  baseUrl: process.env.PITCH_BASE_URL!,
  apiKey: process.env.PITCH_API_KEY!,
});
```

API-key mode is the default for partner operations. Server processes calling owner/admin access-token-only webhook management routes may instead inject an already-issued PITCH token with `{ bearerToken }`. The two credentials are mutually exclusive; the SDK does not acquire, refresh, persist, or expose browser sessions.

Store API keys only in server-side secret storage. Required-idempotency methods require a caller key; event publication defaults it from `event_id`. Inspect `PitchAPIError` for the structured code, details, correlation ID, retry delay, and rate-limit headers. The SDK never retries automatically.

Grant each server workload only the scopes it uses. For audio preparation, `audio:read` permits discovery, `audio:write` permits library changes, and `tts:compose` permits composition, preview, and pronunciation management.

Audio uploads must originate in trusted server code. The SDK preflights non-empty files, a 25 MiB per-file limit, and one to five bulk files, implying at most 125 MiB of raw bulk file payload. PITCH server limits remain authoritative, including the independent 126 MiB complete bulk multipart cap. The service inspects media content instead of trusting the declared MIME type, and format, duration, storage-quota, and plan checks still apply. Treat returned asset and folder IDs as exact opaque identifiers.

The client exposes the complete partner catalog through `audio`, `tts`, `devices`, `announcements`, `schedules`, `events`, `deliveries`, `webhooks`, `controls`, `zones`, and `targetBindings`. Every method accepts request options in its final argument for a caller-provided `correlationId` and `AbortSignal`. List methods accept query parameters before those request options.

Target bindings continue to default to live zone resolution when `resolution_mode` is omitted. Trusted service workloads can request an immutable `pinned_snapshot` by sending the zone's current `expected_zone_version` and `expected_target_hash`; the response records the exact normalized output targets used for delayed event delivery.

Schedule operations live under `client.schedules`. The original pre-1.0 `announcements.updateSchedule`, `announcements.preview`, `announcements.pause`, and `announcements.deleteSchedule` names remain as compatibility aliases. `announcements.delete` deletes the announcement definition through `/v1/announcements/{id}`.

The SDK sends API keys with `X-Pitch-Key`. The PITCH service also accepts the legacy `X-SmartPA-Key` alias so deployed integrations continue to work.

Webhook verification uses `X-Pitch-Signature-Version: v1`, `X-Pitch-Timestamp`, and `X-Pitch-Signature: sha256=<hex>`. Use `readWebhookSignatureHeaders(request.headers)` to read the PITCH headers with a safe legacy fallback, then pass the exact raw request bytes to `verifyWebhookSignature` before parsing JSON. During the compatibility window the PITCH service emits matching `X-Pitch-*` and `X-SmartPA-*` webhook headers.

```ts
import {
  readWebhookSignatureHeaders,
  verifyWebhookSignature,
} from "@KnownSenseAI/pitch-sdk";

const signature = readWebhookSignatureHeaders(request.headers);
if (!signature || !verifyWebhookSignature({
  ...signature,
  secret: process.env.PITCH_WEBHOOK_SECRET!,
  body: rawBody,
})) {
  throw new Error("Invalid PITCH webhook signature");
}
```

Webhook configuration is owner/admin access-token-only in v1. Use server-side `bearerToken` mode for those wrappers; API keys are rejected by the service. Browser/session acquisition remains outside this SDK's scope.

## Header migration

New SDK requests use `X-Pitch-Key`. PITCH webhook responses use `X-Pitch-Signature`, `X-Pitch-Signature-Version`, `X-Pitch-Timestamp`, and `X-Pitch-Event`. The PITCH service temporarily accepts or emits matching `X-SmartPA-*` aliases for deployed integrations; do not use the legacy names in new code.

## Documentation and examples

The [PITCH developer documentation](https://knownsenseai.github.io/pitch-sdk/) includes product-oriented guides and a searchable browser reference generated from the same OpenAPI contract as the SDK types. Browser-side API execution is disabled so partner credentials remain server-side.

Runnable, CI-typechecked examples cover:

- audio-library discovery, uploads, and reviewed text-to-speech assets;
- folder organization and production TTS composition, validation, batch, pronunciation, and approval workflows;
- device and output discovery with target preflight;
- instant, scheduled, and calendar-based repetitive announcements;
- weekly chained sequences of audio-library assets;
- application-owned business events;
- audited output controls and zone preflight;
- delivery tracing; and
- raw-body webhook verification.

See the [`examples`](./examples) directory for complete programs and required environment variables.

## Development

Run `npm ci` followed by `npm run check`. The checked-in OpenAPI contract at `openapi/pitch-v1.yaml` contains only the supported partner surface and generates the SDK's public API types. Internal operations and implementation details are deliberately excluded.
