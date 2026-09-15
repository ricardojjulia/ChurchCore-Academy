"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Gift, DollarSign, Calendar } from "lucide-react";

interface AlumniRecordTabProps {
  enabled: boolean;
  personId: string;
  hasAlumniRecord: boolean;
  giftCount?: number;
  totalGivenCents?: number;
  lastGiftDate?: string | null;
}

export function AlumniRecordTab({
  enabled,
  personId,
  hasAlumniRecord,
  giftCount = 0,
  totalGivenCents = 0,
  lastGiftDate = null,
}: AlumniRecordTabProps) {
  if (!enabled) {
    return null;
  }

  function formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }

  // dateString here is always a date-only value (lastGiftDate), never a timestamp.
  // `new Date(dateString)` parses that as UTC midnight, so `.toLocaleDateString()` in any
  // timezone behind UTC displays the day before the one actually recorded. See the matching
  // fix in the alumni roster/detail pages, found via the same live browser testing pass.
  function formatDate(dateString: string | null): string {
    if (!dateString) return "—";
    const [year, month, day] = dateString.split("-").map(Number);
    if (!year || !month || !day) return "—";
    return new Date(year, month - 1, day).toLocaleDateString();
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Alumni & Giving Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasAlumniRecord ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground italic">
                No alumni record on file.
              </p>
              <Link
                href={`/admin/alumni/${personId}`}
                className="text-sm font-semibold text-accent hover:underline"
              >
                Create alumni record →
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Alumni Record</span>
                </div>
                <Badge variant="default">On File</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Total Gifts</span>
                </div>
                <Badge variant="outline">{giftCount}</Badge>
              </div>

              {totalGivenCents > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium">Total Given</span>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(totalGivenCents)}</span>
                </div>
              )}

              {lastGiftDate && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium">Last Gift</span>
                  </div>
                  <span className="text-sm">{formatDate(lastGiftDate)}</span>
                </div>
              )}

              {giftCount === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No gifts recorded.
                </p>
              )}

              <div className="pt-4 border-t">
                <Link
                  href={`/admin/alumni/${personId}`}
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  View full alumni & giving record →
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
