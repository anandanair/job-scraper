import { Suspense } from "react";
import TailoredResumeStudio from "@/components/jobs/TailoredResumeStudio";
import {
  getCustomizedResumeById,
  getActiveResumeStyle,
  getAllResumeStyles,
} from "@/lib/supabase/queries";
import { DEFAULT_THEME_CONFIG } from "@/lib/resume-presets";
import { notFound } from "next/navigation";

type Params = {
  params: Promise<{ job_id: string; id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ResumeView({ params }: Params) {
  const { job_id, id } = await params;

  try {
    const resume_data = await getCustomizedResumeById(id);

    if (!resume_data) return notFound();

    // Theme priority: this resume's own snapshot -> active global style -> default
    const [activeStyle, allPresets] = await Promise.all([
      getActiveResumeStyle(),
      getAllResumeStyles(),
    ]);
    const themeConfig =
      resume_data.theme_config || activeStyle || DEFAULT_THEME_CONFIG;

    const rawName = resume_data.name?.trim().replace(/\s+/g, "_") || "resume";
    const downloadFileName = `${rawName}_resume.pdf`;

    return (
      <Suspense fallback={null}>
        <TailoredResumeStudio
          jobId={job_id}
          resumeId={id}
          initialResume={resume_data}
          initialThemeConfig={themeConfig}
          savedPresets={allPresets}
          fileName={downloadFileName}
        />
      </Suspense>
    );
  } catch (error) {
    console.error("Error getting customized resume:", error);
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-xl font-bold text-red-500">Error Loading Resume</h1>
        <p className="text-gray-600">Please try again later.</p>
      </div>
    </div>
  );
}
