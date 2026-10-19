import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement du plan de table">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="aspect-[10/7] w-full rounded-2xl" />
    </div>
  );
}
