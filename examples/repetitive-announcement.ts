import { idempotencyKey, pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const deviceId = requireEnv("PITCH_DEVICE_ID");
  const assetId = requireEnv("PITCH_ASSET_ID");
  const outputId = process.env.PITCH_OUTPUT_ID ?? "main";

  // This is a calendar-based repetition: every 15 minutes during the
  // selected weekday window. It is not an immediate multi-play request.
  const trigger = {
    type: "repetitive" as const,
    interval_mins: 15,
    window_start: "08:00",
    window_end: "10:00",
    timezone: "Asia/Kolkata",
    days_of_week: [1, 2, 3, 4, 5],
  };
  const content = { type: "asset" as const, asset_id: assetId };

  const preview = await client.schedules.preview({
    type: "repetitive",
    trigger_config: trigger,
    device_id: deviceId,
    output_id: outputId,
    content_config: content,
    priority: 1,
    limit: 10,
  });

  if (preview.blocking_conflicts?.length) {
    throw new Error(`Resolve ${preview.blocking_conflicts.length} blocking schedule conflict(s) before creation.`);
  }

  console.log("repetitive schedule preview", {
    nextFireTimes: preview.next_fire_times,
    entryCount: preview.entry_count,
    warnings: preview.warnings,
  });

  const announcement = await client.announcements.create({
    name: "Weekday service reminder",
    type: "repetitive",
    device_id: deviceId,
    output_id: outputId,
    content_config: content,
    trigger_config: trigger,
    priority: 1,
  }, idempotencyKey("weekday-service-reminder"));

  console.log("repetitive announcement created", {
    announcementId: announcement.id,
    status: announcement.status,
    nextStep: "Review the draft, then activate it when approved.",
  });
});
