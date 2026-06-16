import assert from "node:assert/strict";
import test from "node:test";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { loadGradebookPageState } from "@/modules/gradebook/page-state";
import type { GradebookReadModel } from "@/modules/gradebook/types";

const emptyReadModel: GradebookReadModel = {
  records: [],
  overrideAudit: [],
};

test("admin gradebook page state requires admin gradebook access before loading", async () => {
  let loaded = false;
  const state = await loadGradebookPageState("admin", {
    resolveActor: async () => ({
      tenantId: "tenant-1",
      userId: "student-1",
      roles: ["student"],
    }),
    loadAdminGradebook: async () => {
      loaded = true;
      return emptyReadModel;
    },
    loadInstructorGradebook: async () => emptyReadModel,
    loadLearnerGradebook: async () => emptyReadModel,
  });

  assert.equal(loaded, false);
  assert.equal(state.kind, "denied");
  assert.equal(state.badge, "Forbidden");
});

test("instructor gradebook page state loads own section model with learner context", async () => {
  const state = await loadGradebookPageState("instructor", {
    learnerPersonId: "student-1",
    resolveActor: async () => ({
      tenantId: "tenant-1",
      userId: "faculty-1",
      roles: ["faculty"],
    }),
    loadAdminGradebook: async () => emptyReadModel,
    async loadInstructorGradebook(actor, filters) {
      assert.equal(actor.userId, "faculty-1");
      assert.deepEqual(filters, { learnerPersonId: "student-1" });
      return emptyReadModel;
    },
    loadLearnerGradebook: async () => emptyReadModel,
  });

  assert.equal(state.kind, "ready");
  if (state.kind === "ready") {
    assert.equal(state.model.visibilityTier, "instructor");
  }
});

test("learner gradebook page state loads only the actor learner model", async () => {
  const state = await loadGradebookPageState("student", {
    resolveActor: async () => ({
      tenantId: "tenant-1",
      userId: "student-1",
      roles: ["student"],
    }),
    loadAdminGradebook: async () => emptyReadModel,
    loadInstructorGradebook: async () => emptyReadModel,
    async loadLearnerGradebook(actor) {
      assert.equal(actor.userId, "student-1");
      return emptyReadModel;
    },
  });

  assert.equal(state.kind, "ready");
  if (state.kind === "ready") {
    assert.equal(state.model.visibilityTier, "student");
  }
});

test("gradebook page state normalizes authentication failures", async () => {
  const state = await loadGradebookPageState("student", {
    resolveActor: async () => {
      throw new AcademyAuthenticationError();
    },
    loadAdminGradebook: async () => emptyReadModel,
    loadInstructorGradebook: async () => emptyReadModel,
    loadLearnerGradebook: async () => emptyReadModel,
  });

  assert.deepEqual(state, {
    kind: "denied",
    badge: "Authentication required",
    message: "Sign in with an authorized Academy account to view gradebook records.",
  });
});
