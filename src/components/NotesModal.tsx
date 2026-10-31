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
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div 
        className="w-full max-w-lg rounded-xl bg-white border border-[rgba(17,24,39,0.08)] shadow-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[rgba(17,24,39,0.08)] flex items-start justify-between bg-white">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#f5f7fa] text-[#4b5565] border border-[rgba(17,24,39,0.08)] font-mono tabular-nums">
                #{job.rank}
              </span>
              <h3 className="text-sm font-semibold text-[#111827]">
                {job.company}
              </h3>
              {status === 'Review' && (
                <ReviewBadge size="xs" />
              )}
            </div>
            <p className="text-xs text-[#6b7487]">{job.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#6b7487] hover:text-[#111827] hover:bg-[#f5f7fa] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          
          {/* Quick Details Bar */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-[#f8fafc] border border-[rgba(17,24,39,0.08)] text-xs">
            <div>
              <span className="text-[#6b7487] block text-[11px]">Location and mode</span>
              <span className="text-[#111827] font-normal">{job.location} • {job.workMode}</span>
            </div>
            <div>
              <span className="text-[#6b7487] block text-[11px]">Compensation</span>
              <span className="text-[#111827] font-mono tabular-nums">{job.salary}</span>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-normal text-[#4b5565] mb-1.5">
              Application status
            </label>
            <StatusDropdown currentStatus={status} onChange={setStatus} className="w-full" />
          </div>

          {/* Comments / Notes Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-normal text-[#4b5565] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#6b7487]" />
                Notes and recruiter follow-up
              </label>
              <span className="text-[11px] text-[#6b7487] font-mono">Syncs to database</span>
            </div>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="e.g. Applied via career portal. Sent message to hiring lead. Technical assessment due next Monday"
              className="w-full p-2.5 rounded-lg bg-white border border-[rgba(17,24,39,0.08)] text-xs text-[#111827] placeholder-[#6b7487] focus:outline-none focus:border-[#2563eb] transition-colors leading-relaxed"
            />
          </div>

          {/* Alignment & Flag Note */}
          {job.notes && (
            <div className="p-3 rounded-lg bg-[#f8fafc] border border-[rgba(17,24,39,0.08)]">
              <span className="text-[10px] text-[#6b7487] block mb-1">
                Role details and scraped match
              </span>
              <p className="text-xs text-[#4b5565] leading-relaxed">
                {job.notes.replace(/<[^>]*>?/gm, '')}
              </p>
            </div>
          )}

          {/* Direct Apply Link */}
          <div className="pt-1 flex items-center justify-between text-xs">
            <span className="text-[#6b7487]">Source: {job.source}</span>
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#2563eb] hover:underline font-normal"
            >
              Open application portal <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgba(17,24,39,0.08)] bg-white flex items-center justify-between">
          <span className="text-[11px] text-[#6b7487] font-mono tabular-nums">
            {trackingItem?.updatedAt ? `Last saved: ${new Date(trackingItem.updatedAt).toLocaleTimeString()}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-8 px-3 rounded-lg text-xs font-normal text-[#4b5565] hover:text-[#111827] hover:bg-[#f5f7fa] border border-[rgba(17,24,39,0.08)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="h-8 px-3.5 rounded-lg text-xs font-medium bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition-colors flex items-center gap-1.5"
            >
              {isSavedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save notes</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
