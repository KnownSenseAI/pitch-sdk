# Data retention

PITCH operational histories are intentionally short-lived. The windows below are maximum raw-history windows, not an archive or a minimum-availability SLA. Account or customer erasure can remove data sooner.

| Data | Maximum raw-history window |
| --- | --- |
| API request activity | Up to three days |
| Delivery summaries, delivery traces, and playback proof | Up to seven days |
| Partner event occurrences | Up to seven days |
| Webhook delivery attempts | Up to seven days |
| Output-control operation history | Up to seven days |

Current configuration resources are not time-based history. Active announcements and schedules, audio-library items, webhook endpoints, target bindings, zones, and device configuration remain until a customer changes or deletes them, or account erasure applies.

## What API activity contains

Successful API activity is metadata-only. Bounded, sanitized body summaries can appear for HTTP errors only. Do not rely on activity history as a copy of request or response payloads.

Billing usage totals and invoices are compact accounting records, not raw API request, playback, or text-to-speech history. They follow the applicable account and billing policy; expiration of raw history does not make its payloads queryable again through billing records.

## Keep only what your application needs

Persist business outcome IDs and compact results when your application needs them beyond these windows. Avoid copying secrets or unnecessary payload data into your own records, and apply your own access, deletion, and retention controls.

Related operational guidance:

- [Monitor delivery summaries and traces](/guides/delivery-monitoring).
- [Publish and trace business events](/guides/business-events).
- [Receive terminal webhooks](/guides/webhooks).
- [Manage output controls](/guides/output-controls).
