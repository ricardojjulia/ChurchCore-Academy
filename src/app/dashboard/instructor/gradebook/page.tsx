import { redirect } from "next/navigation";

export default async function InstructorGradebookRoute({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; studentName?: string }>;
}) {
  const context = await searchParams;
  const params = new URLSearchParams();

  if (context.student) {
    params.set("student", context.student);
  }

  if (context.studentName) {
    params.set("studentName", context.studentName);
  }

  redirect(`/dashboard/faculty/gradebook${params.size ? `?${params.toString()}` : ""}`);
}
