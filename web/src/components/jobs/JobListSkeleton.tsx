// Loading skeleton component
export default function JobListSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-13.5rem)] min-h-[620px] bg-white border border-zinc-200/90 rounded-2xl shadow-xs overflow-hidden animate-pulse">
      {/* Left skeleton */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-200/80 flex flex-col bg-zinc-50/40">
        <div className="px-4 py-3 border-b border-zinc-200/70 bg-white flex items-center justify-between">
          <div className="h-4 bg-zinc-200 rounded w-24"></div>
          <div className="h-4 bg-zinc-200 rounded w-16"></div>
        </div>
        <div className="divide-y divide-zinc-100 flex-grow p-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div className="h-4 bg-zinc-200 rounded w-3/4"></div>
                <div className="h-5 bg-zinc-200 rounded w-10"></div>
              </div>
              <div className="h-3 bg-zinc-100 rounded w-1/2"></div>
              <div className="flex gap-2 pt-1">
                <div className="h-3 bg-zinc-100 rounded w-16"></div>
                <div className="h-3 bg-zinc-100 rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right skeleton */}
      <div className="w-full lg:flex-1 bg-white flex flex-col">
        <div className="p-6 border-b border-zinc-200/80 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2 w-2/3">
              <div className="h-6 bg-zinc-200 rounded w-3/4"></div>
              <div className="h-4 bg-zinc-100 rounded w-1/2"></div>
            </div>
            <div className="h-12 w-24 bg-zinc-100 rounded-xl"></div>
          </div>
          <div className="flex gap-2 pt-2">
            <div className="h-8 bg-zinc-200 rounded-lg w-28"></div>
            <div className="h-8 bg-zinc-100 rounded-lg w-28"></div>
            <div className="h-8 bg-zinc-100 rounded-lg w-28"></div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-zinc-100">
            <div className="h-7 bg-zinc-100 rounded-lg w-20"></div>
            <div className="h-7 bg-zinc-100 rounded-lg w-20"></div>
            <div className="h-7 bg-zinc-100 rounded-lg w-20"></div>
          </div>
        </div>
        <div className="p-6 sm:p-8 space-y-3 flex-grow">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-3.5 bg-zinc-100 rounded"
              style={{ width: `${85 - (i % 4) * 15}%` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}
