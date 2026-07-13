import { pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const text = requireEnv("PITCH_TTS_TEXT");
  const language = process.env.PITCH_TTS_LANGUAGE?.trim() || "en";
  const name = process.env.PITCH_ASSET_NAME?.trim() || `Generated announcement ${new Date().toISOString()}`;
  const voice = process.env.PITCH_TTS_VOICE?.trim();

  const speech = {
    text,
    language,
    ...(voice ? { voice } : {}),
  };

  const preview = await client.tts.preview(speech);
  console.log("temporary TTS preview", {
    audioUrl: preview.audio_url,
    durationMs: preview.duration_ms,
    selectedVoice: preview.resolved_voice,
    charactersBilled: preview.chars_billed,
  });

  if (process.env.PITCH_TTS_APPROVED !== "true") {
    console.log("Review the preview, then rerun with PITCH_TTS_APPROVED=true to save it to the audio library.");
    return;
  }

  const asset = await client.audio.createFromTTS({ ...speech, name });
  console.log("durable TTS asset created", {
    assetId: asset.id,
    name: asset.name,
    content_config: { type: "asset", asset_id: asset.id },
  });
});
