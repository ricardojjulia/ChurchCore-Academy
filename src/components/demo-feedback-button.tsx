"use client";

import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDemoSession } from "@/components/demo-session-provider";
import { notifyAcademy } from "@/lib/ui/notifications";
import { submitDemoFeedback } from "@/modules/demo-feedback/client-reporting";
import { DemoFeedbackCategory, demoFeedbackCategories } from "@/modules/demo-feedback/types";

const categoryOptions = demoFeedbackCategories.map((category) => ({ value: category, label: category }));

export function DemoFeedbackButton() {
  const session = useDemoSession();
  const [opened, setOpened] = useState(false);
  const [category, setCategory] = useState<DemoFeedbackCategory | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!session.enabled) {
    return null;
  }

  async function onSubmit() {
    if (!category || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const ok = await submitDemoFeedback(category, session, { note: note.trim() || undefined });

      if (!ok) {
        notifyAcademy({
          tone: "error",
          title: "Unable to submit feedback",
          message: "Your feedback could not be saved. Please try again.",
        });
        return;
      }

      notifyAcademy({
        tone: "success",
        title: "Feedback sent",
        message: "Thank you. Your demo feedback was captured for platform triage.",
      });
      setOpened(false);
      setCategory(null);
      setNote("");
    } catch {
      notifyAcademy({
        tone: "error",
        title: "Unable to submit feedback",
        message: "Your feedback could not be saved. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        className="demo-feedback-button"
        size="lg"
        onClick={() => setOpened(true)}
        aria-label="Open demo feedback dialog"
      >
        <MessageSquareWarning size={16} />
        Demo Feedback
      </Button>

      <Dialog open={opened} onOpenChange={setOpened}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demo feedback</DialogTitle>
          </DialogHeader>
        <div className="demo-feedback-form">
          <Select
            label="Category"
            placeholder="Select feedback category"
            data={categoryOptions}
            value={category ?? ""}
            onChange={(value) => setCategory((value || null) as DemoFeedbackCategory | null)}
            required
          />

          <label className="demo-feedback-note-label" htmlFor="demo-feedback-note">
            Note
          </label>
          <Textarea
            id="demo-feedback-note"
            aria-label="Feedback note"
            placeholder="Share what happened and what you expected."
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <small>Optional note (up to 2000 characters)</small>

          <div className="demo-feedback-actions">
            <Button variant="outline" onClick={() => setOpened(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={onSubmit} loading={submitting} disabled={!category}>
              Submit
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
