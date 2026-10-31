import { CalendarCheck } from "lucide-react";

interface ActivityChartProps {
  data: { date: string; count: number }[];
}

export default function ActivityChart({ data }: ActivityChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);
  const todayKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  })();

  const formatDateLabel = (dateStr: string): string => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Activity</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Applications over the last 14 days
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
          <CalendarCheck className="h-3.5 w-3.5" />
          {totalCount} applied
        </span>
      </div>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
          <span className="mb-3 inline-flex items-center rounded-full bg-gray-100 p-3">
            <CalendarCheck className="h-6 w-6 text-gray-400" />
          </span>
          <h3 className="text-sm font-semibold text-gray-900">
            No applications yet
          </h3>
          <p className="mt-1 max-w-xs text-xs text-gray-500">
            Jobs you mark as applied will show up here as daily activity.
          </p>
        </div>
      ) : (
        <>
          <div className="flex h-36 items-end gap-1.5">
            {data.map((day) => {
              const isToday = day.date === todayKey;
              const heightPct = (day.count / maxCount) * 100;
              return (
                <div
                  key={day.date}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                >
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                    {formatDateLabel(day.date)} · {day.count} applied
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 group-hover:opacity-80 ${
                      isToday
                        ? "bg-gradient-to-t from-indigo-600 to-indigo-400"
                        : day.count > 0
                          ? "bg-gradient-to-t from-indigo-300 to-indigo-200"
                          : "bg-gray-100"
                    } ${day.count === 0 ? "h-1.5" : ""}`}
                    style={
                      day.count > 0 ? { height: `${Math.max(heightPct, 6)}%` } : undefined
                    }
                    aria-label={`${formatDateLabel(day.date)}: ${day.count} applied`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-gray-400">
            <span>{formatDateLabel(data[0]?.date ?? "")}</span>
            <span className="font-medium text-gray-500">
              peak {maxCount}/day
            </span>
            <span>Today</span>
          </div>
        </>
      )}
    </section>
  );
}
