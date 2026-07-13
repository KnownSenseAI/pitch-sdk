import { idempotencyKey, pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const result = await client.announcements.announceInstant({
    name: "Closing reminder",
    device_id: requireEnv("PITCH_DEVICE_ID"),
    output_id: process.env.PITCH_OUTPUT_ID ?? "main",
    asset_id: requireEnv("PITCH_ASSET_ID"),
    priority: 1,
    interrupt_active: true,
  }, idempotencyKey("closing-reminder"));

  console.log("announcement queued", {
    announcementId: result.announcement_id,
    correlationId: result.correlation_id,
    status: result.status,
  });
});
