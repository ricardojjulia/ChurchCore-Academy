"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { notifyAcademy } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DripSequence } from "@/modules/admissions/applicant-crm";

interface CreateDripSequenceFormProps {
  existingSequences: DripSequence[];
}

// Match the backend's VALID_TEMPLATE_KEYS exactly — the only template worded for this feature's
// actual recipient (admissions staff being notified about an inquiry). Every other
// CommunicationTemplateKey is written in the second person as if addressed directly to the
// applicant/student, which would be sent to staff instead and read as if they were the inquiry.
const VALID_TEMPLATE_KEYS = [
  "admissions_inquiry_activity",
];

// Match the backend's VALID_CHANNELS exactly
const VALID_CHANNELS = ["in_app", "email"];

const VALID_TRIGGER_EVENTS = ["inquiry_received", "application_started", "application_submitted"];

interface DripStepInput {
  stepNumber: number;
  delayDays: number;
  templateKey: string;
  channel: string;
}

export function CreateDripSequenceForm({ existingSequences }: CreateDripSequenceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState(VALID_TRIGGER_EVENTS[0]);
  const [steps, setSteps] = useState<DripStepInput[]>([
    { stepNumber: 1, delayDays: 0, templateKey: VALID_TEMPLATE_KEYS[0], channel: VALID_CHANNELS[0] },
  ]);

  function addStep() {
    setSteps([
      ...steps,
      {
        stepNumber: steps.length + 1,
        delayDays: 0,
        templateKey: VALID_TEMPLATE_KEYS[0],
        channel: VALID_CHANNELS[0],
      },
    ]);
  }

  function removeStep(index: number) {
    const newSteps = steps.filter((_, i) => i !== index);
    // Renumber steps
    setSteps(newSteps.map((step, i) => ({ ...step, stepNumber: i + 1 })));
  }

  function updateStep(index: number, field: keyof DripStepInput, value: string | number) {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      notifyAcademy({
        tone: "warning",
        title: "Name required",
        message: "Please enter a name for this drip sequence.",
      });
      return;
    }

    if (steps.length === 0) {
      notifyAcademy({
        tone: "warning",
        title: "Steps required",
        message: "Please add at least one step to this drip sequence.",
      });
      return;
    }

    // Check for duplicate trigger event
    const existingWithSameTrigger = existingSequences.find(
      (seq) => seq.triggerEvent === triggerEvent && seq.active
    );

    if (existingWithSameTrigger) {
      const proceed = confirm(
        `Warning: An active sequence "${existingWithSameTrigger.name}" already uses the trigger event "${triggerEvent.replace(/_/g, " ")}". Both sequences will fire when this event occurs. Continue anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/academy/admissions/drip-sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          triggerEvent,
          steps: steps.map((step) => ({
            stepNumber: step.stepNumber,
            delayDays: Number(step.delayDays),
            templateKey: step.templateKey,
            channel: step.channel,
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Failed to create drip sequence.");
      }

      notifyAcademy({
        tone: "success",
        title: "Sequence created",
        message: `Drip sequence "${name.trim()}" has been created with ${steps.length} step${steps.length !== 1 ? "s" : ""}.`,
      });

      // Reset form
      setName("");
      setTriggerEvent(VALID_TRIGGER_EVENTS[0]);
      setSteps([
        { stepNumber: 1, delayDays: 0, templateKey: VALID_TEMPLATE_KEYS[0], channel: VALID_CHANNELS[0] },
      ]);

      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Creation failed",
        message: error instanceof Error ? error.message : "Failed to create drip sequence.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div>
        <label htmlFor="drip-sequence-name" className="text-sm font-semibold text-muted-foreground block mb-2">
          Sequence Name
        </label>
        <Input
          id="drip-sequence-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Welcome Inquiry Sequence"
          disabled={isSubmitting}
          required
        />
      </div>

      <div>
        <label htmlFor="drip-sequence-trigger-event" className="text-sm font-semibold text-muted-foreground block mb-2">
          Trigger Event
        </label>
        <select
          id="drip-sequence-trigger-event"
          value={triggerEvent}
          onChange={(e) => setTriggerEvent(e.target.value)}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
        >
          {VALID_TRIGGER_EVENTS.map((event) => (
            <option key={event} value={event}>
              {event.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-muted-foreground">Steps</label>
          <Button type="button" onClick={addStep} disabled={isSubmitting} size="sm">
            <Plus size={16} className="mr-1" />
            Add Step
          </Button>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="border border-border rounded-md p-4 relative">
              <div className="absolute top-2 right-2">
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    disabled={isSubmitting}
                    className="text-destructive hover:text-destructive/80"
                    title="Remove step"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`drip-step-${index}-number`} className="text-xs font-semibold text-muted-foreground block mb-1">
                    Step #{step.stepNumber}
                  </label>
                  <Input
                    id={`drip-step-${index}-number`}
                    type="number"
                    value={step.stepNumber}
                    onChange={(e) => updateStep(index, "stepNumber", parseInt(e.target.value, 10))}
                    disabled={isSubmitting}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label htmlFor={`drip-step-${index}-delay`} className="text-xs font-semibold text-muted-foreground block mb-1">
                    Delay (days)
                  </label>
                  <Input
                    id={`drip-step-${index}-delay`}
                    type="number"
                    value={step.delayDays}
                    onChange={(e) => updateStep(index, "delayDays", parseInt(e.target.value, 10))}
                    disabled={isSubmitting}
                    min={0}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label htmlFor={`drip-step-${index}-template`} className="text-xs font-semibold text-muted-foreground block mb-1">
                    Template
                  </label>
                  <select
                    id={`drip-step-${index}-template`}
                    value={step.templateKey}
                    onChange={(e) => updateStep(index, "templateKey", e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                  >
                    {VALID_TEMPLATE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`drip-step-${index}-channel`} className="text-xs font-semibold text-muted-foreground block mb-1">
                    Channel
                  </label>
                  <select
                    id={`drip-step-${index}-channel`}
                    value={step.channel}
                    onChange={(e) => updateStep(index, "channel", e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                  >
                    {VALID_CHANNELS.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Sequence"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setName("");
            setTriggerEvent(VALID_TRIGGER_EVENTS[0]);
            setSteps([
              { stepNumber: 1, delayDays: 0, templateKey: VALID_TEMPLATE_KEYS[0], channel: VALID_CHANNELS[0] },
            ]);
          }}
          disabled={isSubmitting}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
