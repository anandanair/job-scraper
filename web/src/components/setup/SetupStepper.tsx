"use client";

import React from "react";
import { Database, Cpu, Briefcase, Sparkles, Bot, CheckCircle2 } from "lucide-react";

interface SetupStepperProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  onStepClick?: (step: 1 | 2 | 3 | 4 | 5) => void;
  maxAccessibleStep?: 1 | 2 | 3 | 4 | 5;
}

export function SetupStepper({
  currentStep,
  onStepClick,
  maxAccessibleStep = 1,
}: SetupStepperProps) {
  const isStepClickable = (step: 1 | 2 | 3 | 4 | 5) => {
    if (!onStepClick) return false;
    return step <= maxAccessibleStep;
  };

  const getProgressWidth = () => {
    switch (currentStep) {
      case 1:
        return "0%";
      case 2:
        return "25%";
      case 3:
        return "50%";
      case 4:
        return "75%";
      case 5:
        return "100%";
      default:
        return "0%";
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between relative max-w-3xl mx-auto px-4">
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0" />
        <div
          className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 transition-all duration-500 z-0"
          style={{ width: `calc(${getProgressWidth()} * 0.88)` }}
        />

        {/* Step 1 */}
        <div className="relative z-10 flex flex-col items-center">
          <button
            type="button"
            disabled={!isStepClickable(1)}
            onClick={() => onStepClick && onStepClick(1)}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
              isStepClickable(1) ? "cursor-pointer hover:scale-105" : "cursor-default"
            } ${
              currentStep > 1
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
                : currentStep === 1
                ? "bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md shadow-indigo-100"
                : "bg-white border-2 border-slate-300 text-slate-500"
            }`}
          >
            {currentStep > 1 ? <CheckCircle2 className="w-5 h-5" /> : <Database className="w-4 h-4" />}
          </button>
          <span className={`text-[11px] font-semibold mt-2 ${currentStep === 1 ? "text-indigo-600 font-bold" : "text-slate-600"}`}>
            1. Database
          </span>
        </div>

        {/* Step 2 */}
        <div className="relative z-10 flex flex-col items-center">
          <button
            type="button"
            disabled={!isStepClickable(2)}
            onClick={() => onStepClick && onStepClick(2)}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
              isStepClickable(2) ? "cursor-pointer hover:scale-105" : "cursor-default"
            } ${
              currentStep > 2
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
                : currentStep === 2
                ? "bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md shadow-indigo-100"
                : "bg-white border-2 border-slate-300 text-slate-500"
            }`}
          >
            {currentStep > 2 ? <CheckCircle2 className="w-5 h-5" /> : <Cpu className="w-4 h-4" />}
          </button>
          <span className={`text-[11px] font-semibold mt-2 ${currentStep === 2 ? "text-indigo-600 font-bold" : "text-slate-600"}`}>
            2. AI Engine
          </span>
        </div>

        {/* Step 3 */}
        <div className="relative z-10 flex flex-col items-center">
          <button
            type="button"
            disabled={!isStepClickable(3)}
            onClick={() => onStepClick && onStepClick(3)}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
              isStepClickable(3) ? "cursor-pointer hover:scale-105" : "cursor-default"
            } ${
              currentStep > 3
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
                : currentStep === 3
                ? "bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md shadow-indigo-100"
                : "bg-white border-2 border-slate-300 text-slate-500"
            }`}
          >
            {currentStep > 3 ? <CheckCircle2 className="w-5 h-5" /> : <Briefcase className="w-4 h-4" />}
          </button>
          <span className={`text-[11px] font-semibold mt-2 ${currentStep === 3 ? "text-indigo-600 font-bold" : "text-slate-600"}`}>
            3. Preferences
          </span>
        </div>

        {/* Step 4 */}
        <div className="relative z-10 flex flex-col items-center">
          <button
            type="button"
            disabled={!isStepClickable(4)}
            onClick={() => onStepClick && onStepClick(4)}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
              isStepClickable(4) ? "cursor-pointer hover:scale-105" : "cursor-default"
            } ${
              currentStep > 4
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
                : currentStep === 4
                ? "bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md shadow-indigo-100"
                : "bg-white border-2 border-slate-300 text-slate-500"
            }`}
          >
            {currentStep > 4 ? <CheckCircle2 className="w-5 h-5" /> : <Sparkles className="w-4 h-4" />}
          </button>
          <span className={`text-[11px] font-semibold mt-2 ${currentStep === 4 ? "text-indigo-600 font-bold" : "text-slate-600"}`}>
            4. Resume Studio
          </span>
        </div>

        {/* Step 5 */}
        <div className="relative z-10 flex flex-col items-center">
          <button
            type="button"
            disabled={!isStepClickable(5)}
            onClick={() => onStepClick && onStepClick(5)}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
              isStepClickable(5) ? "cursor-pointer hover:scale-105" : "cursor-default"
            } ${
              currentStep === 5
                ? "bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md shadow-indigo-100"
                : "bg-white border-2 border-slate-300 text-slate-500"
            }`}
          >
            <Bot className="w-4 h-4" />
          </button>
          <span className={`text-[11px] font-semibold mt-2 ${currentStep === 5 ? "text-indigo-600 font-bold" : "text-slate-600"}`}>
            5. Automation
          </span>
        </div>
      </div>
    </div>
  );
}
