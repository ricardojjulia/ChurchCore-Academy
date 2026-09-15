"use client";

import { useState, useTransition } from "react";
import { Bell, CheckCircle2, XCircle } from "lucide-react";

interface NotificationPreferences {
  billingNotices: boolean;
  advisingNotices: boolean;
  academicAnnouncements: boolean;
}

interface Props {
  initial: NotificationPreferences;
}

export function StudentNotificationsView({ initial }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(key: keyof NotificationPreferences) {
    const next = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: next }));
    setSaved(false);
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/academy/students/me/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: next }),
        });
        const payload = await res.json() as { error?: string };
        if (!res.ok) {
          setPrefs((prev) => ({ ...prev, [key]: !next }));
          setError(payload.error ?? "Update failed.");
        } else {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      } catch {
        setPrefs((prev) => ({ ...prev, [key]: !next }));
        setError("Update failed. Please try again.");
      }
    });
  }

  const PREFERENCES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
    { key: "billingNotices", label: "Billing notices", description: "Balance statements, payment confirmations, and overdue alerts." },
    { key: "advisingNotices", label: "Advising notices", description: "Messages from your advisor and academic standing alerts." },
    { key: "academicAnnouncements", label: "Academic announcements", description: "Registration windows, grade postings, and institutional news." },
  ];

  return (
    <section className="student-pwa-panel" aria-labelledby="notifications-heading">
      <div className="student-pwa-panel-heading">
        <div>
          <p>Communication preferences</p>
          <h2 id="notifications-heading">Notifications</h2>
        </div>
        <Bell />
      </div>

      {saved && (
        <div className="student-pwa-notice" role="status">
          <CheckCircle2 size={16} />
          <p>Preferences saved.</p>
        </div>
      )}
      {error && (
        <div className="student-pwa-notice-error" role="alert">
          <XCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      <div className="student-pwa-surface-list">
        {PREFERENCES.map(({ key, label, description }) => (
          <article key={key} className="student-pwa-surface-row">
            <div>
              <strong>{label}</strong>
              <span>{description}</span>
            </div>
            <button
              type="button"
              className={prefs[key] ? "student-pwa-action" : "student-pwa-action-secondary"}
              onClick={() => toggle(key)}
              disabled={isPending}
              aria-pressed={prefs[key]}
            >
              {prefs[key] ? "On" : "Off"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
