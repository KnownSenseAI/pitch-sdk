import { idempotencyKey, pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const deviceId = requireEnv("PITCH_DEVICE_ID");
  const outputId = process.env.PITCH_OUTPUT_ID ?? "main";
  const assetIds = requireEnv("PITCH_CHAIN_ASSET_IDS")
    .split(",")
    .map((assetId) => assetId.trim())
    .filter(Boolean);

  if (assetIds.length < 2 || assetIds.length > 32) {
    throw new Error("PITCH_CHAIN_ASSET_IDS must contain between 2 and 32 comma-separated audio asset IDs.");
  }

  // Chained announcements are weekly schedules. Every item must be an audio
  // library asset, and targets must support scheduled gaps when gap_ms > 0.
  const trigger = {
    type: "scheduled" as const,
    mode: "weekly" as const,
    cron_expr: "30 8 * * 1-5",
    timezone: "Asia/Kolkata",
  };
  const content = {
    type: "chained" as const,
    chain_gap_ms: 2_000,
    chain_items: assetIds.map((assetId) => ({
      type: "asset" as const,
      asset_id: assetId,
    })),
  };

  const preview = await client.schedules.preview({
    type: "chained",
    trigger_config: trigger,
    device_id: deviceId,
    output_id: outputId,
    content_config: content,
    priority: 1,
    limit: 5,
  });

  if (preview.blocking_conflicts?.length) {
    throw new Error(`Resolve ${preview.blocking_conflicts.length} blocking schedule conflict(s) before creation.`);
  }

  console.log("chained schedule preview", {
    nextFireTimes: preview.next_fire_times,
    warnings: preview.warnings,
  });

  const announcement = await client.announcements.create({
    name: "Weekday passenger information sequence",
    type: "chained",
    device_id: deviceId,
    output_id: outputId,
    content_config: content,
    trigger_config: trigger,
    priority: 1,
  }, idempotencyKey("weekday-passenger-sequence"));

  console.log("chained announcement created", {
    announcementId: announcement.id,
    status: announcement.status,
    nextStep: "Review the draft, then activate it when approved.",
  });
});
