import { FileText } from "lucide-react";
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
import type { DocumentType } from "@/modules/admissions/types";
import { createAdmissionDocumentService } from "@/app/api/academy/admissions/service-factory";
import { CreateDocumentTypeForm } from "./CreateDocumentTypeForm";

export const dynamic = "force-dynamic";

export const DOCUMENT_TYPES_VIEW_ROLES: AcademyRole[] = [
  "institution_admin",
  "dean",
  "registrar",
  "admissions",
];

export default async function DocumentTypesPage() {
  const actor = await requireActor();
  requireActor(actor, DOCUMENT_TYPES_VIEW_ROLES);

  let documentTypes: DocumentType[] = [];
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

      // Fetch document types via the module service, using the capability
      // context's tenant-scoped client (not the default global pool).
      const service = createAdmissionDocumentService(client);
      const types = await service.listActiveDocumentTypes(actor, actor.tenantId);

      return {
        documentTypes: types,
        institutionName: fetchedInstitutionName ?? "your institution",
      };
    });

    documentTypes = result.documentTypes;
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
        eyebrow="Admissions"
        title="Document Types"
        subtitle="Manage tenant-wide document types for admission applications."
      >
        <CapabilityGhostPage capability="Admissions Workflows" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  const canCreate = actor.roles.includes("institution_admin");

  return (
    <AdminShell
      activeSection="admissions"
      eyebrow="Admissions"
      title="Document Types"
      subtitle="Manage tenant-wide document types for admission applications."
    >
      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon">
              <FileText />
            </div>
            <div>
              <CardTitle>Document Types</CardTitle>
              <CardDescription>
                Showing {documentTypes.length} document type{documentTypes.length !== 1 ? "s" : ""}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {documentTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No document types found. {canCreate ? "Create your first document type below." : "Contact your institution administrator to create document types."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentTypes.map((docType) => (
                  <TableRow key={docType.id}>
                    <TableCell className="font-medium">{docType.name}</TableCell>
                    <TableCell className="font-mono text-sm">{docType.slug}</TableCell>
                    <TableCell>
                      <Badge variant={docType.required ? "default" : "outline"}>
                        {docType.required ? "Required" : "Optional"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {docType.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={docType.active ? "default" : "outline"}>
                        {docType.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canCreate && (
        <Card className="ops-panel">
          <CardHeader className="ops-card-header">
            <div className="ops-heading">
              <div className="ops-icon">
                <FileText />
              </div>
              <div>
                <CardTitle>Create Document Type</CardTitle>
                <CardDescription>
                  Add a new document type that can be required for program applications.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CreateDocumentTypeForm />
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
