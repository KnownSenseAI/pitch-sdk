import { createHash } from "node:crypto";
import { pitchClient, requireEnv, runExample } from "./_shared.js";

const stableKey = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

await runExample(async () => {
  const client = pitchClient();
  const locale = process.env.PITCH_SPEECH_LOCALE?.trim() || "en-IN";
  const placeId = requireEnv("PITCH_PLACE_ID");
  const placeRevision = requireEnv("PITCH_PLACE_REVISION");
  const displayText = requireEnv("PITCH_PLACE_DISPLAY_TEXT");
  const recipeKey = process.env.PITCH_SPEECH_RECIPE?.trim() || "next_stop";
  const recipeVersion = Number(process.env.PITCH_SPEECH_RECIPE_VERSION?.trim() || "1");

  const lexicon = await client.speech.lexicon.get("mobility.place", placeId, locale);
  if (!lexicon.publishable) throw new Error("The selected place pronunciation is not approved for publication");

  const request = {
    recipe_key: recipeKey,
    recipe_version: recipeVersion,
    locale,
    slots: {
      place: {
        namespace: "mobility.place",
        external_id: placeId,
        revision: placeRevision,
        display_text: displayText,
      },
    },
    voice_profile_version: requireEnv("PITCH_VOICE_PROFILE_VERSION"),
    voice: requireEnv("PITCH_SPEECH_VOICE"),
    target_asset_name: `${recipeKey} - ${displayText} - ${locale}`,
  };

  let operation = await client.speech.renders.resolve(request, stableKey(request));
  for (let attempt = 0; !operation.done && attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    operation = await client.speech.renders.get(operation.operation_id);
  }
  if (!operation.done || operation.status !== "ready" || !operation.speech_rendition_id) {
    throw new Error(`Speech render did not become ready: ${operation.reason_code || operation.status}`);
  }

  const review = await client.speech.renditions.acknowledge(operation.speech_rendition_id);
  if (!review.publishable) throw new Error("The rendered utterance still requires review");

  const deliveryRequest = {
    components: [{ speech_rendition_id: operation.speech_rendition_id, gap_after_ms: 0 }],
    merge_profile_version: "canonical-speech-v1",
  };
  const delivery = await client.speech.deliveryAssets.resolve(deliveryRequest, stableKey(deliveryRequest));
  console.log({ asset_id: delivery.asset_id, checksum_sha256: delivery.checksum_sha256 });
});
