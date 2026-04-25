import * as React from "react";
import { TextInput, type TextInputProps } from "@mantine/core";

type InputProps = Omit<React.ComponentProps<"input">, "size"> & Pick<TextInputProps, "size">;

function Input({ className, type, ...props }: InputProps) {
  return <TextInput className={className} type={type} {...props} />;
}

export { Input };
