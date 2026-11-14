"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ClipboardCopy,
  AlignLeft,
  List,
  Sparkles,
  Check,
} from "lucide-react";

export interface BulletListEditorProps {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  idealCountRange?: string; // e.g. "3-6 bullets recommended"
}

export function BulletListEditor({
  bullets = [],
  onChange,
  label = "Key Achievements & Responsibilities",
  placeholder = "Accomplished [X], as measured by [Y], by doing [Z] (e.g., Automated incident escalation pipeline reducing P1 triage by 45%)...",
  helperText,
  idealCountRange = "3–6 bullets recommended",
}: BulletListEditorProps) {
  // Mode: "list" (interactive individual rows) vs "raw" (one large freeform multi-line textarea)
  const [mode, setMode] = useState<"list" | "raw">("list");
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Raw text state for "raw" mode
  const [rawText, setRawText] = useState("");
  const [isTypingRaw, setIsTypingRaw] = useState(false);

  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Normalize to string array
  const safeBullets =
    Array.isArray(bullets) && bullets.length > 0 ? bullets : [""];

  // Sync rawText when bullets change externally (unless user is actively typing in raw mode)
  useEffect(() => {
    if (!isTypingRaw) {
      const formatted = safeBullets
        .filter((b) => b.trim() !== "")
        .map((b) => `• ${b.trim()}`)
        .join("\n");
      setRawText(formatted);
    }
  }, [bullets, isTypingRaw]);

  // Adjust textarea heights automatically on mount/render
  useEffect(() => {
    if (mode === "list") {
      inputRefs.current.forEach((el) => {
        if (el) {
          el.style.height = "auto";
          el.style.height = `${Math.max(el.scrollHeight, 38)}px`;
        }
      });
    }
  }, [safeBullets, mode]);

  const handleUpdate = (index: number, value: string) => {
    const updated = [...safeBullets];
    updated[index] = value;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    if (safeBullets.length === 1) {
      onChange([""]);
      return;
    }
    const updated = safeBullets.filter((_, i) => i !== index);
    onChange(updated);
    setTimeout(() => {
      const prevIdx = Math.max(0, index - 1);
      inputRefs.current[prevIdx]?.focus();
    }, 50);
  };

  const handleBulletBlur = (index: number) => {
    const updated = [...safeBullets];
    const cleaned =
      updated[index]?.trim().replace(/^[\s•*–—◦▪‣⁃+\-]+/g, "").trim() || "";
    if (cleaned !== updated[index]) {
      updated[index] = cleaned;
      onChange(updated);
    }
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === safeBullets.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...safeBullets];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChange(updated);
    setTimeout(() => {
      inputRefs.current[targetIndex]?.focus();
    }, 50);
  };

  const handleAddBullet = (insertAfterIndex?: number) => {
    const targetIdx =
      typeof insertAfterIndex === "number"
        ? insertAfterIndex + 1
        : safeBullets.length;

    const updated = [...safeBullets];
    updated.splice(targetIdx, 0, "");
    onChange(updated);

    setTimeout(() => {
      inputRefs.current[targetIdx]?.focus();
    }, 50);
  };

  // Keyboard navigation: Enter to add bullet, Backspace on empty to delete
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddBullet(index);
    } else if (
      e.key === "Backspace" &&
      safeBullets[index].trim() === "" &&
      safeBullets.length > 1
    ) {
      e.preventDefault();
      handleRemove(index);
    }
  };

  // Smart multiline paste on a single bullet textarea
  const handlePasteOnBullet = (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    index: number
  ) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.includes("\n")) {
      e.preventDefault();
      const lines = pasted
        .split("\n")
        .map((l) => l.trim().replace(/^[\s•*–—◦▪‣⁃+\-]+/g, "").trim())
        .filter(Boolean);

      if (lines.length > 0) {
        const updated = [...safeBullets];
        updated.splice(index, 1, ...lines);
        onChange(updated);
      }
    }
  };

  const handleApplyBulkPaste = () => {
    if (!bulkText.trim()) {
      setShowBulkPaste(false);
      return;
    }
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim().replace(/^[\s•*–—◦▪‣⁃+\-]+/g, "").trim())
      .filter(Boolean);

    if (lines.length > 0) {
      const existingClean = safeBullets.filter((b) => b.trim() !== "");
      onChange([...existingClean, ...lines]);
    }
    setBulkText("");
    setShowBulkPaste(false);
  };

  // Handle Raw Text updates
  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawText(text);
    setIsTypingRaw(true);

    const lines = text
      .split("\n")
      .map((l) => l.trim().replace(/^[\s•*–—◦▪‣⁃+\-]+/g, "").trim())
      .filter(Boolean);

    onChange(lines.length > 0 ? lines : [""]);
  };

  const handleRawBlur = () => {
    setIsTypingRaw(false);
  };

  const cleanEmptyBullets = () => {
    const cleaned = safeBullets.filter((b) => b.trim() !== "");
    onChange(cleaned.length > 0 ? cleaned : [""]);
  };

  const copyAllBullets = () => {
    const text = safeBullets
      .filter((b) => b.trim() !== "")
      .map((b) => `• ${b.trim()}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const nonEmptyCount = safeBullets.filter((b) => b.trim() !== "").length;

  return (
    <div className="space-y-2.5">
      {/* Header with Title, Mode Switcher & Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-800 tracking-wide uppercase">
            {label}
          </label>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
              nonEmptyCount > 0
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            {nonEmptyCount} {nonEmptyCount === 1 ? "bullet" : "bullets"}
          </span>
        </div>

        {/* Right Tools: Mode Switcher & Batch Paste */}
        <div className="flex items-center gap-1.5">
          {/* Mode Switcher */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setMode("list");
                setIsTypingRaw(false);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                mode === "list"
                  ? "bg-white text-blue-700 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Interactive list mode with keyboard shortcuts"
            >
              <List size={12} />
              <span>List View</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const formatted = safeBullets
                  .filter((b) => b.trim() !== "")
                  .map((b) => `• ${b.trim()}`)
                  .join("\n");
                setRawText(formatted);
                setMode("raw");
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                mode === "raw"
                  ? "bg-white text-blue-700 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Spacious freeform textarea for rapid writing & pasting"
            >
              <AlignLeft size={12} />
              <span>Freeform Text</span>
            </button>
          </div>

          {/* Batch Paste Drawer Toggle */}
          {mode === "list" && (
            <button
              type="button"
              onClick={() => setShowBulkPaste(!showBulkPaste)}
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors border border-blue-100"
            >
              <ClipboardCopy size={12} />
              <span>{showBulkPaste ? "Close Paste" : "Batch Paste"}</span>
            </button>
          )}

          {/* Copy All */}
          <button
            type="button"
            onClick={copyAllBullets}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-medium py-1 px-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Copy all bullets to clipboard"
          >
            {copiedNotification ? (
              <>
                <Check size={12} className="text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <ClipboardCopy size={12} />
                <span className="hidden md:inline">Copy All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}

      {/* Batch Paste Drawer */}
      {showBulkPaste && mode === "list" && (
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <p className="text-xs text-blue-900 font-semibold flex items-center gap-1.5">
              <ClipboardCopy size={14} className="text-blue-600" />
              Batch Paste
            </p>
            <span className="text-[11px] text-blue-700">
              One bullet per line
            </span>
          </div>
          <textarea
            rows={4}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`• Supported semiconductor manufacturing applications with 99.9% uptime\n• Promoted to Shift Lead within 1 year, coordinating incident triage\n• Automated licensing workflows using PowerShell and REST APIs`}
            className="w-full px-3 py-2 text-xs border border-blue-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setBulkText("");
                setShowBulkPaste(false);
              }}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyBulkPaste}
              className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-xs transition-colors"
            >
              Insert All Bullets
            </button>
          </div>
        </div>
      )}

      {/* MODE 1: STRUCTURED LIST VIEW */}
      {mode === "list" && (
        <div className="border border-gray-200/90 rounded-xl bg-white shadow-xs overflow-hidden">
          <div className="divide-y divide-gray-100">
            {safeBullets.map((bullet, idx) => (
              <div
                key={idx}
                className="group relative flex items-start gap-2.5 px-3 py-2 hover:bg-slate-50/80 focus-within:bg-blue-50/30 transition-colors"
              >
                {/* Bullet Dot */}
                <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-400 pt-1 select-none group-focus-within:text-blue-600 transition-colors">
                  •
                </span>

                {/* Auto-growing Textarea */}
                <textarea
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  rows={1}
                  value={bullet}
                  onChange={(e) => {
                    handleUpdate(idx, e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.max(
                      e.target.scrollHeight,
                      36
                    )}px`;
                  }}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onPaste={(e) => handlePasteOnBullet(e, idx)}
                  onBlur={() => handleBulletBlur(idx)}
                  placeholder={placeholder}
                  className="flex-1 text-xs sm:text-sm text-slate-800 bg-transparent placeholder:text-slate-300 outline-none resize-none py-1 leading-relaxed border-none focus:ring-0 min-h-[36px]"
                />

                {/* Subtle Hover Action Controls */}
                <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center gap-0.5 pt-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(idx, "up")}
                    disabled={idx === 0}
                    title="Move bullet up"
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors rounded hover:bg-gray-200/70"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, "down")}
                    disabled={idx === safeBullets.length - 1}
                    title="Move bullet down"
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors rounded hover:bg-gray-200/70"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    title="Remove bullet"
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded hover:bg-red-50 ml-0.5"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Interactive Bar */}
          <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddBullet()}
                className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-800 py-1 px-2.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Plus size={14} /> Add Bullet
              </button>
              {safeBullets.some((b) => b.trim() === "") &&
                safeBullets.length > 1 && (
                  <button
                    type="button"
                    onClick={cleanEmptyBullets}
                    className="text-[11px] text-slate-400 hover:text-slate-600 py-1 px-2 rounded hover:bg-gray-200/60 transition-colors"
                  >
                    Clean Empty
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: FREEFORM TEXTAREA (Multi-line Markdown style) */}
      {mode === "raw" && (
        <div className="space-y-2 animate-fadeIn">
          <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <span>One bullet per line</span>
            <button
              type="button"
              onClick={() => {
                setMode("list");
                setIsTypingRaw(false);
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0 ml-2 cursor-pointer"
            >
              Done &rarr; List View
            </button>
          </div>
          <textarea
            rows={Math.max(6, Math.min(16, safeBullets.length + 2))}
            value={rawText}
            onChange={handleRawChange}
            onBlur={handleRawBlur}
            placeholder={`• Supported 24/7 semiconductor manufacturing applications, maintaining 99.9% uptime\n• Promoted to Shift Lead within 1 year, coordinating incident triage\n• Automated licensing workflows using PowerShell and REST APIs`}
            className="w-full px-4 py-3 text-xs sm:text-sm font-sans border border-gray-300 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed transition-all shadow-xs"
          />
        </div>
      )}
    </div>
  );
}
