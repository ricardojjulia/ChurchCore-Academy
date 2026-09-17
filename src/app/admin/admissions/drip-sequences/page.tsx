import { Mail, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import type { AcademyRole } from "@/modules/academy-auth/policy";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import {
  listDripSequences,
  type ApplicantCrmDatabase,
  type DripSequence,
  type DripStep,
} from "@/modules/admissions/applicant-crm";
import { CreateDripSequenceForm } from "./CreateDripSequenceForm";

export const dynamic = "force-dynamic";

// Stricter than inquiry pages - institution_admin only
export const DRIP_SEQUENCES_ROLES: AcademyRole[] = ["institution_admin"];

export default async function DripSequencesPage() {
  const actor = await requireActor();
  requireActor(actor, DRIP_SEQUENCES_ROLES);

  let sequences: Array<{ sequence: DripSequence; steps: DripStep[] }> = [];
  let capabilityDisabled = false;
  let institutionName = "your institution";

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");

      // Fetch institution name for ghost page
      const profileResult = (await client.query(
        "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
        [actor.tenantId]
      )) as { rows: Array<{ institution_name?: string }> };
      const fetchedInstitutionName = profileResult.rows[0]?.institution_name;

      const sequencesList = await listDripSequences(
        actor,
        asAcademyDatabase<ApplicantCrmDatabase>(client)
      );

      return {
        sequences: sequencesList,
        institutionName: fetchedInstitutionName ?? "your institution",
      };
    });

    sequences = result.sequences;
    institutionName = result.institutionName;
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
        activeSection="admissions"
        eyebrow="Admissions CRM"
        title="Drip Sequences"
        subtitle="Configure automated communication sequences for prospective students."
      >
        <CapabilityGhostPage capability="Admissions Workflows" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  const totalSteps = sequences.reduce((sum, s) => sum + s.steps.length, 0);
  const activeSequences = sequences.filter((s) => s.sequence.active).length;

  return (
    <AdminShell
      activeSection="admissions"
      eyebrow="Admissions CRM"
      title="Drip Sequences"
      subtitle="Configure automated communication sequences for prospective students."
    >
      <section className="ops-stats-grid">
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Total sequences</div>
            <div className="ops-metric-value">{sequences.length}</div>
            <div className="ops-metric-detail">
              <Mail size={13} /> All time
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Active sequences</div>
            <div className="ops-metric-value">{activeSequences}</div>
            <div className="ops-metric-detail">
              <Users size={13} /> Enabled
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Total steps</div>
            <div className="ops-metric-value">{totalSteps}</div>
            <div className="ops-metric-detail">
              <Mail size={13} /> Messages
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon">
              <Mail />
            </div>
            <div>
              <CardTitle>Drip Sequences</CardTitle>
              <CardDescription>
                Showing {sequences.length} sequence{sequences.length !== 1 ? "s" : ""}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sequences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No drip sequences found. Create your first sequence below.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Step Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sequences.map(({ sequence, steps }) => (
                  <TableRow key={sequence.id}>
                    <TableCell className="font-medium">{sequence.name}</TableCell>
                    <TableCell className="text-sm">
                      {sequence.triggerEvent.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sequence.active ? "default" : "outline"}>
                        {sequence.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{steps.length}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {steps.length === 0 ? (
                        "—"
                      ) : (
                        <details>
                          <summary className="cursor-pointer hover:text-accent">
                            View {steps.length} step{steps.length !== 1 ? "s" : ""}
                          </summary>
                          <ul className="mt-2 ml-4 space-y-1">
                            {steps.map((step) => (
                              <li key={step.id} className="text-xs">
                                #{step.stepNumber}: {step.templateKey} via {step.channel} (delay: {step.delayDays}d)
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon">
              <Mail />
            </div>
            <div>
              <CardTitle>Create Drip Sequence</CardTitle>
              <CardDescription>
                Configure a new automated communication sequence.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CreateDripSequenceForm existingSequences={sequences.map(s => s.sequence)} />
        </CardContent>
      </Card>
    </AdminShell>
  );
}
