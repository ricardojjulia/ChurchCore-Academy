"use client";

import { useState } from "react";

interface StudentLmsLaunchUnavailable {
  status: "unavailable";
  displayLabel: string;
  unavailableReason: string;
  auditReference: string;
}

interface StudentLmsLaunchAvailable {
  status: "available";
  displayLabel: string;
  launchUrl: string;
  expiresAt: string;
  auditReference: string;
}

type StudentLmsLaunchResponse = StudentLmsLaunchUnavailable | StudentLmsLaunchAvailable;

export function StudentLmsLaunchPanel() {
  const [targetStudentPersonId, setTargetStudentPersonId] = useState("student-one");
  const [courseId, setCourseId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [launch, setLaunch] = useState<StudentLmsLaunchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function checkLaunch() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/student/lms/launch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetStudentPersonId,
          courseId: courseId || undefined,
          sectionId: sectionId || undefined,
          redirectPath: "/student/lms",
        }),
      });

      const body = (await response.json()) as { launch?: StudentLmsLaunchResponse; error?: string };

      if (!response.ok || !body.launch) {
        setLaunch(null);
        setError(body.error ?? "Unable to load LMS launch status.");
        return;
      }

      setLaunch(body.launch);
    } catch {
      setLaunch(null);
      setError("Unable to load LMS launch status.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="student-pwa-surface student-lms-launch-panel" aria-labelledby="student-lms-launch-heading">
      <div className="student-pwa-surface-heading">
        <div>
          <p>Course learning</p>
          <h2 id="student-lms-launch-heading">Student LMS launch</h2>
        </div>
      </div>

      <div className="student-lms-launch-controls">
        <label>
          Student person ID
          <input value={targetStudentPersonId} onChange={(event) => setTargetStudentPersonId(event.target.value)} />
        </label>
        <label>
          Course ID (optional)
          <input value={courseId} onChange={(event) => setCourseId(event.target.value)} />
        </label>
        <label>
          Section ID (optional)
          <input value={sectionId} onChange={(event) => setSectionId(event.target.value)} />
        </label>
      </div>

      <div className="student-lms-launch-actions">
        <button type="button" className="student-lms-launch-button" onClick={checkLaunch} disabled={isLoading || !targetStudentPersonId.trim()}>
          {isLoading ? "Checking launch..." : "Check LMS launch"}
        </button>
      </div>

      {error ? <p className="student-lms-launch-error">{error}</p> : null}

      {launch?.status === "available" ? (
        <div className="student-lms-launch-result">
          <p>Ready to launch {launch.displayLabel}.</p>
          <a className="student-lms-launch-link" href={launch.launchUrl} target="_blank" rel="noreferrer">
            Open {launch.displayLabel}
          </a>
          <small>Expires: {new Date(launch.expiresAt).toLocaleString()}</small>
        </div>
      ) : null}

      {launch?.status === "unavailable" ? (
        <div className="student-lms-launch-result">
          <p>{launch.displayLabel} is unavailable right now.</p>
          <small>{launch.unavailableReason}</small>
        </div>
      ) : null}
    </section>
  );
}
