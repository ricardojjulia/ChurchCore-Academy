import JSZip from "jszip";
import type { OneRosterExportPackage } from "./types";

export async function buildOneRosterZipPackage(csvPackage: OneRosterExportPackage): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of csvPackage.files) {
    zip.file(file.filename, file.text);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
