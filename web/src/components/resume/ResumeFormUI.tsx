"use client";

import { ChangeEvent, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Trash2,
} from "lucide-react";

// --- SectionCard ---

export function SectionCard({
  icon,
  title,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}
    >
      <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
        <span className="text-navy-600">{icon}</span>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
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
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:border-navy-400 focus:ring-1 focus:ring-navy-400/20 transition-all outline-none placeholder:text-gray-400";

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider"
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
          className={`${baseClasses} resize-y`}
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-navy-600 bg-navy-50 border border-navy-200 rounded-lg hover:bg-navy-100 transition-all"
    >
      <Plus size={13} /> {label}
    </button>
  );
}

// --- RemoveItemButton ---

export function RemoveItemButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-500 transition-colors"
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
    <div className="p-4 border border-gray-100 rounded-lg bg-gray-50/50 relative">
      <RemoveItemButton onClick={onRemove} />
      <div className="pr-8">{children}</div>
    </div>
  );
}
