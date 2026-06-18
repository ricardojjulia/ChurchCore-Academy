import { redirect } from "next/navigation";
export default function LegacyStudentRedirect({ params }: { params: Promise<{ id: string }> }) {
  void params.then(({ id }) => redirect(`/admin/students/${id}`));
  redirect("/admin/students");
}
