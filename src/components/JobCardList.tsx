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
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
}

export const JobCardList: React.FC<JobCardListProps> = ({
  jobs,
  tracking,
  onUpdateStatus,
  onOpenNotes,
  onAutoApply,
  hasMore,
  isLoadingMore,
  onLoadMore,
  totalCount,
}) => {
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' }
    );
    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

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
        const isNoLink = userTrack.status === 'No link' || !job.applyUrl;

        return (
          <div
            key={job.id}
            className="p-3.5 rounded-xl bg-white border border-[rgba(17,24,39,0.08)] space-y-2.5"
          >
            {/* Top row: Company & Date Posted */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
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

                {/* Job Title as Hyperlink */}
                {isNoLink ? (
                  <h4 className="text-xs font-normal text-[#4b5565] mt-0.5">
                    {job.title}
                  </h4>
                ) : (
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[#111827] hover:text-[#2563eb] mt-0.5 inline-flex items-center gap-1 transition-colors hover:underline underline-offset-2 group/title"
                    title={`Open job posting for ${job.title} at ${job.company}`}
                  >
                    <span>{job.title}</span>
                    <ExternalLink className="w-3 h-3 text-[#9ca3af] group-hover/title:text-[#2563eb] transition-colors shrink-0" />
                  </a>
                )}
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
                <MapPin className="w-3 h-3 text-[#9ca3af] shrink-0" />
                {job.location} • {job.workMode}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white text-[#6b7487] border border-[rgba(17,24,39,0.08)] font-mono text-[10px]">
                {job.experience}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#f5f7fa] text-[#111827] font-mono text-[10px] tabular-nums">
                {job.salary}
              </span>
            </div>

            {/* Bottom Controls: Status, Direct Link, Notes, Automation */}
            <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <StatusDropdown
                  currentStatus={userTrack.status}
                  onChange={(newStatus) => onUpdateStatus(job.id, newStatus)}
                  className="flex-1"
                />

                {/* Notes Button */}
                <button
                  onClick={() => onOpenNotes(job)}
                  className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                    hasComments 
                      ? 'bg-blue-50 text-[#2563eb] border-blue-200' 
                      : 'bg-white hover:bg-[#f5f7fa] text-[#4b5565] border-[rgba(17,24,39,0.08)]'
                  }`}
                  title="Add or edit notes"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
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
                {isNoLink ? (
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

            {/* Applied Date Banner */}
            {userTrack.status === 'Applied' && userTrack.appliedDate && (
              <div className="text-[10px] text-[#6b7487] font-mono tabular-nums pt-0.5">
                Applied on {new Date(userTrack.appliedDate).toLocaleDateString()}
              </div>
            )}
          </div>
        );
      })}

      {/* Mobile Lazy Load Sentinel */}
      {hasMore && (
        <div 
          ref={sentinelRef}
          className="p-3 text-center bg-white rounded-xl border border-[rgba(17,24,39,0.08)]"
        >
          <button
            onClick={onLoadMore}
            className="w-full text-xs font-medium text-[#2563eb] hover:text-[#1d4ed8] bg-[#f8fafc] border border-[rgba(17,24,39,0.12)] py-2 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {isLoadingMore ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[#2563eb] animate-ping" />
                <span>Loading more roles...</span>
              </>
            ) : (
              <span>Load more roles ({jobs.length} of {totalCount || 'many'})</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
