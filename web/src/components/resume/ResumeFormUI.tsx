"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// --- SectionCard ---

export type SectionColorTheme =
  | "indigo"
  | "purple"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "teal"
  | "sky"
  | "slate";

const THEME_STYLES: Record<
  SectionColorTheme,
  {
    borderTop: string;
    iconBg: string;
    iconColor: string;
    headerBg: string;
  }
> = {
  indigo: {
    borderTop: "border-t-[3px] border-t-indigo-600",
    iconBg: "bg-indigo-100/90",
    iconColor: "text-indigo-700",
    headerBg: "bg-gradient-to-r from-indigo-50/60 via-white to-white",
  },
  purple: {
    borderTop: "border-t-[3px] border-t-purple-600",
    iconBg: "bg-purple-100/90",
    iconColor: "text-purple-700",
    headerBg: "bg-gradient-to-r from-purple-50/60 via-white to-white",
  },
  blue: {
    borderTop: "border-t-[3px] border-t-blue-600",
    iconBg: "bg-blue-100/90",
    iconColor: "text-blue-700",
    headerBg: "bg-gradient-to-r from-blue-50/60 via-white to-white",
  },
  emerald: {
    borderTop: "border-t-[3px] border-t-emerald-600",
    iconBg: "bg-emerald-100/90",
    iconColor: "text-emerald-700",
    headerBg: "bg-gradient-to-r from-emerald-50/60 via-white to-white",
  },
  amber: {
    borderTop: "border-t-[3px] border-t-amber-500",
    iconBg: "bg-amber-100/90",
    iconColor: "text-amber-800",
    headerBg: "bg-gradient-to-r from-amber-50/60 via-white to-white",
  },
  rose: {
    borderTop: "border-t-[3px] border-t-rose-500",
    iconBg: "bg-rose-100/90",
    iconColor: "text-rose-700",
    headerBg: "bg-gradient-to-r from-rose-50/60 via-white to-white",
  },
  teal: {
    borderTop: "border-t-[3px] border-t-teal-600",
    iconBg: "bg-teal-100/90",
    iconColor: "text-teal-700",
    headerBg: "bg-gradient-to-r from-teal-50/60 via-white to-white",
  },
  sky: {
    borderTop: "border-t-[3px] border-t-sky-500",
    iconBg: "bg-sky-100/90",
    iconColor: "text-sky-700",
    headerBg: "bg-gradient-to-r from-sky-50/60 via-white to-white",
  },
  slate: {
    borderTop: "border-t-[3px] border-t-slate-500",
    iconBg: "bg-slate-100/90",
    iconColor: "text-slate-700",
    headerBg: "bg-gradient-to-r from-slate-50/60 via-white to-white",
  },
};

export function SectionCard({
  icon,
  title,
  action,
  children,
  className = "",
  accentColor = "slate",
  collapsible = true,
  isExpanded: controlledExpanded,
  onToggle: controlledToggle,
  defaultExpanded = false,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accentColor?: SectionColorTheme;
  collapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  defaultExpanded?: boolean;
  badge?: React.ReactNode;
}) {
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

  const styles = THEME_STYLES[accentColor] || THEME_STYLES.slate;

  return (
    <section
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden ${styles.borderTop} ${className}`}
    >
      <div
        onClick={collapsible ? handleToggle : undefined}
        className={`px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 ${
          styles.headerBg
        } ${isExpanded ? "border-b border-slate-100" : ""} ${
          collapsible ? "cursor-pointer select-none hover:opacity-95 transition-all group" : ""
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {collapsible && (
            <span
              className={`p-1 rounded-md transition-colors ${
                isExpanded
                  ? "text-slate-700 bg-slate-200/70"
                  : "text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200/50"
              }`}
            >
              {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </span>
          )}
          <span
            className={`p-1.5 rounded-lg ${styles.iconBg} ${styles.iconColor} shrink-0 shadow-2xs`}
          >
            {icon}
          </span>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
            {title}
          </h2>
          {badge && (
            <span className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
              {badge}
            </span>
          )}
        </div>

        {action && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 flex items-center gap-2"
          >
            {action}
          </div>
        )}
      </div>

      {(!collapsible || isExpanded) && (
        <div className="p-4 sm:p-6 animate-fadeIn">{children}</div>
      )}
    </section>
  );
}

// --- SkillTag ---

export function SkillTag({ skill }: { skill: string }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-navy-50 text-navy-700 border border-navy-100 transition-colors hover:bg-navy-100">
      {skill}
    </span>
  );
}

// --- TimelineItem ---

export function TimelineItem({
  title,
  subtitle,
  meta,
  description,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  description?: string | null;
}) {
  return (
    <div className="relative pl-6 pb-6 last:pb-0 group">
      <div className="absolute left-0 top-2 bottom-0 w-px bg-gray-200 group-last:hidden" />
      <div className="absolute left-[-3.5px] top-2 w-[8px] h-[8px] rounded-full bg-navy-500 border-2 border-white shadow-sm" />
      <h3 className="text-sm font-semibold text-slate-800 leading-tight">
        {title}
      </h3>
      {subtitle && <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>}
      {meta && (
        <p className="text-xs text-slate-400 mt-0.5 font-medium">{meta}</p>
      )}
      {description && (
        <div className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
          {description}
        </div>
      )}
    </div>
  );
}

// --- Toast ---

export function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border transition-all animate-slide-up ${
        type === "success"
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-red-50 text-red-800 border-red-200"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

// --- FormField ---

export function FormField({
  label,
  id,
  value,
  onChange,
  type = "text",
  placeholder,
  rows,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  placeholder?: string;
  rows?: number;
}) {
  const baseClasses =
    "w-full px-3.5 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl bg-white text-slate-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs";

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide"
      >
        {label}
      </label>
      {rows ? (
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          rows={rows}
          placeholder={placeholder}
          className={`${baseClasses} resize-y leading-relaxed`}
        />
      ) : (
        <input
          type={type}
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={baseClasses}
        />
      )}
    </div>
  );
}

// --- AddItemButton ---

export function AddItemButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50/80 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 rounded-xl transition-all shadow-2xs"
    >
      <Plus size={14} /> {label}
    </button>
  );
}

// --- RemoveItemButton ---

export function RemoveItemButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
      title="Remove"
    >
      <Trash2 size={14} />
    </button>
  );
}

// --- ArrayItemCard ---

export function ArrayItemCard({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="p-4 sm:p-5 border border-gray-200/90 rounded-2xl bg-white relative shadow-xs">
      <RemoveItemButton onClick={onRemove} />
      <div className="pr-8">{children}</div>
    </div>
  );
}
