'use client';

import React from 'react';
import { 
  ExternalLink, 
  MessageSquare, 
  Clock, 
  MapPin,
  Bot
} from 'lucide-react';
import { JobItem, JobStatus, TrackingState } from '@/types/job';
import { StatusDropdown } from './StatusDropdown';
import { ReviewBadge } from './ReviewBadge';
import { formatRelativeDate } from '@/lib/utils';

interface JobCardListProps {
  jobs: JobItem[];
  tracking: TrackingState;
  onUpdateStatus: (jobId: string, status: JobStatus) => void;
  onOpenNotes: (job: JobItem) => void;
  onAutoApply?: (job: JobItem) => void;
}

export const JobCardList: React.FC<JobCardListProps> = ({
  jobs,
  tracking,
  onUpdateStatus,
  onOpenNotes,
  onAutoApply,
}) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-xl bg-white border border-[rgba(17,24,39,0.08)] text-[#6b7487]">
        No matching roles found.
      </div>
    );
  }

  return (
    <div className="space-y-2.5" suppressHydrationWarning>
      {jobs.map((job) => {
        const userTrack = tracking[job.id] || {
          status: 'Not Applied',
          comments: '',
        };

        const hasComments = Boolean(userTrack.comments && userTrack.comments.trim().length > 0);

        return (
          <div
            key={job.id}
            className="p-3.5 rounded-xl bg-white border border-[rgba(17,24,39,0.08)] space-y-2.5"
          >
            {/* Top row: Company & Date Posted */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f5f7fa] text-[#6b7487] border border-[rgba(17,24,39,0.08)] tabular-nums">
                    #{job.rank}
                  </span>
                  <h3 className="text-sm font-medium text-[#111827] leading-tight">
                    {job.company}
                  </h3>
                  {userTrack.status === 'Review' && (
                    <ReviewBadge size="xs" />
                  )}
                </div>
                <h4 className="text-xs font-normal text-[#4b5565] mt-0.5">
                  {job.title}
                </h4>
              </div>

              {/* Date Posted */}
              <div className="flex flex-col items-end shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] font-normal text-[#6b7487]">
                  <Clock className="w-3 h-3 text-[#6b7487]" />
                  {formatRelativeDate(job.datePosted)}
                </span>
                <span className="text-[10px] text-[#9ca3af] font-mono tabular-nums">
                  {job.datePosted}
                </span>
              </div>
            </div>

            {/* Badges: Category, Location, Salary */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-[#f5f7fa] text-[#4b5565] border border-[rgba(17,24,39,0.08)]">
                {job.category}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white text-[#6b7487] border border-[rgba(17,24,39,0.08)] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#9ca3af]" />
                {job.location} ({job.workMode})
              </span>
              <span className="px-2 py-0.5 rounded-md font-mono bg-[#f5f7fa] text-[#111827] border border-[rgba(17,24,39,0.08)] tabular-nums">
                {job.salary}
              </span>
            </div>

            {/* Notes preview if exists */}
            {hasComments && (
              <div 
                onClick={() => onOpenNotes(job)}
                className="p-2.5 rounded-lg bg-[#f8fafc] border border-[rgba(17,24,39,0.08)] text-xs cursor-pointer hover:bg-[#f1f5f9] transition-colors"
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-[#6b7487] mb-0.5">
                  <MessageSquare className="w-3 h-3" />
                  Notes
                </div>
                <p className="line-clamp-2 text-[11px] text-[#4b5565]">
                  {userTrack.comments}
                </p>
              </div>
            )}

            {/* Bottom Row: Status dropdown + Apply button + Note trigger */}
            <div className="pt-2 border-t border-[rgba(17,24,39,0.06)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <StatusDropdown
                  currentStatus={userTrack.status}
                  onChange={(newStatus) => onUpdateStatus(job.id, newStatus)}
                  className="flex-1"
                />

                <button
                  onClick={() => onOpenNotes(job)}
                  className={`h-7 w-7 rounded-md border flex items-center justify-center text-xs transition-colors ${
                    hasComments
                      ? 'bg-[#eceff4] text-[#111827] border-[rgba(17,24,39,0.16)]'
                      : 'bg-white text-[#6b7487] border-[rgba(17,24,39,0.08)] hover:bg-[#f5f7fa]'
                  }`}
                  title="Add or edit notes"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Automation Trigger for this specific job */}
              {onAutoApply && userTrack.status !== 'No link' && (
                <button
                  onClick={() => onAutoApply(job)}
                  className="h-7 px-2.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-xs flex items-center gap-1 shrink-0 transition-colors"
                  title="Auto-fill this application with Playwright"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Auto fill</span>
                </button>
              )}

              {/* Direct Apply Button */}
              {userTrack.status === 'No link' ? (
                <span className="h-7 px-2 rounded-md bg-[#f5f7fa] text-[#6b7487] border border-[rgba(17,24,39,0.08)] text-xs flex items-center shrink-0">
                  No link
                </span>
              ) : (
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 w-7 rounded-md bg-white hover:bg-[#f5f7fa] text-[#4b5565] border border-[rgba(17,24,39,0.08)] flex items-center justify-center transition-colors shrink-0"
                  title="Open job link in new tab"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
};
