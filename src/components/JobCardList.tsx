'use client';

import React from 'react';
import { 
  ExternalLink, 
  MessageSquare, 
  Clock, 
  MapPin 
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
}

export const JobCardList: React.FC<JobCardListProps> = ({
  jobs,
  tracking,
  onUpdateStatus,
  onOpenNotes,
}) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-xl bg-white border border-slate-200 text-slate-500 shadow-sm">
        No matching jobs found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const userTrack = tracking[job.id] || {
          status: 'Not Applied',
          comments: '',
        };

        const hasComments = Boolean(userTrack.comments && userTrack.comments.trim().length > 0);

        return (
          <div
            key={job.id}
            className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3"
          >
            {/* Top row: Company & Date Posted in one row */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                    #{job.rank}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                    {job.company}
                  </h3>
                  {userTrack.status === 'Review' && (
                    <ReviewBadge size="xs" />
                  )}
                </div>
                <h4 className="text-xs font-medium text-slate-800 mt-1">
                  {job.title}
                </h4>
              </div>

              {/* Date Posted */}
              <div className="flex flex-col items-end shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  <Clock className="w-3 h-3 text-blue-500" />
                  {formatRelativeDate(job.datePosted)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {job.datePosted}
                </span>
              </div>
            </div>

            {/* Badges: Category, Location, Salary */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {userTrack.status === 'Review' && (
                <ReviewBadge size="xs" />
              )}
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                {job.category}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {job.location} ({job.workMode})
              </span>
              <span className="px-2 py-0.5 rounded font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                {job.salary}
              </span>
            </div>

            {/* Notes preview if exists */}
            {hasComments && (
              <div 
                onClick={() => onOpenNotes(job)}
                className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-xs text-blue-900 cursor-pointer hover:bg-blue-100/70 transition"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-0.5">
                  <MessageSquare className="w-3 h-3" />
                  Notes
                </div>
                <p className="line-clamp-2 text-[11px] text-slate-700">
                  {userTrack.comments}
                </p>
              </div>
            )}

            {/* Bottom Row: Status dropdown + Apply button + Note trigger */}
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <StatusDropdown
                  currentStatus={userTrack.status}
                  onChange={(newStatus) => onUpdateStatus(job.id, newStatus)}
                  className="flex-1"
                />

                <button
                  onClick={() => onOpenNotes(job)}
                  className={`p-2 rounded-lg border text-xs transition ${
                    hasComments
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Add or edit notes"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>

              {/* Direct Apply Button */}
              {userTrack.status === 'No link' ? (
                <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 font-medium text-xs shrink-0">
                  No link
                </span>
              ) : (
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition shadow-xs flex items-center gap-1 shrink-0 active:scale-95"
                >
                  <span>Apply</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
};
