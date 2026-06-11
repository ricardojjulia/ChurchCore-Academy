import { DemoFeedbackPostgresRepository } from "@/modules/demo-feedback/postgres-repository";
import { buildDemoFeedbackFingerprint } from "@/modules/demo-feedback/fingerprint";
import { resolveDemoFeedbackIdentity } from "@/modules/demo-feedback/identity";
import { parseDemoFeedbackJsonBody } from "@/modules/demo-feedback/validation";

export class DemoFeedbackService {
  constructor(private readonly repository = new DemoFeedbackPostgresRepository()) {}

  async submitFromJson(json: unknown) {
    const submission = parseDemoFeedbackJsonBody(json);
    const identity = await resolveDemoFeedbackIdentity();
    const fingerprint = buildDemoFeedbackFingerprint(submission);

    return this.repository.submitFeedback(submission, identity, fingerprint);
  }

  async list(filters: Parameters<DemoFeedbackPostgresRepository["listFeedback"]>[0]) {
    return this.repository.listFeedback(filters);
  }

  async update(id: string, update: Parameters<DemoFeedbackPostgresRepository["updateFeedback"]>[1]) {
    return this.repository.updateFeedback(id, update);
  }
}
