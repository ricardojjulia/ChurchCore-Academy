"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const INSTITUTION_MODES = [
  "bible_school",
  "childrens_school",
  "seminary",
  "college",
  "university",
  "mixed",
] as const;

const CREDENTIAL_TYPES = [
  "certificate",
  "diploma",
  "associate",
  "bachelor",
  "master",
  "doctorate",
  "continuing_education",
  "non_credit",
] as const;

type State = "idle" | "submitting" | "success" | "error";

export function ProgramCreateForm() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setMessage(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      programCode: data.get("programCode") as string,
      title: data.get("title") as string,
      description: data.get("description") as string || undefined,
      institutionMode: data.get("institutionMode") as string,
      credentialType: data.get("credentialType") as string,
      requiredCredits: Number(data.get("requiredCredits")) || 0,
    };

    try {
      const res = await fetch("/api/academy/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { error?: string; id?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Program creation failed.");
        setState("error");
        return;
      }
      setState("success");
      setMessage(`Program created successfully.`);
      form.reset();
      router.refresh();
    } catch {
      setMessage("Network error.");
      setState("error");
    }
  }

  return (
    <form className="ops-form" onSubmit={handleSubmit}>
      <div className="ops-form-row">
        <div className="ops-field">
          <label className="ops-label" htmlFor="pc-code">Program Code</label>
          <input
            id="pc-code"
            name="programCode"
            className="ops-input"
            placeholder="e.g. MDIV-2026"
            required
          />
        </div>
        <div className="ops-field">
          <label className="ops-label" htmlFor="pc-title">Program Title</label>
          <input
            id="pc-title"
            name="title"
            className="ops-input"
            placeholder="e.g. Master of Divinity"
            required
          />
        </div>
      </div>

      <div className="ops-form-row">
        <div className="ops-field">
          <label className="ops-label" htmlFor="pc-mode">Institution Mode</label>
          <select id="pc-mode" name="institutionMode" className="ops-input" required>
            <option value="">— select mode —</option>
            {INSTITUTION_MODES.map((m) => (
              <option key={m} value={m}>{m.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>
        <div className="ops-field">
          <label className="ops-label" htmlFor="pc-credential">Credential Type</label>
          <select id="pc-credential" name="credentialType" className="ops-input" required>
            <option value="">— select type —</option>
            {CREDENTIAL_TYPES.map((c) => (
              <option key={c} value={c}>{c.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>
        <div className="ops-field">
          <label className="ops-label" htmlFor="pc-credits">Required Credits</label>
          <input
            id="pc-credits"
            name="requiredCredits"
            type="number"
            min={0}
            className="ops-input"
            placeholder="e.g. 90"
          />
        </div>
      </div>

      <div className="ops-field">
        <label className="ops-label" htmlFor="pc-desc">Description (optional)</label>
        <input
          id="pc-desc"
          name="description"
          className="ops-input"
          placeholder="Brief program description"
        />
      </div>

      <div>
        <Button type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? "Creating…" : "Create Program"}
        </Button>
      </div>

      {state === "success" && message && (
        <div className="ops-alert ops-alert-success">{message}</div>
      )}
      {state === "error" && message && (
        <div className="ops-alert ops-alert-error">{message}</div>
      )}
    </form>
  );
}
