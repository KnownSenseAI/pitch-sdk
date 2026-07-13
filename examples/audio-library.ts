import { pitchClient, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const search = process.env.PITCH_ASSET_SEARCH?.trim();
  const language = process.env.PITCH_ASSET_LANGUAGE?.trim();

  const page = await client.audio.list({
    search,
    language,
    limit: 50,
  });

  if (page.assets.length === 0) {
    throw new Error("No matching audio assets were found.");
  }
  const selected = page.assets[0]!;

  for (const asset of page.assets) {
    console.log({
      assetId: asset.id,
      name: asset.name,
      source: asset.source,
      language: asset.language,
      durationMs: asset.duration_ms,
      lifecycle: asset.lifecycle,
      tags: asset.tags,
    });
  }

  console.log("Use a selected stable id in an announcement", {
    content_config: { type: "asset", asset_id: selected.id },
    nextCursor: page.next_cursor,
  });
});
