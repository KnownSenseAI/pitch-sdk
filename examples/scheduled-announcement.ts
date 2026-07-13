import { idempotencyKey, pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const deviceId = requireEnv("PITCH_DEVICE_ID");
  const assetId = requireEnv("PITCH_ASSET_ID");
  const trigger = {
    type: "scheduled" as const,
    mode: "weekly" as const,
    cron_expr: "0 9 * * 1-5",
    timezone: "Asia/Kolkata",
  };

  const preview = await client.schedules.preview({
    type: "scheduled",
    trigger_config: trigger,
    device_id: deviceId,
    output_id: "main",
    content_config: { type: "asset", asset_id: assetId },
    priority: 1,
    limit: 5,
  });
  console.log("next fire times", preview.next_fire_times);

  const announcement = await client.announcements.create({
    name: "Weekday opening message",
    type: "scheduled",
    device_id: deviceId,
    output_id: "main",
    content_config: { type: "asset", asset_id: assetId },
    trigger_config: trigger,
    priority: 1,
  }, idempotencyKey("weekday-opening"));

  console.log("schedule created", announcement.id, announcement.status);
});
