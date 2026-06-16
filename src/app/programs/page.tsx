import { redirect } from "next/navigation";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";

export default async function ProgramsPage() {
  const { dataset } = await loadProtectedAcademyDataset();
  
  // Redirect to the first available program
  if (dataset.programs.length > 0) {
    redirect(`/programs/${dataset.programs[0].id}`);
  }
  
  // If no programs exist, redirect to dashboard
  redirect("/");
}
