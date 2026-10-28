"use client";

import React from "react";
import { Bot, Briefcase, Zap, GitFork } from "lucide-react";

export type SettingsTabId = "ai" | "search" | "automation" | "cloud";

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onChangeTab: (tab: SettingsTabId) => void;
}

const TABS: { id: SettingsTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "ai", label: "AI Engine & Models", icon: Bot },
  { id: "search", label: "Job Search Preferences", icon: Briefcase },
  { id: "automation", label: "Automation & Budget", icon: Zap },
  { id: "cloud", label: "Cloud Workflows", icon: GitFork },
];

export function SettingsTabs({ activeTab, onChangeTab }: SettingsTabsProps) {
  return (
    <div className="mb-6 border-b border-slate-200">
      <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-px" aria-label="Settings Tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? "border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                }`}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
