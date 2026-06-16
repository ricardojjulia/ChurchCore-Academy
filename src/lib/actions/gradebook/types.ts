import type { AcademyActor } from "@/modules/academy-auth/policy";

export interface GradebookQueryResult<T = Record<string, unknown>> {
  rowCount: number | null;
  rows: T[];
}

export interface GradebookQueryClient {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<GradebookQueryResult<T>>;
}

export interface GradebookActionDependencies {
  resolveActor(): Promise<AcademyActor>;
  runInDatabaseContext<T>(
    actor: AcademyActor,
    operation: (client: GradebookQueryClient) => Promise<T>,
  ): Promise<T>;
  revalidate(path: string): void;
}

export type GradebookActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
