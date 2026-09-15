"use client";

import Link from "next/link";
import type React from "react";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, FileCheck2, MessageSquareText, Timer, UserRoundCheck, XCircle } from "lucide-react";
import { AdminUser } from "@/modules/academy-data/types";
import { WorkflowQueueItem } from "@/modules/academic-workflows/repository";
import { QueueFilters, WorkflowCode } from "@/modules/shepherd-ai/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notifyAcademy } from "@/lib/ui/notifications";

interface WorkflowApiResponse {
  queue: WorkflowQueueItem[];
}

interface WorkflowQueueBoardProps {
  initialItems: WorkflowQueueItem[];
  administrators: AdminUser[];
}

const workflowCodeOptions: { value: WorkflowCode | "all"; label: string }[] = [
  { value: "all", label: "All workflow types" },
  { value: "incomplete_enrollment_follow_up", label: "Incomplete enrollment" },
  { value: "missing_documentation_review", label: "Missing documentation" },
  { value: "graduation_eligibility_review", label: "Graduation eligibility" },
  { value: "academic_standing_or_credit_progress_review", label: "Academic progress" },
  { value: "transcript_or_records_inconsistency_review", label: "Transcript records" },
  { value: "faculty_or_course_assignment_imbalance_review", label: "Faculty/course setup" },
  { value: "calendar_setup_review", label: "Calendar setup" },
];

const statusOptions = [
  "all",
  "suggested",
  "promoted_to_workflow",
  "open",
  "assigned",
  "deferred",
  "completed",
  "dismissed",
  "resolved",
];

function entityHref(item: WorkflowQueueItem) {
  if (item.entityType === "student") return `/students/${item.entityId}`;
  if (item.entityType === "program") return `/programs/${item.entityId}`;
  if (item.entityType === "institution") return "/settings/calendar";
  if (item.entityType === "faculty" || item.entityType === "course_section") return "/faculty";
  return "/";
}

function queryString(filters: QueueFilters) {
  const params = new URLSearchParams();
  if (filters.urgency && filters.urgency !== "all") params.set("urgency", filters.urgency);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.workflowCode && filters.workflowCode !== "all") params.set("workflowCode", filters.workflowCode);
  if (filters.assignee && filters.assignee !== "all") params.set("assignee", filters.assignee);
  return params.toString();
}

function urgencyVariant(urgency: WorkflowQueueItem["urgency"]) {
  if (urgency === "critical" || urgency === "high") return "destructive";
  if (urgency === "medium") return "secondary";
  return "outline";
}

function formatCode(value: string) {
  return value.replaceAll("_", " ");
}

export function WorkflowQueueBoard({ initialItems, administrators }: WorkflowQueueBoardProps) {
  const [items, setItems] = useState(initialItems);
  const [filters, setFilters] = useState<QueueFilters>({
    urgency: "all",
    status: "all",
    workflowCode: "all",
    assignee: "all",
  });
  const [selectedUserId, setSelectedUserId] = useState(administrators[0]?.id ?? "");
  const [feedbackType, setFeedbackType] = useState("accepted");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [deferReason, setDeferReason] = useState("");
  const [dismissNote, setDismissNote] = useState("");
  const [busyId, setBusyId] = useState<string>();

  const selectedUserName = useMemo(
    () => administrators.find((admin) => admin.id === selectedUserId)?.name ?? selectedUserId,
    [administrators, selectedUserId],
  );

  async function refresh(nextFilters = filters) {
    const query = queryString(nextFilters);
    const response = await fetch(`/api/academy/workflows${query ? `?${query}` : ""}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as WorkflowApiResponse;
    setItems(payload.queue ?? []);
  }

  async function postAction(itemId: string, path: string, body: Record<string, unknown> = {}) {
    setBusyId(itemId);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Workflow action failed.");
      }

      await refresh();
      notifyAcademy({
        tone: "success",
        title: "Workflow queue updated",
        message: "The local Supabase workflow state has been refreshed.",
      });
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Workflow action failed",
        message: error instanceof Error ? error.message : "Workflow action failed.",
      });
    } finally {
      setBusyId(undefined);
    }
  }

  function updateFilters(next: QueueFilters) {
    setFilters(next);
    void refresh(next);
  }

  return (
    <section className="workflow-board">
      <Card>
        <CardHeader>
          <CardTitle>Queue Filters</CardTitle>
          <CardDescription>Scope the queue by administrative urgency, assignment, status, and workflow type.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="control-grid">
            <FilterSelect
              label="Urgency"
              value={filters.urgency ?? "all"}
              options={["all", "critical", "high", "medium", "low"]}
              onChange={(value) => updateFilters({ ...filters, urgency: value as QueueFilters["urgency"] })}
            />
            <FilterSelect
              label="Status"
              value={filters.status ?? "all"}
              options={statusOptions}
              onChange={(value) => updateFilters({ ...filters, status: value as QueueFilters["status"] })}
            />
            <div className="grid gap-2">
              <span className="filter-label">Workflow type</span>
              <Select
                value={filters.workflowCode ?? "all"}
                onChange={(value) => updateFilters({ ...filters, workflowCode: value as QueueFilters["workflowCode"] })}
                data={workflowCodeOptions}
              />
            </div>
            <div className="grid gap-2">
              <span className="filter-label">Assignee filter</span>
              <Select
                value={filters.assignee ?? "all"}
                onChange={(value) => updateFilters({ ...filters, assignee: value })}
                data={[{ value: "all", label: "All assignees" }, ...administrators.map((admin) => ({ value: admin.id, label: admin.name }))]}
              />
            </div>
            <div className="grid gap-2">
              <span className="filter-label">Action assignee</span>
              <Select
                value={selectedUserId}
                onChange={(value) => setSelectedUserId(value)}
                data={administrators.map((admin) => ({ value: admin.id, label: `${admin.name} · ${admin.title}` }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Queue</CardTitle>
          <CardDescription>
            {items.length} academic workflow items. Actions are written to the local Supabase database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No academic workflow suggestions match the current filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <WorkflowRow
                    key={item.id}
                    item={item}
                    selectedUserId={selectedUserId}
                    selectedUserName={selectedUserName}
                    disabled={busyId === item.id || !selectedUserId}
                    feedbackType={feedbackType}
                    feedbackNotes={feedbackNotes}
                    deferReason={deferReason}
                    dismissNote={dismissNote}
                    onFeedbackTypeChange={setFeedbackType}
                    onFeedbackNotesChange={setFeedbackNotes}
                    onDeferReasonChange={setDeferReason}
                    onDismissNoteChange={setDismissNote}
                    onAction={postAction}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="filter-label">{label}</span>
      <Select
        value={value}
        onChange={onChange}
        data={options.map((option) => ({ value: option, label: option }))}
      />
    </div>
  );
}

function WorkflowRow({
  item,
  selectedUserId,
  selectedUserName,
  disabled,
  feedbackType,
  feedbackNotes,
  deferReason,
  dismissNote,
  onFeedbackTypeChange,
  onFeedbackNotesChange,
  onDeferReasonChange,
  onDismissNoteChange,
  onAction,
}: {
  item: WorkflowQueueItem;
  selectedUserId: string;
  selectedUserName: string;
  disabled: boolean;
  feedbackType: string;
  feedbackNotes: string;
  deferReason: string;
  dismissNote: string;
  onFeedbackTypeChange: (value: string) => void;
  onFeedbackNotesChange: (value: string) => void;
  onDeferReasonChange: (value: string) => void;
  onDismissNoteChange: (value: string) => void;
  onAction: (itemId: string, path: string, body?: Record<string, unknown>) => Promise<void>;
}) {
  const isSuggestion = item.kind === "suggestion";
  const isWorkflow = item.kind === "workflow";
  const canPromote = isSuggestion && item.status !== "promoted_to_workflow" && item.status !== "dismissed" && item.status !== "resolved";
  const canDismiss = isSuggestion && item.status !== "dismissed" && item.status !== "promoted_to_workflow";
  const canSnooze = isSuggestion && (item.status === "suggested" || item.status === "deferred");
  const canComplete = isWorkflow && item.status !== "completed";
  const canDefer = item.status !== "completed" && item.status !== "dismissed";

  return (
    <TableRow>
      <TableCell className="max-w-[34rem] whitespace-normal">
        <div className="grid gap-1">
          <div className="font-medium leading-snug">{item.title}</div>
          <div className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {formatCode(item.workflowCode)}
            </Badge>
            {item.confidenceScore ? <span className="text-xs text-muted-foreground">{item.confidenceScore}% confidence</span> : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={urgencyVariant(item.urgency)} className="capitalize">
          {item.urgency}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {formatCode(item.status)}
        </Badge>
      </TableCell>
      <TableCell>
        <Button variant="link" size="sm" nativeButton={false} render={<Link href={entityHref(item)} />}>
          {formatCode(item.entityType)}
          <ExternalLink />
        </Button>
      </TableCell>
      <TableCell>
        <div className="grid gap-1">
          <span className="text-sm">{item.assignee ?? "Unassigned"}</span>
          <span className="text-xs text-muted-foreground">Action: {selectedUserName}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {canPromote ? (
            <Tooltip label="Promote to workflow">
              <Button
                type="button"
                size="icon-sm"
                disabled={disabled}
                onClick={() =>
                  onAction(item.id, `/api/academy/shepherd-ai/suggestions/${item.id}/promote`, {
                    ownerUserId: selectedUserId,
                    assignedToUserId: selectedUserId,
                  })
                }
              >
                <FileCheck2 />
              </Button>
            </Tooltip>
          ) : null}
          {isWorkflow ? (
            <Tooltip label="Assign review">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  onAction(item.id, `/api/academy/workflows/${item.id}/assign`, {
                    assignedToUserId: selectedUserId,
                  })
                }
              >
                <UserRoundCheck />
              </Button>
            </Tooltip>
          ) : null}
          {canComplete ? (
            <Tooltip label="Mark complete">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onAction(item.id, `/api/academy/workflows/${item.id}/complete`)}
              >
                <CheckCircle2 />
              </Button>
            </Tooltip>
          ) : null}
          {canSnooze ? (
            <SnoozeDialog
              disabled={disabled}
              onSubmit={(snoozeUntil) =>
                onAction(item.id, `/api/academy/shepherd-ai/suggestions/${item.id}/snooze`, {
                  snoozeUntil,
                })
              }
            />
          ) : null}
          {canDefer ? (
            <NoteDialog
              title="Defer workflow item"
              description="Add a short administrative reason for deferring this item."
              value={deferReason}
              onChange={onDeferReasonChange}
              triggerIcon={<Clock3 />}
              triggerLabel="Defer"
              disabled={disabled}
              onSubmit={() => {
                const path = isSuggestion
                  ? `/api/academy/shepherd-ai/suggestions/${item.id}/defer`
                  : `/api/academy/workflows/${item.id}/defer`;
                return onAction(item.id, path, { reason: deferReason || "Deferred from workflow queue." });
              }}
            />
          ) : null}
          {canDismiss ? (
            <NoteDialog
              title="Dismiss suggestion"
              description="Dismiss this suggested workflow after human review."
              value={dismissNote}
              onChange={onDismissNoteChange}
              triggerIcon={<XCircle />}
              triggerLabel="Dismiss"
              disabled={disabled}
              onSubmit={() =>
                onAction(item.id, `/api/academy/shepherd-ai/suggestions/${item.id}/dismiss`, {
                  note: dismissNote || "Dismissed from workflow queue.",
                })
              }
            />
          ) : null}
          {isWorkflow ? (
            <FeedbackDialog
              disabled={disabled}
              feedbackType={feedbackType}
              feedbackNotes={feedbackNotes}
              onFeedbackTypeChange={onFeedbackTypeChange}
              onFeedbackNotesChange={onFeedbackNotesChange}
              onSubmit={() =>
                onAction(item.id, `/api/academy/workflows/${item.id}/feedback`, {
                  userId: selectedUserId,
                  feedbackType,
                  notes: feedbackNotes,
                })
              }
            />
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function NoteDialog({
  title,
  description,
  value,
  onChange,
  triggerIcon,
  triggerLabel,
  disabled,
  onSubmit,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  triggerIcon: React.ReactNode;
  triggerLabel: string;
  disabled: boolean;
  onSubmit: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip label={triggerLabel}>
        <Button type="button" size="icon-sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
          {triggerIcon}
        </Button>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Administrative note" />
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              void onSubmit().then(() => setOpen(false));
            }}
          >
            Save
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SnoozeDialog({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (snoozeUntil: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState(1);

  const snoozeDurations = [
    { value: 1, label: "1 day" },
    { value: 3, label: "3 days" },
    { value: 7, label: "7 days" },
    { value: 30, label: "30 days" },
  ];

  function getSnoozeUntil(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  return (
    <>
      <Tooltip label="Snooze">
        <Button type="button" size="icon-sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
          <Timer />
        </Button>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze suggestion</DialogTitle>
            <DialogDescription>Hide this suggestion temporarily. It will reappear after the selected duration.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Select
              value={String(selectedDays)}
              onChange={(value) => setSelectedDays(Number(value))}
              data={snoozeDurations.map((d) => ({ value: String(d.value), label: d.label }))}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                void onSubmit(getSnoozeUntil(selectedDays)).then(() => setOpen(false));
              }}
            >
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FeedbackDialog({
  disabled,
  feedbackType,
  feedbackNotes,
  onFeedbackTypeChange,
  onFeedbackNotesChange,
  onSubmit,
}: {
  disabled: boolean;
  feedbackType: string;
  feedbackNotes: string;
  onFeedbackTypeChange: (value: string) => void;
  onFeedbackNotesChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip label="Record feedback">
        <Button type="button" size="icon-sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
          <MessageSquareText />
        </Button>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workflow feedback</DialogTitle>
            <DialogDescription>Capture whether this recommendation was useful for academic administration.</DialogDescription>
          </DialogHeader>
        <div className="grid gap-3">
          <Select
            value={feedbackType}
            onChange={onFeedbackTypeChange}
            data={[
              { value: "accepted", label: "Accepted" },
              { value: "needs_tuning", label: "Needs tuning" },
              { value: "not_useful", label: "Not useful" },
            ]}
          />
          <Input value={feedbackNotes} onChange={(event) => onFeedbackNotesChange(event.target.value)} placeholder="Feedback note" />
        </div>
        <Separator />
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              void onSubmit().then(() => setOpen(false));
            }}
          >
            Record feedback
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
