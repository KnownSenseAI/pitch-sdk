# Audio library and text-to-speech

Announcements ultimately need playable audio. PITCH represents reusable audio as a customer-owned library asset with a stable `asset_id`. Developers use that identifier when creating instant, scheduled, repetitive, event-driven, or chained announcements.

Assets can come from:

- an uploaded audio file;
- reviewed text saved as generated speech;
- a recording or asset created in the PITCH Console.

All of these appear in the same customer-scoped audio library.

## Required API-key scopes

- `audio:write` lists, uploads, and creates audio-library assets.
- `tts:compose` generates temporary speech previews.
- `announce:write` uses the selected asset in announcements.

Use a server-side API key containing only the scopes required by your integration.

## Find the audio to play

List assets with optional name, language, source, and folder filters:

```ts
const page = await pitch.audio.list({
  search: "platform safety",
  language: "hi",
  source: "tts",
  limit: 50,
});

for (const asset of page.assets) {
  console.log(asset.id, asset.name, asset.duration_ms, asset.lifecycle);
}
```

Use `next_cursor` as `cursor` to request another page. Search is for discovery and administration; it should not be the runtime identity of an announcement. Once an operator or configuration workflow selects an asset, store its stable `id` with your own rule, route, stop, template, or business configuration.

For example:

```ts
const stopAnnouncements = {
  MG_ROAD: "asset-mg-road-hi",
  CENTRAL_STATION: "asset-central-station-hi",
};

const assetId = stopAnnouncements[event.stop_id];
if (!assetId) throw new Error("No approved audio configured for this stop");
```

Do not select the first fuzzy name-search result every time a business event occurs. Names are editable and may not be unique. Asset IDs are the supported announcement reference.

## Upload an existing audio file

The Node.js SDK accepts a `Blob`, filename, and library metadata. PITCH validates and prepares the audio for supported playback.

```ts
import { readFile } from "node:fs/promises";

const bytes = await readFile("./platform-safety.mp3");
const asset = await pitch.audio.upload({
  file: new Blob([new Uint8Array(bytes)]),
  filename: "platform-safety.mp3",
  metadata: {
    name: "Platform safety",
    language: "en",
    tags: ["safety", "platform"],
    lifecycle: "permanent",
  },
});

console.log(asset.id);
```

Use permanent assets for durable schedules. Upload limits, supported formats, duration limits, storage quota, and plan limits are enforced by the service and returned as structured `PitchAPIError` codes.

## Preview generated speech

Generate a temporary preview from reviewed text:

```ts
const speech = {
  text: "The next stop is Central Station.",
  language: "en",
  tone: "clear",
  speed: 1,
};

const preview = await pitch.tts.preview(speech);
console.log(preview.audio_url, preview.duration_ms);
```

The preview URL is temporary and is not an `asset_id`. Preview generation consumes character allowance and is rate-limited. Present it to the responsible operator or apply your own approval process before saving the speech.

## Save approved speech to the library

After approval, create the durable asset:

```ts
const asset = await pitch.audio.createFromTTS({
  ...speech,
  name: "Central Station approach",
  folder_id: "root",
});

console.log(asset.id);
```

The saved asset now behaves like an uploaded asset and can be reused without regenerating speech for every announcement.

## Trigger the selected asset

For an instant announcement, pass the asset ID directly:

```ts
await pitch.announcements.announceInstant({
  name: "Central Station approach",
  device_id: "bus-123",
  output_id: "main",
  asset_id: asset.id,
  priority: 1,
}, "trip-8472-central-station");
```

For durable definitions, use asset content:

```ts
const content = {
  type: "asset" as const,
  asset_id: asset.id,
};
```

Pass that `content` to scheduled, repetitive, conditional, or event-driven definitions. A chained announcement uses an ordered array of these asset references.

## Reliability guidance

- Persist the returned asset ID instead of regenerating speech for every playback.
- Treat TTS preview and asset creation as billable, rate-limited write operations.
- The SDK does not automatically retry. Audio upload and TTS asset creation currently have no idempotency-key contract, so do not blindly repeat them after an ambiguous timeout; search the library for the saved name before deciding to create another asset.
- Keep approval, language, route, stop, and business mappings in your application or configuration system.
- Use library asset tags and language for discovery, not as a substitute for a stored asset ID.
- Before activating a durable schedule, preview it with the final asset so PITCH can validate duration, device readiness, and conflicts.

See the runnable [`audio-library.ts`](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/audio-library.ts), [`upload-audio-asset.ts`](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/upload-audio-asset.ts), and [`tts-audio-library.ts`](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/tts-audio-library.ts) examples.
