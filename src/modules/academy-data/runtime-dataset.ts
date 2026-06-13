import { AcademyDataset } from "@/modules/academy-data/types";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { AcademyDataRepository } from "@/modules/academy-data/postgres-repository";

export type AcademyRuntimeMode = "persistent" | "demo";

interface AcademyDatasetReader {
  loadDataset(tenantId: string): Promise<AcademyDataset>;
}

interface RuntimeDatasetOptions {
  dataset?: AcademyDataset;
  repository?: AcademyDatasetReader;
  environment?: NodeJS.ProcessEnv;
}

export function resolveAcademyRuntimeMode(
  environment: NodeJS.ProcessEnv = process.env,
): AcademyRuntimeMode {
  if (
    environment.NODE_ENV !== "production" &&
    environment.DEMO_MODE_ENABLED === "true"
  ) {
    return "demo";
  }

  if (!environment.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for persistent Academy runtime data.",
    );
  }

  return "persistent";
}

export async function loadRuntimeAcademyDataset(
  tenantId: string,
  options: RuntimeDatasetOptions = {},
): Promise<AcademyDataset> {
  if (options.dataset) {
    return options.dataset;
  }

  const mode = resolveAcademyRuntimeMode(
    options.environment ?? process.env,
  );
  if (mode === "demo") {
    if (tenantId !== academyDataset.tenantId) {
      throw new Error("Demo Academy data is unavailable for this tenant.");
    }
    return academyDataset;
  }

  return (options.repository ?? new AcademyDataRepository()).loadDataset(
    tenantId,
  );
}
