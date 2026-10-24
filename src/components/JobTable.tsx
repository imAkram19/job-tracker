'use client';

import React from 'react';
import { 
  ExternalLink, 
  MessageSquare, 
  Clock, 
  MapPin, 
  Briefcase, 
  Building2,
  CalendarDays
} from 'lucide-react';
import { JobItem, JobStatus, TrackingState } from '@/types/job';
import { StatusDropdown } from './StatusDropdown';
import { formatRelativeDate } from '@/lib/utils';

interface JobTableProps {
  jobs: JobItem[];
  tracking: TrackingState;
  onUpdateStatus: (jobId: string, status: JobStatus) => void;
  onOpenNotes: (job: JobItem) => void;
}

export const JobTable: React.FC<JobTableProps> = ({
  jobs,
  tracking,
  onUpdateStatus,
  onOpenNotes,
}) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 px-4 rounded-xl bg-white border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">No matching jobs found</p>
        <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms or filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        
        {/* Table Head */}
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
            <th className="py-3 px-4 w-10 text-center text-slate-400">#</th>
            <th className="py-3 px-4 min-w-[200px]">Company & Date Posted</th>
            <th className="py-3 px-4 min-w-[280px]">Role & Domain</th>
            <th className="py-3 px-4 min-w-[130px]">Salary / CTC</th>
            <th className="py-3 px-4 min-w-[210px]">Your Status & Link</th>
            <th className="py-3 px-4 min-w-[200px] text-right">Notes & Comments</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {jobs.map((job) => {
            const userTrack = tracking[job.id] || {
              status: 'Not Applied',
              comments: '',
            };

            const hasComments = Boolean(userTrack.comments && userTrack.comments.trim().length > 0);

            return (
              <tr 
                key={job.id} 
                className="hover:bg-slate-50/70 transition-colors group"
              >
                {/* 1. Rank */}
                <td className="py-3.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                  {job.rank}
                </td>

                {/* 2. Company & Date Posted (Merged column) */}
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-slate-900 text-[13px] group-hover:text-blue-600 transition-colors leading-snug">
                    {job.company}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] border border-blue-100">
                      <Clock className="w-2.5 h-2.5 text-blue-500" />
                      {formatRelativeDate(job.datePosted)}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {job.datePosted}
                    </span>
                  </div>
                </td>

                {/* 3. Role & Domain (Cleaner proper structure) */}
                <td className="py-3.5 px-4">
                  <div className="font-medium text-slate-900 text-[13px] leading-snug">
                    {job.title}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {/* Domain badge */}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {job.category}
                    </span>

                    {/* Location & Mode */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-normal">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      {job.location} • <span className="font-medium text-slate-600">{job.workMode}</span>
                    </span>

                    {/* Experience pill */}
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                      {job.experience}
                    </span>
                  </div>
                </td>

                {/* 4. Salary / CTC */}
                <td className="py-3.5 px-4">
                  <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-medium font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {job.salary}
                  </span>
                </td>

                {/* 5. Your Status & Apply Link (Moved together) */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <StatusDropdown
                      currentStatus={userTrack.status}
                      onChange={(newStatus) => onUpdateStatus(job.id, newStatus)}
                      className="min-w-[130px]"
                    />
                    
                    {/* Direct Apply Button */}
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm hover:shadow active:scale-95 shrink-0"
                      title="Open job application page in new tab"
                    >
                      <span>Apply</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  
                  {userTrack.status === 'Applied' && userTrack.appliedDate && (
                    <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                      Applied: {new Date(userTrack.appliedDate).toLocaleDateString()}
                    </span>
                  )}
                </td>

                {/* 6. Notes & Comments (LAST column) */}
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => onOpenNotes(job)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition max-w-[220px] text-left truncate ${
                      hasComments
                        ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                        : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800 hover:border-slate-300 shadow-sm'
                    }`}
                    title={userTrack.comments || "Click to add notes"}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                    <span className="truncate">
                      {hasComments ? userTrack.comments : '+ Add Note'}
                    </span>
                  </button>
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
