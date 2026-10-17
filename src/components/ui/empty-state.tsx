import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-sage-300 bg-ivory-50/60 px-6 py-10 text-center">
      <p className="font-sans text-lg font-semibold text-ink-900">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-[15px] leading-snug text-ink-500">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
