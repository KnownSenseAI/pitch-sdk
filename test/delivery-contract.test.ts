import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Parameter = {
  name?: string;
  schema?: {
    default?: number;
    maximum?: number;
  };
};

type SchemaProperty = {
  description?: string;
  enum?: string[];
  example?: string[];
};

type PublicContract = {
  paths: Record<string, {
    get: {
      description: string;
      parameters: Parameter[];
    };
  }>;
  components: {
    schemas: Record<string, {
      properties: Record<string, SchemaProperty>;
    }>;
  };
};

const contract = parse(
  readFileSync(new URL("../openapi/pitch-v1.yaml", import.meta.url), "utf8"),
) as PublicContract;

describe("public delivery contract", () => {
  it("keeps the complete customer-scoped delivery query and retention contract", () => {
    const operation = contract.paths["/v1/logs/deliveries"]!.get;
    const queryNames = operation.parameters.flatMap((parameter) => parameter.name ?? []);
    const timeline = contract.components.schemas.DeliveryTimeline!.properties;
    const list = contract.components.schemas.DeliveryTimelineListResponse!.properties;

    expect(queryNames).toEqual(expect.arrayContaining([
      "announcement_id",
      "device_id",
      "output_id",
      "correlation_id",
      "status",
    ]));
    expect(operation.description).toContain("customer-scoped");
    expect(operation.description).toContain("up to seven days");
    expect(timeline.status!.enum).toEqual([
      "played",
      "failed",
      "pending",
      "published",
      "received",
      "started",
    ]);
    expect(timeline).toHaveProperty("failureReason");
    expect(list.cursor!.description).toContain("Opaque next-page cursor");
    expect(list.cursor!.description).toContain("no next page");
  });

  it("keeps the bounded trace query and verified webhook example", () => {
    const trace = contract.paths["/v1/logs/deliveries/trace/{correlationId}"]!.get;
    const limit = trace.parameters.find((parameter) => parameter.name === "limit")!;
    const webhook = contract.components.schemas.CreateWebhookRequest!.properties;

    expect(limit.schema).toMatchObject({ default: 100, maximum: 500 });
    expect(webhook.events!.example).toEqual(["play.completed"]);
    expect(webhook.events!.example).not.toContain("device.offline");
  });
});
