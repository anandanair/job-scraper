"use client";

import { AlertTriangle, CheckSquare, CalendarClock, Trophy, XCircle } from "lucide-react";
import { AppliedStatusCounts } from "@/lib/supabase/queries";
import { APPLIED_STATUS_META, AppliedStatus } from "@/lib/applied-status";

interface AppliedStatsBarProps {
  counts: AppliedStatusCounts;
  activeFilter: string;
  onSelectFilter: (value: string) => void;
}

export default function AppliedStatsBar({
  counts,
  activeFilter,
  onSelectFilter,
}: AppliedStatsBarProps) {
  const cards: {
    key: string;
    label: string;
    value: number;
    icon: React.ReactNode;
    iconClasses: string;
    activeClasses: string;
  }[] = [
    {
      key: "all",
      label: "Total",
      value: counts.total,
      icon: <CheckSquare className="h-4 w-4" />,
      iconClasses: "bg-gray-100 text-gray-500",
      activeClasses: "border-gray-900 ring-1 ring-gray-900",
    },
    ...(Object.keys(APPLIED_STATUS_META) as AppliedStatus[]).map((key) => {
      const meta = APPLIED_STATUS_META[key];
      const icons: Record<AppliedStatus, React.ReactNode> = {
        applied: <CheckSquare className="h-4 w-4" />,
        interviewing: <CalendarClock className="h-4 w-4" />,
        offer: <Trophy className="h-4 w-4" />,
        rejected: <XCircle className="h-4 w-4" />,
      };
      return {
        key,
        label: meta.label,
        value: counts[key],
        icon: icons[key],
        iconClasses: `${meta.barClass} bg-opacity-10 text-white`,
        activeClasses: meta.pillActiveClass,
      };
    }),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const isActive = activeFilter === card.key;
        return (
          <button
            key={card.key}
            onClick={() => onSelectFilter(card.key)}
            className={`group flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              isActive ? card.activeClasses : "border-gray-100"
            }`}
          >
            <span
              className={`inline-flex shrink-0 items-center justify-center rounded-xl p-2 ${card.iconClasses}`}
            >
              {card.icon}
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold tabular-nums text-gray-900">
                {card.value}
              </p>
              <p className="truncate text-xs text-gray-500">{card.label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function FollowUpBanner({
  count,
  active,
  onClick,
}: {
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className={`inline-flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:shadow-md ${
        active
          ? "border-amber-500 bg-amber-500 text-white"
          : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        {count} {count === 1 ? "application needs" : "applications need"} your
        attention
      </span>
      <span className="ml-auto text-xs opacity-75">
        {active ? "Showing" : "View"} →
      </span>
    </button>
  );
}
