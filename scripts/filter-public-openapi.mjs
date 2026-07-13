import { isDeepStrictEqual } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";

const sourcePath = process.argv[2];
const mode = process.argv[3];
if (!sourcePath || (mode !== "--write" && mode !== "--check")) {
  console.error("usage: node scripts/filter-public-openapi.mjs <openapi.yaml> --write|--check");
  process.exit(2);
}

const source = parse(readFileSync(sourcePath, "utf8"));
const filtered = publicContract(source);

if (mode === "--check") {
  if (!isDeepStrictEqual(source, filtered)) {
    console.error("public OpenAPI contains non-partner paths, development servers, or unreachable components");
    process.exit(1);
  }
} else {
  writeFileSync(sourcePath, stringify(filtered, { lineWidth: 0 }));
}

function publicContract(document) {
  const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
  const paths = {};

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    const publicItem = {};
    for (const [key, value] of Object.entries(item ?? {})) {
      if (methods.has(key) && value?.["x-pitch-partner"] === true) publicItem[key] = value;
    }
    if (Object.keys(publicItem).length > 0) paths[path] = publicItem;
  }

  const securityNames = new Set();
  collectSecurityNames(document.security, securityNames);
  for (const item of Object.values(paths)) {
    for (const operation of Object.values(item)) collectSecurityNames(operation.security, securityNames);
  }

  const components = {};
  const visited = new Set();
  const pending = [];
  collectRefs(paths, pending);

  while (pending.length > 0) {
    const ref = pending.pop();
    if (visited.has(ref)) continue;
    visited.add(ref);
    const match = /^#\/components\/([^/]+)\/(.+)$/.exec(ref);
    if (!match) continue;
    const [, category, encodedName] = match;
    const name = decodePointer(encodedName);
    const value = document.components?.[category]?.[name];
    if (value === undefined) throw new Error(`unresolved component reference: ${ref}`);
    components[category] ??= {};
    components[category][name] = value;
    collectRefs(value, pending);
  }

  for (const name of securityNames) {
    const value = document.components?.securitySchemes?.[name];
    if (value === undefined) throw new Error(`unresolved security scheme: ${name}`);
    components.securitySchemes ??= {};
    components.securitySchemes[name] = value;
  }

  return {
    ...document,
    servers: (document.servers ?? []).filter((server) => server.description === "Production"),
    paths,
    components,
  };
}

function collectRefs(value, pending) {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, pending);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (typeof value.$ref === "string") pending.push(value.$ref);
  for (const child of Object.values(value)) collectRefs(child, pending);
}

function collectSecurityNames(security, names) {
  for (const requirement of security ?? []) {
    for (const name of Object.keys(requirement)) names.add(name);
  }
}

function decodePointer(value) {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}
