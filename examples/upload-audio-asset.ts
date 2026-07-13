import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const path = requireEnv("PITCH_AUDIO_FILE");
  const filename = basename(path);
  const bytes = await readFile(path);
  const language = process.env.PITCH_ASSET_LANGUAGE?.trim();

  const asset = await client.audio.upload({
    file: new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
    filename,
    metadata: {
      name: process.env.PITCH_ASSET_NAME?.trim() || filename,
      ...(language ? { language } : {}),
      lifecycle: "permanent",
      tags: ["sdk-upload"],
    },
  });

  console.log("audio asset uploaded", {
    assetId: asset.id,
    name: asset.name,
    durationMs: asset.duration_ms,
    content_config: { type: "asset", asset_id: asset.id },
  });
});
