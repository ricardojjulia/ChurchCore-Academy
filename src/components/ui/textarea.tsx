import * as React from "react";
import { Textarea as MantineTextarea, type TextareaProps as MantineTextareaProps } from "@mantine/core";

type TextareaProps = Omit<React.ComponentProps<"textarea">, "size"> & Pick<MantineTextareaProps, "size">;

function Textarea({ className, ...props }: TextareaProps) {
  return <MantineTextarea className={className} minRows={4} autosize {...props} />;
}

export { Textarea };
