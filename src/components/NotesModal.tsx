'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageSquare, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { JobItem, JobStatus, UserJobTracking } from '@/types/job';
import { StatusDropdown } from './StatusDropdown';
import { ReviewBadge } from './ReviewBadge';

interface NotesModalProps {
  job: JobItem | null;
  trackingItem?: UserJobTracking;
  isOpen: boolean;
  onClose: () => void;
  onSave: (jobId: string, updated: UserJobTracking) => void;
}

export const NotesModal: React.FC<NotesModalProps> = ({
  job,
  trackingItem,
  isOpen,
  onClose,
  onSave,
}) => {
  const [comments, setComments] = useState('');
  const [status, setStatus] = useState<JobStatus>('Not Applied');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  useEffect(() => {
    if (job) {
      setComments(trackingItem?.comments || '');
      setStatus(trackingItem?.status || 'Not Applied');
    }
  }, [job, trackingItem]);

  if (!isOpen || !job) return null;

  const handleSave = () => {
    let appliedDate: string | undefined = trackingItem?.appliedDate || undefined;
    if (status === 'Applied') {
      appliedDate = trackingItem?.appliedDate || new Date().toISOString();
    } else if (status === 'Not Applied') {
      appliedDate = undefined;
    }

    onSave(job.id, {
      status,
      comments,
      appliedDate,
      updatedAt: new Date().toISOString(),
    });

    setIsSavedNotice(true);
    setTimeout(() => {
      setIsSavedNotice(false);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-start justify-between bg-slate-50/70">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                #{job.rank}
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                {job.company}
              </h3>
              {status === 'Review' && (
                <ReviewBadge size="xs" />
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">{job.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          
          {/* Quick Details Bar */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Location & Mode</span>
              <span className="text-slate-700 font-medium">{job.location} • {job.workMode}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Salary / CTC</span>
              <span className="text-emerald-700 font-medium font-mono">{job.salary}</span>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Application Status
            </label>
            <StatusDropdown currentStatus={status} onChange={setStatus} className="w-full" />
          </div>

          {/* Comments / Notes Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                Notes & Recruiter Follow-up
              </label>
              <span className="text-[11px] text-slate-400">Auto-saved to Supabase</span>
            </div>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="e.g. Applied on LinkedIn. Sent message to recruiter Rohit. Technical assessment due next Monday."
              className="w-full p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition leading-relaxed shadow-2xs"
            />
          </div>

          {/* Alignment & Flag Note */}
          {job.notes && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Scraped Notes & Match Details:
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {job.notes.replace(/<[^>]*>?/gm, '')}
              </p>
            </div>
          )}

          {/* Direct Apply Link */}
          <div className="pt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">Source: {job.source}</span>
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline font-medium"
            >
              Open Application Page <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {trackingItem?.updatedAt ? `Last saved: ${new Date(trackingItem.updatedAt).toLocaleTimeString()}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm flex items-center gap-1.5"
            >
              {isSavedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Notes</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
