import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildChurchCoreOneRosterFixturePackage,
  churchCoreOneRosterFixtureGeneratedAt,
  churchCoreOneRosterFixtureName,
  churchCoreOneRosterFixtureTenantId,
} from "@/modules/oneroster-contract";

const outputDir = process.argv[2] ?? path.join(process.cwd(), "fixtures", "oneroster", churchCoreOneRosterFixtureName);

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const fixturePackage = await buildChurchCoreOneRosterFixturePackage();

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const files = fixturePackage.files.map((file) => ({
    ...file,
    sha256: sha256(file.text),
    bytes: Buffer.byteLength(file.text),
  }));

  for (const file of files) {
    await writeFile(path.join(outputDir, file.filename), file.text, "utf8");
  }

  const packageHash = sha256(files.map((file) => `${file.filename}\0${file.sha256}`).join("\n"));
  await writeFile(
    path.join(outputDir, "fixture.json"),
    `${JSON.stringify(
      {
        name: churchCoreOneRosterFixtureName,
        standard: "OneRoster",
        version: "1.2",
        profile: "churchcore-oneroster-rostering-csv-provider",
        tenantId: churchCoreOneRosterFixtureTenantId,
        generatedAt: churchCoreOneRosterFixtureGeneratedAt,
        packageHash,
        files: files.map(({ filename, sha256: fileHash, bytes }) => ({
          filename,
          sha256: fileHash,
          bytes,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(JSON.stringify({ outputDir, packageHash, fileCount: files.length }, null, 2));
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
