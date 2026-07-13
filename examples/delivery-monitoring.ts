import { pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const correlationId = requireEnv("PITCH_CORRELATION_ID");

  const summaries = await client.deliveries.list({
    correlation_id: correlationId,
    limit: 100,
  });

  for (const delivery of summaries.deliveries) {
    console.log({
      announcementId: delivery.announcementId,
      deviceId: delivery.deviceId,
      outputId: delivery.outputId,
      status: delivery.status,
      failureReason: delivery.failureReason,
    });
  }

  const trace = await client.deliveries.getTrace(correlationId, { limit: 200 });

  console.log(`delivery trace ${trace.correlationId}`);
  for (const event of trace.events) {
    console.log({
      timestamp: event.timestamp,
      deviceId: event.deviceId,
      outputId: event.outputId,
      messageId: event.msgId,
      type: event.type,
      detail: event.detail,
      metadata: event.metadata,
    });
  }
});
