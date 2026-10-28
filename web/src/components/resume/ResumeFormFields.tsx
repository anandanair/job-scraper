"use client";

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
  Sparkles,
  Briefcase,
  GraduationCap,
  FolderOpen,
  Award,
  Languages,
  Linkedin,
  Github,
  ExternalLink,
} from "lucide-react";
import {
  SectionCard,
  FormField,
  AddItemButton,
  ArrayItemCard,
} from "./ResumeFormUI";
import { TagListEditor } from "./TagListEditor";

export interface ResumeFormProps {
  formData: Resume;
  updateField: (field: keyof Resume, value: any) => void;
  updateNestedField: <T extends object>(
    section: keyof Resume,
    index: number,
    field: keyof T,
    value: string
  ) => void;
  updateLinkField: (field: keyof Links, value: string) => void;
  addArrayItem: (section: keyof Resume, template: object) => void;
  removeArrayItem: (section: keyof Resume, index: number) => void;
}

export function ResumeFormFields({
  formData,
  updateField,
  updateNestedField,
  updateLinkField,
  addArrayItem,
  removeArrayItem,
}: ResumeFormProps) {
  return (
    <>
      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
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
      </div>

      {/* Links */}
      <SectionCard icon={<Globe size={18} />} title="Online Profiles & Links">
        <p className="text-xs text-slate-400 mb-3.5">
          Provide your professional links. These are rendered in your resume header with clean links.
        </p>
        <div className="space-y-3.5">
          {/* LinkedIn */}
          <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="edit-linkedin" className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
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
              <label htmlFor="edit-github" className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
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
              <label htmlFor="edit-portfolio" className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
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
      <SectionCard icon={<Sparkles size={18} />} title="Professional Summary">
        <FormField
          label="Summary"
          id="edit-summary"
          value={formData.summary || ""}
          onChange={(e) => updateField("summary", e.target.value)}
          rows={4}
        />
      </SectionCard>

      {/* Skills */}
      <SectionCard icon={<Sparkles size={18} />} title="Skills">
        <TagListEditor
          label="Skills List"
          id="edit-skills"
          items={Array.isArray(formData.skills) ? formData.skills : []}
          onChange={(newSkills) => updateField("skills", newSkills)}
          placeholder="Type a skill and press Enter or comma (e.g. Python, Docker)..."
          helperText="Add technical and domain skills. Press Enter or comma to create chips, or switch to Comma Text to edit directly."
        />
      </SectionCard>

      {/* Experience */}
      <SectionCard icon={<Briefcase size={18} />} title="Experience">
        <div className="space-y-4">
          {formData.experience?.map((exp, i) => (
            <ArrayItemCard key={i} onRemove={() => removeArrayItem("experience", i)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  label="Job Title"
                  id={`exp-title-${i}`}
                  value={exp.job_title || ""}
                  onChange={(e) =>
                    updateNestedField<Experience>(
                      "experience",
                      i,
                      "job_title",
                      e.target.value
                    )
                  }
                />
                <FormField
                  label="Company"
                  id={`exp-company-${i}`}
                  value={exp.company || ""}
                  onChange={(e) =>
                    updateNestedField<Experience>(
                      "experience",
                      i,
                      "company",
                      e.target.value
                    )
                  }
                />
                <FormField
                  label="Location"
                  id={`exp-location-${i}`}
                  value={exp.location || ""}
                  onChange={(e) =>
                    updateNestedField<Experience>(
                      "experience",
                      i,
                      "location",
                      e.target.value
                    )
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="Start Date"
                    id={`exp-start-${i}`}
                    value={exp.start_date || ""}
                    onChange={(e) =>
                      updateNestedField<Experience>(
                        "experience",
                        i,
                        "start_date",
                        e.target.value
                      )
                    }
                  />
                  <FormField
                    label="End Date"
                    id={`exp-end-${i}`}
                    value={exp.end_date || ""}
                    onChange={(e) =>
                      updateNestedField<Experience>(
                        "experience",
                        i,
                        "end_date",
                        e.target.value
                      )
                    }
                    placeholder="Present"
                  />
                </div>
              </div>
              <div className="mt-3">
                <FormField
                  label="Description"
                  id={`exp-desc-${i}`}
                  value={exp.description || ""}
                  onChange={(e) =>
                    updateNestedField<Experience>(
                      "experience",
                      i,
                      "description",
                      e.target.value
                    )
                  }
                  rows={3}
                />
              </div>
            </ArrayItemCard>
          ))}
          <AddItemButton
            label="Add Experience"
            onClick={() =>
              addArrayItem("experience", {
                job_title: "",
                company: "",
                location: "",
                start_date: "",
                end_date: "",
                description: "",
              } as Experience)
            }
          />
        </div>
      </SectionCard>

      {/* Education */}
      <SectionCard icon={<GraduationCap size={18} />} title="Education">
        <div className="space-y-4">
          {formData.education?.map((edu, i) => (
            <ArrayItemCard key={i} onRemove={() => removeArrayItem("education", i)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  label="Degree"
                  id={`edu-degree-${i}`}
                  value={edu.degree || ""}
                  onChange={(e) =>
                    updateNestedField<Education>(
                      "education",
                      i,
                      "degree",
                      e.target.value
                    )
                  }
                />
                <FormField
                  label="Field of Study"
                  id={`edu-field-${i}`}
                  value={edu.field_of_study || ""}
                  onChange={(e) =>
                    updateNestedField<Education>(
                      "education",
                      i,
                      "field_of_study",
                      e.target.value
                    )
                  }
                />
                <FormField
                  label="Institution"
                  id={`edu-inst-${i}`}
                  value={edu.institution || ""}
                  onChange={(e) =>
                    updateNestedField<Education>(
                      "education",
                      i,
                      "institution",
                      e.target.value
                    )
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="Start Year"
                    id={`edu-start-${i}`}
                    value={edu.start_year || ""}
                    onChange={(e) =>
                      updateNestedField<Education>(
                        "education",
                        i,
                        "start_year",
                        e.target.value
                      )
                    }
                  />
                  <FormField
                    label="End Year"
                    id={`edu-end-${i}`}
                    value={edu.end_year || ""}
                    onChange={(e) =>
                      updateNestedField<Education>(
                        "education",
                        i,
                        "end_year",
                        e.target.value
                      )
                    }
                    placeholder="Present"
                  />
                </div>
              </div>
            </ArrayItemCard>
          ))}
          <AddItemButton
            label="Add Education"
            onClick={() =>
              addArrayItem("education", {
                degree: "",
                field_of_study: "",
                institution: "",
                start_year: "",
                end_year: "",
              } as Education)
            }
          />
        </div>
      </SectionCard>

      {/* Projects */}
      <SectionCard icon={<FolderOpen size={18} />} title="Projects">
        <div className="space-y-4">
          {formData.projects?.map((proj, i) => (
            <ArrayItemCard key={i} onRemove={() => removeArrayItem("projects", i)}>
              <div className="grid grid-cols-1 gap-3">
                <FormField
                  label="Name"
                  id={`proj-name-${i}`}
                  value={proj.name || ""}
                  onChange={(e) =>
                    updateNestedField<Project>(
                      "projects",
                      i,
                      "name",
                      e.target.value
                    )
                  }
                />
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
                      techs as any
                    );
                  }}
                  placeholder="e.g. React, Node.js (press Enter or comma)"
                  compact
                />
                <FormField
                  label="Description"
                  id={`proj-desc-${i}`}
                  value={proj.description || ""}
                  onChange={(e) =>
                    updateNestedField<Project>(
                      "projects",
                      i,
                      "description",
                      e.target.value
                    )
                  }
                  rows={2}
                />
              </div>
            </ArrayItemCard>
          ))}
          <AddItemButton
            label="Add Project"
            onClick={() =>
              addArrayItem("projects", {
                name: "",
                description: "",
                technologies: [],
              } as Project)
            }
          />
        </div>
      </SectionCard>

      {/* Certifications */}
      <SectionCard icon={<Award size={18} />} title="Certifications">
        <div className="space-y-4">
          {formData.certifications?.map((cert, i) => (
            <ArrayItemCard key={i} onRemove={() => removeArrayItem("certifications", i)}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField
                  label="Name"
                  id={`cert-name-${i}`}
                  value={cert.name || ""}
                  onChange={(e) =>
                    updateNestedField<Certification>(
                      "certifications",
                      i,
                      "name",
                      e.target.value
                    )
                  }
                />
                <FormField
                  label="Issuer"
                  id={`cert-issuer-${i}`}
                  value={cert.issuer || ""}
                  onChange={(e) =>
                    updateNestedField<Certification>(
                      "certifications",
                      i,
                      "issuer",
                      e.target.value
                    )
                  }
                />
                <FormField
                  label="Year"
                  id={`cert-year-${i}`}
                  value={cert.year || ""}
                  onChange={(e) =>
                    updateNestedField<Certification>(
                      "certifications",
                      i,
                      "year",
                      e.target.value
                    )
                  }
                />
              </div>
            </ArrayItemCard>
          ))}
          <AddItemButton
            label="Add Certification"
            onClick={() =>
              addArrayItem("certifications", {
                name: "",
                issuer: "",
                year: "",
              } as Certification)
            }
          />
        </div>
      </SectionCard>

      {/* Languages */}
      <SectionCard icon={<Languages size={18} />} title="Languages">
        <TagListEditor
          label="Languages & Proficiency"
          id="edit-languages"
          items={Array.isArray(formData.languages) ? formData.languages : []}
          onChange={(newLanguages) => updateField("languages", newLanguages)}
          placeholder="Type a language and press Enter or comma (e.g. English, Mandarin)..."
          helperText="Add languages you speak. Press Enter or comma to create chips, or switch to Comma Text to edit directly."
        />
      </SectionCard>
    </>
  );
}
