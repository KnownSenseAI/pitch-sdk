# Canonical speech rendering

Canonical speech turns versioned recipes and reviewed lexicon entries into reusable, immutable audio. Use it for names and phrases that must remain consistent across announcements, schedules, devices, and applications.

## Resolve an utterance

List `speech-recipes`, resolve each entity through `speech-lexicon`, then submit a complete-utterance render with a stable idempotency key. Slot revisions, recipe version, voice profile version, and synthesis settings are part of the immutable render identity. Reusing a key with different input returns a conflict.

`POST /v1/speech-renders/resolve` may return a cache hit or an asynchronous operation. Poll `GET /v1/speech-renders/{operationId}` until `done` is true. Treat `attention_required`, `failed`, `cancelled`, and `expired` as terminal; inspect `reason_code`, `retryable`, and `next_action` rather than retrying blindly.

## Review and publish

A ready rendition is not automatically publishable. A tenant reviewer must acknowledge the exact checksum using `POST /v1/speech-renditions/{renditionId}/acknowledge`. Acknowledgement is checksum-bound and can be revoked. Platform-catalog publication also requires independent platform review and applicable rights approval; tenant acknowledgement never grants those rights.

## Build delivery audio

Pass only reviewed, complete-utterance rendition IDs to `POST /v1/speech-delivery-assets/resolve`. Components are ordered and can use reviewed `gap_after_ms` values. The response is a managed, immutable audio-library asset suitable for an announcement `asset_id`; editable assets, URLs, fragments, unsafe-script fallbacks, expired rights, and unapproved cues are rejected.

Use a caller-owned stable key for both render and delivery resolution. Persist operation, rendition, asset, recipe, slot revision, locale, and checksum identifiers so later retries and audits refer to the same inputs. See the [runnable canonical speech example](https://github.com/KnownSenseAI/pitch-sdk/blob/main/examples/canonical-speech-render.ts).
