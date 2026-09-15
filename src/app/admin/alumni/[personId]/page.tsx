import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { getAlumniGivingHistory, type AlumniRecord, type GivingRecord, type AlumniStatus, type GiftType } from "@/modules/people/alumni";
import { UpdateAlumniForm } from "./UpdateAlumniForm";
import { RecordGiftForm } from "./RecordGiftForm";
import { MarkAcknowledgedButton } from "./MarkAcknowledgedButton";
import { CreateAlumniForm } from "./CreateAlumniForm";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

// dateString here is always a date-only value (e.g. "2026-08-01"), never a timestamp.
// `new Date(dateString)` parses that as UTC midnight, so `.toLocaleDateString()` in any
// timezone behind UTC (most of the US) displays the day BEFORE the one that was actually
// entered — a real, user-visible off-by-one-day bug for financial records. Parsing the
// year/month/day as local calendar components avoids the UTC round-trip entirely. Found via
// live browser testing.
function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString();
}

function getStatusVariant(status: AlumniStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "lost_contact":
      return "secondary";
    case "deceased":
      return "outline";
    default:
      return "outline";
  }
}

function getGiftTypeVariant(type: GiftType): "default" | "secondary" | "outline" {
  switch (type) {
    case "one_time":
      return "default";
    case "recurring":
      return "secondary";
    case "pledge":
      return "outline";
    default:
      return "outline";
  }
}

export default async function AlumniDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const actor = await requireActor();
  requireActor(actor, ["institution_admin", "academic_admin", "alumni_relations", "registrar"]);

  let alumniRecord: AlumniRecord | null = null;
  let givingHistory: GivingRecord[] = [];
  let personName = "";
  let programName: string | null = null;
  let capabilityDisabled = false;
  let institutionName = "your institution";
  // Distinguishes "invalid access" (person doesn't exist / isn't graduated — a real 404) from
  // "valid graduated student who simply has no alumni record yet" — the latter used to also
  // 404, which meant there was no way anywhere in the admin UI to create the first alumni
  // record for a newly-graduated student without calling the API directly. Found via live
  // browser testing.
  let needsCreation = false;

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");

      // Verify person exists in this tenant AND has enrollment_status === "graduated"
      const personResult = (await client.query(
        `SELECT p.display_name, sp.enrollment_status
         FROM academy_people p
         JOIN academy_student_profiles sp ON sp.person_id = p.id AND sp.tenant_id = p.tenant_id
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [personId, actor.tenantId]
      )) as { rows: Array<{ display_name: string; enrollment_status: string }> };

      if (personResult.rows.length === 0 || personResult.rows[0].enrollment_status !== "graduated") {
        return null;
      }

      // Fetch alumni record
      const alumniResult = (await client.query(
        `SELECT * FROM academy_alumni_records WHERE person_id = $1 AND tenant_id = $2`,
        [personId, actor.tenantId]
      )) as { rows: Array<Record<string, unknown>> };

      if (alumniResult.rows.length === 0) {
        // A real, valid graduated student — just no alumni record yet. Not a 404.
        return { needsCreation: true as const, personName: personResult.rows[0].display_name };
      }

      const alumniRow = alumniResult.rows[0];
      const record: AlumniRecord = {
        id: String(alumniRow.id),
        tenantId: String(alumniRow.tenant_id),
        personId: String(alumniRow.person_id),
        graduationYear: Number(alumniRow.graduation_year),
        degreeEarned: String(alumniRow.degree_earned),
        programId: alumniRow.program_id ? String(alumniRow.program_id) : null,
        employer: alumniRow.employer ? String(alumniRow.employer) : null,
        jobTitle: alumniRow.job_title ? String(alumniRow.job_title) : null,
        location: alumniRow.location ? String(alumniRow.location) : null,
        contactPreferences: alumniRow.contact_preferences
          ? (typeof alumniRow.contact_preferences === "string"
              ? (JSON.parse(alumniRow.contact_preferences) as Record<string, unknown>)
              : (alumniRow.contact_preferences as Record<string, unknown>))
          : {},
        status: alumniRow.status as AlumniStatus,
        createdAt: String(alumniRow.created_at),
        updatedAt: String(alumniRow.updated_at),
      };

      // Fetch program name if programId is set
      let fetchedProgramName: string | null = null;
      if (record.programId) {
        const programResult = (await client.query(
          `SELECT program_name FROM academy_programs WHERE id = $1 AND tenant_id = $2`,
          [record.programId, actor.tenantId]
        )) as { rows: Array<{ program_name: string }> };
        fetchedProgramName = programResult.rows[0]?.program_name ?? null;
      }

      const [history, profileResult] = await Promise.all([
        getAlumniGivingHistory(actor, personId, client),
        client.query(
          "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
          [actor.tenantId]
        ) as Promise<{ rows: Array<{ institution_name?: string }> }>,
      ]);

      return {
        needsCreation: false as const,
        personName: personResult.rows[0].display_name,
        alumniRecord: record,
        givingHistory: history,
        programName: fetchedProgramName,
        institutionName: profileResult.rows[0]?.institution_name ?? "your institution",
      };
    });

    if (!result) {
      notFound();
    }

    if (result.needsCreation) {
      needsCreation = true;
      personName = result.personName;
    } else {
      personName = result.personName;
      alumniRecord = result.alumniRecord;
      givingHistory = result.givingHistory;
      programName = result.programName;
      institutionName = result.institutionName;
    }
  } catch (error) {
    if (error instanceof CapabilityDisabledError) {
      capabilityDisabled = true;
      try {
        institutionName = await withAcademyDatabaseContext(actor, async (client) => {
          const profileResult = (await client.query(
            "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
            [actor.tenantId]
          )) as { rows: Array<{ institution_name?: string }> };
          return profileResult.rows[0]?.institution_name ?? "your institution";
        });
      } catch {
        // Fallback to default if fetch fails
      }
    } else {
      throw error;
    }
  }

  if (capabilityDisabled) {
    return (
      <AdminShell
        activeSection="records"
        eyebrow="Alumni & Giving"
        title="Alumni Record"
      >
        <CapabilityGhostPage capability="Alumni & Giving" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  if (needsCreation) {
    return (
      <AdminShell activeSection="records" eyebrow="Alumni & Giving" title={personName}>
        <div className="mb-4">
          <Link
            href="/admin/alumni"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <ArrowLeft size={16} /> All Alumni
          </Link>
        </div>
        <CreateAlumniForm personId={personId} personName={personName} />
      </AdminShell>
    );
  }

  if (!alumniRecord) {
    notFound();
  }

  const canModify = actor.roles.some((role) =>
    ["institution_admin", "academic_admin", "alumni_relations", "registrar"].includes(role)
  );

  // Render contact preferences as a comma-separated list of keys with truthy values
  const contactPreferencesList = Object.entries(alumniRecord.contactPreferences)
    .filter(([, value]) => value)
    .map(([key]) => key.replace(/_/g, " "))
    .join(", ") || "—";

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Alumni & Giving"
      title={personName}
    >
      <div className="mb-4">
        <Link
          href="/admin/alumni"
          className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
        >
          <ArrowLeft size={16} /> All Alumni
        </Link>
      </div>

      {/* Alumni Record Section */}
      <Card className="ops-panel mb-6">
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CardTitle>Alumni Record</CardTitle>
            {canModify && <UpdateAlumniForm currentRecord={alumniRecord} />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="ops-readiness-row">
              <span>Graduation Year</span>
              <strong>{alumniRecord.graduationYear}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Degree Earned</span>
              <strong>{alumniRecord.degreeEarned}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Program</span>
              <strong>{programName || "—"}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Employer</span>
              <strong>{alumniRecord.employer || "—"}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Job Title</span>
              <strong>{alumniRecord.jobTitle || "—"}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Location</span>
              <strong>{alumniRecord.location || "—"}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Status</span>
              <Badge variant={getStatusVariant(alumniRecord.status)}>
                {alumniRecord.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="ops-readiness-row">
              <span>Contact Preferences</span>
              <strong>{contactPreferencesList}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Giving History Section */}
      <Card className="ops-panel">
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CardTitle>Giving History</CardTitle>
            {canModify && <RecordGiftForm personId={personId} />}
          </div>
        </CardHeader>
        <CardContent>
          {givingHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No gifts recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fund Designation</TableHead>
                  <TableHead>Acknowledgment</TableHead>
                  <TableHead>Notes</TableHead>
                  {canModify && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {givingHistory.map((gift) => (
                  <TableRow key={gift.id}>
                    <TableCell className="text-sm">
                      {formatDate(gift.giftDate)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(gift.giftAmountCents)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getGiftTypeVariant(gift.giftType)}>
                        {gift.giftType.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {gift.fundDesignation || "—"}
                    </TableCell>
                    <TableCell>
                      {gift.acknowledgmentSentAt ? (
                        <Badge variant="default">Acknowledged</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {gift.notes ? (
                        <span className="max-w-xs truncate inline-block">{gift.notes}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {canModify && (
                      <TableCell>
                        {!gift.acknowledgmentSentAt && (
                          <MarkAcknowledgedButton giftId={gift.id} />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
