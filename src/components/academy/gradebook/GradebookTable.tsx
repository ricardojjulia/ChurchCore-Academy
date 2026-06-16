import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getVisibleGradebookColumns,
  type GradebookColumn,
} from "@/components/academy/gradebook/ColumnVisibilityConfig";
import type { GradebookVisibilityTier, InstructorGradeRow } from "@/types/gradebook";

function columnLabel(column: GradebookColumn) {
  return {
    learner: "Learner",
    assignment: "Assignment",
    status: "Status",
    submittedAt: "Submitted",
    grade: "Grade",
    sensitivity: "Sensitivity",
    behavioralSignal: "Behavioral Signal",
  }[column];
}

function renderCell(row: InstructorGradeRow, column: GradebookColumn) {
  switch (column) {
    case "learner":
      return row.learnerDisplayName;
    case "assignment":
      return row.assignmentTitle;
    case "status":
      return <Badge variant="outline">{row.status}</Badge>;
    case "submittedAt":
      return row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "Not submitted";
    case "grade":
      return row.percentage === null ? "Pending" : `${Math.round(row.percentage)}%`;
    case "sensitivity":
      return <Badge variant={row.sensitivityTier === "pastoral" ? "secondary" : "outline"}>{row.sensitivityTier}</Badge>;
    case "behavioralSignal":
      return row.behavioralSignal ?? "None";
  }
}

export function GradebookTable({
  rows,
  visibilityTier,
}: {
  rows: InstructorGradeRow[];
  visibilityTier: GradebookVisibilityTier;
}) {
  const columns = getVisibleGradebookColumns(visibilityTier);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{columnLabel(column)}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
              No gradebook records yet.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((column) => (
                <TableCell key={column}>{renderCell(row, column)}</TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
