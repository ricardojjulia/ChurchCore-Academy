import { redirect } from "next/navigation";
export default function LegacyHqRedirect() {
  redirect("/internal/hq");
}
