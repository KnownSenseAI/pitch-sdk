import { idempotencyKey, pitchClient, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const occurredAt = new Date().toISOString();

  // Your application decides when this business event occurs. PITCH receives
  // only the event and business metadata needed to match announcement rules.
  const occurrence = await client.events.publish({
    event_id: `bus-R12-MG_ROAD-${occurredAt}`,
    event_type: "bus.stop.approaching",
    occurred_at: occurredAt,
    data: { route_id: "R12", stop_id: "MG_ROAD", direction: "northbound" },
    interrupt_active: false,
  }, idempotencyKey("bus-stop"));

  console.log("event accepted", occurrence);
});
