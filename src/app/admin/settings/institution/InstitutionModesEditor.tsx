"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  concreteInstitutionModes,
  getInstitutionModePack,
  normalizeSelectedInstitutionModes,
} from "@/modules/academy-config/mode-packs";
import type { ConcreteInstitutionMode, InstitutionMode } from "@/modules/academy-config/types";

interface InstitutionModesEditorProps {
  currentModes: InstitutionMode[];
  currentPrimaryMode: InstitutionMode;
}

export function InstitutionModesEditor({ currentModes, currentPrimaryMode }: InstitutionModesEditorProps) {
  const normalizedModes = useMemo(() => normalizeSelectedInstitutionModes(currentModes), [currentModes]);
  const normalizedPrimary = normalizedModes.includes(currentPrimaryMode as ConcreteInstitutionMode)
    ? (currentPrimaryMode as ConcreteInstitutionMode)
    : normalizedModes[0];

  const [isEditing, setIsEditing] = useState(false);
  const [selectedModes, setSelectedModes] = useState<ConcreteInstitutionMode[]>(normalizedModes);
  const [primaryMode, setPrimaryMode] = useState<ConcreteInstitutionMode>(normalizedPrimary);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleMode(mode: ConcreteInstitutionMode) {
    setSelectedModes((previous) => {
      if (previous.includes(mode)) {
        if (previous.length === 1) return previous;
        const next = previous.filter((item) => item !== mode);
        if (primaryMode === mode) {
          setPrimaryMode(next[0]);
        }
        return next;
      }
      return [...previous, mode];
    });
  }

  async function saveModes() {
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/academy/config/institution", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selectedModes,
          primaryMode,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update institution modes.");
      }

      setMessage("Institution modes updated.");
      setIsEditing(false);
      window.location.reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update institution modes.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="grid gap-3 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong className="text-sm">Institution mode setup</strong>
            <p className="text-xs text-muted-foreground">Edit selected concrete mode packs for this tenant.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            Edit modes
          </Button>
        </div>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-md border border-border p-3">
      <div>
        <strong className="text-sm">Edit institution modes</strong>
        <p className="text-xs text-muted-foreground">
          Multi-mode status is derived from the selected concrete modes. Disabling a mode can affect portals, records, LMS posture, and validation.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {concreteInstitutionModes.map((mode) => {
          const pack = getInstitutionModePack(mode);
          const checked = selectedModes.includes(mode);
          return (
            <label key={mode} className="grid gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={checked} onChange={() => toggleMode(mode)} />
                <span className="font-medium">{pack.label}</span>
                {primaryMode === mode ? <Badge variant="outline">Default</Badge> : null}
              </span>
              <span className="text-xs text-muted-foreground">{pack.description}</span>
            </label>
          );
        })}
      </div>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Default mode</span>
        <select
          value={primaryMode}
          onChange={(event) => setPrimaryMode(event.currentTarget.value as ConcreteInstitutionMode)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {selectedModes.map((mode) => (
            <option key={mode} value={mode}>
              {getInstitutionModePack(mode).label}
            </option>
          ))}
        </select>
      </label>

      {selectedModes.length > 1 ? (
        <p className="text-xs text-muted-foreground">This tenant will display as a multi-mode institution with {selectedModes.length} selected mode packs.</p>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void saveModes()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save modes"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => {
            setSelectedModes(normalizedModes);
            setPrimaryMode(normalizedPrimary);
            setError(null);
            setIsEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
