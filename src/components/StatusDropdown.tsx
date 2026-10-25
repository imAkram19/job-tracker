'use client';

import React from 'react';
import { JobStatus } from '@/types/job';
import { ChevronDown } from 'lucide-react';

interface StatusDropdownProps {
  currentStatus: JobStatus;
  onChange: (status: JobStatus) => void;
  className?: string;
}

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  currentStatus,
  onChange,
  className = '',
}) => {
  const getStatusConfig = (status: JobStatus) => {
    switch (status) {
      case 'Review':
        return {
          dot: 'bg-indigo-500 ring-indigo-100',
          style: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/70',
        };
      case 'Applied':
        return {
          dot: 'bg-blue-500 ring-blue-100',
          style: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/70',
        };
      case 'Interviewing':
        return {
          dot: 'bg-purple-500 ring-purple-100',
          style: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70',
        };
      case 'Offer':
        return {
          dot: 'bg-emerald-500 ring-emerald-100',
          style: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold hover:bg-emerald-100/70',
        };
      case 'Rejected':
        return {
          dot: 'bg-rose-500 ring-rose-100',
          style: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70',
        };
      case 'Archived':
        return {
          dot: 'bg-slate-400 ring-slate-100',
          style: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70',
        };
      case 'No link':
        return {
          dot: 'bg-slate-500 ring-slate-100',
          style: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200/70',
        };
      case 'Not Applied':
      default:
        return {
          dot: 'bg-amber-500 ring-amber-100',
          style: 'bg-amber-50/80 text-amber-800 border-amber-200 hover:bg-amber-100/70',
        };
    }
  };

  const config = getStatusConfig(currentStatus);

  return (
    <div className={`relative inline-block ${className}`}>
      <div className="relative flex items-center">
        {/* Status dot */}
        <span 
          className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ring-2 pointer-events-none transition-colors ${config.dot}`} 
        />
        
        <select
          value={currentStatus}
          onChange={(e) => onChange(e.target.value as JobStatus)}
          className={`w-full appearance-none pl-6 pr-7 py-1.5 rounded-lg text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition shadow-sm ${config.style}`}
        >
          <option value="Not Applied">Not Applied</option>
          <option value="Review">Review</option>
          <option value="No link">No link</option>
          <option value="Applied">Applied</option>
          <option value="Interviewing">Interviewing</option>
          <option value="Offer">Offer</option>
          <option value="Rejected">Rejected</option>
          <option value="Archived">Archived</option>
        </select>
        
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
};
