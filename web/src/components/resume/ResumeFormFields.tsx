"use client";

import { useState } from "react";
import {
  Resume,
  Education,
  Experience,
  Project,
  Certification,
  Links,
} from "@/types";
import {
  Globe,
  Briefcase,
  GraduationCap,
  FolderOpen,
  Award,
  Languages,
  Linkedin,
  Github,
  ExternalLink,
  Plus,
  User,
  FileText,
  Cpu,
  Sparkles,
} from "lucide-react";
import { SectionCard, FormField, AddItemButton } from "./ResumeFormUI";
import { TagListEditor } from "./TagListEditor";
import { BulletListEditor } from "./BulletListEditor";
import { CollapsibleCard } from "./CollapsibleCard";

export interface ResumeFormProps {
  formData: Resume;
  updateField: (field: keyof Resume, value: any) => void;
  updateNestedField: <T extends object>(
    section: keyof Resume,
    index: number,
    field: keyof T,
    value: any,
  ) => void;
  updateLinkField: (field: keyof Links, value: string) => void;
  addArrayItem: (section: keyof Resume, template: object) => void;
  removeArrayItem: (section: keyof Resume, index: number) => void;
  moveArrayItem?: (
    section: keyof Resume,
    fromIndex: number,
    toIndex: number,
  ) => void;
}

export function ResumeFormFields({
  formData,
  updateField,
  updateNestedField,
  updateLinkField,
  addArrayItem,
  removeArrayItem,
  moveArrayItem,
}: ResumeFormProps) {
  // Default: EVERYTHING collapsed
  const [sectionsExpanded, setSectionsExpanded] = useState<
    Record<string, boolean>
  >({
    personal: false,
    links: false,
    summary: false,
    skills: false,
    experience: false,
    education: false,
    projects: false,
    certifications: false,
    languages: false,
  });

  const [expExpanded, setExpExpanded] = useState<Record<number, boolean>>({});
  const [projExpanded, setProjExpanded] = useState<Record<number, boolean>>({});
  const [eduExpanded, setEduExpanded] = useState<Record<number, boolean>>({});
  const [certExpanded, setCertExpanded] = useState<Record<number, boolean>>({});

  const isAllSectionsExpanded = Object.values(sectionsExpanded).every(Boolean);

  const toggleAllSections = () => {
    const nextVal = !isAllSectionsExpanded;
    setSectionsExpanded({
      personal: nextVal,
      links: nextVal,
      summary: nextVal,
      skills: nextVal,
      experience: nextVal,
      education: nextVal,
      projects: nextVal,
      certifications: nextVal,
      languages: nextVal,
    });
  };

  const toggleSection = (sectionKey: string) => {
    setSectionsExpanded((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const expCount = formData.experience?.length || 0;
  const isAllExpExpanded =
    expCount > 0 &&
    Array.from({ length: expCount }).every((_, i) => expExpanded[i] === true);

  const toggleAllExp = () => {
    const next: Record<number, boolean> = {};
    for (let i = 0; i < expCount; i++) {
      next[i] = !isAllExpExpanded;
    }
    setExpExpanded(next);
  };

  const projCount = formData.projects?.length || 0;
  const isAllProjExpanded =
    projCount > 0 &&
    Array.from({ length: projCount }).every((_, i) => projExpanded[i] === true);

  const toggleAllProj = () => {
    const next: Record<number, boolean> = {};
    for (let i = 0; i < projCount; i++) {
      next[i] = !isAllProjExpanded;
    }
    setProjExpanded(next);
  };

  const eduCount = formData.education?.length || 0;
  const isAllEduExpanded =
    eduCount > 0 &&
    Array.from({ length: eduCount }).every((_, i) => eduExpanded[i] === true);

  const toggleAllEdu = () => {
    const next: Record<number, boolean> = {};
    for (let i = 0; i < eduCount; i++) {
      next[i] = !isAllEduExpanded;
    }
    setEduExpanded(next);
  };

  const certCount = formData.certifications?.length || 0;
  const isAllCertExpanded =
    certCount > 0 &&
    Array.from({ length: certCount }).every((_, i) => certExpanded[i] === true);

  const toggleAllCert = () => {
    const next: Record<number, boolean> = {};
    for (let i = 0; i < certCount; i++) {
      next[i] = !isAllCertExpanded;
    }
    setCertExpanded(next);
  };

  return (
    <>
      {/* Top Global Section Toggle Control */}
      <div className="flex items-center justify-end px-1 pb-1">
        <button
          type="button"
          onClick={toggleAllSections}
          className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-2xs cursor-pointer"
        >
          {isAllSectionsExpanded
            ? "Collapse All Sections"
            : "Expand All Sections"}
        </button>
      </div>

      {/* Personal Info */}
      <SectionCard
        icon={<User size={18} />}
        title="Personal Information"
        accentColor="slate"
        isExpanded={sectionsExpanded.personal}
        onToggle={() => toggleSection("personal")}
        badge={
          formData.name
            ? `${formData.name}${formData.location ? ` • ${formData.location}` : ""}`
            : "Empty"
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Full Name"
            id="edit-name"
            value={formData.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
          />
          <FormField
            label="Email"
            id="edit-email"
            type="email"
            value={formData.email || ""}
            onChange={(e) => updateField("email", e.target.value)}
          />
          <FormField
            label="Phone"
            id="edit-phone"
            type="tel"
            value={formData.phone || ""}
            onChange={(e) => updateField("phone", e.target.value)}
          />
          <FormField
            label="Location"
            id="edit-location"
            value={formData.location || ""}
            onChange={(e) => updateField("location", e.target.value)}
          />
        </div>
      </SectionCard>

      {/* Links */}
      <SectionCard
        icon={<Globe size={18} />}
        title="Online Profiles & Links"
        accentColor="sky"
        isExpanded={sectionsExpanded.links}
        onToggle={() => toggleSection("links")}
        badge={`${
          [
            formData.links?.linkedin,
            formData.links?.github,
            formData.links?.portfolio,
          ].filter(Boolean).length
        } links`}
      >
        <div className="space-y-3.5">
          {/* LinkedIn */}
          <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="edit-linkedin"
                className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <span className="p-1 rounded-md bg-blue-100/80 text-[#0A66C2]">
                  <Linkedin size={14} />
                </span>
                <span>LinkedIn Profile</span>
              </label>
              {formData.links?.linkedin &&
                formData.links.linkedin.trim() !== "" &&
                formData.links.linkedin.toUpperCase() !== "NA" &&
                formData.links.linkedin.toUpperCase() !== "N/A" && (
                  <a
                    href={
                      formData.links.linkedin.startsWith("http")
                        ? formData.links.linkedin
                        : `https://${formData.links.linkedin}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    title="Open LinkedIn in new tab"
                  >
                    <span>Test Link</span>
                    <ExternalLink size={11} />
                  </a>
                )}
            </div>
            <input
              type="text"
              id="edit-linkedin"
              value={formData.links?.linkedin || ""}
              onChange={(e) => updateLinkField("linkedin", e.target.value)}
              placeholder="e.g. linkedin.com/in/username or https://linkedin.com/in/..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg text-slate-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* GitHub */}
          <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3 focus-within:bg-white focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-100 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="edit-github"
                className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <span className="p-1 rounded-md bg-slate-200/80 text-slate-800">
                  <Github size={14} />
                </span>
                <span>GitHub Profile</span>
              </label>
              {formData.links?.github &&
                formData.links.github.trim() !== "" &&
                formData.links.github.toUpperCase() !== "NA" &&
                formData.links.github.toUpperCase() !== "N/A" && (
                  <a
                    href={
                      formData.links.github.startsWith("http")
                        ? formData.links.github
                        : `https://${formData.links.github}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 hover:underline"
                    title="Open GitHub in new tab"
                  >
                    <span>Test Link</span>
                    <ExternalLink size={11} />
                  </a>
                )}
            </div>
            <input
              type="text"
              id="edit-github"
              value={formData.links?.github || ""}
              onChange={(e) => updateLinkField("github", e.target.value)}
              placeholder="e.g. github.com/username or https://github.com/..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg text-slate-800 placeholder:text-gray-400 focus:outline-none focus:border-slate-600 font-mono"
            />
          </div>

          {/* Portfolio */}
          <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3 focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="edit-portfolio"
                className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <span className="p-1 rounded-md bg-emerald-100/80 text-emerald-700">
                  <Globe size={14} />
                </span>
                <span>Portfolio / Personal Website</span>
              </label>
              {formData.links?.portfolio &&
                formData.links.portfolio.trim() !== "" &&
                formData.links.portfolio.toUpperCase() !== "NA" &&
                formData.links.portfolio.toUpperCase() !== "N/A" && (
                  <a
                    href={
                      formData.links.portfolio.startsWith("http")
                        ? formData.links.portfolio
                        : `https://${formData.links.portfolio}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
                    title="Open Portfolio in new tab"
                  >
                    <span>Test Link</span>
                    <ExternalLink size={11} />
                  </a>
                )}
            </div>
            <input
              type="text"
              id="edit-portfolio"
              value={formData.links?.portfolio || ""}
              onChange={(e) => updateLinkField("portfolio", e.target.value)}
              placeholder="e.g. yoursite.com or https://..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg text-slate-800 placeholder:text-gray-400 focus:outline-none focus:border-emerald-600 font-mono"
            />
          </div>
        </div>
      </SectionCard>

      {/* Summary */}
      <SectionCard
        icon={<FileText size={18} />}
        title="Professional Summary"
        accentColor="amber"
        isExpanded={sectionsExpanded.summary}
        onToggle={() => toggleSection("summary")}
        badge={formData.summary?.trim() ? "Provided" : "Empty"}
      >
        <FormField
          label="Summary"
          id="edit-summary"
          value={formData.summary || ""}
          onChange={(e) => updateField("summary", e.target.value)}
          rows={4}
        />
      </SectionCard>

      {/* Skills */}
      <SectionCard
        icon={<Cpu size={18} />}
        title="Skills"
        accentColor="emerald"
        isExpanded={sectionsExpanded.skills}
        onToggle={() => toggleSection("skills")}
        badge={`${formData.skills?.length || 0} skills`}
      >
        <TagListEditor
          label="Skills List"
          id="edit-skills"
          items={Array.isArray(formData.skills) ? formData.skills : []}
          onChange={(newSkills) => updateField("skills", newSkills)}
          placeholder="Type a skill and press Enter or comma (e.g. Python, Docker)..."
        />
      </SectionCard>

      {/* Experience */}
      <SectionCard
        icon={<Briefcase size={18} />}
        title="Experience"
        accentColor="indigo"
        isExpanded={sectionsExpanded.experience}
        onToggle={() => toggleSection("experience")}
        badge={`${expCount} ${expCount === 1 ? "role" : "roles"}`}
        action={
          <div className="flex items-center gap-2">
            {expCount > 0 && (
              <button
                type="button"
                onClick={toggleAllExp}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              >
                {isAllExpExpanded ? "Collapse All" : "Expand All"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                addArrayItem("experience", {
                  job_title: "",
                  company: "",
                  location: "",
                  start_date: "",
                  end_date: "",
                  technologies: [],
                  bullets: [""],
                  description: "",
                  context_notes: "",
                } as Experience);
                setExpExpanded((prev) => ({ ...prev, [expCount]: true }));
              }}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Role</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {formData.experience?.map((exp, i) => {
            const activeBullets =
              exp.bullets && exp.bullets.length > 0
                ? exp.bullets
                    .map((l) =>
                      l.trim().replace(/^[\s•*–—◦▪‣⁃+\-]+/g, "").trim(),
                    )
                    .filter(Boolean)
                : exp.description
                  ? exp.description
                      .split("\n")
                      .map((l) =>
                        l.trim().replace(/^[\s•*–—◦▪‣⁃+\-]+/g, "").trim(),
                      )
                      .filter(Boolean)
                  : [];

            const isItemExpanded = expExpanded[i] === true;

            return (
              <CollapsibleCard
                key={i}
                title={exp.job_title || "Untitled Role"}
                subtitle={exp.company}
                themeColor="indigo"
                dateBadge={
                  exp.start_date || exp.end_date
                    ? `${exp.start_date || ""} - ${exp.end_date || "Present"}`
                    : null
                }
                metaBadge={`${activeBullets.length} ${
                  activeBullets.length === 1 ? "bullet" : "bullets"
                }`}
                techBadges={exp.technologies}
                onRemove={() => removeArrayItem("experience", i)}
                onMoveUp={
                  moveArrayItem
                    ? () => moveArrayItem("experience", i, i - 1)
                    : undefined
                }
                onMoveDown={
                  moveArrayItem
                    ? () => moveArrayItem("experience", i, i + 1)
                    : undefined
                }
                canMoveUp={i > 0}
                canMoveDown={i < (formData.experience?.length || 0) - 1}
                isExpanded={isItemExpanded}
                onToggle={() =>
                  setExpExpanded((prev) => ({
                    ...prev,
                    [i]: !isItemExpanded,
                  }))
                }
              >
                {/* Row 1: Job Title & Company */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <FormField
                    label="Job Title"
                    id={`exp-title-${i}`}
                    value={exp.job_title || ""}
                    placeholder="e.g. Lead Full-Stack Engineer"
                    onChange={(e) =>
                      updateNestedField<Experience>(
                        "experience",
                        i,
                        "job_title",
                        e.target.value,
                      )
                    }
                  />
                  <FormField
                    label="Company / Organization"
                    id={`exp-company-${i}`}
                    value={exp.company || ""}
                    placeholder="e.g. Acme Corporation"
                    onChange={(e) =>
                      updateNestedField<Experience>(
                        "experience",
                        i,
                        "company",
                        e.target.value,
                      )
                    }
                  />
                </div>

                {/* Row 2: Location, Start Date, End Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <FormField
                    label="Location"
                    id={`exp-location-${i}`}
                    value={exp.location || ""}
                    placeholder="e.g. Singapore (or Remote)"
                    onChange={(e) =>
                      updateNestedField<Experience>(
                        "experience",
                        i,
                        "location",
                        e.target.value,
                      )
                    }
                  />
                  <FormField
                    label="Start Date"
                    id={`exp-start-${i}`}
                    value={exp.start_date || ""}
                    placeholder="e.g. Jan 2022"
                    onChange={(e) =>
                      updateNestedField<Experience>(
                        "experience",
                        i,
                        "start_date",
                        e.target.value,
                      )
                    }
                  />
                  <FormField
                    label="End Date"
                    id={`exp-end-${i}`}
                    value={exp.end_date || ""}
                    placeholder="Present"
                    onChange={(e) =>
                      updateNestedField<Experience>(
                        "experience",
                        i,
                        "end_date",
                        e.target.value,
                      )
                    }
                  />
                </div>

                {/* Technologies */}
                <TagListEditor
                  label="Technologies & Tools Used in this Role"
                  id={`exp-tech-${i}`}
                  items={
                    Array.isArray(exp.technologies) ? exp.technologies : []
                  }
                  onChange={(techs) => {
                    updateNestedField<Experience>(
                      "experience",
                      i,
                      "technologies",
                      techs as any,
                    );
                  }}
                  placeholder="e.g. React, TypeScript, Docker, PostgreSQL (press Enter or comma)"
                  compact
                />

                {/* Achievements & Bullets */}
                <BulletListEditor
                  label="Role Achievements & Responsibilities"
                  bullets={activeBullets}
                  onChange={(newBullets) => {
                    updateNestedField<Experience>(
                      "experience",
                      i,
                      "bullets",
                      newBullets as any,
                    );
                    updateNestedField<Experience>(
                      "experience",
                      i,
                      "description",
                      newBullets.join("\n") as any,
                    );
                  }}
                  placeholder="Accomplished [X], as measured by [Y], by doing [Z] (e.g., Automated incident escalation pipeline reducing P1 triage by 45%)..."
                />

                {/* AI Context Notes */}
                <details className="group border border-purple-200/90 bg-gradient-to-r from-purple-50/60 to-indigo-50/40 rounded-xl p-3.5 transition-all">
                  <summary className="cursor-pointer text-xs font-semibold text-purple-950 flex items-center justify-between select-none">
                    <span className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-purple-100 text-purple-700">
                        <Sparkles size={13} />
                      </span>
                      <span>AI Context &amp; Architecture Notes</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-200/60 text-purple-800">
                        Hidden from PDF
                      </span>
                    </span>
                    <span className="text-[11px] text-purple-700 font-medium group-open:hidden">
                      Click to expand &darr;
                    </span>
                  </summary>
                  <div className="mt-2.5 pt-2 border-t border-purple-200/60">
                    <textarea
                      rows={3}
                      value={exp.context_notes || ""}
                      onChange={(e) =>
                        updateNestedField<Experience>(
                          "experience",
                          i,
                          "context_notes",
                          e.target.value as any,
                        )
                      }
                      placeholder="Private notes for AI tailoring & interview prep (e.g. metrics, trade-offs, architecture decisions, major incidents)..."
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-purple-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400/30 font-sans leading-relaxed"
                    />
                  </div>
                </details>
              </CollapsibleCard>
            );
          })}

          <AddItemButton
            label="Add Experience Role"
            onClick={() => {
              addArrayItem("experience", {
                job_title: "",
                company: "",
                location: "",
                start_date: "",
                end_date: "",
                technologies: [],
                bullets: [""],
                description: "",
                context_notes: "",
              } as Experience);
              setExpExpanded((prev) => ({ ...prev, [expCount]: true }));
            }}
          />
        </div>
      </SectionCard>

      {/* Education */}
      <SectionCard
        icon={<GraduationCap size={18} />}
        title="Education"
        accentColor="blue"
        isExpanded={sectionsExpanded.education}
        onToggle={() => toggleSection("education")}
        badge={`${eduCount} ${eduCount === 1 ? "degree" : "degrees"}`}
        action={
          <div className="flex items-center gap-2">
            {eduCount > 0 && (
              <button
                type="button"
                onClick={toggleAllEdu}
                className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                {isAllEduExpanded ? "Collapse All" : "Expand All"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                addArrayItem("education", {
                  degree: "",
                  field_of_study: "",
                  institution: "",
                  start_year: "",
                  end_year: "",
                } as Education);
                setEduExpanded((prev) => ({ ...prev, [eduCount]: true }));
              }}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Education</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {formData.education?.map((edu, i) => {
            const isItemExpanded = eduExpanded[i] === true;
            const displayTitle = edu.degree
              ? `${edu.degree}${edu.field_of_study ? ` in ${edu.field_of_study}` : ""}`
              : "Degree / Qualification";

            return (
              <CollapsibleCard
                key={i}
                title={displayTitle}
                subtitle={edu.institution}
                themeColor="blue"
                dateBadge={
                  edu.start_year || edu.end_year
                    ? `${edu.start_year || ""} - ${edu.end_year || "Present"}`
                    : null
                }
                onRemove={() => removeArrayItem("education", i)}
                onMoveUp={
                  moveArrayItem
                    ? () => moveArrayItem("education", i, i - 1)
                    : undefined
                }
                onMoveDown={
                  moveArrayItem
                    ? () => moveArrayItem("education", i, i + 1)
                    : undefined
                }
                canMoveUp={i > 0}
                canMoveDown={i < (formData.education?.length || 0) - 1}
                isExpanded={isItemExpanded}
                onToggle={() =>
                  setEduExpanded((prev) => ({
                    ...prev,
                    [i]: !isItemExpanded,
                  }))
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <FormField
                    label="Degree / Qualification"
                    id={`edu-degree-${i}`}
                    value={edu.degree || ""}
                    placeholder="e.g. B.Sc. (Hons) or Diploma"
                    onChange={(e) =>
                      updateNestedField<Education>(
                        "education",
                        i,
                        "degree",
                        e.target.value,
                      )
                    }
                  />
                  <FormField
                    label="Field of Study / Major"
                    id={`edu-field-${i}`}
                    value={edu.field_of_study || ""}
                    placeholder="e.g. Cybersecurity and Networks"
                    onChange={(e) =>
                      updateNestedField<Education>(
                        "education",
                        i,
                        "field_of_study",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="md:col-span-2">
                    <FormField
                      label="Institution / University"
                      id={`edu-inst-${i}`}
                      value={edu.institution || ""}
                      placeholder="e.g. Teesside University"
                      onChange={(e) =>
                        updateNestedField<Education>(
                          "education",
                          i,
                          "institution",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      label="Start Year"
                      id={`edu-start-${i}`}
                      value={edu.start_year || ""}
                      placeholder="e.g. 2023"
                      onChange={(e) =>
                        updateNestedField<Education>(
                          "education",
                          i,
                          "start_year",
                          e.target.value,
                        )
                      }
                    />
                    <FormField
                      label="End Year"
                      id={`edu-end-${i}`}
                      value={edu.end_year || ""}
                      placeholder="e.g. 2024"
                      onChange={(e) =>
                        updateNestedField<Education>(
                          "education",
                          i,
                          "end_year",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>
              </CollapsibleCard>
            );
          })}

          <AddItemButton
            label="Add Education"
            onClick={() => {
              addArrayItem("education", {
                degree: "",
                field_of_study: "",
                institution: "",
                start_year: "",
                end_year: "",
              } as Education);
              setEduExpanded((prev) => ({ ...prev, [eduCount]: true }));
            }}
          />
        </div>
      </SectionCard>

      {/* Projects */}
      <SectionCard
        icon={<FolderOpen size={18} />}
        title="Projects"
        accentColor="purple"
        isExpanded={sectionsExpanded.projects}
        onToggle={() => toggleSection("projects")}
        badge={`${projCount} ${projCount === 1 ? "project" : "projects"}`}
        action={
          <div className="flex items-center gap-2">
            {projCount > 0 && (
              <button
                type="button"
                onClick={toggleAllProj}
                className="px-2.5 py-1 text-xs font-semibold text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
              >
                {isAllProjExpanded ? "Collapse All" : "Expand All"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                addArrayItem("projects", {
                  name: "",
                  role: "",
                  url: "",
                  date: "",
                  technologies: [],
                  bullets: [""],
                  description: "",
                  context_notes: "",
                } as Project);
                setProjExpanded((prev) => ({ ...prev, [projCount]: true }));
              }}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200 cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Project</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {formData.projects?.map((proj, i) => {
            const activeBullets =
              proj.bullets && proj.bullets.length > 0
                ? proj.bullets
                    .map((l) =>
                      l.trim().replace(/^[\s•*–—◦▪‣⁃+\-]+/g, "").trim(),
                    )
                    .filter(Boolean)
                : proj.description
                  ? proj.description
                      .split("\n")
                      .map((l) =>
                        l.trim().replace(/^[\s•*–—◦▪‣⁃+\-]+/g, "").trim(),
                      )
                      .filter(Boolean)
                  : [];

            const isItemExpanded = projExpanded[i] === true;

            return (
              <CollapsibleCard
                key={i}
                title={proj.name || "Untitled Project"}
                subtitle={proj.role}
                themeColor="purple"
                dateBadge={proj.date}
                metaBadge={`${activeBullets.length} ${
                  activeBullets.length === 1 ? "bullet" : "bullets"
                }`}
                techBadges={proj.technologies}
                onRemove={() => removeArrayItem("projects", i)}
                onMoveUp={
                  moveArrayItem
                    ? () => moveArrayItem("projects", i, i - 1)
                    : undefined
                }
                onMoveDown={
                  moveArrayItem
                    ? () => moveArrayItem("projects", i, i + 1)
                    : undefined
                }
                canMoveUp={i > 0}
                canMoveDown={i < (formData.projects?.length || 0) - 1}
                isExpanded={isItemExpanded}
                onToggle={() =>
                  setProjExpanded((prev) => ({
                    ...prev,
                    [i]: !isItemExpanded,
                  }))
                }
              >
                {/* Row 1: Project Name & Role */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <FormField
                    label="Project Name"
                    id={`proj-name-${i}`}
                    value={proj.name || ""}
                    placeholder="e.g. Click4IT IT Support Portal"
                    onChange={(e) =>
                      updateNestedField<Project>(
                        "projects",
                        i,
                        "name",
                        e.target.value,
                      )
                    }
                  />
                  <FormField
                    label="Your Role / Position"
                    id={`proj-role-${i}`}
                    value={proj.role || ""}
                    placeholder="e.g. Lead Full-Stack Architect / Solo Creator"
                    onChange={(e) =>
                      updateNestedField<Project>(
                        "projects",
                        i,
                        "role",
                        e.target.value,
                      )
                    }
                  />
                </div>

                {/* Row 2: Project URL & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <FormField
                    label="Project URL / GitHub / Live Demo"
                    id={`proj-url-${i}`}
                    value={proj.url || ""}
                    placeholder="https://github.com/... or https://..."
                    onChange={(e) =>
                      updateNestedField<Project>(
                        "projects",
                        i,
                        "url",
                        e.target.value,
                      )
                    }
                  />
                  <FormField
                    label="Date / Period"
                    id={`proj-date-${i}`}
                    value={proj.date || ""}
                    placeholder="e.g. 2024 or Jan 2024 - Present"
                    onChange={(e) =>
                      updateNestedField<Project>(
                        "projects",
                        i,
                        "date",
                        e.target.value,
                      )
                    }
                  />
                </div>

                {/* Technologies */}
                <TagListEditor
                  label="Technologies Used"
                  id={`proj-tech-${i}`}
                  items={
                    Array.isArray(proj.technologies) ? proj.technologies : []
                  }
                  onChange={(techs) => {
                    updateNestedField<Project>(
                      "projects",
                      i,
                      "technologies",
                      techs as any,
                    );
                  }}
                  placeholder="e.g. React, Firebase, TypeScript, Tailwind CSS (press Enter or comma)"
                  compact
                />

                {/* Achievements & Bullets */}
                <BulletListEditor
                  label="Key Achievements & Features"
                  bullets={activeBullets}
                  onChange={(newBullets) => {
                    updateNestedField<Project>(
                      "projects",
                      i,
                      "bullets",
                      newBullets as any,
                    );
                    updateNestedField<Project>(
                      "projects",
                      i,
                      "description",
                      newBullets.join("\n") as any,
                    );
                  }}
                  placeholder="Accomplished [X], as measured by [Y], by doing [Z] (e.g., Built an automated triage bot handling 500+ daily support tickets)..."
                />

                {/* AI Context Notes */}
                <details className="group border border-purple-200/90 bg-gradient-to-r from-purple-50/60 to-indigo-50/40 rounded-xl p-3.5 transition-all">
                  <summary className="cursor-pointer text-xs font-semibold text-purple-950 flex items-center justify-between select-none">
                    <span className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-purple-100 text-purple-700">
                        <Sparkles size={13} />
                      </span>
                      <span>AI Context &amp; Architecture Notes</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-200/60 text-purple-800">
                        Hidden from PDF
                      </span>
                    </span>
                    <span className="text-[11px] text-purple-700 font-medium group-open:hidden">
                      Click to expand &darr;
                    </span>
                  </summary>
                  <div className="mt-2.5 pt-2 border-t border-purple-200/60">
                    <textarea
                      rows={3}
                      value={proj.context_notes || ""}
                      onChange={(e) =>
                        updateNestedField<Project>(
                          "projects",
                          i,
                          "context_notes",
                          e.target.value as any,
                        )
                      }
                      placeholder="Private notes for AI tailoring & interview prep (e.g. scale, concurrency, architecture trade-offs, challenge solutions)..."
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-purple-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400/30 font-sans leading-relaxed"
                    />
                  </div>
                </details>
              </CollapsibleCard>
            );
          })}

          <AddItemButton
            label="Add Project"
            onClick={() => {
              addArrayItem("projects", {
                name: "",
                role: "",
                url: "",
                date: "",
                technologies: [],
                bullets: [""],
                description: "",
                context_notes: "",
              } as Project);
              setProjExpanded((prev) => ({ ...prev, [projCount]: true }));
            }}
          />
        </div>
      </SectionCard>

      {/* Certifications */}
      <SectionCard
        icon={<Award size={18} />}
        title="Certifications"
        accentColor="rose"
        isExpanded={sectionsExpanded.certifications}
        onToggle={() => toggleSection("certifications")}
        badge={`${certCount} ${certCount === 1 ? "cert" : "certs"}`}
        action={
          <div className="flex items-center gap-2">
            {certCount > 0 && (
              <button
                type="button"
                onClick={toggleAllCert}
                className="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                {isAllCertExpanded ? "Collapse All" : "Expand All"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                addArrayItem("certifications", {
                  name: "",
                  issuer: "",
                  year: "",
                } as Certification);
                setCertExpanded((prev) => ({ ...prev, [certCount]: true }));
              }}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Certification</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {formData.certifications?.map((cert, i) => {
            const isItemExpanded = certExpanded[i] === true;

            return (
              <CollapsibleCard
                key={i}
                title={cert.name || "Untitled Certification"}
                subtitle={cert.issuer}
                themeColor="rose"
                dateBadge={cert.year || null}
                onRemove={() => removeArrayItem("certifications", i)}
                isExpanded={isItemExpanded}
                onToggle={() =>
                  setCertExpanded((prev) => ({
                    ...prev,
                    [i]: !isItemExpanded,
                  }))
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <FormField
                    label="Certification Name"
                    id={`cert-name-${i}`}
                    value={cert.name || ""}
                    placeholder="e.g. AWS Certified Solutions Architect"
                    onChange={(e) =>
                      updateNestedField<Certification>(
                        "certifications",
                        i,
                        "name",
                        e.target.value,
                      )
                    }
                  />
                  <FormField
                    label="Issuing Organization"
                    id={`cert-issuer-${i}`}
                    value={cert.issuer || ""}
                    placeholder="e.g. Amazon Web Services"
                    onChange={(e) =>
                      updateNestedField<Certification>(
                        "certifications",
                        i,
                        "issuer",
                        e.target.value,
                      )
                    }
                  />
                  <FormField
                    label="Year Achieved"
                    id={`cert-year-${i}`}
                    value={cert.year || ""}
                    placeholder="e.g. 2023"
                    onChange={(e) =>
                      updateNestedField<Certification>(
                        "certifications",
                        i,
                        "year",
                        e.target.value,
                      )
                    }
                  />
                </div>
              </CollapsibleCard>
            );
          })}

          <AddItemButton
            label="Add Certification"
            onClick={() => {
              addArrayItem("certifications", {
                name: "",
                issuer: "",
                year: "",
              } as Certification);
              setCertExpanded((prev) => ({ ...prev, [certCount]: true }));
            }}
          />
        </div>
      </SectionCard>

      {/* Languages */}
      <SectionCard
        icon={<Languages size={18} />}
        title="Languages"
        accentColor="teal"
        isExpanded={sectionsExpanded.languages}
        onToggle={() => toggleSection("languages")}
        badge={`${formData.languages?.length || 0} languages`}
      >
        <TagListEditor
          label="Languages & Proficiency"
          id="edit-languages"
          items={Array.isArray(formData.languages) ? formData.languages : []}
          onChange={(newLanguages) => updateField("languages", newLanguages)}
          placeholder="Type a language and press Enter or comma (e.g. English, Mandarin)..."
        />
      </SectionCard>
    </>
  );
}