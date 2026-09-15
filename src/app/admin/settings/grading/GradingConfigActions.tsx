"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notifyAcademy } from "@/lib/ui/notifications";
import { EvaluationScaleFormDialog } from "./EvaluationScaleFormDialog";
import { ScaleBandFormDialog } from "./ScaleBandFormDialog";
import { EvaluationRuleSetFormDialog } from "./EvaluationRuleSetFormDialog";
import { OfficialRecordRuleFormDialog } from "./OfficialRecordRuleFormDialog";
import type { GradingRecordsConfiguration } from "@/modules/grading-records/types";

interface GradingConfigActionsProps {
  config: GradingRecordsConfiguration;
  canEdit: boolean;
  availableCourses: Array<{ id: string; code: string; title: string }>;
}

type DialogState =
  | { type: "none" }
  | { type: "scale"; mode: "create" | "edit"; scaleId?: string }
  | { type: "band"; mode: "create" | "edit"; scaleId: string; bandId?: string }
  | { type: "ruleset"; mode: "create" | "edit"; ruleSetId?: string }
  | { type: "record-rule"; mode: "create" | "edit"; ruleId?: string };

export function GradingConfigActions({ config, canEdit, availableCourses }: GradingConfigActionsProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });

  if (!canEdit) {
    return null;
  }

  const handleCloseDialog = () => setDialog({ type: "none" });

  const handleDeleteScale = async (scaleId: string) => {
    if (!confirm("Are you sure you want to delete this evaluation scale? This will fail if any rule sets reference it.")) {
      return;
    }

    try {
      const res = await fetch(`/api/academy/config/grading/scales/${scaleId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to delete evaluation scale.");
      }

      notifyAcademy({
        tone: "success",
        title: "Scale deleted",
        message: "Evaluation scale successfully deleted.",
      });

      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Deletion failed",
        message: error instanceof Error ? error.message : "Failed to delete evaluation scale.",
      });
    }
  };

  const handleDeleteBand = async (bandId: string) => {
    if (!confirm("Are you sure you want to delete this scale band?")) {
      return;
    }

    try {
      const res = await fetch(`/api/academy/config/grading/scale-bands/${bandId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to delete scale band.");
      }

      notifyAcademy({
        tone: "success",
        title: "Scale band deleted",
        message: "Scale band successfully deleted.",
      });

      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Deletion failed",
        message: error instanceof Error ? error.message : "Failed to delete scale band.",
      });
    }
  };

  const handleDeleteRuleSet = async (ruleSetId: string) => {
    if (!confirm("Are you sure you want to delete this evaluation rule set?")) {
      return;
    }

    try {
      const res = await fetch(`/api/academy/config/grading/rule-sets/${ruleSetId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to delete evaluation rule set.");
      }

      notifyAcademy({
        tone: "success",
        title: "Rule set deleted",
        message: "Evaluation rule set successfully deleted.",
      });

      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Deletion failed",
        message: error instanceof Error ? error.message : "Failed to delete evaluation rule set.",
      });
    }
  };

  const handleDeleteOfficialRecordRule = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this official record rule?")) {
      return;
    }

    try {
      const res = await fetch(`/api/academy/config/grading/official-record-rules/${ruleId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to delete official record rule.");
      }

      notifyAcademy({
        tone: "success",
        title: "Record rule deleted",
        message: "Official record rule successfully deleted.",
      });

      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Deletion failed",
        message: error instanceof Error ? error.message : "Failed to delete official record rule.",
      });
    }
  };

  const currentScale = dialog.type === "scale" && dialog.scaleId
    ? config.scales.find((s) => s.id === dialog.scaleId)
    : undefined;

  const currentBand = dialog.type === "band" && dialog.bandId
    ? config.scaleBands.find((b) => b.id === dialog.bandId)
    : undefined;

  const currentRuleSet = dialog.type === "ruleset" && dialog.ruleSetId
    ? config.ruleSets.find((r) => r.id === dialog.ruleSetId)
    : undefined;

  const currentRecordRule = dialog.type === "record-rule" && dialog.ruleId
    ? config.officialRecordRules.find((r) => r.id === dialog.ruleId)
    : undefined;

  return (
    <>
      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Configuration Management</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {/* Scales Management */}
          <div className="border-b border-border pb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Evaluation Scales</h4>
              <Button
                onClick={() => setDialog({ type: "scale", mode: "create" })}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Scale
              </Button>
            </div>
            <div className="grid gap-2 mt-2">
              {config.scales.map((scale) => {
                const bands = config.scaleBands.filter((b) => b.scaleId === scale.id);
                return (
                  <div key={scale.id} className="rounded bg-muted/20 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{scale.name}</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialog({ type: "scale", mode: "edit", scaleId: scale.id })}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialog({ type: "band", mode: "create", scaleId: scale.id })}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Band
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteScale(scale.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {bands.length > 0 && (
                      <div className="grid gap-1 mt-2 pl-4">
                        {bands.map((band) => (
                          <div key={band.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{band.label}</span>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDialog({ type: "band", mode: "edit", scaleId: scale.id, bandId: band.id })}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteBand(band.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rule Sets Management */}
          <div className="border-b border-border pb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Evaluation Rule Sets</h4>
              <Button
                onClick={() => setDialog({ type: "ruleset", mode: "create" })}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Rule Set
              </Button>
            </div>
            <div className="grid gap-2 mt-2">
              {config.ruleSets.map((ruleSet) => (
                <div key={ruleSet.id} className="flex items-center justify-between p-2 rounded bg-muted/20">
                  <span className="text-sm font-medium">{ruleSet.courseId}{ruleSet.sectionId ? ` / ${ruleSet.sectionId}` : ""}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog({ type: "ruleset", mode: "edit", ruleSetId: ruleSet.id })}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRuleSet(ruleSet.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Official Record Rules Management */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Official Record Rules</h4>
              <Button
                onClick={() => setDialog({ type: "record-rule", mode: "create" })}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Record Rule
              </Button>
            </div>
            <div className="grid gap-2 mt-2">
              {config.officialRecordRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-2 rounded bg-muted/20">
                  <span className="text-sm font-medium">{rule.recordType} ({rule.appliesToInstitutionMode})</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog({ type: "record-rule", mode: "edit", ruleId: rule.id })}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteOfficialRecordRule(rule.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {dialog.type === "scale" && (
        <EvaluationScaleFormDialog
          open={true}
          onOpenChange={handleCloseDialog}
          mode={dialog.mode}
          scale={currentScale}
        />
      )}

      {dialog.type === "band" && (
        <ScaleBandFormDialog
          open={true}
          onOpenChange={handleCloseDialog}
          mode={dialog.mode}
          scaleId={dialog.scaleId}
          band={currentBand}
        />
      )}

      {dialog.type === "ruleset" && (
        <EvaluationRuleSetFormDialog
          open={true}
          onOpenChange={handleCloseDialog}
          mode={dialog.mode}
          ruleSet={currentRuleSet}
          gradingProfile={config.gradingProfile}
          availableScales={config.scales.map((s) => ({ id: s.id, name: s.name }))}
          availableCourses={availableCourses}
        />
      )}

      {dialog.type === "record-rule" && (
        <OfficialRecordRuleFormDialog
          open={true}
          onOpenChange={handleCloseDialog}
          mode={dialog.mode}
          rule={currentRecordRule}
        />
      )}
    </>
  );
}
