"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { AcademicPeriod, AcademicYear } from "@/modules/academic-calendar/types";
import { CreatePeriodButton } from "./CreatePeriodButton";
import { CreateYearButton } from "./CreateYearButton";
import { PeriodActions } from "./PeriodActions";

interface CalendarClientProps {
  initialPeriods: AcademicPeriod[];
  initialYears: AcademicYear[];
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

function titleize(s: string | undefined | null) {
  if (!s) return "";
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CalendarClient({ initialPeriods, initialYears }: CalendarClientProps) {
  const router = useRouter();

  const handleSuccess = () => {
    router.refresh();
  };

  const yearsById = new Map(initialYears.map((y) => [y.id, y]));

  return (
    <Tabs defaultValue="periods" className="w-full">
      <div className="flex justify-between items-center mb-4">
        <TabsList>
          <TabsTrigger value="periods">Academic Periods</TabsTrigger>
          <TabsTrigger value="years">Academic Years</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="periods">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div>
                <CardTitle>Academic Periods</CardTitle>
                <CardDescription>All configured terms, semesters, and modules for your institution.</CardDescription>
              </div>
              <CreatePeriodButton academicYears={initialYears} onSuccess={handleSuccess} />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPeriods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{period.name}</TableCell>
                    <TableCell className="font-mono">{period.code}</TableCell>
                    <TableCell>{yearsById.get(period.academicYearId)?.name ?? "Unknown"}</TableCell>
                    <TableCell>
                      {new Date(period.startsOn).toLocaleDateString()} - {new Date(period.endsOn).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={periodStatusVariant(period.status)}>{titleize(period.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <PeriodActions period={period} onSuccess={handleSuccess} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {initialPeriods.length === 0 && (
              <div className="student-empty-state py-8">
                <span>No academic periods configured.</span>
                <CreatePeriodButton academicYears={initialYears} onSuccess={handleSuccess} variant="link" />
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="years">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div>
                <CardTitle>Academic Years</CardTitle>
                <CardDescription>High-level 12-month time containers containing your academic terms.</CardDescription>
              </div>
              <CreateYearButton onSuccess={handleSuccess} />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Calendar System</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialYears.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">{year.name}</TableCell>
                    <TableCell className="font-mono">{year.code}</TableCell>
                    <TableCell>{titleize(year.calendarSystem)}</TableCell>
                    <TableCell>
                      {new Date(year.startsOn).toLocaleDateString()} - {new Date(year.endsOn).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{titleize(year.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {initialYears.length === 0 && (
              <div className="student-empty-state py-8">
                <span>No academic years configured.</span>
                <CreateYearButton onSuccess={handleSuccess} variant="link" />
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}