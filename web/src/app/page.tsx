import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCachedDashboardStats, getAppSettings } from "@/lib/supabase/queries";
import {
  Briefcase,
  CheckSquare,
  Star,
  Zap,
  Archive,
  FileClock,
  FileCheck,
  FileText,
  FileX,
  FileUp,
  FileSignature,
  Linkedin,
  SquareKanban,
  CalendarCheck,
  Sparkles,
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  href: string;
  description: string;
  color: string;
}

function StatCard({
  title,
  value,
  icon,
  href,
  description,
  color,
}: StatCardProps) {
  return (
    <Link href={href} className="group transition-all duration-300 ease-in-out">
      <div className="bg-white h-full rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-gray-200 transition-all duration-300">
        <div className={`h-1 ${color}`}></div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div
              className={`${color.replace(
                "bg-",
                "text-"
              )} bg-opacity-10 p-2.5 rounded-lg`}
            >
              {icon}
            </div>
            <span className="text-4xl font-bold text-gray-800">{value}</span>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
            <p className="text-xs text-gray-500 line-clamp-2">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);

  if (!hasSupabase) {
    redirect("/setup");
  }

  let isSetupComplete =
    cookieStore.get("jobtrack_setup_complete")?.value === "true" ||
    process.env.SETUP_COMPLETED === "true";

  // Get server's current local date in YYYY-MM-DD format
  const now = new Date(); // Current date/time in server's local timezone
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0"); // getMonth() is 0-indexed
  const day = now.getDate().toString().padStart(2, "0");
  const localToday = `${year}-${month}-${day}`; // e.g., "2025-05-21"

  console.log("Server's Local Date for Query:", localToday);

  let statsData = {
    totalNewJobs: 0,
    totalAppliedJobs: 0,
    totalTopMatches: 0,
    expiredJobsCount: 0,
    pendingScoreJobsCount: 0,
    scoredJobsCount: 0,
    customResumeJobsCount: 0,
    noCustomResumeJobsCount: 0,
    scoredWithOriginalResumeCount: 0,
    scoredWithCustomResumeCount: 0,
    linkedInJobsCount: 0,
    careersFutureJobsCount: 0,
    appliedTodayCount: 0,
  };
  let appSettings: any = null;

  try {
    const [resStats, resSettings] = await Promise.all([
      getCachedDashboardStats(localToday),
      getAppSettings(),
    ]);
    statsData = resStats;
    appSettings = resSettings;

    if (appSettings?.setup_completed === true) {
      isSetupComplete = true;
    }
  } catch (err: any) {
    console.warn("Initial dashboard stats fetch notice:", err.message);
  }

  if (!isSetupComplete) {
    redirect("/setup");
  }

  const {
    totalNewJobs,
    totalAppliedJobs,
    totalTopMatches,
    expiredJobsCount,
    pendingScoreJobsCount,
    scoredJobsCount,
    customResumeJobsCount,
    noCustomResumeJobsCount,
    scoredWithOriginalResumeCount,
    scoredWithCustomResumeCount,
    linkedInJobsCount,
    careersFutureJobsCount,
    appliedTodayCount,
  } = statsData;

  const hasApiKey = Boolean(
    appSettings?.llm_api_key ||
    process.env.LLM_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.FIREWORKS_API_KEY
  );
  // Create a Date object from the localToday string for formatting the description.
  // new Date(localToday) will parse it as midnight in the server's local timezone.
  const dateForAppliedTodayDescription = new Date(localToday);

  const stats = [
    {
      title: "New Jobs",
      value: totalNewJobs,
      icon: <Zap size={20} />,
      href: "/jobs/new",
      description: "Recently scraped job opportunities.",
      color: "bg-indigo-500",
    },
    {
      title: "Applied Jobs (Total)", // Clarified title
      value: totalAppliedJobs,
      icon: <CheckSquare size={20} />,
      href: "/jobs/applied",
      description: "Total jobs you have applied to.",
      color: "bg-green-500",
    },
    {
      title: "Applied Today", // New StatCard for jobs applied today
      value: appliedTodayCount,
      icon: <CalendarCheck size={20} />,
      href: "/jobs/applied", // Or link to a filtered view if available
      description: `Jobs applied on ${dateForAppliedTodayDescription.toLocaleDateString(
        "en-US",
        {
          month: "long",
          day: "numeric",
          year: "numeric",
          // No timeZone option, so it uses the server's local timezone for formatting
        }
      )}.`,
      color: "bg-pink-500", // Using a new color for distinction
    },
    {
      title: "Top Matches",
      value: totalTopMatches,
      icon: <Star size={20} />,
      href: "/jobs/top-matches",
      description: "Jobs that best match your profile.",
      color: "bg-amber-500",
    },
    {
      title: "Expired Jobs",
      value: expiredJobsCount,
      icon: <Archive size={20} />,
      href: "/",
      description: "Jobs that are no longer active.",
      color: "bg-gray-500",
    },
    {
      title: "Pending Scoring",
      value: pendingScoreJobsCount,
      icon: <FileClock size={20} />,
      href: "/jobs/new",
      description: "Active new jobs awaiting resume score.",
      color: "bg-sky-500",
    },
    {
      title: "Scored Jobs",
      value: scoredJobsCount,
      icon: <FileCheck size={20} />,
      href: "/jobs/top-matches",
      description: "Active new jobs that have a resume score.",
      color: "bg-violet-500",
    },
    {
      title: "Scored (Original)",
      value: scoredWithOriginalResumeCount,
      icon: <FileUp size={20} />,
      href: "/jobs/top-matches",
      description: "Jobs scored using the original resume.",
      color: "bg-blue-500",
    },
    {
      title: "Scored (Custom)",
      value: scoredWithCustomResumeCount,
      icon: <FileSignature size={20} />,
      href: "/jobs/top-matches",
      description: "Jobs scored using a customized resume.",
      color: "bg-purple-500",
    },
    {
      title: "Custom Resumes",
      value: customResumeJobsCount,
      icon: <FileText size={20} />,
      href: "/",
      description: "Jobs with a generated custom resume.",
      color: "bg-emerald-500",
    },
    {
      title: "No Custom Resumes",
      value: noCustomResumeJobsCount,
      icon: <FileX size={20} />,
      href: "/jobs/new",
      description: "Active jobs without a custom resume.",
      color: "bg-rose-500",
    },
    {
      title: "LinkedIn Jobs",
      value: linkedInJobsCount,
      icon: <Linkedin size={20} />,
      href: "/jobs/new",
      description: "Active LinkedIn jobs.",
      color: "bg-cyan-500",
    },
    {
      title: "CareersFuture Jobs",
      value: careersFutureJobsCount,
      icon: <SquareKanban size={20} />,
      href: "/jobs/new",
      description: "Active Careers Future jobs.",
      color: "bg-teal-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!hasApiKey && (
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-indigo-900 to-indigo-800 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-white/10 text-white shrink-0 mt-0.5">
                <Sparkles className="h-6 w-6 text-indigo-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Welcome to JobTrack! Get Started in 2 Minutes</h2>
                <p className="text-sm text-indigo-200 mt-1 max-w-2xl">
                  Connect your Google AI Studio API key and configure your job search preferences in Settings to enable automated job scoring, resume personalization, and scraping.
                </p>
              </div>
            </div>

            <Link
              href="/settings"
              className="px-5 py-2.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-semibold text-sm transition-all shadow-sm shrink-0"
            >
              Configure Settings &rarr;
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              href={stat.href}
              description={stat.description}
              color={stat.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
