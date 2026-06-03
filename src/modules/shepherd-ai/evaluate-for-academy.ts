import { AcademyDataset } from "@/modules/academy-data/types";
import { ContextBuilder } from "@/modules/shepherd-ai/context-builder";
import { AcademicConcernScorer } from "@/modules/shepherd-ai/academic-concern-scorer";
import { SignalAggregator } from "@/modules/shepherd-ai/signal-aggregator";
import { ShepherdAiEvaluationInput, ShepherdAiSuggestion } from "@/modules/shepherd-ai/types";
import { WorkflowRecommender } from "@/modules/shepherd-ai/workflow-recommender";

/**
 * ShepherdAI for ChurchCore Academy
 *
 * This module is product-specific to ChurchCore Academy.
 * It may only use Academy SIS and education-management data.
 * It must not read from ChurchCore Ops, ChurchCore Learning, or ChurchCore Care.
 *
 * ShepherdAI Academy is not a chatbot.
 * It is an explainable Academic Workflow recommendation engine.
 *
 * Core workflow detection, scoring, confidence, urgency, academic standing,
 * transcript validation, and graduation eligibility checks must be deterministic.
 *
 * Optional LLM support may only be used for wording, explanation polishing,
 * and editable administrative message drafts.
 */
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
        const rank = { critical: 0, high: 1, medium: 2, low: 3 };
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
