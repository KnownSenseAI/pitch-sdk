---
layout: home

hero:
  name: PITCH Developer Platform
  text: Deliver the right announcement to the right output.
  tagline: A server-side TypeScript SDK and Partner API for instant audio, schedules, business events, output controls, and delivery proof.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Browse the API
      link: /api-reference

features:
  - title: Output-aware targeting
    details: Discover devices and their available outputs, preflight targets, and address the main or a named output explicitly.
  - title: Reliable server integrations
    details: Use caller-owned idempotency keys, correlation IDs, structured errors, and delivery traces without exposing credentials in a browser.
  - title: Product workflows, not infrastructure
    details: Build instant announcements, recurring schedules, business-event automation, webhooks, and operational controls through one supported contract.
---

## Choose a workflow

- [Find, upload, or generate audio](/guides/audio-library-and-tts) and store the selected asset ID.
- Build an approved multilingual workflow with [Production TTS](/guides/production-tts).
- Render versioned names and phrases with [Canonical speech rendering](/guides/canonical-speech).
- Send an [instant announcement](/guides/instant-announcements) from an uploaded audio asset.
- Preview and create a [scheduled announcement](/guides/scheduled-announcements).
- Repeat one asset inside an operating window with a [repetitive announcement](/guides/repetitive-announcements).
- Play several assets in order with a [chained announcement](/guides/chained-announcements).
- Turn an application signal into a [business event](/guides/business-events).
- Apply an audited [output control](/guides/output-controls).
- Confirm playback with [delivery summaries and traces](/guides/delivery-monitoring).
- Receive signed status updates through [webhooks](/guides/webhooks).
- Understand the platform's [short data-retention windows](/guides/data-retention).

The SDK targets Node.js 22 or newer and uses the current `X-Pitch-*` headers. PITCH retains temporary server-side support for legacy `X-SmartPA-*` headers used by already-deployed devices and integrations.
