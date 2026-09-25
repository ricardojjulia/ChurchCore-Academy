import { redirect } from "next/navigation";

// Legacy URL. Await params and redirect once: the previous version redirected to the list
// synchronously and left an un-awaited redirect to throw as an unhandled rejection (#176).
export default async function LegacyStudentRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/students/${encodeURIComponent(id)}`);
}
