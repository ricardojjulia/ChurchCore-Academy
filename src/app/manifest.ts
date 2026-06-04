import type { MetadataRoute } from "next";
import { studentManifest } from "@/modules/student-pwa/shell-config";

export default function manifest(): MetadataRoute.Manifest {
  return studentManifest;
}
