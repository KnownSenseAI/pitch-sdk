# Instant announcements

Use an instant announcement when audio should be queued immediately for a device or explicit set of outputs.

## Recommended flow

1. Discover the device and targetable outputs.
2. Preflight the target when readiness matters to the calling workflow.
3. Submit a customer-owned [audio-library asset](/guides/audio-library-and-tts) with a stable idempotency key.
4. Persist the returned correlation ID for delivery monitoring.

Use that ID to [list delivery status and inspect a selected trace](/guides/delivery-monitoring).

```ts
const target = { device_id: "device-123", output_id: "main" };

const readiness = await pitch.devices.preflightTargets({
  intent: "instant",
  targets: [target],
  content_config: { type: "asset", asset_id: "asset-456" },
});

if (!readiness.allowed) throw new Error("Target is not ready");

const result = await pitch.announcements.announceInstant({
  name: "Closing reminder",
  ...target,
  asset_id: "asset-456",
  priority: 1,
  interrupt_active: true,
}, "closing-reminder-2026-07-13");

console.log(result.correlation_id);
```

Omitting `output_id` selects `main` for compatibility, but new integrations should send the intended output explicitly. Use `targets` for a mixed multi-output request. A higher-priority request may interrupt active playback only when `interrupt_active` allows it.
