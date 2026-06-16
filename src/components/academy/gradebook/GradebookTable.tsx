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
import type { GradebookReviewRecord } from "@/modules/gradebook/types";
import type { GradebookVisibilityTier } from "@/types/gradebook";

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

function renderCell(row: GradebookReviewRecord, column: GradebookColumn) {
  switch (column) {
    case "learner":
      return row.learnerDisplayName;
    case "assignment":
      return row.assignmentTitle;
    case "status":
      return <Badge variant="outline">{row.status}</Badge>;
    case "submittedAt":
      return row.status === "draft" ? "Not submitted" : "Submitted";
    case "grade":
      return row.displayGrade;
    case "sensitivity":
      return <Badge variant={row.sensitivityLabel === "Pastoral" ? "secondary" : "outline"}>{row.sensitivityLabel}</Badge>;
    case "behavioralSignal":
      return row.behavioralSignal ?? "None";
  }
}

export function GradebookTable({
  rows,
  visibilityTier,
}: {
  rows: GradebookReviewRecord[];
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
