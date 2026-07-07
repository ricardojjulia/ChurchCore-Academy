"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import type { AcademicPeriod, AcademicYear } from "@/modules/academic-calendar/types";
import { CreatePeriodDialog } from "./CreatePeriodDialog";
import { EditPeriodDialog } from "./EditPeriodDialog";
import { PeriodRowActions } from "./PeriodRowActions";

interface YearDetailClientProps {
  year: AcademicYear;
  periods: AcademicPeriod[];
}

function titleize(s: string | undefined | null) {
  if (!s) return "";
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function periodStatusVariant(status: AcademicPeriod["status"]): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "planned":
      return "outline";
    case "enrollment_open":
    case "active":
      return "secondary";
    case "completed":
      return "default";
    case "archived":
      return "destructive";
    default:
      return "outline";
  }
}

export function YearDetailClient({ year, periods: initialPeriods }: YearDetailClientProps) {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null);

  const handleSuccess = () => {
    router.refresh();
  };

  const sortedPeriods = [...initialPeriods].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  return (
    <div className="grid gap-6">
      {/* Year metadata card */}
      <Card className="ops-panel">
        <CardHeader>
          <div className="ops-heading">
            <div>
              <CardTitle>Academic Year Details</CardTitle>
              <CardDescription>Year-level configuration and timeline.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-base font-semibold">{year.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Code</p>
              <p className="text-base font-mono font-semibold">{year.code}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Date</p>
              <p className="text-base">{new Date(year.startsOn).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Date</p>
              <p className="text-base">{new Date(year.endsOn).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Calendar System</p>
              <p className="text-base">{titleize(year.calendarSystem)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant="secondary">{titleize(year.status)}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Periods card */}
      <Card className="ops-panel">
        <CardHeader>
          <div className="ops-heading">
            <div>
              <CardTitle>Academic Periods</CardTitle>
              <CardDescription>Terms, semesters, and modules within this academic year.</CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Period
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedPeriods.length === 0 ? (
            <div className="student-empty-state py-8">
              <span>No periods configured for this year.</span>
              <Button variant="link" onClick={() => setCreateDialogOpen(true)}>
                Create the first period
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead>Sequence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPeriods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{period.name}</TableCell>
                    <TableCell className="font-mono">{period.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{titleize(period.periodType)}</Badge>
                    </TableCell>
                    <TableCell>{new Date(period.startsOn).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(period.endsOn).toLocaleDateString()}</TableCell>
                    <TableCell>{period.sequence}</TableCell>
                    <TableCell>
                      <Badge variant={periodStatusVariant(period.status)}>{titleize(period.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <PeriodRowActions
                        period={period}
                        onSuccess={handleSuccess}
                        onEdit={() => setEditingPeriod(period)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreatePeriodDialog
        yearId={year.id}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          handleSuccess();
        }}
      />

      {editingPeriod && (
        <EditPeriodDialog
          yearId={year.id}
          period={editingPeriod}
          open={!!editingPeriod}
          onOpenChange={(open) => !open && setEditingPeriod(null)}
          onSuccess={() => {
            setEditingPeriod(null);
            handleSuccess();
          }}
        />
      )}
    </div>
  );
}
