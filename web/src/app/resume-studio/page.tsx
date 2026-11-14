import {
  getUserProfileByEmail,
  getActiveResumeStyle,
  getAllResumeStyles,
} from "@/lib/supabase/queries";
import ResumeStudioClient from "@/components/resume-studio/ResumeStudioClient";

export const dynamic = "force-dynamic";

interface ResumeStudioPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function ResumeStudioPage({
  searchParams,
}: ResumeStudioPageProps) {
  const [baseResume, activeStyle, allPresets, resolvedSearchParams] =
    await Promise.all([
      getUserProfileByEmail(),
      getActiveResumeStyle(),
      getAllResumeStyles(),
      searchParams ? searchParams : Promise.resolve({ tab: undefined }),
    ]);

  const defaultTab =
    resolvedSearchParams?.tab === "style" ? "style" : "content";

  return (
    <div className="max-w-[1720px] w-full mx-auto px-2 sm:px-4 flex flex-col h-[calc(100vh-165px)] overflow-hidden">
      <div className="mb-2 shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
          Resume Studio
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Master career vault and ATS resume design center
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ResumeStudioClient
          initialBaseResume={baseResume}
          initialThemeConfig={activeStyle}
          initialSavedSettings={allPresets}
          defaultTab={defaultTab}
        />
      </div>
    </div>
  );
}
