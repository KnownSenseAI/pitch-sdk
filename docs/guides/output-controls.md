# Output controls

Output controls are audited operational commands for stopping playback, changing volume or mute state, and authorized emergency playback. They are separate from normal announcement authoring.

```ts
const operation = await pitch.controls.create({
  action: "set_volume",
  scope: "output",
  target: { device_id: "device-123", output_id: "main" },
  parameters: { volume: 55 },
  reason: "Apply the venue's daytime volume level",
}, "venue-daytime-volume-2026-07-13");

console.log(operation.control_id, operation.status);
```

Always provide a human-readable reason and a stable idempotency key. `output_id` is required for `scope: "output"`; it does not default to `main` for control requests.

For zones, preflight first and carry the returned zone version and target count into the later operation. Controls are atomic: do not assume partial execution is allowed.

Output-control operation history remains queryable for up to seven days. Persist compact business records needed for longer and review the other [data-retention windows](/guides/data-retention).
