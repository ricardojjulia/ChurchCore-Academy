"use client";

import { useState, useTransition } from "react";
import { BookOpen, Plus, Minus, CheckCircle2, XCircle, Wifi } from "lucide-react";

export interface EnrolledCourse {
  registrationId: string;
  sectionId: string;
  courseCode: string;
  title: string;
  schedulePattern?: string;
  deliveryMode: string;
}

export interface AvailableSection {
  id: string;
  courseCode: string;
  courseTitle: string;
  sectionCode: string;
  instructorName?: string;
  schedulePattern?: string;
  enrolledCount: number;
  maxEnrollment?: number;
  deliveryMode: string;
}

interface Props {
  initialEnrolled: EnrolledCourse[];
  availableSections: AvailableSection[];
  enrollmentWindowOpen: boolean;
  studentPersonId: string;
}

type ToastState = { type: "success" | "error"; message: string } | null;

export function StudentCoursesView({
  initialEnrolled,
  availableSections,
  enrollmentWindowOpen,
  studentPersonId,
}: Props) {
  const [enrolled, setEnrolled] = useState<EnrolledCourse[]>(initialEnrolled);
  const [toast, setToast] = useState<ToastState>(null);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  function handleAdd(section: AvailableSection) {
    if (isOffline) { showToast("error", "You're offline. Please reconnect to register."); return; }
    setPendingSectionId(section.id);

    startTransition(async () => {
      try {
        const res = await fetch("/api/academy/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseSectionId: section.id, studentPersonId }),
        });
        const payload = await res.json() as { id?: string; error?: string };

        if (!res.ok) {
          showToast("error", payload.error ?? "Registration failed.");
        } else {
          setEnrolled((prev) => [
            ...prev,
            {
              registrationId: payload.id ?? "",
              sectionId: section.id,
              courseCode: section.courseCode,
              title: section.courseTitle,
              schedulePattern: section.schedulePattern,
              deliveryMode: section.deliveryMode,
            },
          ]);
          showToast("success", `Registered for ${section.courseCode}.`);
        }
      } catch {
        showToast("error", "Registration failed. Please try again.");
      } finally {
        setPendingSectionId(null);
      }
    });
  }

  function handleDrop(course: EnrolledCourse) {
    if (isOffline) { showToast("error", "You're offline. Please reconnect to drop a course."); return; }
    setPendingSectionId(course.registrationId);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/academy/registrations/${course.registrationId}`, {
          method: "DELETE",
        });
        const payload = await res.json() as { error?: string };

        if (res.status === 409) {
          showToast("error", payload.error ?? "Drop window is not open.");
        } else if (!res.ok) {
          showToast("error", payload.error ?? "Drop failed.");
        } else {
          setEnrolled((prev) => prev.filter((e) => e.registrationId !== course.registrationId));
          showToast("success", `Dropped ${course.courseCode}.`);
        }
      } catch {
        showToast("error", "Drop failed. Please try again.");
      } finally {
        setPendingSectionId(null);
      }
    });
  }

  const enrolledSectionIds = new Set(enrolled.map((e) => e.sectionId));
  const addableSections = availableSections.filter((s) => !enrolledSectionIds.has(s.id));

  return (
    <>
      {toast && (
        <div className={toast.type === "success" ? "student-pwa-notice" : "student-pwa-notice-error"} role={toast.type === "error" ? "alert" : "status"}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <p>{toast.message}</p>
        </div>
      )}

      <section className="student-pwa-surface" aria-labelledby="enrolled-heading">
        <div className="student-pwa-surface-heading">
          <div>
            <p>Currently enrolled</p>
            <h2 id="enrolled-heading">{enrolled.length} courses</h2>
          </div>
          <BookOpen />
        </div>

        {enrolled.length === 0 ? (
          <div className="student-pwa-empty">
            <BookOpen />
            <p>You are not registered for any courses this period.</p>
          </div>
        ) : (
          <div className="student-pwa-surface-list">
            {enrolled.map((course) => (
              <article className="student-pwa-surface-row" key={course.registrationId}>
                <span className="student-pwa-surface-icon"><BookOpen /></span>
                <div>
                  <strong>{course.title}</strong>
                  <span>{course.courseCode} · {course.deliveryMode}{course.schedulePattern ? ` · ${course.schedulePattern}` : ""}</span>
                </div>
                {enrollmentWindowOpen ? (
                  <button
                    type="button"
                    className="student-pwa-action-secondary"
                    onClick={() => handleDrop(course)}
                    disabled={isPending && pendingSectionId === course.registrationId}
                    aria-label={`Drop ${course.courseCode}`}
                    title={isOffline ? "You're offline" : "Drop this course"}
                  >
                    <Minus size={14} />
                    {isPending && pendingSectionId === course.registrationId ? "Dropping…" : "Drop"}
                  </button>
                ) : (
                  <small>Enrolled</small>
                )}
              </article>
            ))}
          </div>
        )}

        {enrolled.length > 0 && !enrollmentWindowOpen && (
          <p className="student-pwa-notice-info">Add/drop window is not currently open.</p>
        )}
      </section>

      {enrollmentWindowOpen && addableSections.length > 0 && (
        <section className="student-pwa-surface" aria-labelledby="available-heading">
          <div className="student-pwa-surface-heading">
            <div>
              <p>Registration</p>
              <h2 id="available-heading">Available sections</h2>
            </div>
            <Plus />
          </div>
          {isOffline && (
            <div className="student-pwa-notice-error" role="alert">
              <Wifi size={16} />
              <p>You&apos;re offline. Reconnect to register for courses.</p>
            </div>
          )}
          <div className="student-pwa-surface-list">
            {addableSections.map((section) => (
              <article className="student-pwa-surface-row" key={section.id}>
                <span className="student-pwa-surface-icon"><BookOpen /></span>
                <div>
                  <strong>{section.courseCode} — {section.courseTitle}</strong>
                  <span>
                    Section {section.sectionCode}
                    {section.instructorName ? ` · ${section.instructorName}` : ""}
                    {section.schedulePattern ? ` · ${section.schedulePattern}` : ""}
                    {" · "}
                    {section.enrolledCount}{section.maxEnrollment != null ? `/${section.maxEnrollment}` : ""} enrolled
                  </span>
                </div>
                <button
                  type="button"
                  className="student-pwa-action"
                  onClick={() => handleAdd(section)}
                  disabled={isPending && pendingSectionId === section.id}
                  aria-label={`Register for ${section.courseCode}`}
                  title={isOffline ? "You're offline" : "Register for this section"}
                >
                  <Plus size={14} />
                  {isPending && pendingSectionId === section.id ? "Adding…" : "Add"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {enrollmentWindowOpen && addableSections.length === 0 && enrolled.length > 0 && (
        <div className="student-pwa-safe-state">
          <BookOpen />
          <span>You are registered for all available sections this period.</span>
        </div>
      )}
    </>
  );
}
