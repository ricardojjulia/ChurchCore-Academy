import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
} from "@/modules/academy-auth/errors";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { assertAdmissionsAccess } from "@/modules/admissions/policy";
import { buildAdmissionReviewModel } from "@/modules/admissions/review-model";
import { AdmissionApplication } from "@/modules/admissions/types";

export type AdmissionsPageState =
  | {
      kind: "ready";
      model: ReturnType<typeof buildAdmissionReviewModel>;
    }
  | {
      kind: "denied";
      badge: string;
      message: string;
    };

interface AdmissionsPageDependencies {
  resolveActor(): Promise<AcademyActor>;
  loadApplications(actor: AcademyActor): Promise<AdmissionApplication[]>;
}

export async function loadAdmissionsPageState(
  dependencies: AdmissionsPageDependencies,
): Promise<AdmissionsPageState> {
  try {
    const actor = await dependencies.resolveActor();
    assertAdmissionsAccess(actor, actor.tenantId, actor.userId, "review");
    const applications = await dependencies.loadApplications(actor);

    return {
      kind: "ready",
      model: buildAdmissionReviewModel(applications, {
        includeApplicantContact: true,
      }),
    };
  } catch (error) {
    if (error instanceof AcademyAuthenticationError) {
      return {
        kind: "denied",
        badge: "Authentication required",
        message:
          "Sign in with an authorized Academy account to review admissions applications.",
      };
    }
    if (error instanceof AcademyAuthorizationError) {
      return {
        kind: "denied",
        badge: "Forbidden",
        message:
          "Admissions staff authorization is required for this workspace.",
      };
    }
    throw error;
  }
}
