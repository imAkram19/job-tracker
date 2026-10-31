'use client';

import React from 'react';
import { 
  ExternalLink, 
  Clock, 
  MapPin, 
  Bot
} from 'lucide-react';
import { JobItem, JobStatus, TrackingState } from '@/types/job';
import { StatusDropdown } from './StatusDropdown';
import { ReviewBadge } from './ReviewBadge';
import { formatRelativeDate } from '@/lib/utils';

interface JobTableProps {
  jobs: JobItem[];
  tracking: TrackingState;
  onUpdateStatus: (jobId: string, status: JobStatus) => void;
  onOpenNotes: (job: JobItem) => void;
  onAutoApply?: (job: JobItem) => void;
}

export const JobTable: React.FC<JobTableProps> = ({
  jobs,
  tracking,
  onUpdateStatus,
  onOpenNotes,
  onAutoApply,
}) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 px-4 rounded-xl bg-white border border-[rgba(17,24,39,0.08)]">
        <p className="text-sm font-medium text-[#111827]">No matching roles found</p>
        <p className="text-xs text-[#6b7487] mt-1">Try adjusting your search terms or filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[rgba(17,24,39,0.08)] bg-white">
      <table className="w-full text-left border-collapse text-xs" suppressHydrationWarning>
        
        {/* Table Head: Sentence case, calm neutral, no uppercase tracking */}
        <thead>
          <tr className="border-b border-[rgba(17,24,39,0.08)] bg-[#f8fafc] text-[#4b5565] font-normal text-xs">
            <th className="py-2.5 px-4 min-w-[200px]">Company and date</th>
            <th className="py-2.5 px-4 min-w-[280px]">Role and domain</th>
            <th className="py-2.5 px-4 min-w-[130px]">Compensation</th>
            <th className="py-2.5 px-4 min-w-[210px]">Status and actions</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-[rgba(17,24,39,0.06)] text-[#111827]" suppressHydrationWarning>
          {jobs.map((job) => {
            const userTrack = tracking[job.id] || {
              status: 'Not Applied',
              comments: '',
            };

            return (
              <tr 
                key={job.id} 
                className="hover:bg-[#fbfcfd] transition-colors group"
              >
                {/* 1. Company & Date Posted */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-[#111827] text-xs leading-snug">
                      {job.company}
                    </span>
                    {userTrack.status === 'Review' && (
                      <ReviewBadge size="xs" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#6b7487]">
                    <span className="inline-flex items-center gap-1 text-[11px] font-normal">
                      <Clock className="w-3 h-3 text-[#6b7487]" />
                      {formatRelativeDate(job.datePosted)}
                    </span>
                    <span className="text-[#9ca3af] font-mono text-[10px] tabular-nums">
                      • {job.datePosted}
                    </span>
                  </div>
                </td>

                {/* 2. Role & Domain */}
                <td className="py-3 px-4">
                  <div className="font-normal text-[#111827] text-xs leading-snug">
                    {job.title}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {/* Domain badge */}
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-normal bg-[#f5f7fa] text-[#4b5565] border border-[rgba(17,24,39,0.08)]">
                      {job.category}
                    </span>

                    {/* Location & Mode */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6b7487] font-normal">
                      <MapPin className="w-3 h-3 text-[#9ca3af] shrink-0" />
                      {job.location} • {job.workMode}
                    </span>

                    {/* Experience indicator */}
                    <span className="text-[10px] text-[#6b7487] font-mono bg-white px-1.5 py-0.5 rounded border border-[rgba(17,24,39,0.08)]">
                      {job.experience}
                    </span>
                  </div>
                </td>

                {/* 3. Salary / CTC */}
                <td className="py-3 px-4">
                  <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-normal font-mono bg-[#f5f7fa] text-[#111827] border border-[rgba(17,24,39,0.08)] tabular-nums">
                    {job.salary}
                  </span>
                </td>

                {/* 4. Your Status & Apply Link */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <StatusDropdown
                      currentStatus={userTrack.status}
                      onChange={(newStatus) => onUpdateStatus(job.id, newStatus)}
                      className="min-w-[125px]"
                    />
                    
                    {/* Automation Trigger for this specific job */}
                    {onAutoApply && userTrack.status !== 'No link' && (
                      <button
                        onClick={() => onAutoApply(job)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition-colors shrink-0"
                        title="Auto-fill this application with Playwright"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Auto fill</span>
                      </button>
                    )}

                    {/* Direct Apply Button */}
                    {userTrack.status === 'No link' ? (
                      <span className="inline-flex items-center h-7 px-2 rounded-md text-xs text-[#6b7487] bg-[#f5f7fa] border border-[rgba(17,24,39,0.08)] shrink-0">
                        No link
                      </span>
                    ) : (
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white hover:bg-[#f5f7fa] text-[#4b5565] hover:text-[#111827] border border-[rgba(17,24,39,0.08)] transition-colors shrink-0"
                        title="Open job link in new tab"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  
                  {userTrack.status === 'Applied' && userTrack.appliedDate && (
                    <span className="text-[10px] text-[#6b7487] block mt-1 font-mono tabular-nums">
                      Applied {new Date(userTrack.appliedDate).toLocaleDateString()}
                    </span>
                  )}
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
