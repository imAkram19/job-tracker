'use client';

import React from 'react';
import { JobItem, TrackingState } from '@/types/job';

interface StatsDashboardProps {
  jobs: JobItem[];
  tracking: TrackingState;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ jobs, tracking }) => {
  const totalJobs = jobs.length;
  const actionableJobs = jobs.filter((job) => {
    const status = tracking[job.id]?.status || 'Not Applied';
    return status !== 'No link' && status !== 'Archived';
  }).length;
  
  let appliedCount = 0;
  let interviewingCount = 0;
  let offerCount = 0;
  let notAppliedCount = 0;
  let reviewCount = 0;

  jobs.forEach(job => {
    const item = tracking[job.id];
    const status = item ? item.status : 'Not Applied';
    if (status === 'Applied') appliedCount++;
    else if (status === 'Interviewing') interviewingCount++;
    else if (status === 'Offer') offerCount++;
    else if (status === 'Review') reviewCount++;
    else if (status === 'Not Applied') notAppliedCount++;
  });

  const today = new Date();
  const freshJobsCount = jobs.filter(job => {
    try {
      const d = new Date(job.datePosted);
      const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 3;
    } catch {
      return false;
    }
  }).length;

  const targetDailyGoal = 5;
  const progressPercent = Math.min(Math.round((appliedCount / targetDailyGoal) * 100), 100);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-5">
      
      {/* 1. Total Openings */}
      <div className="p-4 rounded-xl bg-white border border-[rgba(17,24,39,0.08)]">
        <div className="text-xs font-normal text-[#6b7487] mb-1">Total Openings</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-[#111827] tabular-nums tracking-tight">
            {totalJobs}
          </span>
          <span className="text-xs text-[#16a34a] font-normal tabular-nums">
            +{freshJobsCount} new
          </span>
        </div>
        <div className="text-[11px] text-[#6b7487] mt-1">
          {actionableJobs} active roles across India
        </div>
      </div>

      {/* 2. Applications Sent (Primary Focus) */}
      <div className="p-4 rounded-xl bg-white border border-[rgba(17,24,39,0.08)]">
        <div className="text-xs font-normal text-[#6b7487] mb-1">Applications Sent</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-[#2563eb] tabular-nums tracking-tight">
            {appliedCount}
          </span>
          <span className="text-xs text-[#6b7487] tabular-nums">
            of {actionableJobs}
          </span>
        </div>
        <div className="mt-2 w-full bg-[#f5f7fa] h-1 rounded-full overflow-hidden">
          <div 
            className="bg-[#2563eb] h-full rounded-full transition-all duration-300" 
            style={{ width: `${Math.round((appliedCount / (actionableJobs || 1)) * 100)}%` }}
          />
        </div>
      </div>

      {/* 3. Pipeline Active (Interview / Offer) */}
      <div className="p-4 rounded-xl bg-white border border-[rgba(17,24,39,0.08)]">
        <div className="text-xs font-normal text-[#6b7487] mb-1">Active Pipeline</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-[#111827] tabular-nums tracking-tight">
            {interviewingCount + offerCount}
          </span>
          {offerCount > 0 && (
            <span className="text-xs text-[#16a34a] font-medium tabular-nums">
              {offerCount} offer
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#6b7487] mt-1 tabular-nums">
          {interviewingCount} in interview rounds
        </div>
      </div>

      {/* 4. Daily Cadence */}
      <div className="p-4 rounded-xl bg-white border border-[rgba(17,24,39,0.08)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-normal text-[#6b7487]">Daily Target</span>
          <span className="text-xs font-mono text-[#4b5565] tabular-nums">{progressPercent}%</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-[#111827] tabular-nums tracking-tight">
            {appliedCount}
          </span>
          <span className="text-xs text-[#6b7487] tabular-nums">
            of {targetDailyGoal} today
          </span>
        </div>
        <div className="mt-2 w-full bg-[#f5f7fa] h-1 rounded-full overflow-hidden">
          <div 
            className="bg-[#111827] h-full rounded-full transition-all duration-300" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

    </div>
  );
};
