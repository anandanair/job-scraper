import { redirect } from "next/navigation";

type Params = {
  params: Promise<{ job_id: string; id: string }>;
};

/**
 * The dedicated edit page was replaced by the inline Tailored Resume Studio
 * (toggleable editor sidebar on the resume view page). Keep this route as a
 * redirect so old bookmarks and links keep working.
 */
export default async function ResumeEditRedirect({ params }: Params) {
  const { job_id, id } = await params;
  redirect(`/jobs/${job_id}/resumes/${id}`);
}
