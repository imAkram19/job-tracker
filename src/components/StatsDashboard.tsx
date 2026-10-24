'use client';

import React from 'react';
import { 
  Send, 
  Sparkles, 
  Award, 
  Flame 
} from 'lucide-react';
import { JobItem, TrackingState } from '@/types/job';

interface StatsDashboardProps {
  jobs: JobItem[];
  tracking: TrackingState;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ jobs, tracking }) => {
  const totalJobs = jobs.length;
  
  let appliedCount = 0;
  let interviewingCount = 0;
  let offerCount = 0;
  let notAppliedCount = 0;

  jobs.forEach(job => {
    const item = tracking[job.id];
    const status = item ? item.status : 'Not Applied';
    if (status === 'Applied') appliedCount++;
    else if (status === 'Interviewing') interviewingCount++;
    else if (status === 'Offer') offerCount++;
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 my-5">
      
      {/* 1. Total Jobs */}
      <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500">Total Scraped Jobs</span>
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{totalJobs}</span>
          <span className="text-[11px] text-emerald-600 font-medium">
            +{freshJobsCount} fresh
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">Verified permanent roles</p>
      </div>

      {/* 2. Applications Sent */}
      <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500">Applications Sent</span>
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            <Send className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-blue-600">{appliedCount}</span>
          <span className="text-[11px] text-slate-400">/ {totalJobs} total</span>
        </div>
        <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.round((appliedCount / (totalJobs || 1)) * 100)}%` }}
          />
        </div>
      </div>

      {/* 3. In Interview / Offer */}
      <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500">Interview / Offer</span>
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Award className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-emerald-600">
            {interviewingCount + offerCount}
          </span>
          <span className="text-[11px] text-slate-500">
            ({interviewingCount} rounds, {offerCount} offers)
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">High conversion pipeline</p>
      </div>

      {/* 4. Daily Target Goal */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/70 to-slate-50 border border-blue-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Today's Target
          </span>
          <span className="text-xs font-bold text-blue-700">{progressPercent}%</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{appliedCount}</span>
          <span className="text-[11px] text-slate-500">of {targetDailyGoal} daily target</span>
        </div>
        <div className="mt-2 w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full rounded-full transition-all duration-500" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

    </div>
  );
};
