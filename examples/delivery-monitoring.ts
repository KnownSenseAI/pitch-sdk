import { pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const correlationId = requireEnv("PITCH_CORRELATION_ID");
  const trace = await client.deliveries.getTrace(correlationId);

  console.log(`delivery trace ${trace.correlationId}`);
  for (const event of trace.events) {
    console.log(event.timestamp, event.deviceId, event.outputId, event.type, event.detail);
  }
});
