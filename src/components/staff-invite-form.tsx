"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STAFF_ROLES = [
  { value: "institution_admin", label: "Institution Admin" },
  { value: "dean", label: "Dean" },
  { value: "registrar", label: "Registrar" },
  { value: "academic_admin", label: "Academic Admin" },
  { value: "admissions", label: "Admissions" },
  { value: "advisor", label: "Advisor" },
  { value: "faculty", label: "Faculty" },
  { value: "teacher", label: "Teacher" },
  { value: "professor", label: "Professor" },
] as const;

interface InviteResult {
  staffNumber: string;
  displayName: string;
  email: string;
  primaryRole: string;
}

export function StaffInviteForm() {
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [primaryRole, setPrimaryRole] = useState("faculty");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    setResult(null);

    try {
      const res = await fetch("/api/academy/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ givenName, familyName, email, primaryRole, title }),
      });

      const json = await res.json() as { error?: string } & InviteResult;

      if (!res.ok) {
        setStatus("error");
        setMessage(json.error ?? "Invite failed.");
        return;
      }

      setStatus("success");
      setResult(json);
      setGivenName("");
      setFamilyName("");
      setEmail("");
      setTitle("");
      setPrimaryRole("faculty");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <Card className="ops-panel">
      <CardHeader>
        <div className="ops-heading">
          <div className="ops-icon"><UserPlus /></div>
          <div>
            <CardTitle>Invite Staff Member</CardTitle>
            <CardDescription>
              Create a person and staff profile record. The new staff member can be linked
              to a login account separately.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {status === "success" && result && (
          <div className="ops-alert ops-alert-success" role="alert">
            <strong>Staff record created.</strong>{" "}
            <span>
              {result.displayName} ({result.email}) added as{" "}
              <Badge variant="secondary">{result.primaryRole.replace(/_/g, " ")}</Badge>{" "}
              — staff number <code>{result.staffNumber}</code>.
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="ops-alert ops-alert-error" role="alert">
            <strong>Error:</strong> {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="ops-form">
          <div className="ops-form-row">
            <label className="ops-field">
              <span>Given name</span>
              <input
                type="text"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                required
                placeholder="First name"
                className="ops-input"
              />
            </label>
            <label className="ops-field">
              <span>Family name</span>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
                placeholder="Last name"
                className="ops-input"
              />
            </label>
          </div>

          <div className="ops-form-row">
            <label className="ops-field">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="staff@institution.edu"
                className="ops-input"
              />
            </label>
            <label className="ops-field">
              <span>Job title (optional)</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bible Studies Instructor"
                className="ops-input"
              />
            </label>
          </div>

          <label className="ops-field">
            <span>Primary role</span>
            <select
              value={primaryRole}
              onChange={(e) => setPrimaryRole(e.target.value)}
              className="ops-input"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          <div className="ops-form-actions">
            <Button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "Creating…" : "Create staff record"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
