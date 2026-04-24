import { AcademyDataset } from "@/modules/academy-data/types";
import { ContextBuilder } from "@/modules/shepherd-ai/context-builder";
import { AcademicConcernScorer } from "@/modules/shepherd-ai/academic-concern-scorer";
import { SignalAggregator } from "@/modules/shepherd-ai/signal-aggregator";
import { ShepherdAiEvaluationInput, ShepherdAiSuggestion } from "@/modules/shepherd-ai/types";
import { WorkflowRecommender } from "@/modules/shepherd-ai/workflow-recommender";

export function evaluateForAcademy(
  input: ShepherdAiEvaluationInput,
  dataset: AcademyDataset,
): ShepherdAiSuggestion[] {
  // ShepherdAI is product-specific in each ChurchCore product and operates
  // only within that product's authorized data boundary.
  if (input.productArea !== "academy") {
    throw new Error("ShepherdAI Academy evaluation only supports the Academy product area.");
  }

  const scorer = new AcademicConcernScorer();
  const contextBuilder = new ContextBuilder();
  const recommender = new WorkflowRecommender();

  return input.signals
    .filter((signal) => !input.entityType || signal.entityType === input.entityType)
    .filter((signal) => !input.entityId || signal.entityId === input.entityId)
    .map((signal) => {
      const score = scorer.score(signal);
      const context = contextBuilder.build(dataset, signal);
      return recommender.recommend(signal, context, score);
    })
    .sort((left, right) => {
      if (left.urgency !== right.urgency) {
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[left.urgency] - rank[right.urgency];
      }

      return right.confidenceScore - left.confidenceScore;
    });
}

export function aggregateAndEvaluateAcademy(dataset: AcademyDataset) {
  const signals = new SignalAggregator().evaluate(dataset);

  const suggestions = evaluateForAcademy(
    {
      tenantId: dataset.tenantId,
      productArea: "academy",
      signals,
      context: {
        institutionName: dataset.institutionName,
      },
    },
    dataset,
  );

  return { signals, suggestions };
}
