# Audio library and text-to-speech

PITCH stores reusable audio as customer-owned assets with stable `asset_id` values. Use names, tags, language, folders, and search for operator discovery; persist the selected ID in your application before creating announcements.

## Required API-key scopes

- `audio:read` lists folders and assets, reads metadata and edit context, and obtains download links.
- `audio:write` creates and changes folders or assets, including uploads and generated speech.
- `tts:compose` composes and previews speech and manages the pronunciation dictionary.
- `announce:write` is only needed when the integration also creates or changes announcements.

Read-only inventory jobs should receive `audio:read`, not a write scope. See [Production TTS](/guides/production-tts) for intent composition, approval, pronunciation, and multilingual batch workflows.

## Organize folders

Folders support typed list, tree, create, rename, and delete operations:

```ts
const children = await pitch.audio.folders.list({ parent_id: "root", limit: 100 });
const campaigns = children.folders.find((folder) => folder.name === "Campaigns")
  ?? await pitch.audio.folders.create({ name: "Campaigns", parent_id: "root" });

const tree = await pitch.audio.folders.tree({ max_depth: 4 });
await pitch.audio.folders.rename(campaigns.id, { name: "Current campaigns" });
// Delete only after your own workflow confirms the folder is no longer required.
// await pitch.audio.folders.delete(campaigns.id);
```

Folder names are discovery labels and can change. Store `folder.id` in configuration after an operator selects or creates the folder.

## Find assets

```ts
const page = await pitch.audio.list({
  folder_id: "folder-123",
  search: "platform safety",
  language: "hi",
  source: "tts",
  limit: 50,
});

for (const asset of page.assets) {
  console.log(asset.id, asset.name, asset.duration_ms, asset.lifecycle);
}
```

Use `next_cursor` to request another page. Do not select the first fuzzy result every time an event occurs: names are editable and may not be unique. Persist the reviewed `asset_id` with your route, template, stop, or business rule.

## Upload into a folder

```ts
import { readFile } from "node:fs/promises";

const bytes = await readFile("./platform-safety.mp3");
const asset = await pitch.audio.upload({
  file: new Blob([new Uint8Array(bytes)]),
  filename: "platform-safety.mp3",
  metadata: {
    name: "Platform safety",
    folder_id: "folder-123",
    language: "en",
    tags: ["safety", "platform"],
    lifecycle: "permanent",
  },
});
```

The SDK rejects empty files and files larger than 25 MiB before sending them. PITCH server limits remain authoritative and may reject a request after additional format, duration, storage-quota, or plan checks. Uploaded media content is inspected; a filename extension or declared `Blob` MIME type is not trusted as proof of format.

## Bulk upload

One multipart request can carry repeated files plus one metadata document. Results can contain per-item successes and failures, so inspect both arrays.

Bulk requests contain one to five files, each limited to 25 MiB, so the SDK constraints imply at most 125 MiB of raw file payload. Independently, the PITCH service authoritatively caps the complete multipart request at 126 MiB including multipart overhead.

```ts
const result = await pitch.audio.bulkUpload({
  files: [
    { file: new Blob([welcomeBytes]), filename: "welcome.mp3" },
    { file: new Blob([safetyBytes]), filename: "safety.mp3" },
  ],
  metadata: {
    defaults: { folder_id: "folder-123", lifecycle: "permanent", language: "en" },
    items: [{ name: "Welcome" }, { name: "Safety reminder" }],
  },
});

console.log(result.assets.map((item) => item.id), result.errors);
```

## Move, copy, and update

```ts
await pitch.audio.update(asset.id, { name: "Platform safety v2", tags: ["approved"] });
await pitch.audio.move(asset.id, { folder_id: "folder-approved" });
const localizedCopy = await pitch.audio.copy(asset.id, {
  folder_id: "folder-localization",
  name: "Platform safety translation draft",
});
console.log(localizedCopy.id);
```

Deletion and folder deletion are destructive. Keep them behind an explicit administrative decision and review usage first.

## Reliability guidance

- Keep API keys in server-side secret storage and perform uploads only from trusted server code.
- Treat `asset_id` and `folder_id` as exact opaque identifiers. Persist them unchanged; use editable names, tags, and search only for discovery.
- Upload and generated-audio writes can consume quota and do not accept idempotency keys. After an ambiguous timeout, inspect the target folder before creating a duplicate.
- Treat server limits as authoritative and handle structured `PitchAPIError` codes for size, format, duration, quota, and rate-limit failures.
- Use permanent assets for durable schedules and test a representative device before rollout.
- Store the final `asset_id` instead of regenerating speech for every playback.

The runnable [folder workflow](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/audio-folder-workflow.ts) creates or finds an exact child folder, uploads a local file, and prints stable IDs. The [audio discovery](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/audio-library.ts), [upload](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/upload-audio-asset.ts), and [TTS approval](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/tts-audio-library.ts) examples cover the related flows.
