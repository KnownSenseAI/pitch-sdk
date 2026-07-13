# Delivery monitoring

Delivery monitoring lets a server-side integration confirm what happened after PITCH accepted an announcement or business event. Keep correlation IDs with your business records so you can move from a summary row to the events for one delivery.

Both delivery views require an API key with the `logs:read` scope.

## Choose the right view

- `client.deliveries.list` returns newest-first summary rows. Use it for dashboards, status checks, pagination, and finding schedule firings by announcement ID.
- `client.deliveries.getTrace` returns ordered diagnostic events for one correlation ID. Events identify the device, output, and message and can include safe metadata.

Use the list for discovery and overview. Fetch a trace only for a selected delivery that needs investigation; tracing every list row creates unnecessary requests.

## Understand lifecycle states

| State | Meaning |
| --- | --- |
| `pending` | PITCH accepted and queued the delivery, but publication has not yet been accepted. |
| `published` | Publication was accepted. This is not proof that the device received the command or played audio. |
| `received` | The device queued the command. |
| `started` | The device reported that playback started. |
| `played` | Terminal proof of successful playback. |
| `failed` | Terminal failure. Inspect `failureReason` and trace event detail for diagnostics. Do not branch business logic on an undocumented reason string. |

An intermediate acknowledgement can be missing even when terminal proof arrives later. Trace event detail reports missing phases, so do not treat an absent `received` or `started` event as terminal by itself.

## Keep the right correlation

The correlation recipe depends on how playback starts:

- For a single-target instant announcement, persist the response `correlation_id`.
- For a multi-target instant announcement, use the response correlation for the group and expect one timeline per device and output. You can also store any per-target response IDs your workflow receives.
- For a business-event publication, persist the occurrence response `correlation_id`.
- Creating or activating a scheduled, repetitive, or chained announcement does not provide correlation IDs for future firings. List deliveries with `announcement_id`, then use each row's `correlationId` to retrieve its trace. Every firing receives a new correlation ID.

```ts
const page = await client.deliveries.list({
  announcement_id: announcementId,
  limit: 100,
});

const failed = page.deliveries.find((delivery) => delivery.status === "failed");
if (failed) {
  const trace = await client.deliveries.getTrace(failed.correlationId, { limit: 200 });
  console.log(trace.events);
}
```

## Paginate within the retention window

Raw delivery history is queryable for up to seven days. Older history is deleted, so persist the business outcome IDs and compact results your application needs for longer. See [Data retention](/guides/data-retention) for the other operational-history windows.

Delivery lists accept a maximum `limit` of 100 and return an opaque `cursor`. Pass that cursor unchanged to retrieve the next page. An empty or omitted cursor means there is no next page. Delivery traces default to 100 events and accept a maximum `limit` of 500.

## Poll safely

When a synchronous workflow must wait for a result, start polling around every 2 seconds. Apply exponential backoff with jitter, cap the interval around 15 seconds, and give the caller a deadline around 2 minutes. Stop as soon as every expected target is `played` or `failed`.

Never poll sub-second or indefinitely. If PITCH responds with `429`, honor `PitchAPIError.retryAfter`. Do not create the announcement again while waiting for its existing delivery result.

For long-lived schedules, do not poll continuously between firings. Prefer terminal webhooks, or query delivery summaries around expected firing times.

## Use terminal webhooks and reconcile

Subscribe to `play.completed` for push delivery of terminal playback results. The event can represent terminal success or failure, so inspect the payload status. PITCH does not emit `play.completed` for the intermediate `received` or `started` states.

Verify the webhook signature before parsing its payload, and process events idempotently. Webhook delivery can be delayed, duplicated, or missed by your endpoint; use the delivery list and a selected trace to reconcile the final state. See [Webhooks](/guides/webhooks) for secure receiver setup.
