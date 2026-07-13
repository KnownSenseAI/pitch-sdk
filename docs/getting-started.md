# Install and authenticate

The PITCH SDK is intended for trusted server processes. Keep the API key in your server's secret manager and never ship it to frontend JavaScript.

## Requirements

- Node.js 22 or newer
- An HTTPS PITCH Partner API base URL
- A PITCH API key with the scopes required by your workflow

Choose least privilege: `audio:read` covers audio and folder discovery, `audio:write` covers library changes, and `tts:compose` covers speech composition, preview, and pronunciation management. Write scopes imply their matching read scope, but a read-only integration should request only the read scope. See [Audio library and TTS](/guides/audio-library-and-tts) and [Production TTS](/guides/production-tts).

## Install

Until the npm-registry release is available, pin the public GitHub release:

```bash
npm install "github:KnownSenseAI/pitch-sdk#v0.3.1"
```

Your application imports it by its package name:

```ts
import { PitchClient } from "@KnownSenseAI/pitch-sdk";

const pitch = new PitchClient({
  baseUrl: process.env.PITCH_BASE_URL!,
  apiKey: process.env.PITCH_API_KEY!,
});
```

The SDK sends API keys as `X-Pitch-Key`. It does not acquire credentials, persist sessions, or retry requests automatically.

## Make the first request

```ts
const page = await pitch.devices.list({ status: "online", limit: 25 });

for (const device of page.devices) {
  const outputs = (device.audio_outputs ?? [])
    .filter((output) => output.targetable)
    .map((output) => output.id);
  console.log(device.id, device.name, outputs);
}
```

## Handle errors

```ts
import { PitchAPIError } from "@KnownSenseAI/pitch-sdk";

try {
  await pitch.devices.get("device-123");
} catch (error) {
  if (error instanceof PitchAPIError) {
    console.error(error.status, error.code, error.correlationId);
  }
}
```

`PitchAPIError` also exposes machine-readable details, retry timing, and rate-limit headers when the service returns them.

## Request reliability

Creation methods that can be retried require a caller-owned idempotency key. Store that key with your business operation and reuse it when retrying the same request. Every method also accepts an optional `correlationId` and `AbortSignal` in its final argument.

```ts
await pitch.announcements.announceInstant(body, order.announcementRequestId, {
  correlationId: order.traceId,
  signal: controller.signal,
});
```

Continue with the [runnable examples](/examples), [Production TTS](/guides/production-tts), or the [Partner API reference](/api-reference). For production observability, review [Delivery monitoring](/guides/delivery-monitoring) and [Data retention](/guides/data-retention).
