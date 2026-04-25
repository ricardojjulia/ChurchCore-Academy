"use client";

import { Divider } from "@mantine/core";

function Separator({ orientation = "horizontal" }: { orientation?: "horizontal" | "vertical"; className?: string }) {
  return <Divider orientation={orientation} />;
}

export { Separator };
