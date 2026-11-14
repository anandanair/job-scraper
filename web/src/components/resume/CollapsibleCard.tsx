"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export type CardThemeColor =
  | "indigo"
  | "purple"
  | "blue"
  | "rose"
  | "teal"
  | "slate";

export interface CollapsibleCardProps {
  title: string;
  subtitle?: string | null;
  dateBadge?: string | null;
  metaBadge?: string | null;
  techBadges?: string[] | null;
  children: React.ReactNode;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  themeColor?: CardThemeColor;
}

const THEME_ACCENTS: Record<
  CardThemeColor,
  {
    leftBorder: string;
    expandedBorder: string;
    expandedRing: string;
    chevronBg: string;
    chevronColor: string;
    metaBadge: string;
  }
> = {
  indigo: {
    leftBorder: "border-l-[4px] border-l-indigo-600",
    expandedBorder: "border-indigo-300",
    expandedRing: "ring-2 ring-indigo-50/80",
    chevronBg: "bg-indigo-100/80",
    chevronColor: "text-indigo-700",
    metaBadge: "bg-indigo-50 text-indigo-700 border-indigo-200/90",
  },
  purple: {
    leftBorder: "border-l-[4px] border-l-purple-600",
    expandedBorder: "border-purple-300",
    expandedRing: "ring-2 ring-purple-50/80",
    chevronBg: "bg-purple-100/80",
    chevronColor: "text-purple-700",
    metaBadge: "bg-purple-50 text-purple-700 border-purple-200/90",
  },
  blue: {
    leftBorder: "border-l-[4px] border-l-blue-600",
    expandedBorder: "border-blue-300",
    expandedRing: "ring-2 ring-blue-50/80",
    chevronBg: "bg-blue-100/80",
    chevronColor: "text-blue-700",
    metaBadge: "bg-blue-50 text-blue-700 border-blue-200/90",
  },
  rose: {
    leftBorder: "border-l-[4px] border-l-rose-500",
    expandedBorder: "border-rose-300",
    expandedRing: "ring-2 ring-rose-50/80",
    chevronBg: "bg-rose-100/80",
    chevronColor: "text-rose-700",
    metaBadge: "bg-rose-50 text-rose-700 border-rose-200/90",
  },
  teal: {
    leftBorder: "border-l-[4px] border-l-teal-600",
    expandedBorder: "border-teal-300",
    expandedRing: "ring-2 ring-teal-50/80",
    chevronBg: "bg-teal-100/80",
    chevronColor: "text-teal-700",
    metaBadge: "bg-teal-50 text-teal-700 border-teal-200/90",
  },
  slate: {
    leftBorder: "border-l-[4px] border-l-slate-500",
    expandedBorder: "border-slate-300",
    expandedRing: "ring-2 ring-slate-100/80",
    chevronBg: "bg-slate-200/80",
    chevronColor: "text-slate-700",
    metaBadge: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export function CollapsibleCard({
  title,
  subtitle,
  dateBadge,
  metaBadge,
  techBadges,
  children,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  defaultExpanded = false,
  isExpanded: controlledExpanded,
  onToggle: controlledToggle,
  themeColor = "indigo",
}: CollapsibleCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  const isExpanded =
    typeof controlledExpanded === "boolean"
      ? controlledExpanded
      : internalExpanded;

  const handleToggle = () => {
    if (controlledToggle) {
      controlledToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  const displayTitle = title?.trim() || "Untitled Entry";
  const accents = THEME_ACCENTS[themeColor] || THEME_ACCENTS.indigo;

  return (
    <div
      className={`rounded-2xl transition-all overflow-hidden border ${accents.leftBorder} ${
        isExpanded
          ? `${accents.expandedBorder} ${accents.expandedRing} bg-white shadow-md`
          : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs"
      }`}
    >
      {/* Header Bar */}
      <div
        className={`px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 select-none transition-colors ${
          isExpanded
            ? "bg-slate-50/90 border-b border-slate-100"
            : "bg-white hover:bg-slate-50/70"
        }`}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="flex-1 flex items-center gap-3 text-left min-w-0 group cursor-pointer"
        >
          <span
            className={`p-1.5 rounded-lg transition-colors ${
              isExpanded
                ? `${accents.chevronBg} ${accents.chevronColor}`
                : "text-slate-400 group-hover:text-slate-800 bg-slate-100 group-hover:bg-slate-200/70"
            }`}
          >
            {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
          </span>

          <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span
              className={`text-sm sm:text-base font-bold truncate ${
                isExpanded ? "text-slate-900" : "text-slate-800"
              }`}
            >
              {displayTitle}
            </span>
            {subtitle && (
              <span className="text-xs sm:text-sm text-slate-500 font-medium truncate">
                &bull; {subtitle}
              </span>
            )}
            {dateBadge && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100/90 text-slate-700 border border-slate-200/90 shadow-2xs">
                {dateBadge}
              </span>
            )}
            {metaBadge && (
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shadow-2xs ${accents.metaBadge}`}
              >
                {metaBadge}
              </span>
            )}
            {techBadges && techBadges.length > 0 && (
              <span className="hidden md:inline-flex text-xs text-slate-400 font-normal">
                ({techBadges.slice(0, 3).join(", ")}
                {techBadges.length > 3 ? ` +${techBadges.length - 3}` : ""})
              </span>
            )}
          </div>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Move item up"
              className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition-colors rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <ArrowUp size={15} />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Move item down"
              className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition-colors rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <ArrowDown size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            title="Delete entry"
            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 ml-0.5 cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Expanded Content with Generous Breathing Room */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-5 bg-white animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
}
