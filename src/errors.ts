export class PitchAPIError extends Error {
  readonly status: number;
  readonly code?: string | undefined;
  readonly details?: unknown;
  readonly body: unknown;
  readonly correlationId?: string | undefined;
  readonly retryAfter?: string | undefined;
  readonly rateLimit?: { limit?: string | undefined; remaining?: string | undefined } | undefined;

  constructor(message: string, options: {
    status: number;
    code?: string | undefined;
    details?: unknown;
    body: unknown;
    correlationId?: string | undefined;
    retryAfter?: string | undefined;
    rateLimit?: { limit?: string | undefined; remaining?: string | undefined } | undefined;
  }) {
    super(message);
    this.name = "PitchAPIError";
    this.status = options.status;
    this.body = options.body;
    if (options.code !== undefined) this.code = options.code;
    if (options.details !== undefined) this.details = options.details;
    if (options.correlationId !== undefined) this.correlationId = options.correlationId;
    if (options.retryAfter !== undefined) this.retryAfter = options.retryAfter;
    if (options.rateLimit !== undefined) this.rateLimit = options.rateLimit;
  }
}
