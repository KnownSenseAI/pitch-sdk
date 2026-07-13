import { PitchClient } from "../src/index.js";

const client = new PitchClient({ baseUrl: process.env.PITCH_BASE_URL!, apiKey: process.env.PITCH_API_KEY! });

// The upstream fleet system converts location observations into this business
// event. PITCH intentionally does not ingest or retain raw GPS traces.
await client.events.publish({
  event_id: `bus-R12-MG_ROAD-${new Date().toISOString()}`,
  event_type: "bus.stop.approaching",
  occurred_at: new Date().toISOString(),
  data: { route: "R12", stop: "MG_ROAD", direction: "northbound" },
  interrupt_active: false,
});
