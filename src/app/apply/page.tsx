"use client";

import { useState, useEffect } from "react";

interface Program {
  id: string;
  title: string;
  description?: string;
}

interface SubmitResult {
  applicationId: string;
  statusToken: string;
}

export default function ApplyPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsError, setProgramsError] = useState<string | null>(null);

  const [legalName, setLegalName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [programId, setProgramId] = useState("");
  const [personalStatement, setPersonalStatement] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    fetch("/api/public/apply/programs")
      .then((res) => res.json())
      .then((data) => {
        if (data.programs) {
          setPrograms(data.programs);
        } else {
          setProgramsError("Unable to load programs.");
        }
      })
      .catch(() => setProgramsError("Unable to load programs."));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/public/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName,
          preferredName: preferredName || undefined,
          email,
          phone: phone || undefined,
          programId,
          personalStatement,
          website, // honeypot
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "An error occurred. Please try again.");
        return;
      }

      setResult(data.application);
    } catch {
      setError("Unable to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <main className="apply-portal-main">
        <h1 className="apply-portal-heading">Application submitted</h1>
        <p className="apply-portal-body">
          Thank you for applying. Your application has been received.
        </p>
        <p className="apply-portal-body">
          Save this token to check your application status:
        </p>
        <p className="apply-portal-token">{result.statusToken}</p>
        <a
          href={`/apply/status?token=${encodeURIComponent(result.statusToken)}`}
          className="apply-portal-link"
        >
          Check application status
        </a>
      </main>
    );
  }

  return (
    <main className="apply-portal-main">
      <h1 className="apply-portal-heading">Apply for admission</h1>

      {programsError && (
        <p className="apply-portal-error">{programsError}</p>
      )}

      <form onSubmit={handleSubmit} className="apply-portal-form" noValidate>
        {/* Honeypot — hidden from real users */}
        <div style={{ display: "none" }} aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="apply-portal-field">
          <label htmlFor="legalName" className="apply-portal-label">
            Legal name <span aria-hidden="true">*</span>
          </label>
          <input
            id="legalName"
            name="legalName"
            type="text"
            required
            className="apply-portal-input"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div className="apply-portal-field">
          <label htmlFor="preferredName" className="apply-portal-label">
            Preferred name
          </label>
          <input
            id="preferredName"
            name="preferredName"
            type="text"
            className="apply-portal-input"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            autoComplete="nickname"
          />
        </div>

        <div className="apply-portal-field">
          <label htmlFor="email" className="apply-portal-label">
            Email address <span aria-hidden="true">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="apply-portal-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="apply-portal-field">
          <label htmlFor="phone" className="apply-portal-label">
            Phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="apply-portal-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>

        <div className="apply-portal-field">
          <label htmlFor="programId" className="apply-portal-label">
            Program <span aria-hidden="true">*</span>
          </label>
          <select
            id="programId"
            name="programId"
            required
            className="apply-portal-select"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          >
            <option value="">Select a program</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.title}
              </option>
            ))}
          </select>
        </div>

        <div className="apply-portal-field">
          <label htmlFor="personalStatement" className="apply-portal-label">
            Personal statement <span aria-hidden="true">*</span>
          </label>
          <p className="apply-portal-hint">
            Minimum 50 characters, maximum 3000 characters.
          </p>
          <textarea
            id="personalStatement"
            name="personalStatement"
            required
            rows={8}
            className="apply-portal-textarea"
            value={personalStatement}
            onChange={(e) => setPersonalStatement(e.target.value)}
          />
          <p className="apply-portal-char-count">
            {personalStatement.length} / 3000 characters
          </p>
        </div>

        {error && <p className="apply-portal-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="apply-portal-button"
        >
          {submitting ? "Submitting..." : "Submit application"}
        </button>
      </form>
    </main>
  );
}
