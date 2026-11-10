import { Suspense } from "react";
import { getAppSettings } from "@/lib/supabase/queries";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [initialSettings, params] = await Promise.all([
    getAppSettings(),
    searchParams,
  ]);
  const rawTab = params?.tab;
  const initialTab = typeof rawTab === "string" ? rawTab : undefined;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={null}>
        <SettingsClient
          initialSettings={initialSettings}
          initialTab={initialTab}
        />
      </Suspense>
    </div>
  );
}
