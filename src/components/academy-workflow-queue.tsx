"use client";

import Link from "next/link";
import type React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock3, ExternalLink, FileCheck2, MessageSquareText, UserRoundCheck, XCircle } from "lucide-react";
import { AdminUser } from "@/modules/academy-data/types";
import { WorkflowQueueItem } from "@/modules/academic-workflows/repository";
import { QueueFilters, WorkflowCode } from "@/modules/shepherd-ai/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
      toast.success("Workflow queue updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workflow action failed.");
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
                onValueChange={(value) => updateFilters({ ...filters, workflowCode: value as QueueFilters["workflowCode"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workflowCodeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <span className="filter-label">Assignee filter</span>
              <Select value={filters.assignee ?? "all"} onValueChange={(value) => value && updateFilters({ ...filters, assignee: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                  {administrators.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <span className="filter-label">Action assignee</span>
              <Select value={selectedUserId} onValueChange={(value) => value && setSelectedUserId(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {administrators.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.name} · {admin.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      <Select value={value} onValueChange={(nextValue) => nextValue && onChange(nextValue)}>
        <SelectTrigger className="w-full capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="capitalize">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
            <Tooltip>
              <TooltipTrigger
                render={
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
                  />
                }
              >
                <FileCheck2 />
              </TooltipTrigger>
              <TooltipContent>Promote to workflow</TooltipContent>
            </Tooltip>
          ) : null}
          {isWorkflow ? (
            <Tooltip>
              <TooltipTrigger
                render={
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
                  />
                }
              >
                <UserRoundCheck />
              </TooltipTrigger>
              <TooltipContent>Assign review</TooltipContent>
            </Tooltip>
          ) : null}
          {canComplete ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => onAction(item.id, `/api/academy/workflows/${item.id}/complete`)}
                  />
                }
              >
                <CheckCircle2 />
              </TooltipTrigger>
              <TooltipContent>Mark complete</TooltipContent>
            </Tooltip>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button type="button" size="icon-sm" variant="outline" disabled={disabled} />} />}>
          {triggerIcon}
        </TooltipTrigger>
        <TooltipContent>{triggerLabel}</TooltipContent>
      </Tooltip>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button type="button" size="icon-sm" variant="outline" disabled={disabled} />} />}>
          <MessageSquareText />
        </TooltipTrigger>
        <TooltipContent>Record feedback</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workflow feedback</DialogTitle>
          <DialogDescription>Capture whether this recommendation was useful for academic administration.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Select value={feedbackType} onValueChange={(value) => value && onFeedbackTypeChange(value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="needs_tuning">Needs tuning</SelectItem>
              <SelectItem value="not_useful">Not useful</SelectItem>
            </SelectContent>
          </Select>
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
  );
}
