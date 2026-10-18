import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <div className="space-y-6" aria-busy="true" role="status" aria-label="Chargement">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
      <Skeleton className="h-9 w-36" />
    </div>
  );
}
