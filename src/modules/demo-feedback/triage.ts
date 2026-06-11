import { DemoFeedbackStoredRecord, DemoFeedbackTriageFilters } from "@/modules/demo-feedback/types";

export function filterDemoFeedbackRecords(records: DemoFeedbackStoredRecord[], filters: DemoFeedbackTriageFilters) {
  return records.filter((record) => {
    if (filters.status === "open" && record.processed) return false;
    if (filters.status === "done" && !record.processed) return false;
    if (filters.category && record.category !== filters.category) return false;

    if (filters.identity) {
      const needle = filters.identity.toLowerCase();
      const haystack = `${record.userEmail ?? ""} ${record.userRole ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (filters.from && record.createdAt < filters.from) return false;
    if (filters.to && record.createdAt > filters.to) return false;

    return true;
  });
}
