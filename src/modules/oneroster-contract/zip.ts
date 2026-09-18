import JSZip from "jszip";
import type { OneRosterExportPackage } from "./types";

export async function buildOneRosterZipPackage(csvPackage: OneRosterExportPackage): Promise<Uint8Array> {
  const zip = new JSZip();
  if (csvPackage.files.reduce((total, file) => total + Buffer.byteLength(file.text, "utf8"), 0) > 50 * 1024 * 1024) {
    throw new Error("Invalid OneRoster package size.");
  }
  for (const file of csvPackage.files) {
    zip.file(file.filename, file.text, { date: new Date("1980-01-01T00:00:00.000Z") });
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("Invalid OneRoster package size.");
  return bytes;
}
