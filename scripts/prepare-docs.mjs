import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("docs/public", { recursive: true });
copyFileSync("openapi/pitch-v1.yaml", "docs/public/pitch-v1.yaml");
