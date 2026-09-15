"use client";

import { useState, useTransition } from "react";
import { User, CheckCircle2, XCircle } from "lucide-react";

interface ContactInfo {
  preferredName: string | null;
  phone: string | null;
  mailingAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

interface Props {
  initial: ContactInfo;
}

export function StudentContactView({ initial }: Props) {
  const [form, setForm] = useState<ContactInfo>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setField<K extends keyof ContactInfo>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value || null }));
    setSaved(false);
    setError(null);
  }

  function save() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/academy/students/me/contact", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preferredName: form.preferredName,
            phone: form.phone,
            mailingAddress: form.mailingAddress,
            emergencyContactName: form.emergencyContactName,
            emergencyContactPhone: form.emergencyContactPhone,
          }),
        });
        const payload = await res.json() as { error?: string };
        if (!res.ok) {
          setError(payload.error ?? "Update failed.");
        } else {
          setSaved(true);
        }
      } catch {
        setError("Update failed. Please try again.");
      }
    });
  }

  return (
    <section className="student-pwa-panel" aria-labelledby="contact-heading">
      <div className="student-pwa-panel-heading">
        <div>
          <p>My information</p>
          <h2 id="contact-heading">Contact details</h2>
        </div>
        <User />
      </div>

      {saved && (
        <div className="student-pwa-notice" role="status">
          <CheckCircle2 size={16} />
          <p>Contact information updated.</p>
        </div>
      )}
      {error && (
        <div className="student-pwa-notice-error" role="alert">
          <XCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      <div className="student-pwa-form">
        <div className="student-pwa-form-row">
          <label htmlFor="preferred-name" className="student-pwa-label">Preferred name</label>
          <input
            id="preferred-name"
            type="text"
            className="student-pwa-input"
            value={form.preferredName ?? ""}
            onChange={(e) => setField("preferredName", e.target.value)}
            placeholder="What should we call you?"
            disabled={isPending}
          />
        </div>
        <div className="student-pwa-form-row">
          <label htmlFor="phone" className="student-pwa-label">Phone number</label>
          <input
            id="phone"
            type="tel"
            className="student-pwa-input"
            value={form.phone ?? ""}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="+1 (555) 000-0000"
            disabled={isPending}
          />
        </div>
        <div className="student-pwa-form-row">
          <label htmlFor="mailing-address" className="student-pwa-label">Mailing address</label>
          <textarea
            id="mailing-address"
            className="student-pwa-input"
            rows={3}
            value={form.mailingAddress ?? ""}
            onChange={(e) => setField("mailingAddress", e.target.value)}
            placeholder={"123 Main St\nCity, State ZIP"}
            disabled={isPending}
          />
        </div>
        <div className="student-pwa-form-row">
          <label htmlFor="emergency-name" className="student-pwa-label">Emergency contact name</label>
          <input
            id="emergency-name"
            type="text"
            className="student-pwa-input"
            value={form.emergencyContactName ?? ""}
            onChange={(e) => setField("emergencyContactName", e.target.value)}
            placeholder="Full name"
            disabled={isPending}
          />
        </div>
        <div className="student-pwa-form-row">
          <label htmlFor="emergency-phone" className="student-pwa-label">Emergency contact phone</label>
          <input
            id="emergency-phone"
            type="tel"
            className="student-pwa-input"
            value={form.emergencyContactPhone ?? ""}
            onChange={(e) => setField("emergencyContactPhone", e.target.value)}
            placeholder="+1 (555) 000-0000"
            disabled={isPending}
          />
        </div>
        <div className="student-pwa-form-actions">
          <button
            type="button"
            className="student-pwa-action"
            onClick={save}
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </section>
  );
}
