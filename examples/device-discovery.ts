import { pitchClient, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const page = await client.devices.list({ status: "online", limit: 25 });

  for (const device of page.devices) {
    const targetableOutputs = (device.audio_outputs ?? []).filter((output) => output.targetable);
    console.log(device.id, device.name, targetableOutputs.map((output) => output.id));
  }

  const first = page.devices[0];
  if (!first) return;

  const preflight = await client.devices.preflightTargets({
    intent: "instant",
    targets: [{ device_id: first.id, output_id: "main" }],
    content_config: { type: "asset" },
  });
  console.log("main output ready", preflight.allowed, preflight.results[0]);
});
