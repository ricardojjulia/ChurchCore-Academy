import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Filesystem discovery of every App Router surface. The coverage gate
// (src/modules/acceptance/__tests__/surface-manifest.test.ts) compares this against
// e2e/surfaces/manifest.ts, so a new page or API method can't ship without being registered.

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export interface DiscoveredPage {
  path: string;
  file: string;
}

export interface DiscoveredApiRoute {
  path: string;
  file: string;
  methods: HttpMethod[];
}

const appDir = path.join(process.cwd(), "src/app");

function walk(dir: string, fileName: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, fileName, found);
    else if (entry === fileName) found.push(full);
  }
  return found;
}

function routePath(file: string, fileName: string) {
  const relative = path.relative(appDir, path.dirname(file)).split(path.sep);
  // Route groups "(name)" don't appear in the URL.
  const segments = relative.filter((segment) => segment && !/^\(.*\)$/.test(segment));
  return segments.length ? `/${segments.join("/")}` : "/";
}

export function discoverPages(): DiscoveredPage[] {
  return walk(appDir, "page.tsx")
    .map((file) => ({ path: routePath(file, "page.tsx"), file: path.relative(process.cwd(), file) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function exportedMethods(source: string): HttpMethod[] {
  const methods = new Set<HttpMethod>();
  for (const match of source.matchAll(/^export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/gm)) {
    methods.add(match[1] as HttpMethod);
  }
  for (const match of source.matchAll(/^export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/gm)) {
    methods.add(match[1] as HttpMethod);
  }
  for (const match of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const name of match[1].split(",").map((part) => part.trim().split(/\s+as\s+/).pop()?.trim())) {
      if (name && (HTTP_METHODS as string[]).includes(name)) methods.add(name as HttpMethod);
    }
  }
  return HTTP_METHODS.filter((method) => methods.has(method));
}

export function discoverApiRoutes(): DiscoveredApiRoute[] {
  return walk(path.join(appDir, "api"), "route.ts")
    .map((file) => ({
      path: routePath(file, "route.ts"),
      file: path.relative(process.cwd(), file),
      methods: exportedMethods(readFileSync(file, "utf8")),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
