import { DemoFeedbackCategory } from "@/modules/demo-feedback/types";

export interface DemoSessionSnapshot {
  sessionId: string;
  breadcrumbs: string[];
  sessionDurationSeconds: number;
  route: string;
  demoVersion: string;
}

export interface BuildClientDemoFeedbackInput {
  category: DemoFeedbackCategory;
  note?: string;
  errorMessage?: string;
  session: DemoSessionSnapshot;
}

export function buildClientDemoFeedbackPayload(input: BuildClientDemoFeedbackInput) {
  return {
    sessionId: input.session.sessionId,
    route: input.session.route,
    category: input.category,
    errorMessage: input.errorMessage,
    note: input.note,
    breadcrumbs: input.session.breadcrumbs,
    demoVersion: input.session.demoVersion,
    sessionDurationSeconds: input.session.sessionDurationSeconds,
  };
}
