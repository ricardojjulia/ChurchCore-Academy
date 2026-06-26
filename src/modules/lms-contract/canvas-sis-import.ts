export type CanvasSisCsvKind = "users" | "courses" | "sections" | "enrollments";

export interface CanvasSisImportConfiguration {
  tenantId: string;
  accountId: string;
  sisImportEnabled?: boolean;
  batchModeEnabled?: boolean;
  batchModeChangeThreshold?: number;
}

export interface BuildCanvasSisImportRequestInput {
  tenantId: string;
  csvKind: CanvasSisCsvKind;
  csvBody: string;
  batchMode?: boolean;
  changeCount: number;
  idempotencyKey: string;
}

export interface CanvasSisImportRequest {
  path: string;
  body: {
    import_type: "instructure_csv";
    extension: "csv";
    batch_mode: boolean;
    batch_mode_term_id?: string;
    attachment: string;
  };
  auditMetadata: {
    csvKind: CanvasSisCsvKind;
    batchMode: boolean;
    changeCount: number;
    changeThreshold?: number;
    idempotencyKey: string;
  };
}

function assertTenantMatch(config: CanvasSisImportConfiguration, input: BuildCanvasSisImportRequestInput) {
  if (config.tenantId !== input.tenantId) {
    throw new Error("Cannot build Canvas SIS import across tenants.");
  }
}

export function buildCanvasSisImportRequest(
  config: CanvasSisImportConfiguration,
  input: BuildCanvasSisImportRequestInput,
): CanvasSisImportRequest {
  assertTenantMatch(config, input);

  if (!input.idempotencyKey.trim()) {
    throw new Error("Canvas SIS import requires an idempotency key.");
  }

  if (!config.sisImportEnabled) {
    throw new Error("Canvas SIS import is disabled for this tenant.");
  }

  const batchMode = input.batchMode === true;
  if (batchMode && !config.batchModeEnabled) {
    throw new Error("Canvas SIS batch mode is disabled by default.");
  }

  if (batchMode) {
    const threshold = config.batchModeChangeThreshold;
    if (threshold == null || threshold < 1 || input.changeCount > threshold) {
      throw new Error("Canvas SIS batch mode requires a configured change threshold that allows this import.");
    }
  }

  return {
    path: `/accounts/${encodeURIComponent(config.accountId)}/sis_imports`,
    body: {
      import_type: "instructure_csv",
      extension: "csv",
      batch_mode: batchMode,
      attachment: input.csvBody,
    },
    auditMetadata: {
      csvKind: input.csvKind,
      batchMode,
      changeCount: input.changeCount,
      changeThreshold: config.batchModeChangeThreshold,
      idempotencyKey: input.idempotencyKey,
    },
  };
}
