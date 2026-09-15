"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";

export interface AcademicContextPickerProps {
  context: {
    yearId: string | null;
    yearName: string | null;
    periodId: string | null;
    periodName: string | null;
  };
  years: Array<{ id: string; name: string; status: string }>;
  periods: Array<{ id: string; name: string; academicYearId: string }>;
}

export function AcademicContextPicker({ context, years, periods }: AcademicContextPickerProps) {
  const router = useRouter();
  const [selectedYearId, setSelectedYearId] = useState<string | null>(context.yearId);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(context.periodId);
  const [savingYear, setSavingYear] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);

  async function handleYearChange(newYearId: string) {
    if (newYearId === selectedYearId) return;

    setSelectedYearId(newYearId);
    setSelectedPeriodId(null);
    setSavingYear(true);

    try {
      const response = await fetch("/api/academy/user-context", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeYearId: newYearId }),
      });

      if (!response.ok) {
        throw new Error("Failed to save academic year");
      }

      router.refresh();
    } catch (error) {
      console.error("Error saving year:", error);
      notifyAcademy({
        tone: "error",
        title: "Failed to save academic year",
        message: "Please try again.",
      });
      setSelectedYearId(context.yearId);
    } finally {
      setSavingYear(false);
    }
  }

  async function handlePeriodChange(newPeriodId: string) {
    if (newPeriodId === selectedPeriodId || !selectedYearId) return;

    setSelectedPeriodId(newPeriodId);
    setSavingPeriod(true);

    try {
      const response = await fetch("/api/academy/user-context", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activePeriodId: newPeriodId }),
      });

      if (!response.ok) {
        throw new Error("Failed to save academic period");
      }

      router.refresh();
    } catch (error) {
      console.error("Error saving period:", error);
      notifyAcademy({
        tone: "error",
        title: "Failed to save academic period",
        message: "Please try again.",
      });
      setSelectedPeriodId(context.periodId);
    } finally {
      setSavingPeriod(false);
    }
  }

  return (
    <div className="admin-context-picker">
      {/* Academic Year Select */}
      {years.length > 0 && (
        <div className="admin-context-picker-field">
          <label htmlFor="academic-year-select" className="admin-context-picker-label">
            Year
          </label>
          <select
            id="academic-year-select"
            className="admin-context-picker-select"
            value={selectedYearId || ""}
            onChange={(e) => handleYearChange(e.target.value)}
            disabled={savingYear}
            aria-label="Select Academic Year"
          >
            {!selectedYearId && <option value="">Select Year</option>}
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Academic Period Select */}
      {selectedYearId && periods.length > 0 && (
        <div className="admin-context-picker-field">
          <label htmlFor="academic-period-select" className="admin-context-picker-label">
            Period
          </label>
          <select
            id="academic-period-select"
            className="admin-context-picker-select"
            value={selectedPeriodId || ""}
            onChange={(e) => handlePeriodChange(e.target.value)}
            disabled={!selectedYearId || savingPeriod}
            aria-label="Select Academic Period"
          >
            {!selectedPeriodId && <option value="">Select Period</option>}
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
