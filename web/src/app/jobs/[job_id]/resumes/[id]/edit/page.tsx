import ResumeEditClient from "@/components/resume/ResumeEditClient";
import { getCustomizedResumeById } from "@/lib/supabase/queries";
import { Resume } from "@/types";
import { notFound } from "next/navigation";

type Params = {
  params: Promise<{ job_id: string; id: string }>;
};

export default async function ResumeEdit({ params }: Params) {
  const { job_id, id } = await params;

  try {
    const resume_data: Resume | null = await getCustomizedResumeById(id);

    if (!resume_data) return notFound();

    return <ResumeEditClient resumeData={resume_data} job_id={job_id} />;
  } catch (error) {
    console.error("Error getting resume:", error);
  }

  return <div>Resume Edit Page {id}</div>;
}
