import { createSupabaseServerClient } from "@/utils/supabase/server";

/**
 * Generates a signed URL for a private file in Supabase Storage.
 * @param path The path to the file in the bucket (e.g., 'personalized_resumes/resume_123.pdf').
 * @param bucket The name of the Supabase Storage bucket. Defaults to 'resumes'.
 * @param expiresIn Time in seconds until the signed URL expires. Defaults to 3600 (1 hour).
 * @returns A promise that resolves to the signed URL string.
 * @throws Error if the signed URL generation fails.
 */
export async function getSignedUrl(
  path: string,
  bucket: string = "personalized_resumes",
  expiresIn: number = 3600
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error(`Error generating signed URL for ${path}:`, error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error("No signed URL returned from Supabase.");
  }

  return data.signedUrl;
}
