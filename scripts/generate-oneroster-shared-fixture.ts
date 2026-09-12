import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSharedAcademyOneRosterFixturePackage } from "@/modules/oneroster-contract/conformance-fixture";

const fixtureName = "churchcore-academy-rostering-v1";
const output = process.argv[2] ?? path.join(process.cwd(), "fixtures/oneroster", fixtureName);

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  const csvPackage = await buildSharedAcademyOneRosterFixturePackage();
  const metadataFiles: Array<{ filename: string; sha256: string; bytes: number }> = [];
  for (const file of csvPackage.files) {
    const text = `${file.text}\n`;
    await writeFile(path.join(output, file.filename), text, "utf8");
    metadataFiles.push({
      filename: file.filename,
      sha256: sha256(text),
      bytes: Buffer.byteLength(text, "utf8"),
    });
  }
  await writeFile(
    path.join(output, "fixture.json"),
    `${JSON.stringify({
      name: fixtureName,
      standard: "OneRoster",
      version: "1.2",
      profile: "churchcore-oneroster-rostering-csv-provider",
      generatedAt: "2026-09-12T18:00:00.000Z",
      packageHash: packageHash(metadataFiles),
      files: metadataFiles,
    }, null, 2)}\n`,
    "utf8",
  );

  console.log(output);
}

function packageHash(files: Array<{ filename: string; sha256: string }>) {
  return sha256(files.map((file) => `${file.filename}\0${file.sha256}`).join("\n"));
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
