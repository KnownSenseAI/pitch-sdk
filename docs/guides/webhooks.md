# Webhooks

Webhooks deliver selected PITCH events to an HTTPS endpoint. Webhook configuration uses an owner/admin bearer token in v1; normal partner API keys are rejected for those management routes.

## Create a webhook

```ts
const admin = new PitchClient({
  baseUrl: process.env.PITCH_BASE_URL!,
  bearerToken: process.env.PITCH_ADMIN_TOKEN!,
});

const { webhook, secret } = await admin.webhooks.create({
  url: "https://partner.example.com/webhooks/pitch",
  events: ["play.completed"],
});

// Store `secret` now; it is returned only at creation or rotation.
console.log(webhook.id);
```

## Verify delivery

Verify the signature over `timestamp + "." + rawBody` through the SDK helper. Do this before JSON parsing and before enqueuing side effects.

```ts
const signature = readWebhookSignatureHeaders(request.headers);
const valid = signature && verifyWebhookSignature({
  ...signature,
  secret: process.env.PITCH_WEBHOOK_SECRET!,
  body: rawBody,
});

if (!valid) return response.writeHead(401).end();
```

Return a success response quickly after durable acceptance. Process longer work asynchronously, make your handler idempotent, and rotate a secret immediately if it may have been exposed.

`play.completed` is terminal-only: it can report successful playback or a terminal failure, so inspect the payload status. It is not emitted for the intermediate `received` or `started` states. Use [delivery monitoring](/guides/delivery-monitoring) for in-progress polling and for reconciliation after delayed, duplicate, or missed webhook delivery.

Webhook delivery attempts remain queryable for up to seven days. See [Data retention](/guides/data-retention) and persist only the compact business results needed for longer.
