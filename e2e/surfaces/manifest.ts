import { PERSONA_KEYS, type PersonaKey } from "../personas";
import type { ApiEntry, PageEntry } from "./types";

// The registry of every page and API method, and who each is for. The coverage gate
// (src/modules/acceptance/__tests__/surface-manifest.test.ts) fails CI when a page or API
// method exists without an entry here, and the sweeps (e2e/sweep/*) check every entry in a
// real browser against a production build. See docs/testing/e2e-suite.md for how to add one.

/** Every signed-in persona except the student and guardian portals. */
export const STAFF: readonly PersonaKey[] = PERSONA_KEYS.filter((key) => key !== "student" && key !== "guardian");
export const ALL_SIGNED_IN: readonly PersonaKey[] = PERSONA_KEYS;

export const PAGE_MANIFEST: PageEntry[] = [];

export const API_MANIFEST: ApiEntry[] = [];
