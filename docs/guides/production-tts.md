# Production text-to-speech

## 1. Choose the scopes

Use `tts:compose` for composition, preview, batch generation, and pronunciation management. Add `audio:write` for durable generated assets and revisions, and `audio:read` for folder discovery and edit context. A compose-review-save service usually needs all three. Add `announce:write` only when the same service also sends announcements.

Direct save-from-TTS and revision remain `audio:write` actions for compatibility; they do not require `tts:compose`. Issue a server-side key containing only the scopes that its workload uses.

```ts
import { PitchAPIError, PitchClient } from "@KnownSenseAI/pitch-sdk";

const pitch = new PitchClient({
  baseUrl: process.env.PITCH_BASE_URL!,
  apiKey: process.env.PITCH_API_KEY!,
});
```

## 2. Compose from intent

Put the important instruction first. State the desired outcome, language, audience, venue, tone, pace, `asset_hint`, and `max_chars`. Do not put prompt markup, decorative symbols, emoji, URLs, or unexplained abbreviations into spoken copy.

```ts
const composed = await pitch.tts.compose({
  intent: "Ask platform 3 passengers to remain behind the yellow line until boarding starts.",
  language: "hi",
  audience: "Platform 3 passengers",
  venue_type: "railway_station",
  tone: "calm and professional",
  pace: 0.95,
  asset_hint: "Platform 3 safety",
  max_chars: 320,
});
```

## 3. Review before synthesis

Show the returned text to a responsible reviewer. Inspect `warnings` and `validation_issues`; require a human or application approval boundary for customer-facing or safety-sensitive speech.

```ts
console.log({
  text: composed.text,
  rationale: composed.rationale,
  warnings: composed.warnings ?? [],
  validation_issues: composed.validation_issues ?? [],
});
```

## 4. Fix recurring names with pronunciation

Read the current pronunciation dictionary before changing it. Add only customer-reviewed terms or approved templates, verify the returned limits, then regenerate a preview. A spelling guess is not approval, and the result still needs listening review.

```ts
const before = await pitch.tts.pronunciation.get();
if (before.enabled_count >= before.max_enabled_terms) {
  throw new Error("Review existing pronunciation terms before adding another.");
}

await pitch.tts.pronunciation.upsertTerm({
  language: "en",
  word: "KnownSense",
  pronunciation: "Known Sense",
  enabled: true,
});
const approvedIndustry = process.env.PITCH_TTS_TEMPLATE_INDUSTRY?.trim();
if (approvedIndustry) {
  const available = before.templates.some((template) => template.industry === approvedIndustry);
  if (!available) throw new Error("Requested pronunciation template is not available.");
  await pitch.tts.pronunciation.applyTemplate(approvedIndustry);
}
// await pitch.tts.pronunciation.deleteTerm({ language: "en", word: "KnownSense" });
```

## 5. Preview on representative playback

Use the resolved voice, duration, and billed/remaining character data returned by preview. Check audibility, pace, names, numbers, acronyms, and pauses on representative PA hardware, not laptop speakers alone. Review every language independently because results can differ.

```ts
const speech = {
  text: composed.text,
  language: composed.language,
  ...(composed.speaker ? { voice: composed.speaker } : {}),
  speed: composed.pace,
  ...(composed.style_tags ? { style_tags: composed.style_tags } : {}),
};

const preview = await pitch.tts.preview(speech);
console.log({
  audioUrl: preview.audio_url,
  resolvedVoice: preview.resolved_voice,
  durationMs: preview.duration_ms,
  charactersBilled: preview.chars_billed,
  charactersRemaining: preview.tts_remaining,
});
```

## 6. Save once and reuse

After text and audio approval, save into an explicitly named folder. Persist the returned stable `asset_id` and reuse it for announcements instead of paying synthesis latency and character usage on every playback.

```ts
const folders = await pitch.audio.folders.list({ parent_id: "root", search: "Approved safety", limit: 100 });
const folder = folders.folders.find((item) => item.name === "Approved safety")
  ?? await pitch.audio.folders.create({ name: "Approved safety", parent_id: "root" });

const saved = await pitch.audio.createFromTTS({
  ...speech,
  name: composed.asset_name_suggestion,
  folder_id: folder.id,
});
console.log({ asset_id: saved.id });
```

## 7. Edit by revision

For an existing generated asset, read edit context and create a revision instead of mutating old audio bytes or creating uncontrolled duplicates. Schedules can continue to reference the stable asset while the PITCH service handles revision-safe playback.

```ts
const context = await pitch.audio.getEditContext(saved.id);
if (!context.editable) throw new Error(context.reason ?? "Asset is not editable");

const revision = await pitch.audio.createTTSRevision(saved.id, {
  mode: context.impact.active_schedules > 0 ? "copy" : "replace",
  expected_revision: context.active_revision,
  text: "Updated, operator-approved announcement text.",
  language: context.language ?? "en",
  name: "Platform safety revision",
});
console.log(revision.asset.id, revision.revision.revision);
```

## 8. Multilingual and batch workflows

Batch methods accept up to the documented request limit. Keep languages as independent assets when operators approve or schedule them separately. Merge only when one ordered file is the actual playback requirement; choose `gap_ms` through listening review rather than applying one value universally.

```ts
const batch = await pitch.tts.composeBatch({
  prompt: "Announce that boarding closes in five minutes.",
  languages: ["en", "hi", "mr"],
  tone: "clear and urgent",
  audience_context: "Intercity rail passengers",
  max_chars: 240,
});

for (const item of batch.items) {
  console.log(item.language, item.text, item.validation_issues ?? []);
}

const items = batch.items.map((item) => ({
  text: item.text,
  language: item.language,
  ...(item.speaker ? { voice: item.speaker } : {}),
  speed: item.pace,
}));
const previews = await pitch.tts.previewBatch({ items });
console.log(previews.items.map((item) => item.audio_url), previews.errors ?? []);

const savedBatch = await pitch.audio.createFromTTSBatch({
  folder_id: folder.id,
  items: items.map((item) => ({ ...item, name: `Boarding closes - ${item.language}` })),
  merge: { enabled: true, name: "Boarding closes - multilingual", gap_ms: 1800, language: "multi" },
});
console.log(savedBatch.assets.map((asset) => asset.id), savedBatch.merged_asset?.id);
```

## 9. Quotas, failures, and retries

TTS preview and save are billable and rate-limited. The SDK does not retry automatically. Catch `PitchAPIError`, honor backoff headers such as `retryAfter`, and distinguish validation from transient failures. Because saves are non-idempotent, inspect the target folder after an ambiguous timeout before repeating the write.

```ts
try {
  await pitch.tts.preview(speech);
} catch (error) {
  if (error instanceof PitchAPIError) {
    console.error(error.status, error.code, error.retryAfter, error.correlationId);
  }
  throw error;
}
```

## 10. Production checklist

- The returned text, warnings, and validation issues were reviewed.
- Names, acronyms, numbers, pauses, and pronunciation were approved.
- Audio was tested on representative playback hardware.
- Stable folder and asset IDs are stored in application configuration.
- The key contains the required scopes and no unrelated elevated permissions.
- Character and request quota has operational headroom.
- Ambiguous non-idempotent outcomes are checked before retrying.
- Targets are preflighted and [delivery monitoring](/guides/delivery-monitoring) is connected before rollout.

For folder organization, uploads, bulk operations, moves, and copies, continue with [Audio library and text-to-speech](/guides/audio-library-and-tts).
