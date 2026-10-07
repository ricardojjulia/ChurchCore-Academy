// Schedule items carry the section's term start date as UTC midnight (`YYYY-MM-DDT00:00:00.000Z`),
// not a meeting time. Formatting that with a time in a local time zone moved it to the previous
// evening ("Aug 14, 8:00 PM" for a term starting Aug 15, found in the 2026-10-06 pilot dry run),
// so it is shown as a calendar date in UTC.
export function formatScheduleStart(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "Date pending";
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  return `Starts ${day}`;
}
