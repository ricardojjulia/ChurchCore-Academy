import type { ReactNode } from "react";

const growthReplacements: Array<[RegExp, string]> = [
  [/flagged?/gi, "reviewed"],
  [/risk/gi, "growth note"],
  [/problem/gi, "support need"],
  [/warning/gi, "attention item"],
  [/failure/gi, "learning opportunity"],
];

export function filterGrowthFrameText(value: string) {
  return growthReplacements.reduce((accumulator, [pattern, replacement]) => accumulator.replace(pattern, replacement), value);
}

export function GrowthFrameFilter({ children }: { children: ReactNode }) {
  if (typeof children === "string") {
    return <>{filterGrowthFrameText(children)}</>;
  }

  return <>{children}</>;
}
