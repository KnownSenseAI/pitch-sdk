<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { withBase } from "vitepress";

const container = ref<HTMLElement>();
let destroyReference: (() => void) | undefined;

onMounted(async () => {
  if (!container.value) return;
  const { createApiReference } = await import("@scalar/api-reference");
  const reference = createApiReference(container.value, {
    url: withBase("/pitch-v1.yaml"),
    theme: "default",
    layout: "modern",
    agent: { disabled: true },
    mcp: { disabled: true },
    telemetry: false,
    showDeveloperTools: "never",
    hideClientButton: true,
    showOperationId: true,
    hideTestRequestButton: true,
    documentDownloadType: "yaml",
    defaultHttpClient: { targetKey: "node", clientKey: "fetch" },
    customCss: 'a[href="https://www.scalar.com"] { display: none !important; }',
  });
  destroyReference = () => reference.destroy();
});

onBeforeUnmount(() => destroyReference?.());
</script>

<template>
  <div ref="container" class="pitch-api-reference" />
</template>
