# Runnable examples

The repository examples are typechecked in CI. Clone the repository, run `npm ci`, set the environment variables listed below, and execute an example with [`tsx`](https://tsx.is/) or compile it with your application.

All client examples require `PITCH_BASE_URL` and `PITCH_API_KEY`.

| Example | Additional variables | What it demonstrates |
| --- | --- | --- |
| [Audio library](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/audio-library.ts) | Optional `PITCH_ASSET_SEARCH`, `PITCH_ASSET_LANGUAGE` | Search customer-owned assets and obtain the stable asset IDs used by announcements. |
| [Audio upload](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/upload-audio-asset.ts) | `PITCH_AUDIO_FILE`; optional `PITCH_ASSET_NAME`, `PITCH_ASSET_LANGUAGE` | Upload a local audio file and save it as a permanent library asset. |
| [Audio folder workflow](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/audio-folder-workflow.ts) | `PITCH_AUDIO_FILE`, `PITCH_FOLDER_NAME`; optional `PITCH_PARENT_FOLDER_ID`, `PITCH_ASSET_NAME`, `PITCH_ASSET_LANGUAGE` | Find or create an exact child folder, upload into it, and print stable folder and asset IDs. Requires `audio:read` and `audio:write`. |
| [TTS to audio library](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/tts-audio-library.ts) | `PITCH_TTS_INTENT`; optional `PITCH_TTS_LANGUAGE`, `PITCH_TTS_AUDIENCE`, `PITCH_TTS_VENUE`, `PITCH_TTS_TONE`, `PITCH_TTS_PACE`, `PITCH_TTS_ASSET_HINT`, `PITCH_TTS_MAX_CHARS`, `PITCH_ASSET_NAME`, `PITCH_FOLDER_ID`, `PITCH_TTS_APPROVED=true` | Compose business intent, review warnings and `validation_issues`, preview, then explicitly approve one durable save. Requires `tts:compose` and `audio:write`. |
| [Device discovery](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/device-discovery.ts) | None | List online devices, inspect targetable outputs, and preflight `main`. |
| [Instant announcement](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/instant-announcement.ts) | `PITCH_DEVICE_ID`, `PITCH_ASSET_ID`; optional `PITCH_OUTPUT_ID` | Queue an asset with a caller-owned idempotency key. |
| [Scheduled announcement](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/scheduled-announcement.ts) | `PITCH_DEVICE_ID`, `PITCH_ASSET_ID` | Preview weekday fire times before creating a schedule. |
| [Repetitive announcement](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/repetitive-announcement.ts) | `PITCH_DEVICE_ID`, `PITCH_ASSET_ID`; optional `PITCH_OUTPUT_ID` | Preview and create a calendar-based interval schedule inside a daily window. |
| [Chained announcement](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/chained-announcement.ts) | `PITCH_DEVICE_ID`, comma-separated `PITCH_CHAIN_ASSET_IDS`; optional `PITCH_OUTPUT_ID` | Preview and create an ordered weekly sequence of audio-library assets. |
| [Business event](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/bus-event.ts) | None | Publish application-owned business metadata without location ingestion. |
| [Output control](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/output-control.ts) | `PITCH_DEVICE_ID`; optional `PITCH_OUTPUT_ID` | Apply an audited volume change to one output. |
| [Zone preflight](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/zone-control-preflight.ts) | `PITCH_ZONE_ID` | Lock a zone operation to a reviewed version and target count. |
| [Delivery monitoring](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/delivery-monitoring.ts) | `PITCH_CORRELATION_ID` | Find delivery summaries for one correlation, then read its ordered diagnostic trace. |
| [Delivery timelines](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/delivery-timelines.ts) | `PITCH_ANNOUNCEMENT_ID` | Paginate recent firing summaries for a scheduled announcement without tracing every row. |
| [Webhook receiver](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/webhook-server.ts) | `PITCH_WEBHOOK_SECRET`; optional `PORT` | Verify raw request bytes before parsing an event. |

The shared helper in [`examples/_shared.ts`](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/_shared.ts) validates environment variables and shows structured `PitchAPIError` handling. Copy the parts appropriate to your application's configuration and logging conventions.

For batch composition with `composeBatch`, multilingual `previewBatch`, `createFromTTSBatch`, pronunciation management, merged-audio `gap_ms`, and representative-device rollout, follow the [Production TTS guide](/guides/production-tts).
