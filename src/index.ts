export { PitchClient } from "./client.js";
export type { AudioUploadInput, DeliveryListQuery, DeliveryTraceOptions, PitchClientOptions, RequestOptions, SuccessResponse } from "./client.js";
export { PitchAPIError } from "./errors.js";
export {
  LEGACY_SMARTPA_WEBHOOK_HEADERS,
  PITCH_WEBHOOK_HEADERS,
  readWebhookSignatureHeaders,
  verifyWebhookSignature,
} from "./webhooks.js";
export type { VerifyWebhookOptions, WebhookHeaderSource, WebhookSignatureHeaders } from "./webhooks.js";
export type { paths, components, operations } from "./generated/openapi.js";
