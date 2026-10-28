import { getAppSettings } from "@/lib/supabase/queries";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const initialSettings = await getAppSettings();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          System Settings & AI Configuration
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your AI provider, Gemini models, rate-limit safety tiers, and job search keywords.
          All settings are saved to your database and applied automatically to both the web studio and automated scrapers.
        </p>
      </div>

      <SettingsClient initialSettings={initialSettings} />
    </div>
  );
}
