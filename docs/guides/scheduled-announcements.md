# Scheduled announcements

Preview a schedule before creating it. The preview resolves upcoming fire times and can surface conflicts or warnings without committing the announcement.

Start by selecting a permanent asset from the [audio library](/guides/audio-library-and-tts). Save generated speech to the library before placing it on a durable schedule.

```ts
const trigger = {
  type: "scheduled" as const,
  mode: "weekly" as const,
  cron_expr: "0 9 * * 1-5",
  timezone: "Asia/Kolkata",
};

const preview = await pitch.schedules.preview({
  type: "scheduled",
  trigger_config: trigger,
  device_id: "device-123",
  output_id: "main",
  content_config: { type: "asset", asset_id: "asset-456" },
  priority: 1,
  limit: 5,
});

console.log(preview.next_fire_times, preview.conflicts);
```

After reviewing the result, create the durable announcement definition with `pitch.announcements.create`. Keep the timezone explicit and use the warning confirmation token only when your product has shown the warning to an authorized user.

Manage existing schedules through `pitch.schedules`: list, update, pause, resume, or delete. Update operations support whole-schedule and occurrence-scoped edits where documented by the API.

Use a [repetitive announcement](/guides/repetitive-announcements) for interval- or count-based playback inside a daily window. Use a [chained announcement](/guides/chained-announcements) when several audio-library assets must play in order from one weekly schedule slot.
