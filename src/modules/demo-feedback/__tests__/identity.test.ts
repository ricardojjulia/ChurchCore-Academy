import assert from "node:assert/strict";
import test from "node:test";
import { resolveDemoFeedbackIdentity } from "@/modules/demo-feedback/identity";

test("authenticated identity is derived on the server", async () => {
  const identity = await resolveDemoFeedbackIdentity(async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            email: "Admin@ChurchCore.test",
            app_metadata: { role: "platform_staff" },
            user_metadata: {},
          },
        },
        error: null,
      }),
    },
  }));

  assert.deepEqual(identity, {
    userEmail: "admin@churchcore.test",
    userRole: "platform_staff",
  });
});

test("anonymous feedback stores no identity", async () => {
  const identity = await resolveDemoFeedbackIdentity(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: null,
      }),
    },
  }));

  assert.deepEqual(identity, {
    userEmail: null,
    userRole: null,
  });
});
