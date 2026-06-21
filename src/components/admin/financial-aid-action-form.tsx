"use client";

import { useMemo, useState, useTransition } from "react";

export interface FinancialAidStudentOption {
  id: string;
  fullName: string;
  enrollmentStatus: string;
}

export interface FinancialAidPackageOption {
  id: string;
  studentPersonId: string;
  studentName: string;
  aidYear: string;
  status: string;
}

export interface FinancialAidAwardOption {
  id: string;
  studentPersonId: string;
  studentName: string;
  description: string;
  status: string;
  amountCents: number;
}

export interface FinancialAidDisbursementOption {
  id: string;
  studentName: string;
  status: string;
  amountCents: number;
  scheduledOn: string;
}

type AidAction =
  | "create_package"
  | "create_award"
  | "update_award_status"
  | "schedule_disbursement"
  | "post_disbursement"
  | "create_hold";

function dollarsToCents(value: string) {
  return Math.round(Number(value) * 100);
}

export function FinancialAidActionForm({
  students,
  packages,
  awards,
  disbursements,
}: {
  students: FinancialAidStudentOption[];
  packages: FinancialAidPackageOption[];
  awards: FinancialAidAwardOption[];
  disbursements: FinancialAidDisbursementOption[];
}) {
  const [action, setAction] = useState<AidAction>("create_package");
  const [studentPersonId, setStudentPersonId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [awardId, setAwardId] = useState("");
  const [disbursementId, setDisbursementId] = useState("");
  const [aidYear, setAidYear] = useState("2026-2027");
  const [amount, setAmount] = useState("500.00");
  const [description, setDescription] = useState("Institutional scholarship");
  const [scheduledOn, setScheduledOn] = useState(new Date().toISOString().slice(0, 10));
  const [holdReason, setHoldReason] = useState("Financial aid documentation pending");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPackageStudent = useMemo(
    () => packages.find((pkg) => pkg.id === packageId)?.studentPersonId,
    [packageId, packages],
  );
  const selectedAwardStudent = useMemo(
    () => awards.find((award) => award.id === awardId)?.studentPersonId,
    [awardId, awards],
  );

  function resetFeedback() {
    setMessage(null);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    resetFeedback();

    const amountCents = dollarsToCents(amount);
    const idempotencyKey = crypto.randomUUID();
    const baseStudentId = studentPersonId || selectedPackageStudent || selectedAwardStudent;

    if ((action === "create_package" || action === "create_hold") && !studentPersonId) {
      setError("Please select a student.");
      return;
    }
    if (action === "create_award" && (!packageId || !baseStudentId)) {
      setError("Please select an aid package.");
      return;
    }
    if (action === "update_award_status" && !awardId) {
      setError("Please select an award.");
      return;
    }
    if (action === "schedule_disbursement" && (!awardId || !baseStudentId)) {
      setError("Please select an award to disburse.");
      return;
    }
    if (action === "post_disbursement" && !disbursementId) {
      setError("Please select a scheduled disbursement.");
      return;
    }
    if (
      (action === "create_award" || action === "schedule_disbursement") &&
      (!Number.isInteger(amountCents) || amountCents <= 0)
    ) {
      setError("Enter a positive amount.");
      return;
    }

    const body =
      action === "create_package"
        ? { action, studentPersonId, aidYear }
        : action === "create_award"
          ? {
              action,
              packageId,
              studentPersonId: baseStudentId,
              awardType: "scholarship",
              sourceType: "institutional",
              amountCents,
              currency: "USD",
              description,
            }
          : action === "update_award_status"
            ? { action, awardId, status: "accepted" }
            : action === "schedule_disbursement"
              ? {
                  action,
                  awardId,
                  studentPersonId: baseStudentId,
                  amountCents,
                  currency: "USD",
                  scheduledOn,
                  idempotencyKey,
                }
              : action === "post_disbursement"
                ? { action, disbursementId, idempotencyKey }
                : {
                    action,
                    studentPersonId,
                    holdType: "documentation",
                    reason: holdReason,
                  };

    startTransition(async () => {
      try {
        const response = await fetch("/api/academy/financial-aid", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const payload = await response.json() as { error?: string };

        if (!response.ok) {
          setError(payload.error ?? "Financial aid action failed.");
          return;
        }

        setMessage("Financial aid action completed. Refresh to see the updated record.");
      } catch {
        setError("Financial aid action failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="ops-form">
      <div className="ops-form-field">
        <label className="ops-form-label" htmlFor="aid-action">Action</label>
        <select
          id="aid-action"
          className="ops-form-select"
          value={action}
          onChange={(event) => {
            resetFeedback();
            setAction(event.target.value as AidAction);
          }}
        >
          <option value="create_package">Create aid package</option>
          <option value="create_award">Create institutional award</option>
          <option value="update_award_status">Accept award</option>
          <option value="schedule_disbursement">Schedule disbursement</option>
          <option value="post_disbursement">Post disbursement to ledger</option>
          <option value="create_hold">Place aid hold</option>
        </select>
      </div>

      {(action === "create_package" || action === "create_hold") && (
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="aid-student">Student</label>
          <select
            id="aid-student"
            className="ops-form-select"
            value={studentPersonId}
            onChange={(event) => setStudentPersonId(event.target.value)}
            required
          >
            <option value="">Select a student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.fullName} ({student.enrollmentStatus.replaceAll("_", " ")})
              </option>
            ))}
          </select>
        </div>
      )}

      {action === "create_package" && (
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="aid-year">Aid year</label>
          <input
            id="aid-year"
            className="ops-form-input"
            value={aidYear}
            onChange={(event) => setAidYear(event.target.value)}
            required
          />
        </div>
      )}

      {action === "create_award" && (
        <>
          <div className="ops-form-field">
            <label className="ops-form-label" htmlFor="aid-package">Aid package</label>
            <select
              id="aid-package"
              className="ops-form-select"
              value={packageId}
              onChange={(event) => setPackageId(event.target.value)}
              required
            >
              <option value="">Select a package</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.studentName} · {pkg.aidYear} · {pkg.status}
                </option>
              ))}
            </select>
          </div>
          <div className="ops-form-row">
            <div className="ops-form-field">
              <label className="ops-form-label" htmlFor="aid-award-amount">Amount</label>
              <input
                id="aid-award-amount"
                className="ops-form-input"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="ops-form-field">
              <label className="ops-form-label" htmlFor="aid-award-description">Description</label>
              <input
                id="aid-award-description"
                className="ops-form-input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </div>
          </div>
        </>
      )}

      {(action === "update_award_status" || action === "schedule_disbursement") && (
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="aid-award">Award</label>
          <select
            id="aid-award"
            className="ops-form-select"
            value={awardId}
            onChange={(event) => setAwardId(event.target.value)}
            required
          >
            <option value="">Select an award</option>
            {awards.map((award) => (
              <option key={award.id} value={award.id}>
                {award.studentName} · {award.description} · {award.status}
              </option>
            ))}
          </select>
        </div>
      )}

      {action === "schedule_disbursement" && (
        <div className="ops-form-row">
          <div className="ops-form-field">
            <label className="ops-form-label" htmlFor="aid-disbursement-amount">Amount</label>
            <input
              id="aid-disbursement-amount"
              className="ops-form-input"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>
          <div className="ops-form-field">
            <label className="ops-form-label" htmlFor="aid-disbursement-date">Scheduled date</label>
            <input
              id="aid-disbursement-date"
              className="ops-form-input"
              type="date"
              value={scheduledOn}
              onChange={(event) => setScheduledOn(event.target.value)}
              required
            />
          </div>
        </div>
      )}

      {action === "post_disbursement" && (
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="aid-disbursement">Scheduled disbursement</label>
          <select
            id="aid-disbursement"
            className="ops-form-select"
            value={disbursementId}
            onChange={(event) => setDisbursementId(event.target.value)}
            required
          >
            <option value="">Select a disbursement</option>
            {disbursements.map((disbursement) => (
              <option key={disbursement.id} value={disbursement.id}>
                {disbursement.studentName} · {disbursement.scheduledOn} · {disbursement.status}
              </option>
            ))}
          </select>
        </div>
      )}

      {action === "create_hold" && (
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="aid-hold-reason">Hold reason</label>
          <input
            id="aid-hold-reason"
            className="ops-form-input"
            value={holdReason}
            onChange={(event) => setHoldReason(event.target.value)}
            required
          />
        </div>
      )}

      <p className="faculty-section-roster">
        Federal and Title IV aid remain disabled until the regulated-aid compliance gate is approved.
      </p>

      {error && <p className="ops-form-error" role="alert">{error}</p>}
      {message && <p className="ops-form-success" role="status">{message}</p>}

      <button type="submit" className="ops-btn-primary" disabled={isPending}>
        {isPending ? "Working..." : "Run financial aid action"}
      </button>
    </form>
  );
}
