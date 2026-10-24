'use client';

import React from 'react';
import { Search, ArrowUpDown, X } from 'lucide-react';

export type SortOption = 'date-desc' | 'date-asc' | 'rank-asc';

interface FilterControlsProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (c: string) => void;
  locationFilter: string;
  onLocationFilterChange: (l: string) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  totalFiltered: number;
  totalCount: number;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  locationFilter,
  onLocationFilterChange,
  sortOption,
  onSortChange,
  totalFiltered,
  totalCount,
}) => {
  const statusTabs = [
    { id: 'ALL', label: 'All Jobs' },
    { id: 'Not Applied', label: 'Not Applied' },
    { id: 'Applied', label: 'Applied' },
    { id: 'Interviewing', label: 'Interviewing' },
    { id: 'Offer', label: 'Offer' },
    { id: 'Archived', label: 'Archived' },
  ];

  const clearAllFilters = () => {
    onSearchChange('');
    onStatusFilterChange('ALL');
    onCategoryFilterChange('ALL');
    onLocationFilterChange('ALL');
    onSortChange('date-desc');
  };

  const hasActiveFilters = 
    searchQuery !== '' || 
    statusFilter !== 'ALL' || 
    categoryFilter !== 'ALL' || 
    locationFilter !== 'ALL' ||
    sortOption !== 'date-desc';

  return (
    <div className="space-y-3 mb-5">
      
      {/* Top Bar: Search Input + Sort Selection */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search company, job title, tech stack (Next.js, Python, React...)"
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-2xs transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date Sort Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[210px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="w-full appearance-none pl-8 pr-7 py-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer shadow-2xs transition"
            >
              <option value="date-desc">Newest Posted First</option>
              <option value="date-asc">Oldest Posted First</option>
              <option value="rank-asc">Match Rank (1 - 22)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-2.5 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition"
              title="Reset all filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onStatusFilterChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-2xs'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dropdowns for Domain & Location */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Domain Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="flex-1 sm:flex-initial text-xs py-1.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">All Domains</option>
            <option value="Frontend & Full-Stack">Frontend & Full-Stack</option>
            <option value="Backend & Full-Stack">Backend & Full-Stack</option>
            <option value="QA & Testing">QA & Testing</option>
            <option value="Support & Trainee">Support & Trainee</option>
          </select>

          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => onLocationFilterChange(e.target.value)}
            className="flex-1 sm:flex-initial text-xs py-1.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">All Locations</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Hyderabad">Hyderabad</option>
            <option value="Pune">Pune</option>
          </select>

          <span className="text-xs text-slate-400 hidden lg:inline font-mono">
            {totalFiltered} of {totalCount}
          </span>
        </div>

      </div>

    </div>
  );
};
