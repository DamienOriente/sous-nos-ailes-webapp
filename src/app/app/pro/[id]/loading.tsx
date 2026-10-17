import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
