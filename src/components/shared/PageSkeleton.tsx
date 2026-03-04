import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5" />
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </div>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-28" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        <Skeleton className="h-48 rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    </div>
  );
}
