import { pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const zoneId = requireEnv("PITCH_ZONE_ID");
  const zone = await client.zones.get(zoneId);
  const preflight = await client.zones.preflight(zoneId, {
    intent: "control",
    expected_zone_version: zone.version,
    expected_target_count: zone.members.length,
    allow_partial: false,
  });

  // Use the returned version and target count when submitting a later zone
  // operation so a membership change cannot silently alter the target set.
  console.log("zone preflight", {
    allowed: preflight.allowed,
    version: preflight.version,
    ready: preflight.ready,
    blocked: preflight.blocked,
  });
});
