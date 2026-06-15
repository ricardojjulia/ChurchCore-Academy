import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  placeholder?: string;
  data: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

function Select({ label, placeholder, data, value, onChange, className, id, required, ...props }: SelectProps) {
  const generatedId = React.useId();
  const selectId = id ?? generatedId;

  return (
    <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor={selectId}>
      {label ? <span>{label}</span> : null}
      <select
        id={selectId}
        className={cn(
          "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        required={required}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        ) : null}
        {data.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export { Select };
