import CustomPdfViewer from "@/components/CustomPdfViewer";
import { getCustomizedResumeById } from "@/lib/supabase/queries";
import { Resume } from "@/types";
import { notFound } from "next/navigation";

type Params = {
  params: Promise<{ job_id: string; id: string }>;
};

export default async function ResumeView({ params }: Params) {
  const { job_id, id } = await params;

  try {
    const resume_data: Resume | null = await getCustomizedResumeById(id);

    if (!resume_data) return notFound();

    // Stream on-the-fly dynamically via PDFKit (no Supabase Storage bucket needed)
    const streamingPdfUrl = `/api/customized_resumes/${id}/pdf`;
    const rawName = resume_data.name?.trim().replace(/\s+/g, "_") || "resume";
    const downloadFileName = `${rawName}_resume.pdf`;

    return (
      <CustomPdfViewer
        fileUrl={streamingPdfUrl}
        jobId={job_id}
        resumeId={id}
        fileName={downloadFileName}
      />
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
