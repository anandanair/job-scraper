import { getAppSettings } from "@/lib/supabase/queries";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const initialSettings = await getAppSettings();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SettingsClient initialSettings={initialSettings} />
    </div>
  );
}
