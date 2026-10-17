import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement des contacts">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
