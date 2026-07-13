import { PitchClient } from "../src/index.js";

const client = new PitchClient({ baseUrl: process.env.PITCH_BASE_URL!, apiKey: process.env.PITCH_API_KEY! });
const zoneId = process.env.PITCH_ZONE_ID!;
const preflight = await client.zones.preflight(zoneId, { intent: "control", allow_partial: false });
console.log("review preflight version/count before creating an audited control", preflight);

// Controls require explicit output targets, a caller-owned idempotency key,
// and the permissions documented for the requested authority level.
await client.controls.create({
  action: "set_volume",
  target: { zone_id: zoneId },
  volume: 55,
  reason: "scheduled venue level adjustment",
} as never, `zone-volume-${zoneId}-${Date.now()}`);
