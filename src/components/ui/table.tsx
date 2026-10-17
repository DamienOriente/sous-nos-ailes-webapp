import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-md border border-sage-200 bg-ivory-50">
      <table className={cn("w-full border-collapse text-left text-[15px]", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("border-b border-sage-200 bg-ivory-100 px-4 py-2.5 text-[13px] font-semibold tracking-[0.01em] text-ink-500", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-sage-100 px-4 py-3 align-top text-ink-900", className)} {...props} />;
}
