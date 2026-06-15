import { redirect } from "next/navigation";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";

export default async function StudentsPage() {
  const { dataset } = await loadProtectedAcademyDataset();
  
  // Redirect to the first available student
  if (dataset.students.length > 0) {
    redirect(`/students/${dataset.students[0].id}`);
  }
  
  // If no students exist, redirect to dashboard
  redirect("/");
}
