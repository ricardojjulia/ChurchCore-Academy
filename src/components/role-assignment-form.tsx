"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const ASSIGNABLE_ROLES = [
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "advisor",
  "faculty",
  "teacher",
  "professor",
  "student",
  "guardian",
] as const;

interface PersonOption {
  id: string;
  displayName: string;
  email: string;
}

interface Props {
  people: PersonOption[];
}

type State = "idle" | "submitting" | "success" | "error";

export function RoleAssignmentForm({ people }: Props) {
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personId || !role) return;
    setState("submitting");
    setMessage(null);

    try {
      const res = await fetch("/api/academy/people/role-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, role }),
      });
      const json = await res.json() as { error?: string; role?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Role assignment failed.");
        setState("error");
        return;
      }
      setMessage(`Role "${json.role}" assigned successfully.`);
      setState("success");
      setPersonId("");
      setRole("");
    } catch {
      setMessage("Network error.");
      setState("error");
    }
  }

  return (
    <form className="ops-form" onSubmit={handleSubmit}>
      <div className="ops-form-row">
        <div className="ops-field">
          <label className="ops-label" htmlFor="ra-person">Person</label>
          <select
            id="ra-person"
            className="ops-input"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            required
          >
            <option value="">— select person —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} ({p.email})
              </option>
            ))}
          </select>
        </div>

        <div className="ops-field">
          <label className="ops-label" htmlFor="ra-role">Role</label>
          <select
            id="ra-role"
            className="ops-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            <option value="">— select role —</option>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{r.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>

        <div className="ops-field" style={{ alignSelf: "flex-end" }}>
          <Button type="submit" disabled={state === "submitting" || !personId || !role}>
            {state === "submitting" ? "Assigning…" : "Assign Role"}
          </Button>
        </div>
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
