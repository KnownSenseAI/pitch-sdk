import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const parentId = process.env.PITCH_PARENT_FOLDER_ID?.trim() || "root";
  const folderName = requireEnv("PITCH_FOLDER_NAME");
  const filePath = requireEnv("PITCH_AUDIO_FILE");
  const filename = basename(filePath);

  const candidates = await client.audio.folders.list({
    parent_id: parentId,
    search: folderName,
    limit: 100,
  });
  const existing = candidates.folders.find((folder) =>
    folder.name === folderName && (folder.parent_id ?? "root") === parentId
  );
  const folder = existing ?? await client.audio.folders.create({
    name: folderName,
    parent_id: parentId,
  });

  const bytes = await readFile(filePath);
  const language = process.env.PITCH_ASSET_LANGUAGE?.trim();
  const asset = await client.audio.upload({
    file: new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
    filename,
    metadata: {
      name: process.env.PITCH_ASSET_NAME?.trim() || filename,
      folder_id: folder.id,
      ...(language ? { language } : {}),
      lifecycle: "permanent",
      tags: ["sdk-folder-workflow"],
    },
  });

  const contents = await client.audio.list({ folder_id: folder.id, limit: 100 });
  console.log("folder workflow stable IDs", {
    folderId: folder.id,
    uploadedAssetId: asset.id,
    assetIds: contents.assets.map((item) => item.id),
  });
});
