import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentGroupMembership } from "@/modules/student-groups/types";

export function StudentGroupsCard({ memberships }: { memberships: StudentGroupMembership[] }) {
  return (
    <Card className="ops-panel">
      <CardHeader>
        <CardTitle>Student Groups</CardTitle>
        <CardDescription>Cohorts, graduating classes, and program groups for this student.</CardDescription>
      </CardHeader>
      <CardContent>
        {memberships.length === 0 ? (
          <div className="student-empty-state"><Users /><span>No student group memberships.</span></div>
        ) : (
          <div className="grid gap-3">
            {memberships.map((membership) => (
              <div key={membership.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="font-medium">{membership.groupName}</div>
                  <div className="text-sm text-muted-foreground">
                    {membership.groupCode} · {membership.academicYearName}
                    {membership.programTitle ? ` · ${membership.programTitle}` : ""}
                  </div>
                </div>
                <Badge variant={membership.endedOn ? "outline" : "secondary"}>
                  {membership.endedOn ? `Ended ${membership.endedOn}` : "Active"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
