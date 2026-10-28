// Loading skeleton component
export default function JobListSkeleton() {
  return (
    <div className="h-[calc(100vh-10rem)] bg-gray-50 rounded-lg overflow-hidden shadow-sm animate-pulse">
      <div className="flex flex-col md:flex-row h-full">
        {/* Left skeleton */}
        <div className="w-full md:w-1/3 bg-white border-r border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
        {/* Right skeleton */}
        <div className="w-full md:w-2/3 bg-white">
          <div className="p-6 border-b border-gray-200">
            <div className="h-8 bg-gray-200 rounded w-2/3 mb-3"></div>
            <div className="flex gap-2 mb-4">
              <div className="h-5 bg-gray-200 rounded w-1/4"></div>
              <div className="h-5 bg-gray-200 rounded w-1/4"></div>
            </div>
            <div className="flex gap-2 mt-4">
              <div className="h-10 bg-gray-200 rounded w-32"></div>
              <div className="h-10 bg-gray-200 rounded w-32"></div>
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
          <div className="p-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-4 bg-gray-200 rounded w-full mb-3"
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
