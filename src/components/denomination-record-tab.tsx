"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Church, Users } from "lucide-react";

interface DenominationRecordTabProps {
  denominationTrackingEnabled: boolean;
  personId: string;
  membershipCount: number;
  ordinationCount: number;
  hasActiveOrdination: boolean;
  denominationNames: string[];
}

export function DenominationRecordTab({
  denominationTrackingEnabled,
  personId,
  membershipCount,
  ordinationCount,
  hasActiveOrdination,
  denominationNames,
}: DenominationRecordTabProps) {
  if (!denominationTrackingEnabled) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Denomination & Ordination Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Denomination Memberships</span>
              </div>
              <Badge variant="outline">{membershipCount}</Badge>
            </div>

            {denominationNames.length > 0 && (
              <div className="ml-6 text-sm text-muted-foreground">
                {denominationNames.join(", ")}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Church size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Ordination Records</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{ordinationCount}</Badge>
                {hasActiveOrdination && (
                  <Badge variant="default">Active</Badge>
                )}
              </div>
            </div>

            {(membershipCount === 0 && ordinationCount === 0) && (
              <p className="text-sm text-muted-foreground italic">
                No denomination or ordination records on file.
              </p>
            )}

            <div className="pt-4 border-t">
              <Link
                href={`/admin/denomination/${personId}`}
                className="text-sm font-semibold text-accent hover:underline"
              >
                View full denomination & ordination records →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
