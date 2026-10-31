'use client';

import React from 'react';

export const SkeletonStatsDashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-5">
      {[1, 2, 3, 4].map((i) => (
        <div 
          key={i} 
          className="p-4 rounded-xl bg-white border border-[rgba(17,24,39,0.08)] space-y-2 animate-pulse"
        >
          <div className="h-3 w-24 bg-[#e2e8f0] rounded" />
          <div className="flex items-baseline gap-2 pt-1">
            <div className="h-7 w-16 bg-[#cbd5e1] rounded" />
            <div className="h-3.5 w-12 bg-[#e2e8f0] rounded" />
          </div>
          <div className="h-2.5 w-32 bg-[#f1f5f9] rounded mt-2" />
        </div>
      ))}
    </div>
  );
};

export const SkeletonFilterControls: React.FC = () => {
  return (
    <div className="space-y-3 mb-4 animate-pulse">
      {/* Search Bar Skeleton */}
      <div className="h-10 w-full bg-white border border-[rgba(17,24,39,0.08)] rounded-xl" />
      
      {/* Pills Skeleton */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[80, 95, 75, 80, 90, 65, 75, 80, 70].map((width, idx) => (
          <div
            key={idx}
            className="h-7 rounded-lg bg-white border border-[rgba(17,24,39,0.08)] shrink-0"
            style={{ width: `${width}px` }}
          />
        ))}
      </div>
    </div>
  );
};

export const SkeletonJobTable: React.FC<{ rows?: number }> = ({ rows = 8 }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-[rgba(17,24,39,0.08)] bg-white">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-[rgba(17,24,39,0.08)] bg-[#f8fafc] text-[#4b5565] font-normal text-xs">
            <th className="py-2.5 px-4 min-w-[200px]">Company and date</th>
            <th className="py-2.5 px-4 min-w-[280px]">Role and domain</th>
            <th className="py-2.5 px-4 min-w-[130px]">Compensation</th>
            <th className="py-2.5 px-4 min-w-[210px]">Status and actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(17,24,39,0.06)] animate-pulse">
          {Array.from({ length: rows }).map((_, idx) => (
            <tr key={idx} className="hover:bg-[#fbfcfd]">
              {/* Col 1: Company & Date */}
              <td className="py-3 px-4">
                <div className="h-4 w-28 bg-[#cbd5e1] rounded" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-3 w-16 bg-[#e2e8f0] rounded" />
                  <div className="h-3 w-16 bg-[#f1f5f9] rounded" />
                </div>
              </td>

              {/* Col 2: Role & Domain */}
              <td className="py-3 px-4">
                <div className="h-4 w-52 bg-[#cbd5e1] rounded" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-5 w-24 bg-[#f1f5f9] border border-[rgba(17,24,39,0.08)] rounded-md" />
                  <div className="h-4 w-32 bg-[#e2e8f0] rounded" />
                  <div className="h-4 w-16 bg-[#f1f5f9] rounded" />
                </div>
              </td>

              {/* Col 3: Salary */}
              <td className="py-3 px-4">
                <div className="h-5 w-28 bg-[#f1f5f9] border border-[rgba(17,24,39,0.08)] rounded-md" />
              </td>

              {/* Col 4: Status & Actions */}
              <td className="py-3 px-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-7 w-[125px] bg-[#f1f5f9] border border-[rgba(17,24,39,0.08)] rounded-md" />
                  <div className="h-7 w-16 bg-[#e2e8f0] rounded-md" />
                  <div className="h-7 w-7 bg-[#f1f5f9] border border-[rgba(17,24,39,0.08)] rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const SkeletonJobCardList: React.FC<{ cards?: number }> = ({ cards = 5 }) => {
  return (
    <div className="space-y-2.5 animate-pulse">
      {Array.from({ length: cards }).map((_, idx) => (
        <div
          key={idx}
          className="p-3.5 rounded-xl bg-white border border-[rgba(17,24,39,0.08)] space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-4 w-8 bg-[#e2e8f0] rounded" />
                <div className="h-4 w-32 bg-[#cbd5e1] rounded" />
              </div>
              <div className="h-3.5 w-48 bg-[#e2e8f0] rounded" />
            </div>
            <div className="h-3 w-16 bg-[#e2e8f0] rounded shrink-0" />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="h-5 w-20 bg-[#f1f5f9] rounded" />
            <div className="h-5 w-24 bg-[#f1f5f9] rounded" />
            <div className="h-5 w-20 bg-[#f1f5f9] rounded" />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="h-7 w-28 bg-[#f1f5f9] rounded-md" />
            <div className="flex items-center gap-1.5">
              <div className="h-7 w-16 bg-[#e2e8f0] rounded-md" />
              <div className="h-7 w-7 bg-[#f1f5f9] rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonLazyLoadingRow: React.FC = () => {
  return (
    <div className="py-4 px-4 text-center bg-white/70 backdrop-blur-sm border-t border-[rgba(17,24,39,0.06)] flex items-center justify-center gap-2 text-xs text-[#6b7487] animate-pulse">
      <div className="w-2 h-2 rounded-full bg-[#2563eb] animate-ping" />
      <span className="font-medium text-[#4b5565]">Loading more roles...</span>
    </div>
  );
};
