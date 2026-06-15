import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Form Field wrapper following LMS UI spec section 7.6
 * 
 * Labels: block text-sm font-semibold text-foreground mb-1.5
 * Required marker: <span class="text-rose-500">*</span>
 * Field hint: text-xs text-muted-foreground mt-1
 * Inline error: text-xs text-rose-600 mt-1
 */
export function FormField({
  label,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-foreground mb-1.5">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

/**
 * Text Input following LMS UI spec section 7.6
 * 
 * w-full border border-input rounded-md px-4 py-2.5 text-sm
 * text-foreground bg-background placeholder:text-muted-foreground
 * focus:outline-none focus:ring-2 focus:ring-ring transition
 */
export function TextInput({
  label,
  required,
  error,
  hint,
  containerClassName,
  ...props
}: TextInputProps) {
  const input = (
    <input
      {...props}
      className={cn(
        "w-full border border-input rounded-md px-4 py-2.5 text-sm text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition",
        props.className,
      )}
    />
  );

  if (!label) return input;

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={containerClassName}
    >
      {input}
    </FormField>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

/**
 * Textarea following LMS UI spec section 7.6
 * 
 * w-full border border-input rounded-md px-4 py-2.5 text-sm
 * text-foreground bg-background resize-none
 * focus:outline-none focus:ring-2 focus:ring-ring transition
 */
export function TextArea({
  label,
  required,
  error,
  hint,
  containerClassName,
  ...props
}: TextAreaProps) {
  const textarea = (
    <textarea
      {...props}
      className={cn(
        "w-full border border-input rounded-md px-4 py-2.5 text-sm text-foreground bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring transition",
        props.className,
      )}
    />
  );

  if (!label) return textarea;

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={containerClassName}
    >
      {textarea}
    </FormField>
  );
}

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  containerClassName?: string;
}

/**
 * Select following LMS UI spec section 7.6
 * 
 * w-full border border-input rounded-md px-4 py-2.5 text-sm
 * text-foreground bg-background
 * focus:outline-none focus:ring-2 focus:ring-ring transition
 */
export function Select({
  label,
  required,
  error,
  hint,
  options,
  containerClassName,
  ...props
}: SelectProps) {
  const select = (
    <select
      {...props}
      className={cn(
        "w-full border border-input rounded-md px-4 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring transition",
        props.className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (!label) return select;

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={containerClassName}
    >
      {select}
    </FormField>
  );
}

interface FormActionsProps {
  onSubmit?: () => void;
  submitLabel?: string;
  onCancel?: () => void;
  onDelete?: () => void;
  isLoading?: boolean;
}

/**
 * Form Actions following LMS UI spec section 7.6
 * 
 * Standard: Submit + Cancel buttons
 * With delete: Delete (left) + Cancel + Save (right)
 */
export function FormActions({
  onSubmit,
  submitLabel = "Save",
  onCancel,
  onDelete,
  isLoading,
}: FormActionsProps) {
  if (onDelete) {
    return (
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={isLoading}
          className="text-sm font-semibold text-rose-600 hover:text-rose-800 transition-colors disabled:opacity-50"
        >
          Delete
        </button>
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="border border-border rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading}
            className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading}
        className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {submitLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="border border-border rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
