import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const controlBase =
  "block w-full rounded-sm border bg-ivory-50 px-3.5 text-[15px] text-ink-900 " +
  "transition-[border-color,box-shadow] duration-150 ease-out " +
  "hover:border-sage-400 focus:border-sage-700 focus:outline-none focus:ring-2 focus:ring-sage-200 " +
  "disabled:bg-ivory-200 disabled:text-ink-500 read-only:bg-ivory-100";

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "h-11", invalid ? "border-danger-600" : "border-sage-300", className)}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "min-h-28 py-2.5 leading-relaxed", invalid ? "border-danger-600" : "border-sage-300", className)}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "h-11 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4' fill='none' stroke='%233b5447' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[position:right_0.75rem_center] bg-no-repeat pr-10", invalid ? "border-danger-600" : "border-sage-300", className)}
      {...props}
    >
      {children}
    </select>
  );
}

type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  help?: ReactNode;
  error?: string | string[] | null;
  required?: boolean;
  optionalLabel?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({ label, htmlFor, help, error, required, optionalLabel, children, className }: FieldProps) {
  const errors = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[15px] font-semibold text-ink-900">
        {label}
        {required ? <span className="ml-1 text-clay-700" aria-hidden="true">*</span> : null}
        {optionalLabel && !required ? <span className="ml-2 text-sm font-normal text-ink-500">(facultatif)</span> : null}
      </label>
      {children}
      {help ? (
        <p id={`${htmlFor}-help`} className="text-sm leading-snug text-ink-500">
          {help}
        </p>
      ) : null}
      {errors.length ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm font-medium text-danger-600">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

const CHECKBOX_CLASSES =
  "mt-1 size-4 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-sage-400 bg-ivory-50 checked:border-sage-700 checked:bg-sage-700 bg-center bg-no-repeat " +
  "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-6' fill='none' stroke='%23fbf8f3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")]";

export function Checkbox({ className, label, id, ...props }: ComponentProps<"input"> & { label: ReactNode; id: string }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-ink-700", className)}>
      <input
        id={id}
        type="checkbox"
        className={CHECKBOX_CLASSES}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

export function RadioOption({
  className,
  label,
  description,
  id,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode; id: string }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-sm border border-sage-200 bg-ivory-50 px-4 py-3 text-[15px] leading-snug text-ink-900 transition-colors hover:border-sage-400 has-checked:border-sage-700 has-checked:bg-sage-50",
        className,
      )}
    >
      <input
        id={id}
        type="radio"
        className="mt-1 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-sage-400 bg-ivory-50 checked:border-[5px] checked:border-sage-700"
        {...props}
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {description ? <span className="text-sm text-ink-500">{description}</span> : null}
      </span>
    </label>
  );
}
