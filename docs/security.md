# Security and reliability

## Keep credentials server-side

Construct `PitchClient` only in trusted server code. Never place a PITCH API key, webhook secret, or owner/admin bearer token in a browser bundle, mobile application, log message, or source repository.

The interactive request button is intentionally disabled in this documentation so production credentials are not pasted into a browser. Use the SDK, `curl` from a secured environment, or your server-side API client instead.

## Use the current headers

New API-key requests use `X-Pitch-Key`. Signed webhooks use:

- `X-Pitch-Signature-Version`
- `X-Pitch-Timestamp`
- `X-Pitch-Signature`
- `X-Pitch-Event`

PITCH temporarily supports equivalent `X-SmartPA-*` aliases for deployed legacy integrations. New integrations should only emit and document `X-Pitch-*` names.

## Verify webhooks before parsing

Read the exact raw request bytes, resolve the signature headers with `readWebhookSignatureHeaders`, and call `verifyWebhookSignature` before parsing JSON. The verifier rejects expired timestamps, malformed signatures, unsupported versions, and conflicting current/legacy headers.

## Make retries safe

Reuse one idempotency key for retries of the same logical operation. Generate a new key for a new announcement, control, or event. Do not use a timestamp alone when concurrent workers could submit the same operation.

The SDK does not retry automatically. Your retry policy should observe `Retry-After`, distinguish retryable transport failures from validation errors, and use an `AbortSignal` to enforce request deadlines.

When polling for [delivery status](/guides/delivery-monitoring), keep credentials in server-side code, begin around a 2-second interval, back off with jitter, and stop at a deadline or terminal result. Never poll sub-second or indefinitely.

Audio upload, TTS preview, and TTS asset creation are rate-limited and may consume storage or character allowance. They do not currently accept an idempotency key. After an ambiguous timeout, inspect the audio library before creating another copy.

## Preserve correlation IDs

Pass your trace identifier as `correlationId`, store the returned correlation ID with your business record, and use it to retrieve the delivery lifecycle when investigating a result.

Raw operational histories have short [maximum retention windows](/guides/data-retention). Persist only the compact business outcomes you need for longer, without secrets or unnecessary payloads.
