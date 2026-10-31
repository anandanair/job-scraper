import Link from "next/link";
import { Zap, Star, Sparkles, CheckSquare } from "lucide-react";

interface KpiCardsProps {
  newCount: number;
  matchesCount: number;
  tailoredCount: number;
  appliedCount: number;
}

interface Kpi {
  title: string;
  value: number;
  href: string;
  description: string;
  icon: React.ReactNode;
  iconClasses: string;
  accentClasses: string;
}

export default function KpiCards({
  newCount,
  matchesCount,
  tailoredCount,
  appliedCount,
}: KpiCardsProps) {
  const kpis: Kpi[] = [
    {
      title: "New Jobs",
      value: newCount,
      href: "/jobs/new",
      description: "Freshly scraped, awaiting your review",
      icon: <Zap className="h-5 w-5" />,
      iconClasses: "bg-amber-50 text-amber-600",
      accentClasses: "group-hover:border-amber-200",
    },
    {
      title: "Top Matches",
      value: matchesCount,
      href: "/jobs/top-matches",
      description: "Scored 50+ against your resume",
      icon: <Star className="h-5 w-5" />,
      iconClasses: "bg-indigo-50 text-indigo-600",
      accentClasses: "group-hover:border-indigo-200",
    },
    {
      title: "Tailored & Ready",
      value: tailoredCount,
      href: "/jobs/tailored",
      description: "Custom resumes generated",
      icon: <Sparkles className="h-5 w-5" />,
      iconClasses: "bg-emerald-50 text-emerald-600",
      accentClasses: "group-hover:border-emerald-200",
    },
    {
      title: "Applied",
      value: appliedCount,
      href: "/jobs/applied",
      description: "Total applications submitted",
      icon: <CheckSquare className="h-5 w-5" />,
      iconClasses: "bg-sky-50 text-sky-600",
      accentClasses: "group-hover:border-sky-200",
    },
  ];

  return (
    <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Link
          key={kpi.title}
          href={kpi.href}
          className={`group block rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${kpi.accentClasses}`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-xl p-2.5 ${kpi.iconClasses}`}
            >
              {kpi.icon}
            </span>
            <span className="text-3xl font-bold tabular-nums text-gray-900">
              {kpi.value}
            </span>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">
            {kpi.title}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">{kpi.description}</p>
        </Link>
      ))}
    </section>
  );
}
