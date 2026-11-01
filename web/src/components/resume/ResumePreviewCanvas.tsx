"use client";

import { forwardRef } from "react";
import { Resume, ResumeThemeConfig } from "@/types";
import {
  PAGE_WIDTH_PX,
  PAGE_HEIGHT_PX,
  SECTION_LABELS,
  getPreviewFontSizes,
  getPreviewFontFamily,
  getPreviewPadding,
  getPreviewLineSpacing,
  getEffectiveHeaderStyle,
  isRealValue,
} from "@/lib/resume-preview";

interface ResumePreviewCanvasProps {
  resume: Resume;
  theme: ResumeThemeConfig;
}

/**
 * Calibrated 1:1 HTML mirror of the PDFKit ATS engine.
 *
 * Renders the resume exactly as the PDF engine will typeset it (same page
 * width, padding, font sizes and spacing derived from shared calibration
 * constants). Purely presentational: parent controls scrolling, page-fit
 * measurement (via the forwarded ref on the paper sheet) and toolbars.
 */
const ResumePreviewCanvas = forwardRef<HTMLDivElement, ResumePreviewCanvasProps>(
  function ResumePreviewCanvas({ resume, theme }, ref) {
    const currentSizes = getPreviewFontSizes(theme.typography.fontSizeScale);
    const headerStyle = getEffectiveHeaderStyle(theme);

    const renderSectionHeading = (title: string) => {
      const headingStyle = theme.layout.headingStyle || "underline";

      if (headingStyle === "left_bar") {
        return (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div
              className="w-1 rounded-sm shrink-0"
              style={{
                height: currentSizes.heading,
                backgroundColor: theme.colors.primary,
              }}
            />
            <span
              className="font-bold uppercase tracking-wider"
              style={{
                fontSize: currentSizes.heading,
                color: theme.colors.primary,
              }}
            >
              {title}
            </span>
          </div>
        );
      }

      if (headingStyle === "shaded_pill") {
        return (
          <div
            className="mb-1.5 px-2 py-0.5 rounded"
            style={{
              backgroundColor: `${theme.colors.primary}18`,
            }}
          >
            <span
              className="font-bold uppercase tracking-wider"
              style={{
                fontSize: currentSizes.heading,
                color: theme.colors.primary,
              }}
            >
              {title}
            </span>
          </div>
        );
      }

      if (headingStyle === "borderless") {
        return (
          <div className="mb-1.5">
            <span
              className="font-bold uppercase tracking-wider"
              style={{
                fontSize: currentSizes.heading,
                color: theme.colors.primary,
              }}
            >
              {title}
            </span>
          </div>
        );
      }

      // Default: "underline"
      return (
        <div className="mb-1.5">
          <div
            className="font-bold uppercase tracking-wider mb-0.5"
            style={{
              fontSize: currentSizes.heading,
              color: theme.colors.primary,
            }}
          >
            {title}
          </div>
          {theme.layout.showDividers !== false && (
            <div
              className="w-full mb-1"
              style={{
                height: `${theme.layout.dividerThickness || 1}px`,
                backgroundColor: theme.colors.divider,
              }}
            />
          )}
        </div>
      );
    };

    const renderLinksRow = () => {
      if (!resume.links) return null;
      const linkedin = isRealValue(resume.links.linkedin);
      const github = isRealValue(resume.links.github);
      const portfolio = isRealValue(resume.links.portfolio);
      const separator = (linkedin && (github || portfolio)) || (github && portfolio);

      return (
        <>
          {linkedin && (
            <span style={{ color: theme.colors.primary }} className="underline">
              LinkedIn
            </span>
          )}
          {github && (
            <>
              {separator && <span className="text-gray-400">|</span>}
              <span style={{ color: theme.colors.primary }} className="underline">
                GitHub
              </span>
            </>
          )}
          {portfolio && (
            <>
              {(linkedin || github) && <span className="text-gray-400">|</span>}
              <span style={{ color: theme.colors.primary }} className="underline">
                Portfolio
              </span>
            </>
          )}
        </>
      );
    };

    const renderHeader = () => {
      if (headerStyle === "split_twocol") {
        return (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex-1 text-left min-w-0">
              <h1
                className="font-bold tracking-tight uppercase leading-none"
                style={{
                  fontSize: `calc(${currentSizes.name} * 0.95)`,
                  color: theme.colors.primary,
                }}
              >
                {resume.name || "Your Full Name"}
              </h1>
              {theme.layout.professionalTitle && (
                <div
                  className="font-bold tracking-wide mt-1"
                  style={{
                    fontSize: currentSizes.heading,
                    color: theme.colors.secondary,
                  }}
                >
                  {theme.layout.professionalTitle}
                </div>
              )}
            </div>

            <div className="text-right shrink-0 max-w-[45%]">
              <div
                className="font-medium"
                style={{
                  fontSize: currentSizes.meta,
                  color: theme.colors.secondary,
                }}
              >
                {[resume.email, resume.phone, resume.location]
                  .filter(Boolean)
                  .join("  |  ")}
              </div>
              {resume.links && (
                <div
                  className="mt-1 font-medium space-x-2"
                  style={{ fontSize: currentSizes.meta }}
                >
                  {renderLinksRow()}
                </div>
              )}
            </div>
          </div>
        );
      }

      const isCentered = headerStyle === "stacked_center";
      return (
        <div className={`mb-4 ${isCentered ? "text-center" : "text-left"}`}>
          <h1
            className="font-bold tracking-tight uppercase"
            style={{
              fontSize: currentSizes.name,
              color: theme.colors.primary,
              lineHeight: "1.1",
            }}
          >
            {resume.name || "Your Full Name"}
          </h1>

          {theme.layout.professionalTitle && (
            <div
              className="font-bold tracking-wide mt-1 mb-1"
              style={{
                fontSize: currentSizes.heading,
                color: theme.colors.secondary,
              }}
            >
              {theme.layout.professionalTitle}
            </div>
          )}

          <div
            className="mt-1 font-medium"
            style={{
              fontSize: currentSizes.meta,
              color: theme.colors.secondary,
            }}
          >
            {[resume.email, resume.phone, resume.location]
              .filter(Boolean)
              .join("  |  ")}
          </div>

          {resume.links && (
            <div
              className="mt-1 font-medium space-x-2"
              style={{ fontSize: currentSizes.meta }}
            >
              {renderLinksRow()}
            </div>
          )}
        </div>
      );
    };

    const renderSection = (sectionKey: ResumeThemeConfig["layout"]["sectionOrder"][number]) => {
      if (theme.layout.hiddenSections?.includes(sectionKey)) return null;
      const sectionHeading = (
        theme.layout.customSectionTitles?.[sectionKey] ||
        SECTION_LABELS[sectionKey] ||
        sectionKey
      ).toUpperCase();

      switch (sectionKey) {
        case "summary":
          if (!resume.summary) return null;
          return (
            <div key="summary" className="mb-2.5">
              {renderSectionHeading(sectionHeading)}
              <p
                className="text-justify"
                style={{ fontSize: currentSizes.body }}
              >
                {resume.summary}
              </p>
            </div>
          );

        case "skills":
          if (!resume.skills || resume.skills.length === 0) return null;
          return (
            <div key="skills" className="mb-2.5">
              {renderSectionHeading(sectionHeading)}
              {theme.layout.skillsLayout === "inline_wrap" ? (
                <p style={{ fontSize: currentSizes.body }}>
                  {resume.skills.join("  •  ")}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                  {resume.skills.map((skill, i) => (
                    <div
                      key={i}
                      className="truncate"
                      style={{ fontSize: currentSizes.body }}
                    >
                      • {skill}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );

        case "experience":
          if (!resume.experience || resume.experience.length === 0) return null;
          return (
            <div key="experience" className="mb-2.5">
              {renderSectionHeading(sectionHeading)}
              <div className="space-y-2">
                {resume.experience.map((exp, idx) => (
                  <div key={idx} className="break-inside-avoid">
                    <div className="flex items-center justify-between">
                      <span
                        className="font-bold"
                        style={{
                          fontSize: currentSizes.body,
                          color: theme.colors.primary,
                        }}
                      >
                        {exp.job_title}
                      </span>
                      <span
                        className="italic"
                        style={{
                          fontSize: currentSizes.meta,
                          color: theme.colors.light,
                        }}
                      >
                        {exp.start_date} - {exp.end_date || "Present"}
                      </span>
                    </div>
                    <div
                      className="font-semibold"
                      style={{
                        fontSize: currentSizes.body,
                        color: theme.colors.secondary,
                      }}
                    >
                      {[exp.company, exp.location].filter(Boolean).join(" | ")}
                    </div>
                    {exp.description && (
                      <ul className="list-disc ml-4 mt-0.5 space-y-0.5">
                        {exp.description.split("\n").map((line, lIdx) => {
                          const text = line.replace(/^[•\-]\s*/, "");
                          if (!text.trim()) return null;
                          return (
                            <li
                              key={lIdx}
                              style={{ fontSize: currentSizes.body }}
                            >
                              {text}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );

        case "education":
          if (!resume.education || resume.education.length === 0) return null;
          return (
            <div key="education" className="mb-2.5">
              {renderSectionHeading(sectionHeading)}
              <div className="space-y-1.5">
                {resume.education.map((edu, idx) => (
                  <div key={idx} className="break-inside-avoid">
                    <div className="flex items-center justify-between">
                      <span
                        className="font-bold"
                        style={{
                          fontSize: currentSizes.body,
                          color: theme.colors.text,
                        }}
                      >
                        {edu.degree}
                        {edu.field_of_study ? `, ${edu.field_of_study}` : ""}
                      </span>
                      <span
                        className="italic"
                        style={{
                          fontSize: currentSizes.meta,
                          color: theme.colors.light,
                        }}
                      >
                        {edu.start_year && edu.end_year
                          ? `${edu.start_year} - ${edu.end_year}`
                          : edu.end_year || ""}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: currentSizes.body,
                        color: theme.colors.secondary,
                      }}
                    >
                      {edu.institution}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );

        case "projects":
          if (!resume.projects || resume.projects.length === 0) return null;
          return (
            <div key="projects" className="mb-2.5">
              {renderSectionHeading(sectionHeading)}
              <div className="space-y-1.5">
                {resume.projects.map((proj, idx) => (
                  <div key={idx} className="break-inside-avoid">
                    <div
                      className="font-bold"
                      style={{
                        fontSize: currentSizes.body,
                        color: theme.colors.primary,
                      }}
                    >
                      {proj.name}
                    </div>
                    {proj.technologies && proj.technologies.length > 0 && (
                      <div
                        className="italic"
                        style={{
                          fontSize: currentSizes.meta,
                          color: theme.colors.light,
                        }}
                      >
                        Technologies: {proj.technologies.join(", ")}
                      </div>
                    )}
                    {proj.description && (
                      <p
                        className="mt-0.5"
                        style={{ fontSize: currentSizes.body }}
                      >
                        {proj.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );

        case "certifications":
          if (!resume.certifications || resume.certifications.length === 0)
            return null;
          return (
            <div key="certifications" className="mb-2.5">
              {renderSectionHeading(sectionHeading)}
              <div className="space-y-1">
                {resume.certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-baseline break-inside-avoid"
                  >
                    <div>
                      <span
                        className="font-bold"
                        style={{ fontSize: currentSizes.body }}
                      >
                        {cert.name}
                      </span>
                      {cert.issuer && (
                        <span
                          className="ml-2"
                          style={{
                            fontSize: currentSizes.meta,
                            color: theme.colors.secondary,
                          }}
                        >
                          ({cert.issuer})
                        </span>
                      )}
                    </div>
                    {cert.year && (
                      <span
                        className="italic"
                        style={{
                          fontSize: currentSizes.meta,
                          color: theme.colors.light,
                        }}
                      >
                        {cert.year}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );

        case "languages": {
          const validLangs = (resume.languages || []).filter((l) =>
            isRealValue(l)
          );
          if (validLangs.length === 0) return null;
          return (
            <div key="languages" className="mb-2.5 break-inside-avoid">
              {renderSectionHeading(sectionHeading)}
              <p style={{ fontSize: currentSizes.body }}>
                {validLangs.join(", ")}
              </p>
            </div>
          );
        }

        default:
          return null;
      }
    };

    return (
      <div
        ref={ref}
        className="bg-white shadow-2xl rounded-sm w-[612px] max-w-full min-h-[792px] h-fit shrink-0 transition-all duration-200 relative mb-8"
        style={{
          fontFamily: getPreviewFontFamily(theme.typography.fontFamily),
          padding: getPreviewPadding(theme.layout.margins),
          lineHeight: getPreviewLineSpacing(theme.typography.lineSpacing),
          color: theme.colors.text,
        }}
      >
        {/* Visual Page 1 End Marker (US Letter 8.5" x 11" exact 792px cutoff) */}
        <div
          className="absolute left-0 right-0 pointer-events-none select-none flex items-center justify-center z-10"
          style={{ top: "792px" }}
        >
          <div className="w-full border-b-2 border-dashed border-rose-300 relative">
            <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-xs tracking-wider uppercase">
              Page 1 End (8.5&quot; &times; 11&quot;) &bull; Content below prints
              on Page 2
            </span>
          </div>
        </div>

        {renderHeader()}

        {theme.layout.sectionOrder.map((sectionKey) => renderSection(sectionKey))}
      </div>
    );
  }
);

export default ResumePreviewCanvas;
