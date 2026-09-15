"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RelationshipModal } from "./RelationshipModal";

interface RelationshipRecord {
  id: string;
  studentPersonId: string;
  studentDisplayName: string;
  relationshipType: string;
  authority: string;
  visibility: string;
  status: string;
}

interface StudentsTabProps {
  guardianPersonId: string;
  relationships: RelationshipRecord[];
  students: Array<{ id: string; displayName: string }>;
}

function titleize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function StudentsTab({ guardianPersonId, relationships, students }: StudentsTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editMode, setEditMode] = useState<{
    relationshipId: string;
    authority: string;
    visibility: string;
    status: string;
  } | null>(null);

  return (
    <>
      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          {relationships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No student relationships linked yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Relationship Type</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relationships.map((rel) => (
                  <TableRow key={rel.id}>
                    <TableCell className="font-medium">{rel.studentDisplayName}</TableCell>
                    <TableCell>{titleize(rel.relationshipType)}</TableCell>
                    <TableCell>{titleize(rel.authority)}</TableCell>
                    <TableCell>{titleize(rel.visibility)}</TableCell>
                    <TableCell>
                      <Badge variant={rel.status === "active" ? "secondary" : "outline"}>
                        {titleize(rel.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditMode({
                              relationshipId: rel.id,
                              authority: rel.authority,
                              visibility: rel.visibility,
                              status: rel.status,
                            })
                          }
                        >
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="button-row">
            <Button onClick={() => setCreateOpen(true)}>+ Link to student</Button>
          </div>
        </CardContent>
      </Card>

      <RelationshipModal
        guardianPersonId={guardianPersonId}
        mode="create"
        students={students}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {editMode && (
        <RelationshipModal
          guardianPersonId={guardianPersonId}
          mode="edit"
          relationshipId={editMode.relationshipId}
          currentAuthority={editMode.authority}
          currentVisibility={editMode.visibility}
          currentStatus={editMode.status}
          open={true}
          onClose={() => setEditMode(null)}
        />
      )}
    </>
  );
}
