import { createServer, type IncomingMessage } from "node:http";
import { readWebhookSignatureHeaders, verifyWebhookSignature } from "../src/index.js";
import { requireEnv } from "./_shared.js";

const secret = requireEnv("PITCH_WEBHOOK_SECRET");
const port = Number(process.env.PORT ?? "3000");

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/webhooks/pitch") {
    response.writeHead(404).end();
    return;
  }

  try {
    const rawBody = await readRawBody(request, 1_000_000);
    const signature = readWebhookSignatureHeaders(request.headers);
    if (!signature || !verifyWebhookSignature({ ...signature, secret, body: rawBody })) {
      response.writeHead(401).end("Invalid signature");
      return;
    }

    // Parse only after verifying the signature over the exact raw bytes.
    const event: unknown = JSON.parse(rawBody.toString("utf8"));
    console.log("verified PITCH event", signature.event, event);
    response.writeHead(204).end();
  } catch (error) {
    console.error(error);
    response.writeHead(400).end("Invalid request");
  }
}).listen(port, () => console.log(`PITCH webhook receiver listening on :${port}`));

async function readRawBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) throw new Error("Webhook body exceeds the configured limit");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}
