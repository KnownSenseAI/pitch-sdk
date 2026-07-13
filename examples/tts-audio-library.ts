import { pitchClient, requireEnv, runExample } from "./_shared.js";

await runExample(async () => {
  const client = pitchClient();
  const intent = requireEnv("PITCH_TTS_INTENT");
  const language = process.env.PITCH_TTS_LANGUAGE?.trim() || "en";
  const composed = await client.tts.compose({
    intent,
    language,
    ...(process.env.PITCH_TTS_AUDIENCE?.trim() ? { audience: process.env.PITCH_TTS_AUDIENCE.trim() } : {}),
    ...(process.env.PITCH_TTS_VENUE?.trim() ? { venue_type: process.env.PITCH_TTS_VENUE.trim() } : {}),
    ...(process.env.PITCH_TTS_TONE?.trim() ? { tone: process.env.PITCH_TTS_TONE.trim() } : {}),
    ...(process.env.PITCH_TTS_PACE?.trim() ? { pace: Number(process.env.PITCH_TTS_PACE) } : {}),
    ...(process.env.PITCH_TTS_ASSET_HINT?.trim() ? { asset_hint: process.env.PITCH_TTS_ASSET_HINT.trim() } : {}),
    ...(process.env.PITCH_TTS_MAX_CHARS?.trim() ? { max_chars: Number(process.env.PITCH_TTS_MAX_CHARS) } : {}),
  });

  console.log("composition review", {
    text: composed.text,
    language: composed.language,
    warnings: composed.warnings ?? [],
    validationIssues: composed.validation_issues ?? [],
  });

  const speech = {
    text: composed.text,
    language: composed.language,
    ...(composed.speaker ? { voice: composed.speaker } : {}),
    speed: composed.pace,
    ...(composed.style_tags ? { style_tags: composed.style_tags } : {}),
  };

  const preview = await client.tts.preview(speech);
  console.log("temporary TTS preview", {
    audioUrl: preview.audio_url,
    durationMs: preview.duration_ms,
    selectedVoice: preview.resolved_voice,
    charactersBilled: preview.chars_billed,
  });

  if (process.env.PITCH_TTS_APPROVED !== "true") {
    console.log("Review the text, validation issues, and preview; rerun with PITCH_TTS_APPROVED=true to save once.");
    return;
  }

  const folderId = process.env.PITCH_FOLDER_ID?.trim();
  const asset = await client.audio.createFromTTS({
    ...speech,
    name: process.env.PITCH_ASSET_NAME?.trim() || composed.asset_name_suggestion,
    ...(folderId ? { folder_id: folderId } : {}),
  });
  console.log("durable TTS asset created", {
    assetId: asset.id,
    name: asset.name,
    content_config: { type: "asset", asset_id: asset.id },
  });
});
