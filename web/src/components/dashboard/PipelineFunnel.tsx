import Link from "next/link";
import {
  Search,
  BarChart3,
  Star,
  FileSignature,
  CheckSquare,
  FileClock,
  Archive,
  Linkedin,
  SquareKanban,
} from "lucide-react";
import type { DashboardStats } from "@/types";

interface PipelineFunnelProps {
  stats: DashboardStats;
}

interface Stage {
  key: string;
  label: string;
  value: number;
  href: string;
  icon: React.ReactNode;
  barClasses: string;
  note?: string;
}

export default function PipelineFunnel({ stats }: PipelineFunnelProps) {
  // Snapshot stages: current state of active jobs. Applied is cumulative (all time).
  const snapshotStages: Stage[] = [
    {
      key: "scraped",
      label: "Scraped",
      value: stats.totalNewJobs,
      href: "/jobs/new",
      icon: <Search className="h-4 w-4" />,
      barClasses: "bg-slate-300",
      note: "active new jobs",
    },
    {
      key: "scored",
      label: "Scored",
      value: stats.scoredJobsCount,
      href: "/jobs/top-matches",
      icon: <BarChart3 className="h-4 w-4" />,
      barClasses: "bg-indigo-400",
      note: "AI-evaluated",
    },
    {
      key: "matched",
      label: "Matched (50+)",
      value: stats.totalTopMatches,
      href: "/jobs/top-matches",
      icon: <Star className="h-4 w-4" />,
      barClasses: "bg-indigo-500",
      note: "strong fits",
    },
    {
      key: "tailored",
      label: "Tailored",
      value: stats.customResumeJobsCount,
      href: "/jobs/tailored",
      icon: <FileSignature className="h-4 w-4" />,
      barClasses: "bg-emerald-500",
      note: "custom resume ready",
    },
  ];

  const appliedStage: Stage = {
    key: "applied",
    label: "Applied",
    value: stats.totalAppliedJobs,
    href: "/jobs/applied",
    icon: <CheckSquare className="h-4 w-4" />,
    barClasses: "bg-sky-500",
    note: "all time",
  };

  const stages = [...snapshotStages, appliedStage];
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  const conversion = (from: number, to: number): string | null => {
    if (from <= 0) return null;
    return `${Math.round((to / from) * 100)}%`;
  };

  const renderStage = (stage: Stage, index: number) => {
    const isSnapshot = index < snapshotStages.length;
    const prevStage = index > 0 ? stages[index - 1] : null;
    const conversionRate =
      isSnapshot && prevStage && index < snapshotStages.length
        ? conversion(prevStage.value, stage.value)
        : null;

    return (
      <li key={stage.key}>
        <Link
          href={stage.href}
          className="group block rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex items-center rounded-lg bg-gray-100 p-1.5 text-gray-500 group-hover:bg-white">
                {stage.icon}
              </span>
              <span className="truncate text-sm font-medium text-gray-700">
                {stage.label}
              </span>
              {stage.note && (
                <span className="hidden text-xs text-gray-400 sm:inline">
                  {stage.note}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              {conversionRate && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  {conversionRate} of prev
                </span>
              )}
              <span className="text-sm font-bold tabular-nums text-gray-900">
                {stage.value}
              </span>
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${stage.barClasses} transition-all duration-500`}
              style={{ width: `${Math.max((stage.value / maxValue) * 100, stage.value > 0 ? 2 : 0)}%` }}
            />
          </div>
        </Link>
      </li>
    );
  };

  return (
    <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Job Pipeline
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Where your active opportunities stand right now
          </p>
        </div>
      </div>

      <ol className="space-y-1">{stages.map(renderStage)}</ol>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          <FileClock className="h-3.5 w-3.5" />
          {stats.pendingScoreJobsCount} awaiting scoring
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          <Archive className="h-3.5 w-3.5" />
          {stats.expiredJobsCount} expired
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700">
          <Linkedin className="h-3.5 w-3.5" />
          {stats.linkedInJobsCount} LinkedIn
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
          <SquareKanban className="h-3.5 w-3.5" />
          {stats.careersFutureJobsCount} MyCareersFuture
        </span>
      </div>
    </section>
  );
}
