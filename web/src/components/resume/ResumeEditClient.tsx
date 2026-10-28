"use client";

import {
  Resume,
  Education,
  Experience,
  Project,
  Certification,
  Links,
} from "@/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, FormEvent } from "react";
import { Loader2, Save, X, FileText } from "lucide-react";
import { Toast } from "./ResumeFormUI";
import { ResumeFormFields } from "./ResumeFormFields";

interface ResumeEditProps {
  resumeData: Resume;
  job_id: string;
}

export default function ResumeEditClient({
  resumeData,
  job_id,
}: ResumeEditProps) {
  const [formData, setFormData] = useState<Resume>(resumeData);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setFormData(resumeData);
  }, [resumeData]);

  // --- Field change handlers for ResumeFormFields ---
  const updateField = (field: keyof Resume, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateNestedField = <T extends object>(
    section: keyof Resume,
    index: number,
    field: keyof T,
    value: string,
  ) => {
    setFormData((prev) => {
      const arr = [...(prev[section] as any[])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [section]: arr };
    });
  };

  const updateLinkField = (field: keyof Links, value: string) => {
    setFormData((prev) => ({
      ...prev,
      links: { ...prev.links, [field]: value },
    }));
  };

  const addArrayItem = (section: keyof Resume, template: object) => {
    setFormData((prev) => ({
      ...prev,
      [section]: [...(prev[section] as any[]), template],
    }));
  };

  const removeArrayItem = (section: keyof Resume, index: number) => {
    setFormData((prev) => {
      const arr = [...(prev[section] as any[])];
      arr.splice(index, 1);
      return { ...prev, [section]: arr };
    });
  };

  // --- PDF generation and Upload logic ---
  async function generateResumePdf(resumeDataForPdf: Resume) {
    const {
      id,
      created_at,
      parsed_at,
      last_updated,
      resume_link,
      ...cleanedResumeDataForPdf
    } = resumeDataForPdf;

    try {
      // Generate PDF using local API route
      const pdfResponse = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedResumeDataForPdf),
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json().catch(() => ({
          error: "PDF generation failed",
        }));
        throw new Error(
          errorData.error || `Failed to generate PDF: ${pdfResponse.status}`,
        );
      }

      // Get the PDF blob from the response
      const pdfBlob = await pdfResponse.blob();

      // Convert blob to File (for Supabase upload)
      const fileName = `resume_${job_id}.pdf`;
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      // Upload the file using the existing API endpoint
      const formDataToUpload = new FormData();
      formDataToUpload.append("file", file);
      formDataToUpload.append("fileName", fileName);

      const uploadResponse = await fetch(`/api/customized_resumes/${id}/`, {
        method: "POST",
        body: formDataToUpload,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({
          error: "Upload failed with no JSON response",
          details: `HTTP status: ${uploadResponse.status}`,
        }));
        throw new Error(
          errorData.error || `Failed to upload PDF: ${errorData.details}`,
        );
      }

      const { fileName: uploadedFileName } = await uploadResponse.json();
      return uploadedFileName;
    } catch (error) {
      console.error("Error generating/uploading PDF:", error);
      throw error;
    }
  }

  // --- Save Logic ---
  const handleSave = async () => {
    setIsSaving(true);
    setToast(null);

    const { id, created_at, parsed_at, ...updateData } = formData;
    const finalUpdateData = { ...updateData };

    // Parse JSON strings to objects if necessary
    (
      Object.keys(finalUpdateData) as Array<keyof typeof finalUpdateData>
    ).forEach((key) => {
      if (typeof finalUpdateData[key] === "string") {
        if (
          [
            "skills",
            "education",
            "experience",
            "projects",
            "certifications",
            "languages",
            "links",
          ].includes(key)
        ) {
          try {
            (finalUpdateData as any)[key] = JSON.parse(
              finalUpdateData[key] as string,
            );
          } catch (e) {
            // Ignore parse errors, keep as string
          }
        }
      }
    });

    try {
      // 1. Generate new PDF and upload it to Supabase Storage
      try {
        const generatedPdfUrl = await generateResumePdf(formData);
        if (generatedPdfUrl) {
          finalUpdateData.resume_link = generatedPdfUrl;
        }
      } catch (pdfError) {
        console.warn(
          "PDF generation/upload failed. Saving data only.",
          pdfError,
        );
        // Continue saving even if PDF generation fails.
      }

      // 2. Patch the database record
      const response = await fetch(`/api/customized_resumes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          finalUpdateData as Partial<
            Omit<Resume, "id" | "created_at" | "last_updated">
          >,
        ),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `HTTP error! status: ${response.status}`,
        );
      }

      const updatedResume: Resume = await response.json();
      if (updatedResume) {
        setFormData(updatedResume);
        setToast({ message: "Resume updated successfully!", type: "success" });
        // Navigate back to view page after a short delay so user sees toast
        setTimeout(() => {
          const params = searchParams.toString();
          const query = params ? `?${params}` : "";
          router.push(`/jobs/${job_id}/resumes/${id}${query}`);
        }, 1500);
      } else {
        throw new Error("Failed to update resume.");
      }
    } catch (err) {
      console.error("Error updating resume:", err);
      setToast({
        message:
          err instanceof Error ? err.message : "An unexpected error occurred",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const params = searchParams.toString();
    const query = params ? `?${params}` : "";
    router.push(`/jobs/${job_id}/resumes/${resumeData.id}${query}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 mt-8">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Edit Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-navy-600" />
            <h1 className="text-xl font-bold text-slate-900">
              Edit Custom Resume
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-navy-600 rounded-lg hover:bg-navy-700 transition-all shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-2">
          Editing this tailored resume will automatically generate a new PDF
          cover letter and save it to the job prospect.
        </p>
      </div>

      <ResumeFormFields
        formData={formData}
        updateField={updateField}
        updateNestedField={updateNestedField}
        updateLinkField={updateLinkField}
        addArrayItem={addArrayItem}
        removeArrayItem={removeArrayItem}
      />

      {/* Bottom action bar — fixed at bottom of viewport */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Changes are not saved until you click &quot;Save&quot;
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-navy-600 rounded-lg hover:bg-navy-700 transition-all shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
