import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  canAdministerGradebook,
  canWriteGradebook,
} from "@/lib/gradebook/policy";
import { buildGradebookReviewModel } from "@/modules/gradebook/review-model";
import type {
  GradebookReadModel,
  GradebookReviewModel,
} from "@/modules/gradebook/types";

export type GradebookPortal = "admin" | "instructor" | "student";

export type GradebookPageState =
  | {
      kind: "ready";
      model: GradebookReviewModel;
    }
  | {
      kind: "denied";
      badge: string;
      message: string;
    };

interface GradebookPageDependencies {
  learnerPersonId?: string;
  resolveActor(): Promise<AcademyActor>;
  loadAdminGradebook(actor: AcademyActor): Promise<GradebookReadModel>;
  loadInstructorGradebook(
    actor: AcademyActor,
    filters: { learnerPersonId?: string },
  ): Promise<GradebookReadModel>;
  loadLearnerGradebook(actor: AcademyActor): Promise<GradebookReadModel>;
}

function denied(badge: string, message: string): GradebookPageState {
  return { kind: "denied", badge, message };
}

export async function loadGradebookPageState(
  portal: GradebookPortal,
  dependencies: GradebookPageDependencies,
): Promise<GradebookPageState> {
  try {
    const actor = await dependencies.resolveActor();

    if (portal === "admin") {
      if (!canAdministerGradebook(actor)) {
        return denied("Forbidden", "Gradebook administration access is required.");
      }

      return {
        kind: "ready",
        model: buildGradebookReviewModel(
          await dependencies.loadAdminGradebook(actor),
          "admin",
        ),
      };
    }

    if (portal === "instructor") {
      if (!canWriteGradebook(actor)) {
        return denied("Forbidden", "Instructor gradebook access is required.");
      }

      return {
        kind: "ready",
        model: buildGradebookReviewModel(
          await dependencies.loadInstructorGradebook(actor, {
            learnerPersonId: dependencies.learnerPersonId,
          }),
          "instructor",
        ),
      };
    }

    if (!actor.roles.includes("student")) {
      return denied("Forbidden", "Learner grade access is required.");
    }

    return {
      kind: "ready",
      model: buildGradebookReviewModel(
        await dependencies.loadLearnerGradebook(actor),
        "student",
      ),
    };
  } catch (error) {
    if (error instanceof AcademyAuthenticationError) {
      return denied(
        "Authentication required",
        "Sign in with an authorized Academy account to view gradebook records.",
      );
    }

    throw error;
  }
}
