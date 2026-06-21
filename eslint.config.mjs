import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/modules/academy-data/server-dataset",
              message:
                "ADR-0030: runtime surfaces must use requireActor() plus targeted database reads instead of loadProtectedAcademyDataset.",
            },
          ],
          patterns: [
            {
              group: ["**/academy-data/server-dataset"],
              message:
                "ADR-0030: runtime surfaces must use requireActor() plus targeted database reads instead of loadProtectedAcademyDataset.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
]);

export default eslintConfig;
