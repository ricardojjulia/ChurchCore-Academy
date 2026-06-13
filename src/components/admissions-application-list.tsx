import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdmissionReviewModel } from "@/modules/admissions/review-model";

function statusVariant(status: string) {
  if (status === "accepted") return "secondary";
  if (status === "declined") return "destructive";
  return "outline";
}

export function AdmissionsApplicationList({
  model,
}: {
  model: AdmissionReviewModel;
}) {
  return (
    <>
      <section className="ops-stats-grid">
        {model.metrics.map((metric) => (
          <Card key={metric.label} className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">{metric.label}</div>
              <div className="ops-metric-value">{metric.value}</div>
              <div className="ops-metric-detail">{metric.detail}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Application Review Queue</CardTitle>
          <CardDescription>
            Persistent applicant records for staff review. Enrollment conversion
            remains a separate controlled workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {model.applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No admissions applications are available for this tenant.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">
                        {application.applicantName}
                      </div>
                      {application.email ? (
                        <div className="text-sm text-muted-foreground">
                          {application.email}
                          {application.phone ? ` · ${application.phone}` : ""}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{application.programId}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(application.status)}>
                        {application.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>{application.submittedDate}</TableCell>
                    <TableCell>{application.decisionDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
