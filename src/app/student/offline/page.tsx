import Link from "next/link";
import { GraduationCap, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";

export default function StudentOfflinePage() {
  return (
    <main className="student-offline-page">
      <section className="student-offline-card">
        <span className="student-offline-mark">
          <GraduationCap />
        </span>
        <div className="student-offline-status">
          <WifiOff />
          Offline
        </div>
        <h1>Reconnect to view your Academy records</h1>
        <p>
          ChurchCore Academy does not store student schedules, grades, progress, documents, messages, or learning launch data for offline access.
        </p>
        <div className="student-offline-privacy">
          <ShieldCheck />
          <span>Only this non-sensitive offline screen and the Academy mark are stored by the Student PWA.</span>
        </div>
        <Link href="/student" className="student-offline-retry">
          <RefreshCw />
          Try again
        </Link>
      </section>
    </main>
  );
}
