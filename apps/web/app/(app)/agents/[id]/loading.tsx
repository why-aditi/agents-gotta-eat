import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading agent">
      <div className="space-y-4">
        <Skeleton className="h-4 w-16" />
        <div className="sticker flex flex-col items-center gap-6 p-6 sm:flex-row">
          <Skeleton className="size-32 rounded-full sm:size-36" />
          <div className="w-full flex-1 space-y-3">
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-80 max-w-full" />
            <Skeleton className="h-2.5 w-full max-w-sm" />
          </div>
        </div>
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Skeleton className="h-[28rem] w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
