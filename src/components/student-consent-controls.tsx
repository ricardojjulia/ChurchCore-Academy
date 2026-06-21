"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { History, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LearnerIntelligenceConsentRecord } from "@/modules/learner-intelligence/types";

type ConsentFlags = {
  consentBehavioralTracking: boolean;
  consentAiMemory: boolean;
  consentSocialGraph: boolean;
  consentPredictiveModeling: boolean;
  consentLearnerMirror: boolean;
};

const emptyFlags: ConsentFlags = {
  consentBehavioralTracking: false,
  consentAiMemory: false,
  consentSocialGraph: false,
  consentPredictiveModeling: false,
  consentLearnerMirror: false,
};

const consentOptions: Array<{
  key: keyof ConsentFlags;
  title: string;
  description: string;
}> = [
  {
    key: "consentBehavioralTracking",
    title: "Learning activity",
    description: "Use course activity to identify momentum and support needs.",
  },
  {
    key: "consentAiMemory",
    title: "Learner memory",
    description: "Retain reviewed strengths and learning patterns over time.",
  },
  {
    key: "consentPredictiveModeling",
    title: "Predictive support",
    description: "Allow explainable risk snapshots and staff-reviewed support recommendations.",
  },
  {
    key: "consentLearnerMirror",
    title: "Learner mirror",
    description: "Allow learner-visible reflections when your institution enables them.",
  },
  {
    key: "consentSocialGraph",
    title: "Learning relationships",
    description: "Allow reviewed collaboration insights when your institution enables them.",
  },
];

export function StudentConsentControls() {
  const [current, setCurrent] = useState<LearnerIntelligenceConsentRecord | null>(null);
  const [history, setHistory] = useState<LearnerIntelligenceConsentRecord[]>([]);
  const [flags, setFlags] = useState<ConsentFlags>(emptyFlags);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("Loading privacy choices...");
  const [pending, setPending] = useState(false);

  const loadConsent = useCallback(async () => {
    const response = await fetch(
      "/api/academy/learner-intelligence/consent?includeHistory=true",
      { cache: "no-store" },
    );
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error ?? "Unable to load privacy choices.");
    }

    const nextCurrent = body.current as LearnerIntelligenceConsentRecord | null;
    setCurrent(nextCurrent);
    setHistory((body.history as LearnerIntelligenceConsentRecord[] | undefined) ?? []);
    setFlags(nextCurrent ? {
      consentBehavioralTracking: nextCurrent.consentBehavioralTracking,
      consentAiMemory: nextCurrent.consentAiMemory,
      consentSocialGraph: nextCurrent.consentSocialGraph,
      consentPredictiveModeling: nextCurrent.consentPredictiveModeling,
      consentLearnerMirror: nextCurrent.consentLearnerMirror,
    } : emptyFlags);
    setStatus(nextCurrent?.revokedAt ? "Your latest consent is revoked." : "Your choices are current.");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadConsent().catch((error) => {
        setStatus(error instanceof Error ? error.message : "Unable to load privacy choices.");
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadConsent]);

  async function saveConsent(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus("Saving your choices...");

    try {
      const response = await fetch("/api/academy/learner-intelligence/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consentVersion: "2026-06",
          ...flags,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to save privacy choices.");
      }
      await loadConsent();
      setStatus("Your privacy choices were saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save privacy choices.");
    } finally {
      setPending(false);
    }
  }

  async function revokeConsent() {
    if (!current || !reason.trim()) {
      setStatus("Enter a reason before revoking consent.");
      return;
    }

    setPending(true);
    setStatus("Revoking consent...");

    try {
      const response = await fetch("/api/academy/learner-intelligence/consent", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consentVersion: current.consentVersion,
          reason,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to revoke consent.");
      }
      setReason("");
      await loadConsent();
      setStatus("Consent was revoked. Protected learner intelligence writes are now blocked.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to revoke consent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="student-consent" aria-labelledby="student-consent-heading">
      <div className="student-consent-intro">
        <ShieldCheck />
        <div>
          <p>Consent belongs to you</p>
          <h2 id="student-consent-heading">Learner intelligence choices</h2>
          <span>Academy staff can review your consent status, but they cannot grant, change, or revoke it for you.</span>
        </div>
      </div>

      <form onSubmit={saveConsent}>
        <div className="student-consent-options">
          {consentOptions.map((option) => (
            <label className="student-consent-option" key={option.key}>
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
              <input
                type="checkbox"
                checked={flags[option.key]}
                onChange={(event) =>
                  setFlags((value) => ({ ...value, [option.key]: event.target.checked }))
                }
              />
            </label>
          ))}
        </div>
        <div className="student-consent-actions">
          <Button type="submit" loading={pending}>Save privacy choices</Button>
          <span role="status" aria-live="polite">{status}</span>
        </div>
      </form>

      <div className="student-consent-revoke">
        <div>
          <h3>Revoke current consent</h3>
          <p>Revocation blocks new protected activity, memory, and predictive writes. Existing records remain governed by retention policy.</p>
        </div>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="Why are you revoking consent?"
          aria-label="Consent revocation reason"
        />
        <Button
          type="button"
          variant="destructive"
          disabled={!current || Boolean(current.revokedAt) || pending}
          onClick={revokeConsent}
        >
          Revoke consent
        </Button>
      </div>

      <div className="student-consent-history">
        <div>
          <History />
          <h3>Consent history</h3>
        </div>
        {history.length === 0 ? (
          <p>No consent versions have been recorded.</p>
        ) : (
          <ul>
            {history.map((record) => (
              <li key={record.id ?? `${record.consentVersion}-${record.consentedAt}`}>
                <strong>{record.consentVersion}</strong>
                <span>{record.revokedAt ? `Revoked ${formatDate(record.revokedAt)}` : `Accepted ${formatDate(record.consentedAt)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
