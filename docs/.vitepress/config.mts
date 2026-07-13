import { defineConfig } from "vitepress";

export default defineConfig({
  title: "PITCH Developer Documentation",
  description: "Build announcement and audio-delivery integrations with the PITCH Partner API.",
  base: "/pitch-sdk/",
  cleanUrls: true,
  lastUpdated: true,
  markdown: { lineNumbers: true },
  themeConfig: {
    siteTitle: "PITCH Developers",
    nav: [
      { text: "Guides", link: "/getting-started" },
      { text: "Examples", link: "/examples" },
      { text: "API Reference", link: "/api-reference" },
    ],
    sidebar: [
      {
        text: "Get started",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Install and authenticate", link: "/getting-started" },
          { text: "Security and reliability", link: "/security" },
          { text: "Runnable examples", link: "/examples" },
        ],
      },
      {
        text: "Product guides",
        items: [
          { text: "Audio library and TTS", link: "/guides/audio-library-and-tts" },
          { text: "Instant announcements", link: "/guides/instant-announcements" },
          { text: "Scheduled announcements", link: "/guides/scheduled-announcements" },
          { text: "Repetitive announcements", link: "/guides/repetitive-announcements" },
          { text: "Chained announcements", link: "/guides/chained-announcements" },
          { text: "Delivery monitoring", link: "/guides/delivery-monitoring" },
          { text: "Data retention", link: "/guides/data-retention" },
          { text: "Business events", link: "/guides/business-events" },
          { text: "Output controls", link: "/guides/output-controls" },
          { text: "Webhooks", link: "/guides/webhooks" },
        ],
      },
      {
        text: "Reference",
        items: [{ text: "Partner API", link: "/api-reference" }],
      },
    ],
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/KnownSenseAI/pitch-sdk" }],
    editLink: {
      pattern: "https://github.com/KnownSenseAI/pitch-sdk/edit/main/docs/:path",
      text: "Improve this page on GitHub",
    },
    footer: {
      message: "PITCH Partner API documentation",
      copyright: "Copyright © KnownSenseAI",
    },
  },
});
