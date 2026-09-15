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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  OfficialRecordRule,
  OfficialRecordType,
  GradingStatus,
  PostingAuthority,
} from "@/modules/grading-records/types";
import type { InstitutionMode } from "@/modules/academy-config/types";

interface OfficialRecordRuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  rule?: OfficialRecordRule;
}

type FormData = {
  recordType: OfficialRecordType;
  appliesToInstitutionMode: InstitutionMode;
  postingAuthority: PostingAuthority;
  releasePolicy: string;
  includedInTranscript: boolean;
  includedInProgressReport: boolean;
  includedInCompletionRecord: boolean;
  includedInPromotion: boolean;
  includedInGraduationAudit: boolean;
  status: GradingStatus;
};

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

const INSTITUTION_MODE_OPTIONS = [
  { value: "bible_school", label: "Bible School" },
  { value: "seminary", label: "Seminary" },
  { value: "college", label: "College" },
  { value: "university", label: "University" },
  { value: "childrens_school", label: "Children's School" },
  { value: "youth_seminary", label: "Youth Seminary" },
  { value: "ministry_training_center", label: "Ministry Training Center" },
  { value: "continuing_education", label: "Continuing Education" },
  { value: "homeschool_hybrid", label: "Homeschool Hybrid" },
  { value: "mixed", label: "Mixed" },
];

const POSTING_AUTHORITY_OPTIONS = [
  { value: "registrar", label: "Registrar" },
  { value: "academic_admin", label: "Academic Admin" },
  { value: "dean", label: "Dean" },
  { value: "institution_admin", label: "Institution Admin" },
];

const RELEASE_POLICY_OPTIONS = [
  { value: "registrar_release", label: "Registrar Release" },
  { value: "teacher_releases_after_review", label: "Teacher Releases After Review" },
  { value: "immediate_after_posting", label: "Immediate After Posting" },
  { value: "manual_hold", label: "Manual Hold" },
  { value: "guardian_release_after_review", label: "Guardian Release After Review" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export function OfficialRecordRuleFormDialog({ open, onOpenChange, mode, rule }: OfficialRecordRuleFormDialogProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (mode === "edit" && rule) {
      reset({
        recordType: rule.recordType,
        appliesToInstitutionMode: rule.appliesToInstitutionMode,
        postingAuthority: rule.postingAuthority,
        releasePolicy: rule.releasePolicy,
        includedInTranscript: rule.includedInTranscript,
        includedInProgressReport: rule.includedInProgressReport,
        includedInCompletionRecord: rule.includedInCompletionRecord,
        includedInPromotion: rule.includedInPromotion,
        includedInGraduationAudit: rule.includedInGraduationAudit,
        status: rule.status,
      });
    } else if (mode === "create") {
      reset({
        recordType: "transcript",
        appliesToInstitutionMode: "bible_school",
        postingAuthority: "registrar",
        releasePolicy: "registrar_release",
        includedInTranscript: true,
        includedInProgressReport: false,
        includedInCompletionRecord: false,
        includedInPromotion: false,
        includedInGraduationAudit: false,
        status: "active",
      });
    }
  }, [mode, rule, open, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        recordType: data.recordType,
        appliesToInstitutionMode: data.appliesToInstitutionMode,
        postingAuthority: data.postingAuthority,
        releasePolicy: data.releasePolicy,
        includedInTranscript: data.includedInTranscript,
        includedInProgressReport: data.includedInProgressReport,
        includedInCompletionRecord: data.includedInCompletionRecord,
        includedInPromotion: data.includedInPromotion,
        includedInGraduationAudit: data.includedInGraduationAudit,
        status: data.status,
      };

      const url = mode === "create" ? "/api/academy/config/grading/official-record-rules" : `/api/academy/config/grading/official-record-rules/${rule?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? `Failed to ${mode} official record rule.`);
      }

      notifyAcademy({
        tone: "success",
        title: mode === "create" ? "Official record rule created" : "Official record rule updated",
        message: `Official record rule successfully ${mode === "create" ? "created" : "updated"}.`,
      });

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: mode === "create" ? "Creation failed" : "Update failed",
        message: error instanceof Error ? error.message : `Failed to ${mode} official record rule.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Official Record Rule" : "Edit Official Record Rule"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Define posting and release rules for an official record type."
              : "Update the official record rule configuration."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} id="record-rule-form" className="grid gap-4 py-4">
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
            <Label htmlFor="appliesToInstitutionMode" className="text-right">Institution Mode</Label>
            <div className="col-span-3">
              <Controller
                name="appliesToInstitutionMode"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="appliesToInstitutionMode"
                    value={field.value}
                    onChange={field.onChange}
                    data={INSTITUTION_MODE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="postingAuthority" className="text-right">Posting Authority</Label>
            <div className="col-span-3">
              <Controller
                name="postingAuthority"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="postingAuthority"
                    value={field.value}
                    onChange={field.onChange}
                    data={POSTING_AUTHORITY_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="releasePolicy" className="text-right">Release Policy</Label>
            <div className="col-span-3">
              <Controller
                name="releasePolicy"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="releasePolicy"
                    value={field.value}
                    onChange={field.onChange}
                    data={RELEASE_POLICY_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includedInTranscript" className="text-right">Include in Transcript</Label>
            <div className="col-span-3 flex items-center">
              <input
                type="checkbox"
                id="includedInTranscript"
                {...register("includedInTranscript")}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includedInProgressReport" className="text-right">Include in Progress Report</Label>
            <div className="col-span-3 flex items-center">
              <input
                type="checkbox"
                id="includedInProgressReport"
                {...register("includedInProgressReport")}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includedInCompletionRecord" className="text-right">Include in Completion Record</Label>
            <div className="col-span-3 flex items-center">
              <input
                type="checkbox"
                id="includedInCompletionRecord"
                {...register("includedInCompletionRecord")}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includedInPromotion" className="text-right">Include in Promotion</Label>
            <div className="col-span-3 flex items-center">
              <input
                type="checkbox"
                id="includedInPromotion"
                {...register("includedInPromotion")}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includedInGraduationAudit" className="text-right">Include in Graduation Audit</Label>
            <div className="col-span-3 flex items-center">
              <input
                type="checkbox"
                id="includedInGraduationAudit"
                {...register("includedInGraduationAudit")}
                className="h-4 w-4 rounded border-input"
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
          <Button type="submit" form="record-rule-form" disabled={isSubmitting}>
            {isSubmitting ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Rule" : "Save Changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
