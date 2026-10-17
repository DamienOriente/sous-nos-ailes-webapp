import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyNestScene } from "@/components/illustrations";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export type Column<T> = { key: string; header: React.ReactNode; cell: (row: T) => React.ReactNode; className?: string };

/** Server-rendered table with an illustrated empty state; rows carry their own key. */
export function AdminTable<T>({ columns, rows, rowKey, emptyTitle, emptyDescription, emptyIllustration, className }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; emptyTitle: string; emptyDescription?: string; emptyIllustration?: React.ReactNode; className?: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 px-6 py-10 text-center" role="status">
        <div className="mb-2 w-40">{emptyIllustration ?? <EmptyNestScene />}</div>
        <h3 className="text-base font-semibold">{emptyTitle}</h3>
        {emptyDescription && <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{emptyDescription}</p>}
      </div>
    );
  }
  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={c.className}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={rowKey(r)}>
              {columns.map((c) => (
                <TableCell key={c.key} className={c.className}>
                  {c.cell(r)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export { EmptyState };

export function dateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(typeof d === "string" ? new Date(d) : d);
}
