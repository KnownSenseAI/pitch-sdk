import { randomUUID } from "node:crypto";
import { PitchAPIError, PitchClient } from "../src/index.js";

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before running this example.`);
  return value;
}

export function pitchClient(): PitchClient {
  return new PitchClient({
    baseUrl: requireEnv("PITCH_BASE_URL"),
    apiKey: requireEnv("PITCH_API_KEY"),
  });
}

export function idempotencyKey(purpose: string): string {
  return `${purpose}-${randomUUID()}`;
}

export async function runExample(example: () => Promise<void>): Promise<void> {
  try {
    await example();
  } catch (error) {
    if (error instanceof PitchAPIError) {
      console.error("PITCH request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
        correlationId: error.correlationId,
        retryAfter: error.retryAfter,
      });
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  }
}
