import Link from "next/link";
import {
  BuildingIcon,
  MapPinIcon,
  ArrowRight,
  Star,
  Inbox,
} from "lucide-react";
import type { Job } from "@/types";

interface TopMatchesPreviewProps {
  jobs: Job[];
}

function getScoreBadgeClasses(score: number): string {
  if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 60) return "bg-blue-50 text-blue-700 border-blue-200";
  if (score >= 40) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

export default function TopMatchesPreview({ jobs }: TopMatchesPreviewProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Top Matches
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Your highest-scoring opportunities
          </p>
        </div>
        <Link
          href="/jobs/top-matches"
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
          <span className="mb-3 inline-flex items-center rounded-full bg-gray-100 p-3">
            <Inbox className="h-6 w-6 text-gray-400" />
          </span>
          <h3 className="text-sm font-semibold text-gray-900">
            No matches yet
          </h3>
          <p className="mt-1 max-w-xs text-xs text-gray-500">
            Once jobs are scraped and scored, your best fits will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {jobs.map((job) => (
            <li key={job.job_id}>
              <Link
                href={`/jobs/top-matches?selectedJobId=${job.job_id}`}
                className="group flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-indigo-700">
                    {job.job_title}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <BuildingIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{job.company}</span>
                    </span>
                    <span className="hidden min-w-0 items-center gap-1 sm:inline-flex">
                      <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {job.resume_score_stage === "custom" && (
                    <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:inline">
                      ✨ Tailored
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${getScoreBadgeClasses(job.resume_score ?? 0)}`}
                  >
                    <Star className="h-3 w-3" />
                    {job.resume_score ?? "—"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
