import { pitchClient, requireEnv, runExample } from "./_shared.js";

const MAX_PAGES = 20;

await runExample(async () => {
  const client = pitchClient();
  const announcementId = requireEnv("PITCH_ANNOUNCEMENT_ID");
  let cursor: string | undefined;

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const page = await client.deliveries.list({
      announcement_id: announcementId,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });

    for (const delivery of page.deliveries) {
      console.log({
        correlationId: delivery.correlationId,
        deviceId: delivery.deviceId,
        outputId: delivery.outputId,
        status: delivery.status,
      });
    }

    cursor = page.cursor;
    if (!cursor) return;
  }

  console.warn(`Stopped after ${MAX_PAGES} pages. Continue later with the last cursor if needed.`);
  // Fetch a trace only for a selected failed or ambiguous correlation, not every row.
});
