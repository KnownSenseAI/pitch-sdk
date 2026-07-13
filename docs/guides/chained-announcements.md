# Chained announcements

Use a chained announcement when several different audio-library assets must play in a defined order on a recurring weekly schedule. A passenger-information sequence might play a welcome message, a safety instruction, and a route notice at 08:30 every weekday.

A chain is not an instant playlist and is not the way to repeat one message several times. Chained announcements use the device schedule and its ordered-sequence capabilities.

## Build the ordered content

Every item must reference an existing customer-owned audio-library asset.

Use the [audio library and TTS guide](/guides/audio-library-and-tts) to upload, generate, search, and select the stable asset IDs before building the chain.

```ts
const content = {
  type: "chained" as const,
  chain_gap_ms: 2_000,
  chain_items: [
    { type: "asset" as const, asset_id: "asset-welcome" },
    { type: "asset" as const, asset_id: "asset-safety" },
    { type: "asset" as const, asset_id: "asset-route-notice" },
  ],
};
```

`chain_gap_ms` is the pause before every item after the first. Omit it to use the 2-second default, or set it to `0` for no added pause.

## Use a weekly scheduled trigger

The announcement type is `chained`, but its trigger is `scheduled` because the complete sequence starts from one weekly calendar slot.

```ts
const trigger = {
  type: "scheduled" as const,
  mode: "weekly" as const,
  cron_expr: "30 8 * * 1-5",
  timezone: "Asia/Kolkata",
};
```

One-time `mode: "once"` triggers are not supported for chained announcements.

## Preflight and preview

Use an explicit device/output target. When the gap is greater than zero, every target must report support for scheduled chain gaps.

```ts
const target = { device_id: "device-123", output_id: "main" };

const readiness = await pitch.devices.preflightTargets({
  intent: "schedule_authoring",
  targets: [target],
  content_config: content,
});

if (!readiness.allowed) throw new Error("Target cannot accept this chain");

const preview = await pitch.schedules.preview({
  type: "chained",
  trigger_config: trigger,
  ...target,
  content_config: content,
  priority: 1,
  limit: 5,
});

if (preview.blocking_conflicts?.length) {
  throw new Error("Resolve the blocking schedule conflicts first");
}
```

The preview evaluates the full sequence duration, its gaps, and existing playback on the selected output.

## Create and activate

```ts
const announcement = await pitch.announcements.create({
  name: "Weekday passenger information sequence",
  type: "chained",
  ...target,
  content_config: content,
  trigger_config: trigger,
  priority: 1,
}, "weekday-passenger-sequence-v1");
```

Creation produces a draft. Review the sequence, preview, target capabilities, and any decision warnings before calling `pitch.announcements.activate(announcement.id)`.

Activation does not return the correlation IDs of future firings. [Discover each firing](/guides/delivery-monitoring) by listing delivery timelines with `announcement_id`, then use the row's `correlationId` for a selected trace.

## Restrictions and operational guidance

- A chain contains between 1 and 32 items.
- Every item must be an audio-library `asset`; nested URL, text-to-speech, or chained items are rejected.
- `chain_gap_ms` is between 0 and 60,000 milliseconds. Omission defaults to 2,000 milliseconds.
- Only weekly scheduled triggers are supported. Instant and one-time chained announcements are rejected.
- A positive gap requires explicit device targets that report scheduled-gap support.
- PITCH rejects overlapping active schedules on the same output. Preview with the final content and target before creation.
- Pause, resume, update, or delete the chain as one schedule through `pitch.schedules`.

See the runnable [`chained-announcement.ts`](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/chained-announcement.ts) example for a complete program.
