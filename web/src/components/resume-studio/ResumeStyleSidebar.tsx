"use client";

import { useState } from "react";
import {
  ResumeThemeConfig,
  ResumeStyleSetting,
  FontFamilyOption,
  FontSizeScaleOption,
  LineSpacingOption,
  HeaderStyleOption,
  SkillsLayoutOption,
  MarginsOption,
  HeadingStyleOption,
  ResumeSectionKey,
} from "@/types";
import { RESUME_PRESETS } from "@/lib/resume-presets";
import { SECTION_LABELS } from "@/lib/resume-preview";
import {
  Check,
  MoveUp,
  MoveDown,
  Palette,
  Type,
  Layout,
  ListOrdered,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  Pencil,
  X,
  Trash2,
  Plus,
  Bookmark,
  Layers,
} from "lucide-react";

interface ResumeStyleSidebarProps {
  theme: ResumeThemeConfig;
  onThemeChange: (updater: (prev: ResumeThemeConfig) => ResumeThemeConfig) => void;
  savedPresets: ResumeStyleSetting[];
  selectedPersonaId: string | null;
  onSelectPersona: (preset: ResumeStyleSetting) => void;
  onActivatePersona: (preset: ResumeStyleSetting) => void;
  onDeletePersona: (id: string, name: string) => void;
  onSaveAsNewPersona: (name: string) => void;
  isSavingPersona: boolean;
  /**
   * Master mode: full persona management (select / activate / delete / save).
   * Tailored mode: personas are read-only "apply a copy" sources — activating
   * or deleting global personas is not allowed from a per-resume context.
   */
  showPersonaManagement?: boolean;
}

const HEADING_STYLE_OPTIONS: {
  id: HeadingStyleOption;
  label: string;
  desc: string;
}[] = [
  { id: "underline", label: "Full Underline", desc: "Classic rule beneath heading" },
  { id: "left_bar", label: "Left Pillar Bar", desc: "Modern vertical accent bar" },
  { id: "shaded_pill", label: "Shaded Pill", desc: "Pastel background box" },
  { id: "borderless", label: "Borderless Minimal", desc: "Clean typography-only" },
];

/**
 * Reusable "Design & Style" control panels shared by the master Resume Studio
 * and the per-job Tailored Resume Studio. Fully controlled: all theme mutations
 * flow up through `onThemeChange`; all persona persistence flows through the
 * provided callbacks.
 */
export default function ResumeStyleSidebar({
  theme,
  onThemeChange,
  savedPresets,
  selectedPersonaId,
  onSelectPersona,
  onActivatePersona,
  onDeletePersona,
  onSaveAsNewPersona,
  isSavingPersona,
  showPersonaManagement = true,
}: ResumeStyleSidebarProps) {
  const setPresetCustom = (
    patch: Partial<ResumeThemeConfig["layout"]>
  ) => {
    onThemeChange((prev) => ({
      ...prev,
      preset: "custom",
      layout: { ...prev.layout, ...patch },
    }));
  };

  const updateColor = (
    key: keyof ResumeThemeConfig["colors"],
    value: string
  ) => {
    onThemeChange((prev) => ({
      ...prev,
      preset: "custom",
      colors: { ...prev.colors, [key]: value },
    }));
  };

  const toggleSectionVisibility = (sectionKey: ResumeSectionKey) => {
    onThemeChange((prev) => {
      const hidden = new Set(prev.layout.hiddenSections || []);
      if (hidden.has(sectionKey)) {
        hidden.delete(sectionKey);
      } else {
        hidden.add(sectionKey);
      }
      return {
        ...prev,
        preset: "custom",
        layout: {
          ...prev.layout,
          hiddenSections: Array.from(hidden),
        },
      };
    });
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    onThemeChange((prev) => {
      const currentOrder = [...prev.layout.sectionOrder];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentOrder.length) return prev;

      const temp = currentOrder[index];
      currentOrder[index] = currentOrder[targetIndex];
      currentOrder[targetIndex] = temp;

      return {
        ...prev,
        preset: "custom",
        layout: { ...prev.layout, sectionOrder: currentOrder },
      };
    });
  };

  return (
    <div className="space-y-4">
      {/* Saved Personas & Custom Profiles */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between text-gray-900 font-semibold">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-violet-600" />
            <span>Saved Personas &amp; Styles</span>
          </div>
          <span className="text-[11px] text-gray-400 font-normal">
            {savedPresets.length} saved
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {showPersonaManagement
            ? "Save distinct styling personas for different roles or industries, and switch between them anytime."
            : "Apply a saved persona as a starting point. It is copied into this resume only — your global default stays untouched."}
        </p>

        {savedPresets.length > 0 && (
          <div className="space-y-2.5 pt-1 max-h-80 overflow-y-auto custom-scrollbar pr-1">
            {savedPresets.map((sp) => {
              const isActive = showPersonaManagement && sp.is_active;
              const isSelected = selectedPersonaId === sp.id;
              return (
                <div
                  key={sp.id}
                  onClick={() => onSelectPersona(sp)}
                  className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    isActive
                      ? "border-emerald-300 bg-emerald-50/25 shadow-xs ring-1 ring-emerald-400/40"
                      : isSelected
                      ? "border-violet-400 bg-violet-50/40 shadow-xs ring-1 ring-violet-400/30"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm truncate">
                          {sp.name}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>Active Default</span>
                          </span>
                        )}
                        {isSelected && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200">
                            Live View
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="capitalize font-medium text-gray-600">
                          {sp.preset}
                        </span>
                        {sp.theme_config?.typography?.fontFamily && (
                          <>
                            <span>•</span>
                            <span className="text-gray-400 capitalize">
                              {sp.theme_config.typography.fontFamily}
                            </span>
                          </>
                        )}
                        {sp.theme_config?.colors?.primary && (
                          <>
                            <span>•</span>
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block border border-gray-300 shadow-2xs"
                              style={{
                                backgroundColor: sp.theme_config.colors.primary,
                              }}
                              title={sp.theme_config.colors.primary}
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {showPersonaManagement && (
                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!sp.is_active ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onActivatePersona(sp);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-xs hover:shadow transition-all cursor-pointer"
                            title="Set this persona as active default for job resumes & Re-apply Style"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Set as Active</span>
                          </button>
                        ) : (
                          <div className="text-[11px] font-medium text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-300/60 select-none">
                            Active Default
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (sp.id) onDeletePersona(sp.id, sp.name);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Persona"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showPersonaManagement && (
          <SavePersonaInput
            onSave={onSaveAsNewPersona}
            isSaving={isSavingPersona}
          />
        )}
      </div>

      {/* Preset Cards */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-gray-900 font-semibold">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Preset Styles</span>
        </div>
        <p className="text-xs text-gray-500">
          Pick a pre-configured ATS template as a baseline, then customize any
          parameter below.
        </p>

        <div className="grid grid-cols-1 gap-2.5 pt-1">
          {RESUME_PRESETS.map((preset) => {
            const isSelected = theme.preset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onThemeChange(() => JSON.parse(JSON.stringify(preset.config)))}
                type="button"
                className={`flex items-start gap-3 p-3 text-left rounded-xl border transition-all ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full mt-0.5 shrink-0 border border-black/10 shadow-inner"
                  style={{ backgroundColor: preset.accentColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {preset.name}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">
                    {preset.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Palette */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-900 font-semibold">
          <Palette className="w-4 h-4 text-indigo-600" />
          <span>Color Palette</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <ColorField
            label="Primary Accent (Titles/Name)"
            value={theme.colors.primary}
            onChange={(v) => updateColor("primary", v)}
          />
          <ColorField
            label="Secondary (Roles/Subtitles)"
            value={theme.colors.secondary}
            onChange={(v) => updateColor("secondary", v)}
          />
          <ColorField
            label="Body Text Color"
            value={theme.colors.text}
            onChange={(v) => updateColor("text", v)}
          />
          <ColorField
            label="Muted / Dates Text"
            value={theme.colors.light}
            onChange={(v) => updateColor("light", v)}
          />
          <div className="sm:col-span-2">
            <ColorField
              label="Divider Rules Color"
              value={theme.colors.divider}
              onChange={(v) => updateColor("divider", v)}
            />
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-900 font-semibold">
          <Type className="w-4 h-4 text-emerald-600" />
          <span>Typography</span>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Standard ATS Font Family
            </label>
            <select
              value={theme.typography.fontFamily}
              onChange={(e) =>
                onThemeChange((prev) => ({
                  ...prev,
                  preset: "custom",
                  typography: {
                    ...prev.typography,
                    fontFamily: e.target.value as FontFamilyOption,
                  },
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="Helvetica">Helvetica / Arial (Universal Sans-Serif)</option>
              <option value="Times-Roman">Times New Roman (Classic Editorial Serif)</option>
              <option value="Courier">Courier (Monospace Technical)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Font Sizing Scale
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["compact", "normal", "spacious"] as FontSizeScaleOption[]).map(
                (scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() =>
                      onThemeChange((prev) => ({
                        ...prev,
                        preset: "custom",
                        typography: {
                          ...prev.typography,
                          fontSizeScale: scale,
                        },
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border font-medium capitalize text-center ${
                      theme.typography.fontSizeScale === scale
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {scale}
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Line Spacing
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["tight", "normal", "relaxed"] as LineSpacingOption[]).map(
                (spacing) => (
                  <button
                    key={spacing}
                    type="button"
                    onClick={() =>
                      onThemeChange((prev) => ({
                        ...prev,
                        preset: "custom",
                        typography: {
                          ...prev.typography,
                          lineSpacing: spacing,
                        },
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border font-medium capitalize text-center ${
                      theme.typography.lineSpacing === spacing
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {spacing}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Heading Style */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-900 font-semibold">
          <Layers className="w-4 h-4 text-amber-600" />
          <span>Section Heading Style</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {HEADING_STYLE_OPTIONS.map((styleOpt) => {
            const isSelected =
              (theme.layout.headingStyle || "underline") === styleOpt.id;
            return (
              <button
                key={styleOpt.id}
                type="button"
                onClick={() => setPresetCustom({ headingStyle: styleOpt.id })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-amber-600 bg-amber-50/60 shadow-xs"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                }`}
              >
                <div className="font-semibold text-gray-900">
                  {styleOpt.label}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                  {styleOpt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Layout & Structure */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-900 font-semibold">
          <Layout className="w-4 h-4 text-purple-600" />
          <span>Layout &amp; Dividers</span>
        </div>

        <div className="space-y-3 text-xs">
          {/* Header Style & Layout */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-700 font-medium">
                Header Style &amp; Layout
              </label>
              <span className="text-[10px] text-gray-400">ATS Compliant</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  "stacked_left",
                  "stacked_center",
                  "split_twocol",
                ] as HeaderStyleOption[]
              ).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setPresetCustom({
                      headerStyle: option,
                      headerAlignment:
                        option === "stacked_center" ? "center" : "left",
                    })
                  }
                  className={`py-1.5 px-2 rounded-lg border font-medium text-center text-[11px] ${
                    (theme.layout.headerStyle ||
                      (theme.layout.headerAlignment === "center"
                        ? "stacked_center"
                        : "stacked_left")) === option
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {option === "stacked_left"
                    ? "Stacked Left"
                    : option === "stacked_center"
                    ? "Centered"
                    : "Split 2-Col"}
                </button>
              ))}
            </div>
          </div>

          {/* Target Professional Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-700 font-medium">
                Target Professional Title
              </label>
              <span className="text-[10px] text-gray-400">Optional subtitle</span>
            </div>
            <input
              type="text"
              value={theme.layout.professionalTitle || ""}
              onChange={(e) =>
                setPresetCustom({ professionalTitle: e.target.value })
              }
              placeholder="e.g. Senior Full Stack Engineer"
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Skills Layout */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Skills Display Layout
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["grid_3col", "inline_wrap"] as SkillsLayoutOption[]).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPresetCustom({ skillsLayout: option })}
                    className={`py-1.5 px-3 rounded-lg border font-medium ${
                      theme.layout.skillsLayout === option
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {option === "grid_3col" ? "3-Column Grid" : "Inline Bullet Tags"}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Page Margins */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Page Margins
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["compact", "normal", "wide"] as MarginsOption[]).map((margin) => (
                <button
                  key={margin}
                  type="button"
                  onClick={() => setPresetCustom({ margins: margin })}
                  className={`py-1.5 px-2 rounded-lg border font-medium capitalize text-center ${
                    theme.layout.margins === margin
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {margin}
                </button>
              ))}
            </div>
          </div>

          {/* Dividers */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <div>
              <span className="font-medium text-gray-800">
                Section Divider Lines
              </span>
              <p className="text-[11px] text-gray-400">
                Render clean horizontal rules between resume sections
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={theme.layout.showDividers}
                onChange={(e) =>
                  setPresetCustom({ showDividers: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>
        </div>
      </div>

      {/* Section Order & Visibility */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <ListOrdered className="w-4 h-4 text-orange-600" />
            <span>Section Order &amp; Visibility</span>
          </div>
          <span className="text-[11px] text-gray-400">
            Rename, hide, or reorder
          </span>
        </div>

        <SectionOrderEditor
          theme={theme}
          onThemeChange={onThemeChange}
          onToggleVisibility={toggleSectionVisibility}
          onMoveSection={moveSection}
        />
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-gray-700 font-medium mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
        />
        <span className="text-gray-500 font-mono text-xs uppercase">
          {value}
        </span>
      </div>
    </div>
  );
}

function SavePersonaInput({
  onSave,
  isSaving,
}: {
  onSave: (name: string) => void;
  isSaving: boolean;
}) {
  return (
    <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
      <input
        type="text"
        id="new-persona-name"
        placeholder="Persona name e.g. Frontend Tech Lead"
        className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const input = e.currentTarget;
            if (input.value.trim()) {
              onSave(input.value.trim());
              input.value = "";
            }
          }
        }}
      />
      <button
        type="button"
        disabled={isSaving}
        onClick={() => {
          const input = document.getElementById(
            "new-persona-name"
          ) as HTMLInputElement | null;
          if (input?.value.trim()) {
            onSave(input.value.trim());
            input.value = "";
          }
        }}
        className="px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1 shrink-0"
      >
        {isSaving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Plus className="w-3.5 h-3.5" />
        )}
        <span>Save New</span>
      </button>
    </div>
  );
}

/**
 * Section order list with inline rename, hide/show and reordering.
 * Kept as its own component so the rename editing state stays local.
 */
function SectionOrderEditor({
  theme,
  onThemeChange,
  onToggleVisibility,
  onMoveSection,
}: {
  theme: ResumeThemeConfig;
  onThemeChange: ResumeStyleSidebarProps["onThemeChange"];
  onToggleVisibility: (sectionKey: ResumeSectionKey) => void;
  onMoveSection: (index: number, direction: "up" | "down") => void;
}) {
  const [editingTitleKey, setEditingTitleKey] =
    useState<ResumeSectionKey | null>(null);
  const [tempTitleText, setTempTitleText] = useState<string>("");

  const handleStartEditTitle = (sectionKey: ResumeSectionKey) => {
    setEditingTitleKey(sectionKey);
    setTempTitleText(
      theme.layout.customSectionTitles?.[sectionKey] ||
        SECTION_LABELS[sectionKey] ||
        ""
    );
  };

  const handleSaveCustomTitle = (sectionKey: ResumeSectionKey) => {
    onThemeChange((prev) => {
      const updatedTitles = { ...(prev.layout.customSectionTitles || {}) };
      if (tempTitleText.trim()) {
        updatedTitles[sectionKey] = tempTitleText.trim();
      } else {
        delete updatedTitles[sectionKey];
      }
      return {
        ...prev,
        preset: "custom",
        layout: {
          ...prev.layout,
          customSectionTitles: updatedTitles,
        },
      };
    });
    setEditingTitleKey(null);
  };

  return (
    <div className="space-y-2 pt-1 text-xs">
      {theme.layout.sectionOrder.map((sectionKey, index) => {
        const isHidden = theme.layout.hiddenSections?.includes(sectionKey);
        const customTitle = theme.layout.customSectionTitles?.[sectionKey];
        const displayLabel =
          customTitle || SECTION_LABELS[sectionKey] || sectionKey;
        const isEditing = editingTitleKey === sectionKey;

        return (
          <div
            key={sectionKey}
            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
              isHidden
                ? "bg-gray-100/70 border-gray-200 text-gray-400"
                : "bg-gray-50 border-gray-200 text-gray-800"
            }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
              <button
                type="button"
                onClick={() => onToggleVisibility(sectionKey)}
                className={`p-1 rounded-md transition-colors ${
                  isHidden
                    ? "text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                    : "text-blue-600 hover:bg-blue-100"
                }`}
                title={isHidden ? "Click to Show Section" : "Click to Hide Section"}
              >
                {isHidden ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>

              {isEditing ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="text"
                    value={tempTitleText}
                    onChange={(e) => setTempTitleText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveCustomTitle(sectionKey);
                      if (e.key === "Escape") setEditingTitleKey(null);
                    }}
                    className="px-2 py-0.5 border border-blue-400 rounded bg-white text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                    placeholder={SECTION_LABELS[sectionKey]}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveCustomTitle(sectionKey)}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                    title="Save Title"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTitleKey(null)}
                    className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`${isHidden ? "line-through opacity-70" : ""}`}>
                    {index + 1}. {displayLabel}
                  </span>
                  {isHidden && (
                    <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.2 rounded font-normal">
                      Hidden
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartEditTitle(sectionKey)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded opacity-60 hover:opacity-100"
                    title="Rename Section Heading"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMoveSection(index, "up")}
                className="p-1 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Move section up"
              >
                <MoveUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={index === theme.layout.sectionOrder.length - 1}
                onClick={() => onMoveSection(index, "down")}
                className="p-1 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Move section down"
              >
                <MoveDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
