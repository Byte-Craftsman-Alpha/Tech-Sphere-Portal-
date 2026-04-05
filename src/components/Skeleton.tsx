export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`skeleton ${className}`} />
);

export const EventSkeleton = () => (
  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
    <Skeleton className="h-48 w-full rounded-none" />
    <div className="p-6 space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="pt-4 flex justify-between items-center">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  </div>
);

export const UserSkeleton = () => (
  <div className="flex items-center gap-4 p-4">
    <Skeleton className="w-12 h-12 rounded-lg" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  </div>
);

export const ProfileSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-6 p-8 bg-white rounded-xl border border-gray-100">
      <Skeleton className="w-32 h-32 rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  </div>
);
