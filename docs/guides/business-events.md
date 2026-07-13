# Business events

Business events let your application trigger active event-driven announcements. Your system decides that an event occurred; PITCH receives a stable event identifier, event type, timestamp, and only the business metadata required by your configured rules.

```ts
const occurredAt = new Date().toISOString();

const occurrence = await pitch.events.publish({
  event_id: `order-ready-4815-${occurredAt}`,
  event_type: "order.ready",
  occurred_at: occurredAt,
  data: { order_number: "4815", pickup_counter: "B" },
  interrupt_active: false,
});

console.log(occurrence.correlation_id);
```

`event_id` is the natural idempotency key and the SDK uses it by default. Retrying the same event is safe when the event type and identifier remain unchanged.

Keep payloads small and business-oriented. Top-level scalar fields can participate in stored conditions; nested objects and arrays are not condition inputs. Send the business event needed by the announcement rule, not an upstream data stream.

Persist the returned `correlation_id` and use it to [monitor the event's delivery](/guides/delivery-monitoring). Event occurrences remain queryable for up to seven days; see [Data retention](/guides/data-retention).
