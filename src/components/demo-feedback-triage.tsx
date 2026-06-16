"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { notifyAcademy } from "@/lib/ui/notifications";
import { DemoFeedbackAction, DemoFeedbackStoredRecord, demoFeedbackActions, demoFeedbackCategories } from "@/modules/demo-feedback/types";

interface TriageProps {
  initialItems: DemoFeedbackStoredRecord[];
}

type StatusFilter = "open" | "done" | "all";

const actionOptions = demoFeedbackActions.map((action) => ({ value: action, label: action }));
const categoryFilterOptions = [{ value: "", label: "All categories" }, ...demoFeedbackCategories.map((value) => ({ value, label: value }))];

function truncate(text: string | null, max = 100) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function toIsoDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function sortItems(items: DemoFeedbackStoredRecord[]) {
  return [...items].sort((left, right) => {
    if (left.processed !== right.processed) return left.processed ? 1 : -1;
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function DemoFeedbackTriage({ initialItems }: TriageProps) {
  const [items, setItems] = useState(sortItems(initialItems));
  const [status, setStatus] = useState<StatusFilter>("open");
  const [category, setCategory] = useState<string>("");
  const [identity, setIdentity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (status === "open" && item.processed) return false;
      if (status === "done" && !item.processed) return false;
      if (category && item.category !== category) return false;
      if (identity) {
        const needle = identity.toLowerCase();
        const identityText = `${item.userEmail ?? ""} ${item.userRole ?? ""}`.toLowerCase();
        if (!identityText.includes(needle)) return false;
      }

      const createdMs = Date.parse(item.createdAt);
      if (from && createdMs < Date.parse(from)) return false;
      if (to && createdMs > Date.parse(to)) return false;
      return true;
    });
  }, [category, from, identity, items, status, to]);

  async function reloadFromServer() {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("status", status);
      if (category) params.set("category", category);
      if (identity) params.set("identity", identity);
      const fromIso = toIsoDate(from);
      const toIso = toIsoDate(to);
      if (fromIso) params.set("from", fromIso);
      if (toIso) params.set("to", toIso);

      const response = await fetch(`/api/academy/platform/demo-feedback?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { feedback?: DemoFeedbackStoredRecord[]; error?: string };

      if (!response.ok || !payload.feedback) {
        throw new Error(payload.error ?? "Unable to load feedback triage data.");
      }

      setItems(sortItems(payload.feedback));
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Triage refresh failed",
        message: error instanceof Error ? error.message : "Unable to load feedback triage data.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function applyUpdate(id: string, update: { action?: DemoFeedbackAction | null; processed?: boolean }) {
    const previous = items;

    setItems((current) =>
      sortItems(
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(update.action !== undefined ? { action: update.action } : {}),
                ...(update.processed !== undefined ? { processed: update.processed } : {}),
              }
            : item,
        ),
      ),
    );

    try {
      const response = await fetch(`/api/academy/platform/demo-feedback/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      const payload = (await response.json()) as { feedback?: DemoFeedbackStoredRecord; error?: string };

      if (!response.ok || !payload.feedback) {
        throw new Error(payload.error ?? "Unable to apply triage update.");
      }

      setItems((current) => sortItems(current.map((item) => (item.id === id ? payload.feedback! : item))));
    } catch (error) {
      setItems(previous);
      notifyAcademy({
        tone: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Unable to apply triage update.",
      });
    }
  }

  return (
    <section className="demo-triage-shell">
      <Card>
        <CardHeader>
          <CardTitle>Feedback triage filters</CardTitle>
          <CardDescription>Open and process demo feedback reports from platform staff workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="demo-triage-filter-grid">
            <Select
              label="View"
              value={status}
              onChange={(value) => setStatus((value || "open") as StatusFilter)}
              data={[
                { value: "open", label: "Open" },
                { value: "done", label: "Done" },
                { value: "all", label: "All" },
              ]}
            />
            <Select
              label="Category"
              value={category}
              onChange={(value) => setCategory(value)}
              data={categoryFilterOptions}
            />
            <label className="grid gap-2 text-sm font-medium">
              <span>Email/role filter</span>
              <Input value={identity} onChange={(event) => setIdentity(event.currentTarget.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>From</span>
              <Input type="date" value={from} onChange={(event) => setFrom(event.currentTarget.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>To</span>
              <Input type="date" value={to} onChange={(event) => setTo(event.currentTarget.value)} />
            </label>
            <div className="demo-triage-filter-actions">
              <Button onClick={reloadFromServer} loading={loading}>Apply</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demo feedback records</CardTitle>
          <CardDescription>
            {filtered.length === 0
              ? "No feedback records match the current filters."
              : `${filtered.length} records in current view.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="demo-triage-empty">No demo feedback has been submitted for this view.</div>
          ) : (
            <div className="demo-triage-list">
              {filtered.map((item) => (
                <button key={item.id} className="demo-triage-row" onClick={() => setSelectedId(item.id)} type="button">
                  <div className="demo-triage-row-main">
                    <div>
                      <strong>{item.route}</strong>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="demo-triage-badges">
                      <Badge variant={item.processed ? "outline" : "secondary"}>{item.processed ? "Done" : "Open"}</Badge>
                      <Badge variant="outline">{item.category}</Badge>
                    </div>
                  </div>
                  <div className="demo-triage-row-meta">
                    <span>{item.userEmail ?? "anonymous"}</span>
                    <span>{item.userRole ?? "no-role"}</span>
                    <span>hits: {item.hitCount}</span>
                    <span>{truncate(item.note ?? item.errorMessage)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-[min(92vw,42rem)] overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Demo feedback detail</SheetTitle>
          </SheetHeader>
        {selected ? (
          <div className="demo-triage-drawer">
            <div className="demo-triage-detail-grid">
              <Detail label="Submitted" value={new Date(selected.createdAt).toLocaleString()} />
              <Detail label="User" value={selected.userEmail ?? "anonymous"} />
              <Detail label="Role" value={selected.userRole ?? "none"} />
              <Detail label="Route" value={selected.route} />
              <Detail label="Category" value={selected.category} />
              <Detail label="Session duration" value={`${selected.sessionDurationSeconds ?? 0}s`} />
              <Detail label="Hit count" value={String(selected.hitCount)} />
              <Detail label="Demo version" value={selected.demoVersion} />
            </div>

            <div className="demo-triage-panel">
              <strong>Breadcrumbs</strong>
              {selected.breadcrumbs.length === 0 ? <span>None</span> : <span>{selected.breadcrumbs.join(" -> ")}</span>}
            </div>

            <div className="demo-triage-panel">
              <strong>Full note</strong>
              <span>{selected.note ?? "No note provided."}</span>
            </div>

            <div className="demo-triage-panel">
              <strong>Safe error message</strong>
              <span>{selected.errorMessage ?? "No error message provided."}</span>
            </div>

            <div className="demo-triage-form-grid">
              <Select
                label="Action"
                value={selected.action ?? ""}
                onChange={(value) => applyUpdate(selected.id, { action: (value || null) as DemoFeedbackAction | null })}
                data={[{ value: "", label: "No action" }, ...actionOptions]}
              />
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={selected.processed}
                  onChange={(event) => applyUpdate(selected.id, { processed: event.currentTarget.checked })}
                />
                Processed
              </label>
            </div>

            <details>
              <summary>Raw JSON</summary>
              <pre className="demo-triage-json">{JSON.stringify(selected, null, 2)}</pre>
            </details>
          </div>
        ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="demo-triage-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
