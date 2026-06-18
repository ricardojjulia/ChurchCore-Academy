import { redirect } from "next/navigation";
export default function LegacyProgramRedirect({ params }: { params: Promise<{ id: string }> }) {
  void params.then(({ id }) => redirect(`/admin/programs/${id}`));
  redirect("/admin/programs");
}
