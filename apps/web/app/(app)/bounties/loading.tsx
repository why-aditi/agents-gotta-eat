import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading bounties">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Bounties</h1>
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="sticker space-y-3 p-5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
