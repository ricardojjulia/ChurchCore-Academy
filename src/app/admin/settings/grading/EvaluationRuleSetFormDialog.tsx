"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  EvaluationRuleSet,
  EvaluationType,
  OfficialRecordType,
  GradingStatus,
  GpaPolicy,
  CreditPolicy,
  ClockHourPolicy,
  CompetencyPolicy,
  NarrativePolicy,
  PostingPolicy,
  LmsGradeReturnPolicy,
  GradingProfile,
} from "@/modules/grading-records/types";

interface EvaluationRuleSetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  ruleSet?: EvaluationRuleSet;
  gradingProfile: GradingProfile;
  availableScales: Array<{ id: string; name: string }>;
  availableCourses: Array<{ id: string; code: string; title: string }>;
}

type FormData = {
  courseId: string;
  sectionId: string;
  evaluationType: EvaluationType;
  scaleId: string;
  recordType: OfficialRecordType;
  gpaPolicy: GpaPolicy;
  creditPolicy: CreditPolicy;
  clockHourPolicy: ClockHourPolicy;
  competencyPolicy: CompetencyPolicy;
  narrativePolicy: NarrativePolicy;
  postingPolicy: PostingPolicy;
  lmsGradeReturnPolicy: LmsGradeReturnPolicy;
  status: GradingStatus;
};

const EVALUATION_TYPE_OPTIONS = [
  { value: "letter_grade", label: "Letter Grade" },
  { value: "numeric_percentage", label: "Numeric Percentage" },
  { value: "pass_fail", label: "Pass/Fail" },
  { value: "completion", label: "Completion" },
  { value: "competency", label: "Competency" },
  { value: "narrative", label: "Narrative" },
  { value: "attendance_only", label: "Attendance Only" },
  { value: "custom", label: "Custom" },
];

const RECORD_TYPE_OPTIONS = [
  { value: "transcript", label: "Transcript" },
  { value: "progress_record", label: "Progress Record" },
  { value: "completion_record", label: "Completion Record" },
  { value: "report_card", label: "Report Card" },
  { value: "competency_record", label: "Competency Record" },
  { value: "attendance_record", label: "Attendance Record" },
  { value: "graduation_audit", label: "Graduation Audit" },
  { value: "custom", label: "Custom" },
];

const GPA_POLICY_OPTIONS = [
  { value: "included", label: "Included" },
  { value: "excluded", label: "Excluded" },
  { value: "not_applicable", label: "Not Applicable" },
];

const CREDIT_POLICY_OPTIONS = [
  { value: "attempted_and_earned", label: "Attempted and Earned" },
  { value: "attempted_only", label: "Attempted Only" },
  { value: "earned_only", label: "Earned Only" },
  { value: "not_applicable", label: "Not Applicable" },
];

const CLOCK_HOUR_POLICY_OPTIONS = [
  { value: "attempted_and_earned", label: "Attempted and Earned" },
  { value: "attendance_threshold", label: "Attendance Threshold" },
  { value: "not_applicable", label: "Not Applicable" },
];

const COMPETENCY_POLICY_OPTIONS = [
  { value: "not_applicable", label: "Not Applicable" },
  { value: "checklist", label: "Checklist" },
  { value: "progress_summary", label: "Progress Summary" },
  { value: "mastery_required", label: "Mastery Required" },
];

const NARRATIVE_POLICY_OPTIONS = [
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "not_required", label: "Not Required" },
];

const POSTING_POLICY_OPTIONS = [
  { value: "registrar_posting", label: "Registrar Posting" },
  { value: "teacher_submit_registrar_release", label: "Teacher Submit, Registrar Release" },
  { value: "academic_admin_posting", label: "Academic Admin Posting" },
];

const LMS_GRADE_RETURN_POLICY_OPTIONS = [
  { value: "manual_entry_only", label: "Manual Entry Only" },
  { value: "review_before_posting", label: "Review Before Posting" },
  { value: "disabled", label: "Disabled" },
  { value: "direct_post_to_official_record", label: "Direct Post to Official Record" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export function EvaluationRuleSetFormDialog({
  open,
  onOpenChange,
  mode,
  ruleSet,
  gradingProfile,
  availableScales,
  availableCourses,
}: EvaluationRuleSetFormDialogProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (mode === "edit" && ruleSet) {
      reset({
        courseId: ruleSet.courseId,
        sectionId: ruleSet.sectionId ?? "",
        evaluationType: ruleSet.evaluationType,
        scaleId: ruleSet.scaleId,
        recordType: ruleSet.recordType,
        gpaPolicy: ruleSet.gpaPolicy,
        creditPolicy: ruleSet.creditPolicy,
        clockHourPolicy: ruleSet.clockHourPolicy,
        competencyPolicy: ruleSet.competencyPolicy,
        narrativePolicy: ruleSet.narrativePolicy,
        postingPolicy: ruleSet.postingPolicy,
        lmsGradeReturnPolicy: ruleSet.lmsGradeReturnPolicy,
        status: ruleSet.status,
      });
    } else if (mode === "create") {
      reset({
        courseId: availableCourses[0]?.id ?? "",
        sectionId: "",
        evaluationType: "letter_grade",
        scaleId: availableScales[0]?.id ?? "",
        recordType: "transcript",
        gpaPolicy: "included",
        creditPolicy: "attempted_and_earned",
        clockHourPolicy: "not_applicable",
        competencyPolicy: "not_applicable",
        narrativePolicy: "not_required",
        postingPolicy: "registrar_posting",
        lmsGradeReturnPolicy: "manual_entry_only",
        status: "active",
      });
    }
  }, [mode, ruleSet, open, reset, availableScales, availableCourses]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        courseId: data.courseId,
        sectionId: data.sectionId || undefined,
        evaluationType: data.evaluationType,
        scaleId: data.scaleId,
        recordType: data.recordType,
        gpaPolicy: data.gpaPolicy,
        creditPolicy: data.creditPolicy,
        clockHourPolicy: data.clockHourPolicy,
        competencyPolicy: data.competencyPolicy,
        narrativePolicy: data.narrativePolicy,
        postingPolicy: data.postingPolicy,
        lmsGradeReturnPolicy: data.lmsGradeReturnPolicy,
        status: data.status,
      };

      const url = mode === "create" ? "/api/academy/config/grading/rule-sets" : `/api/academy/config/grading/rule-sets/${ruleSet?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? `Failed to ${mode} evaluation rule set.`);
      }

      notifyAcademy({
        tone: "success",
        title: mode === "create" ? "Rule set created" : "Rule set updated",
        message: `Evaluation rule set successfully ${mode === "create" ? "created" : "updated"}.`,
      });

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: mode === "create" ? "Creation failed" : "Update failed",
        message: error instanceof Error ? error.message : `Failed to ${mode} evaluation rule set.`,
      });
    }
  };

  const competencyPolicyOptions = gradingProfile.supportsCompetencies
    ? COMPETENCY_POLICY_OPTIONS
    : COMPETENCY_POLICY_OPTIONS.filter((opt) => opt.value === "not_applicable");

  const narrativePolicyOptions = gradingProfile.supportsNarrativeEvaluation
    ? NARRATIVE_POLICY_OPTIONS
    : NARRATIVE_POLICY_OPTIONS.filter((opt) => opt.value === "not_required");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Evaluation Rule Set" : "Edit Evaluation Rule Set"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Define evaluation rules for a course or section."
              : "Update the evaluation rule set configuration."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} id="ruleset-form" className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="courseId" className="text-right">Course</Label>
            <div className="col-span-3">
              <Controller
                name="courseId"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="courseId"
                    value={field.value}
                    onChange={field.onChange}
                    data={availableCourses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
                  />
                )}
              />
              {availableCourses.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No courses exist for this institution yet — create a course first.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sectionId" className="text-right">Section ID</Label>
            <Input
              id="sectionId"
              {...register("sectionId")}
              className="col-span-3"
              placeholder="Optional — internal section id, not the section code"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="evaluationType" className="text-right">Evaluation Type</Label>
            <div className="col-span-3">
              <Controller
                name="evaluationType"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="evaluationType"
                    value={field.value}
                    onChange={field.onChange}
                    data={EVALUATION_TYPE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="scaleId" className="text-right">Scale</Label>
            <div className="col-span-3">
              <Controller
                name="scaleId"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="scaleId"
                    value={field.value}
                    onChange={field.onChange}
                    data={availableScales.map((s) => ({ value: s.id, label: s.name }))}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="recordType" className="text-right">Record Type</Label>
            <div className="col-span-3">
              <Controller
                name="recordType"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="recordType"
                    value={field.value}
                    onChange={field.onChange}
                    data={RECORD_TYPE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gpaPolicy" className="text-right">GPA Policy</Label>
            <div className="col-span-3">
              <Controller
                name="gpaPolicy"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="gpaPolicy"
                    value={field.value}
                    onChange={field.onChange}
                    data={GPA_POLICY_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="creditPolicy" className="text-right">Credit Policy</Label>
            <div className="col-span-3">
              <Controller
                name="creditPolicy"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="creditPolicy"
                    value={field.value}
                    onChange={field.onChange}
                    data={CREDIT_POLICY_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="clockHourPolicy" className="text-right">Clock Hour Policy</Label>
            <div className="col-span-3">
              <Controller
                name="clockHourPolicy"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="clockHourPolicy"
                    value={field.value}
                    onChange={field.onChange}
                    data={CLOCK_HOUR_POLICY_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="competencyPolicy" className="text-right">Competency Policy</Label>
            <div className="col-span-3">
              <Controller
                name="competencyPolicy"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="competencyPolicy"
                    value={field.value}
                    onChange={field.onChange}
                    data={competencyPolicyOptions}
                    disabled={!gradingProfile.supportsCompetencies}
                  />
                )}
              />
              {!gradingProfile.supportsCompetencies && (
                <p className="text-xs text-muted-foreground mt-1">
                  Competency policies are not supported by this institution&apos;s grading profile.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="narrativePolicy" className="text-right">Narrative Policy</Label>
            <div className="col-span-3">
              <Controller
                name="narrativePolicy"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="narrativePolicy"
                    value={field.value}
                    onChange={field.onChange}
                    data={narrativePolicyOptions}
                    disabled={!gradingProfile.supportsNarrativeEvaluation}
                  />
                )}
              />
              {!gradingProfile.supportsNarrativeEvaluation && (
                <p className="text-xs text-muted-foreground mt-1">
                  Narrative policies are not supported by this institution&apos;s grading profile.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="postingPolicy" className="text-right">Posting Policy</Label>
            <div className="col-span-3">
              <Controller
                name="postingPolicy"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="postingPolicy"
                    value={field.value}
                    onChange={field.onChange}
                    data={POSTING_POLICY_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lmsGradeReturnPolicy" className="text-right">LMS Grade Return</Label>
            <div className="col-span-3">
              <Controller
                name="lmsGradeReturnPolicy"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="lmsGradeReturnPolicy"
                    value={field.value}
                    onChange={field.onChange}
                    data={LMS_GRADE_RETURN_POLICY_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">Status</Label>
            <div className="col-span-3">
              <Controller
                name="status"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="status"
                    value={field.value}
                    onChange={field.onChange}
                    data={STATUS_OPTIONS}
                  />
                )}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="ruleset-form" disabled={isSubmitting}>
            {isSubmitting ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Rule Set" : "Save Changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
