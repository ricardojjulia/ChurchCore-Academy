"use client";

import * as React from "react";
import { Table as MantineTable } from "@mantine/core";
import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <MantineTable.ScrollContainer minWidth={760}>
      <MantineTable striped highlightOnHover withTableBorder withColumnBorders={false} className={className} {...props} />
    </MantineTable.ScrollContainer>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <MantineTable.Thead className={className} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <MantineTable.Tbody className={className} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <MantineTable.Tfoot className={className} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <MantineTable.Tr className={className} {...props} />;
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <MantineTable.Th className={cn("mantine-table-head", className)} {...props} />;
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <MantineTable.Td className={className} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={className} {...props} />;
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
