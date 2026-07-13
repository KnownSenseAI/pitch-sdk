# PITCH TypeScript SDK

The official server-side Node.js SDK for the PITCH Partner API v1. It supports Node.js 22+ and ESM.

## Install

Until an npm-registry release is available, pin the public GitHub release in your application's `package.json`:

```json
{
  "dependencies": {
    "@KnownSenseAI/pitch-sdk": "github:KnownSenseAI/pitch-sdk#v0.1.0"
  }
}
```

Then run `npm install`.

## Use

```ts
import { PitchClient } from "@KnownSenseAI/pitch-sdk";

const pitch = new PitchClient({
  baseUrl: process.env.PITCH_BASE_URL!,
  apiKey: process.env.PITCH_API_KEY!,
});
```

API-key mode is the default for partner operations. Server processes calling owner/admin JWT-only webhook management routes may instead inject an already-issued PITCH token with `{ bearerToken }`. The two credentials are mutually exclusive; the SDK does not acquire, refresh, persist, or expose browser sessions.

Store API keys only in server-side secret storage. Required-idempotency methods require a caller key; event publication defaults it from `event_id`. Inspect `PitchAPIError` for the structured code, details, correlation ID, retry delay, and rate-limit headers. The SDK never retries automatically.

The client exposes the complete partner catalog through `devices`, `announcements`, `schedules`, `events`, `deliveries`, `webhooks`, `controls`, `zones`, and `targetBindings`. Every method accepts request options in its final argument for a caller-provided `correlationId` and `AbortSignal`. List methods accept query parameters before those request options.

Schedule operations live under `client.schedules`. The original pre-1.0 `announcements.updateSchedule`, `announcements.preview`, `announcements.pause`, and `announcements.deleteSchedule` names remain as compatibility aliases. `announcements.delete` deletes the announcement definition through `/v1/announcements/{id}`.

The SDK sends API keys with `X-Pitch-Key`. The backend also accepts the legacy `X-SmartPA-Key` alias so deployed integrations continue to work.

Webhook verification uses `X-Pitch-Signature-Version: v1`, `X-Pitch-Timestamp`, and `X-Pitch-Signature: sha256=<hex>`. Use `readWebhookSignatureHeaders(request.headers)` to read the PITCH headers with a safe legacy fallback, then pass the exact raw request bytes to `verifyWebhookSignature` before parsing JSON. During the compatibility window the backend emits matching `X-Pitch-*` and `X-SmartPA-*` webhook headers.

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

Webhook configuration is owner/admin JWT-only in v1. Use server-side `bearerToken` mode for those wrappers; API keys are rejected by the service. Browser/session acquisition remains outside this SDK's scope.

## Header migration

New SDK requests use `X-Pitch-Key`. PITCH webhook responses use `X-Pitch-Signature`, `X-Pitch-Signature-Version`, `X-Pitch-Timestamp`, and `X-Pitch-Event`. The backend temporarily accepts or emits matching `X-SmartPA-*` aliases for deployed integrations; do not use the legacy names in new code.

## Development

Run `npm ci` followed by `npm run check`. The checked-in OpenAPI contract at `openapi/pitch-v1.yaml` contains only the supported partner surface and generates the SDK's public API types. Internal operations and implementation details are deliberately excluded.
