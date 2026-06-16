"use client";

import type React from "react";

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex" title={label}>
      {children}
    </span>
  );
}

export { Tooltip };
