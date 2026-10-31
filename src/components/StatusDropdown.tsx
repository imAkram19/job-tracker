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
  const getStatusDot = (status: JobStatus) => {
    switch (status) {
      case 'Offer':
        return 'bg-[#16a34a]';
      case 'Interviewing':
        return 'bg-[#2563eb]';
      case 'Applied':
        return 'bg-[#2563eb]';
      case 'Review':
        return 'bg-[#d97706]';
      case 'Rejected':
        return 'bg-[#dc2626]';
      case 'Archived':
      case 'No link':
        return 'bg-[#9ca3af]';
      case 'Not Applied':
      default:
        return 'bg-[#cbd5e1]';
    }
  };

  const dotColor = getStatusDot(currentStatus);

  return (
    <div className={`relative inline-block ${className}`}>
      <div className="relative flex items-center">
        {/* Crisp status dot */}
        <span 
          className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none ${dotColor}`} 
        />
        
        <select
          value={currentStatus}
          onChange={(e) => onChange(e.target.value as JobStatus)}
          className="w-full appearance-none pl-6 pr-6 h-7 rounded-md text-xs font-normal text-[#111827] bg-white hover:bg-[#f5f7fa] border border-[rgba(17,24,39,0.08)] cursor-pointer focus:outline-none focus:border-[#2563eb] transition-colors"
        >
          <option value="Not Applied">Not applied</option>
          <option value="Review">Review</option>
          <option value="Applied">Applied</option>
          <option value="Interviewing">Interviewing</option>
          <option value="Offer">Offer</option>
          <option value="Rejected">Rejected</option>
          <option value="No link">No link</option>
          <option value="Archived">Archived</option>
        </select>
        
        <ChevronDown className="w-3 h-3 text-[#6b7487] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
};
