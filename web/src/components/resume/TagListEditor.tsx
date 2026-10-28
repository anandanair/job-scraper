"use client";

import React, { useState, useEffect, KeyboardEvent, ChangeEvent, ClipboardEvent } from "react";
import { X, Plus, Tag, AlignLeft, Sparkles } from "lucide-react";

interface TagListEditorProps {
  label: string;
  id?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  helperText?: string;
  compact?: boolean;
}

export function TagListEditor({
  label,
  id,
  items,
  onChange,
  placeholder,
  helperText,
  compact = false,
}: TagListEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  // View mode: 'chips' (visual pills + quick add) vs 'text' (raw comma-separated textarea)
  const [mode, setMode] = useState<"chips" | "text">("chips");

  // Local state for the quick-add input in chips mode
  const [inputValue, setInputValue] = useState("");

  // Local state for raw text mode to guarantee that typing commas & spaces is never blocked
  const [rawText, setRawText] = useState<string>(() => safeItems.join(", "));
  const [isTypingRaw, setIsTypingRaw] = useState(false);

  // Keep rawText synced when external items change (e.g. initial load, preset switch, or reset)
  useEffect(() => {
    if (isTypingRaw) return;
    const currentParsed = rawText
      .split(/[,,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (JSON.stringify(currentParsed) !== JSON.stringify(safeItems)) {
      setRawText(safeItems.join(", "));
    }
  }, [items, isTypingRaw]);

  // Add multiple tokens (deduplicating case-insensitively)
  const handleAddTokens = (tokens: string[]) => {
    const existingLower = new Set(safeItems.map((s) => s.toLowerCase()));
    const toAdd: string[] = [];

    tokens.forEach((t) => {
      const clean = t.trim();
      if (clean && !existingLower.has(clean.toLowerCase())) {
        existingLower.add(clean.toLowerCase());
        toAdd.push(clean);
      }
    });

    if (toAdd.length > 0) {
      const updated = [...safeItems, ...toAdd];
      onChange(updated);
      setRawText(updated.join(", "));
    }
  };

  // Remove a single item
  const handleRemove = (indexToRemove: number) => {
    const updated = safeItems.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
    setRawText(updated.join(", "));
  };

  // Handle typing in the quick-add input
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // If user types a comma, immediately commit whatever is before it
    if (val.includes(",")) {
      const parts = val.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        handleAddTokens(parts);
      }
      setInputValue("");
      return;
    }
    setInputValue(val);
  };

  // Handle Enter or comma key in the quick-add input
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        handleAddTokens([inputValue.trim()]);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && inputValue === "" && safeItems.length > 0) {
      // Remove last item on backspace when input is empty
      handleRemove(safeItems.length - 1);
    }
  };

  // Handle paste in the quick-add input (e.g. pasting "React, Node.js, TypeScript")
  const handleInputPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted && (pasted.includes(",") || pasted.includes("\n"))) {
      e.preventDefault();
      const parts = pasted.split(/[,,\n]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        handleAddTokens(parts);
      }
      setInputValue("");
    }
  };

  // Handle explicit click on the "+ Add" button
  const handleAddClick = () => {
    if (inputValue.trim()) {
      const parts = inputValue.split(/[,,\n]/).map((s) => s.trim()).filter(Boolean);
      handleAddTokens(parts.length > 0 ? parts : [inputValue.trim()]);
      setInputValue("");
    }
  };

  // Handle raw textarea changes
  const handleRawTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setRawText(newText);
    const parsed = newText
      .split(/[,,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(parsed);
  };

  const handleRawTextBlur = () => {
    setIsTypingRaw(false);
    const parsed = rawText
      .split(/[,,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setRawText(parsed.join(", "));
    onChange(parsed);
  };

  return (
    <div className="w-full">
      {/* Header with Label and Mode Switcher */}
      <div className="flex items-center justify-between mb-1.5">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
        >
          {label}
          {safeItems.length > 0 && (
            <span className="ml-2 font-normal text-slate-400 lowercase tracking-normal">
              ({safeItems.length} {safeItems.length === 1 ? "item" : "items"})
            </span>
          )}
        </label>

        {!compact && (
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setMode("chips");
                setIsTypingRaw(false);
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition-all ${
                mode === "chips"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Tag size={12} />
              <span>Chips</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("text");
                setRawText(safeItems.join(", "));
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition-all ${
                mode === "text"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <AlignLeft size={12} />
              <span>Comma Text</span>
            </button>
          </div>
        )}
      </div>

      {helperText && (
        <p className="text-[11px] text-slate-400 mb-2">{helperText}</p>
      )}

      {/* MODE 1: CHIPS VIEW (Tags + Quick Add) */}
      {mode === "chips" && (
        <div className="space-y-2">
          {/* Tag Pills List */}
          <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50/80 border border-gray-200 rounded-xl min-h-[46px] items-center">
            {safeItems.length === 0 ? (
              <span className="text-xs text-slate-400 italic px-1">
                No items added yet. Type below to add.
              </span>
            ) : (
              safeItems.map((item, idx) => (
                <span
                  key={`${item}-${idx}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-800 shadow-xs hover:border-slate-300 transition-colors group"
                >
                  <span className="select-all">{item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title={`Remove ${item}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Quick Add Input Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                id={id}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onPaste={handleInputPaste}
                placeholder={
                  placeholder || "Type item and press Enter or comma (,)..."
                }
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg text-slate-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all"
              />
            </div>
            <button
              type="button"
              onClick={handleAddClick}
              disabled={!inputValue.trim()}
              className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                inputValue.trim()
                  ? "bg-slate-900 text-white hover:bg-slate-800 cursor-pointer shadow-xs"
                  : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
              }`}
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Tip: Press <kbd className="px-1 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px]">Enter</kbd> or type <kbd className="px-1 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px]">,</kbd> to add. Paste comma lists to add multiple at once.
          </p>
        </div>
      )}

      {/* MODE 2: RAW COMMA-SEPARATED TEXTAREA */}
      {mode === "text" && (
        <div className="space-y-1.5">
          <textarea
            id={id}
            value={rawText}
            onFocus={() => setIsTypingRaw(true)}
            onChange={handleRawTextChange}
            onBlur={handleRawTextBlur}
            rows={compact ? 2 : 4}
            placeholder={
              placeholder || "Type comma-separated items (e.g. React, Node.js, Python)..."
            }
            className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg text-slate-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all font-mono leading-relaxed resize-y"
          />
          <p className="text-[10px] text-slate-400">
            Edit freely with commas. Changes sync to your live resume in real time.
          </p>
        </div>
      )}
    </div>
  );
}
