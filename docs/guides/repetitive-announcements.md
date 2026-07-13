# Repetitive announcements

Use a repetitive announcement when one audio item should play repeatedly inside a recurring daily window. Examples include a service reminder every 15 minutes during operating hours or four evenly spaced safety messages during a shift.

This is calendar repetition, not an immediate request to play the same message several times. For one immediate play, use an [instant announcement](/guides/instant-announcements).

Choose a permanent asset from the [audio library](/guides/audio-library-and-tts) before authoring the schedule. Saving generated speech first gives PITCH stable duration and offline-ready content.

## Choose a cadence

Every repetitive trigger needs a timezone, a start and end time, and exactly one cadence mode.

### Fixed interval

`interval_mins` starts at `window_start` and adds the selected number of minutes until the next start would fall at or after `window_end`.

```ts
const trigger = {
  type: "repetitive" as const,
  interval_mins: 15,
  window_start: "08:00",
  window_end: "10:00",
  timezone: "Asia/Kolkata",
  days_of_week: [1, 2, 3, 4, 5],
};
```

Days use `0` for Sunday through `6` for Saturday. Omit `days_of_week` to use every day.

### Occurrences per window

Use `occurrences_per_window` when the required number of plays matters more than the exact interval. PITCH distributes minute-aligned starts evenly across the window.

```ts
const trigger = {
  type: "repetitive" as const,
  occurrences_per_window: 4,
  window_start: "08:00",
  window_end: "10:00",
  timezone: "Asia/Kolkata",
  days_of_week: [1, 2, 3, 4, 5, 6],
};
```

In this example, the starts are 08:00, 08:30, 09:00, and 09:30. `window_end` closes the window; it is not an additional start.

## Preview before creating

Include the target and content in the preview so PITCH can evaluate output availability, content duration, duplicate schedules, and playback overlap.

```ts
const content = { type: "asset" as const, asset_id: "asset-456" };

const preview = await pitch.schedules.preview({
  type: "repetitive",
  trigger_config: trigger,
  device_id: "device-123",
  output_id: "main",
  content_config: content,
  priority: 1,
  limit: 10,
});

if (preview.blocking_conflicts?.length) {
  throw new Error("Resolve the blocking schedule conflicts first");
}
```

The audio must finish before `window_end`, and starts must not overlap another active announcement on the same output. A window whose end is earlier than or equal to its start runs overnight; `days_of_week` selects the day on which that overnight window begins.

## Create and activate

```ts
const announcement = await pitch.announcements.create({
  name: "Weekday service reminder",
  type: "repetitive",
  device_id: "device-123",
  output_id: "main",
  content_config: content,
  trigger_config: trigger,
  priority: 1,
}, "weekday-reminder-v1");

console.log(announcement.id, announcement.status);
```

Creation produces a draft. Review the preview and any decision warnings before calling `pitch.announcements.activate(announcement.id)`. If activation returns a warning confirmation token, show the warning to an authorized user before retrying with that token.

Activation does not return the correlation IDs of future firings. [Discover each firing](/guides/delivery-monitoring) by listing delivery timelines with `announcement_id`, then use the row's `correlationId` for a selected trace.

## Restrictions and operational guidance

- Set exactly one of `interval_mins` and `occurrences_per_window`.
- Both cadence values are positive integers; the schedule is minute-aligned.
- Use an audio-library asset for predictable duration and offline readiness. Durable URL audio requires a checksum.
- Temporary text-to-speech cannot be scheduled directly. Save it as an audio-library asset first.
- PITCH rejects schedules that are too dense, exceed device schedule capacity, overrun the window, or conflict with active playback on the same output.
- Pause, resume, update, and delete the complete definition through `pitch.schedules`.

See the runnable [`repetitive-announcement.ts`](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/repetitive-announcement.ts) example for a complete program.
