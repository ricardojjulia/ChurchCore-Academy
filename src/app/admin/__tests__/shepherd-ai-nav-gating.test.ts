import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// The "ShepherdAI Queue" sidebar link (Daily Ops section) was shown to every staff role
// unconditionally, but /admin/workflows itself only allows the "academic_admin" role
// (assertShepherdAiAccess). Any staff member without that role (institution_admin, registrar,
// faculty, etc.) could click the nav link straight into an access-denied dead end. This is the
// same bug class already found and fixed once for the dashboard's ShepherdAI tile (PR #108) and
// again for the denomination/alumni nav links (PR #119) — that history didn't cover this
// specific sidebar link. Found via the 2026-09-17 daily checkup.

test("admin capability context carries a role-derived canReadShepherdAi flag, not a capability flag", async () => {
  const context = await readFile(
    path.join(process.cwd(), "src/components/admin-capability-context.tsx"),
    "utf8",
  );

  assert.match(context, /canReadShepherdAi: boolean/);
  assert.match(context, /canReadShepherdAi: false/);
});

test("admin layout computes canReadShepherdAi from the actor's role via canAccessShepherdAi, not an institution capability", async () => {
  const layout = await readFile(
    path.join(process.cwd(), "src/app/admin/layout.tsx"),
    "utf8",
  );

  assert.match(layout, /import \{ canAccessShepherdAi \} from "@\/modules\/academy-auth\/policy"/);
  assert.match(layout, /canAccessShepherdAi\(actor, actor\.tenantId, "read"\)/);
  assert.match(layout, /canReadShepherdAi=\{capabilityData\.canReadShepherdAi\}/);
});

test("admin shell hides the ShepherdAI Queue sidebar link when the actor cannot read ShepherdAI", async () => {
  const shell = await readFile(
    path.join(process.cwd(), "src/components/admin-shell.tsx"),
    "utf8",
  );

  assert.match(shell, /label: "ShepherdAI Queue", href: "\/admin\/workflows"/);
  assert.match(
    shell,
    /if \(item\.href === "\/admin\/workflows" && !canReadShepherdAi\) \{\s*return false;\s*\}/,
  );
});
