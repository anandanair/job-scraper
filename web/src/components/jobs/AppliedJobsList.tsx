"use client";

import { useState } from "react";
import Link from "next/link";
import PaginationControls from "./PaginationControls";
import {
  ExternalLink,
  Calendar,
  Building,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  FileText,
  Briefcase,
  ChevronRight,
  Info, // <-- Add Info icon
} from "lucide-react";
import { Job } from "@/types";
import { useRouter } from "next/navigation";

// Status options for applied jobs
const JOB_STATUS_OPTIONS = [
  {
    value: "applied",
    label: "Applied",
    icon: CheckCircle2,
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    value: "interviewing",
    label: "Interviewing",
    icon: Calendar,
    color: "bg-purple-100 text-purple-800 border-purple-300",
  },
  {
    value: "offered",
    label: "Offered",
    icon: BadgeCheck,
    color: "bg-green-100 text-green-800 border-green-300",
  },
  {
    value: "rejected",
    label: "Rejected",
    icon: XCircle,
    color: "bg-red-100 text-red-800 border-red-300",
  },
];

interface AppliedJobsListProps {
  jobs: Job[];
  currentPage: number;
  totalPages: number;
}

export default function AppliedJobsList({
  jobs,
  currentPage,
  totalPages,
}: AppliedJobsListProps) {
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState<string | null>(null);
  const router = useRouter();

  const handleViewResume = (
    job_id: string,
    resume_id: string | null | undefined
  ) => {
    router.push(`/jobs/${job_id}/resumes/${resume_id}`);
  };

  const handleStatusChange = async (job: Job, newStatus: string) => {
    setUpdatingJobId(job.job_id);
    setIsStatusMenuOpen(null);

    try {
      const response = await fetch(`/api/jobs/${job.job_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      // Refresh the page to show updated jobs
      router.refresh();

      // Show toast
      showToast(`Job status updated to ${newStatus} successfully!`, "success");
    } catch (error) {
      console.error("Error updating job status:", error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    } finally {
      setUpdatingJobId(null);
    }
  };

  // Simple toast notification function (placeholder)
  const showToast = (message: string, type: "success" | "error") => {
    console.log(`Toast (${type}): ${message}`);
    if (type === "error") {
      alert(message);
    }
  };

  // Function to format date
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get status icon and color
  const getStatusInfo = (status: string) => {
    const statusOption = JOB_STATUS_OPTIONS.find(
      (option) => option.value === status
    );
    return statusOption || JOB_STATUS_OPTIONS[0]; // Default to applied if not found
  };

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      <div className="bg-gray-100 p-6 rounded-full mb-4">
        <Briefcase className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No applied jobs found
      </h3>
      <p className="text-gray-500 max-w-sm">
        You haven't applied to any jobs yet, or no applied jobs match your
        current filters.
      </p>
    </div>
  );

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden shadow-sm">
      {jobs.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {jobs.map((job) => {
            const statusInfo = getStatusInfo(job.status || "applied");
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={job.job_id}
                className="bg-white p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Job information */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {job.job_title}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Building className="h-4 w-4 mr-1.5" />
                        <span>{job.company}</span>
                      </div>
                      {job.location && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1.5" />
                          <span>{job.location}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1.5" />
                        <span>
                          Applied on {formatDate(job.application_date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center">
                    <div
                      className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}
                    >
                      <StatusIcon className="h-4 w-4 mr-1.5" />
                      {statusInfo.label}
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  {/* Left side actions */}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/jobs/${job.job_id}`} // <-- Changed: Link to job details page
                      className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <Info size={14} className="mr-1.5" /> {/* <-- Add Icon */}
                      View Details
                    </Link>
                    <Link
                      href={
                        job.provider === "careers_future"
                          ? `https://www.mycareersfuture.gov.sg/job/${job.job_id}`
                          : `https://www.linkedin.com/jobs/view/${job.job_id}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                    >
                      View Job Posting {/* <-- Changed text for clarity */}
                      <ExternalLink size={14} className="ml-1.5" />
                    </Link>

                    {job.customized_resume_id && (
                      <button
                        onClick={() =>
                          handleViewResume(job.job_id, job.customized_resume_id)
                        }
                        className="inline-flex cursor-pointer items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <FileText size={14} className="mr-1.5" />
                        View Resume
                      </button>
                    )}
                  </div>

                  {/* Status dropdown */}
                  <div className="relative">
                    <button
                      disabled={updatingJobId === job.job_id}
                      onClick={() =>
                        setIsStatusMenuOpen(
                          isStatusMenuOpen === job.job_id ? null : job.job_id
                        )
                      }
                      className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {updatingJobId === job.job_id ? (
                        "Updating..."
                      ) : (
                        <>
                          Update Status
                          <ChevronRight
                            size={16}
                            className={`ml-1.5 transition-transform duration-200 ${
                              isStatusMenuOpen === job.job_id ? "rotate-90" : ""
                            }`}
                          />
                        </>
                      )}
                    </button>

                    {/* Status dropdown menu */}
                    {isStatusMenuOpen === job.job_id && (
                      <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 z-50">
                        <div className="py-1">
                          {JOB_STATUS_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            return (
                              <button
                                key={option.value}
                                onClick={() =>
                                  handleStatusChange(job, option.value)
                                }
                                className={`w-full text-left px-4 py-2 text-sm flex items-center hover:bg-gray-100 ${
                                  job.status === option.value
                                    ? "bg-gray-50 font-medium"
                                    : ""
                                }`}
                                disabled={job.status === option.value}
                              >
                                <Icon
                                  className={`h-4 w-4 mr-2 ${
                                    job.status === option.value
                                      ? "text-indigo-600"
                                      : "text-gray-500"
                                  }`}
                                />
                                {option.label}
                                {job.status === option.value && (
                                  <CheckCircle2 className="h-4 w-4 ml-auto text-indigo-600" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-5 border-t border-gray-100 bg-white">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
          />
        </div>
      )}
    </div>
  );
}
