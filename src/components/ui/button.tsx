import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "sage";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm font-sans font-semibold leading-none whitespace-nowrap " +
  "transition-[background-color,color,border-color,box-shadow] duration-200 ease-out cursor-pointer select-none " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-clay-600 text-ivory-50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] hover:bg-clay-700 active:bg-clay-800",
  sage: "bg-sage-700 text-ivory-50 hover:bg-sage-800 active:bg-sage-900",
  secondary:
    "border border-sage-400 bg-transparent text-sage-800 hover:border-sage-700 hover:bg-sage-50 active:bg-sage-100",
  ghost: "bg-transparent text-sage-800 hover:bg-sage-50 active:bg-sage-100",
  danger: "border border-danger-600 text-danger-600 bg-transparent hover:bg-danger-100",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(options: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(base, variants[options.variant ?? "primary"], sizes[options.size ?? "md"], options.className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode };

export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
