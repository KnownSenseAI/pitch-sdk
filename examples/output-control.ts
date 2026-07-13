import { idempotencyKey, pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const operation = await client.controls.create({
    action: "set_volume",
    scope: "output",
    target: {
      device_id: requireEnv("PITCH_DEVICE_ID"),
      output_id: process.env.PITCH_OUTPUT_ID ?? "main",
    },
    parameters: { volume: 55 },
    reason: "Apply the venue's daytime volume level",
  }, idempotencyKey("daytime-volume"));

  console.log("control accepted", operation.control_id, operation.status);
});
