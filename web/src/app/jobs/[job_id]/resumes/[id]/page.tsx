import CustomPdfViewer from "@/components/CustomPdfViewer";
import { getCustomizedResumeById } from "@/lib/supabase/queries";
import { getSignedUrl } from "@/lib/supabase/storage";
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

    let signedUrl = "";
    let downloadFileName = "";
    if (resume_data.resume_link) {
      // The resume_link now stores the file name, e.g., 'resume_123.pdf'
      // These are stored in 'personalized_resumes' bucket.
      const storagePath = resume_data.resume_link;
      downloadFileName = storagePath.split("/").pop() || "";
      try {
        signedUrl = await getSignedUrl(storagePath);
      } catch (err) {
        console.error("Failed to get signed URL for resume:", err);
      }
    } else if (resume_data.name) {
      downloadFileName = `${resume_data.name.trim().replace(/\s+/g, "_")}_resume.pdf`;
    }

    return (
      <CustomPdfViewer
        fileUrl={signedUrl}
        jobId={job_id}
        resumeId={id}
        fileName={downloadFileName}
      />
    );
  } catch (error) {
    console.error("Error getting resume:", error);
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
