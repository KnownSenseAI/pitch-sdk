# Runnable examples

The repository examples are typechecked in CI. Clone the repository, run `npm ci`, set the environment variables listed below, and execute an example with [`tsx`](https://tsx.is/) or compile it with your application.

All client examples require `PITCH_BASE_URL` and `PITCH_API_KEY`.

| Example | Additional variables | What it demonstrates |
| --- | --- | --- |
| [Device discovery](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/device-discovery.ts) | None | List online devices, inspect targetable outputs, and preflight `main`. |
| [Instant announcement](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/instant-announcement.ts) | `PITCH_DEVICE_ID`, `PITCH_ASSET_ID`; optional `PITCH_OUTPUT_ID` | Queue an asset with a caller-owned idempotency key. |
| [Scheduled announcement](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/scheduled-announcement.ts) | `PITCH_DEVICE_ID`, `PITCH_ASSET_ID` | Preview weekday fire times before creating a schedule. |
| [Business event](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/bus-event.ts) | None | Publish application-owned business metadata without location ingestion. |
| [Output control](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/output-control.ts) | `PITCH_DEVICE_ID`; optional `PITCH_OUTPUT_ID` | Apply an audited volume change to one output. |
| [Zone preflight](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/zone-control-preflight.ts) | `PITCH_ZONE_ID` | Lock a zone operation to a reviewed version and target count. |
| [Delivery monitoring](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/delivery-monitoring.ts) | `PITCH_CORRELATION_ID` | Read the ordered delivery lifecycle for a request. |
| [Webhook receiver](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/webhook-server.ts) | `PITCH_WEBHOOK_SECRET`; optional `PORT` | Verify raw request bytes before parsing an event. |

The shared helper in [`examples/_shared.ts`](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/_shared.ts) validates environment variables and shows structured `PitchAPIError` handling. Copy the parts appropriate to your application's configuration and logging conventions.
