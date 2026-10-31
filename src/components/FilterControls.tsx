'use client';

import React from 'react';
import { Search, ArrowUpDown, X } from 'lucide-react';

export type SortOption = 'date-desc' | 'date-asc' | 'rank-asc';

interface FilterCounts {
  status: Record<string, number>;
  category: Record<string, number>;
  location: Record<string, number>;
}

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
  filterCounts: FilterCounts;
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
  filterCounts,
}) => {
  const statusTabs = [
    { id: 'ALL', label: 'All roles' },
    { id: 'Not Applied', label: 'Not applied' },
    { id: 'Review', label: 'Review' },
    { id: 'Applied', label: 'Applied' },
    { id: 'Interviewing', label: 'Interviewing' },
    { id: 'Offer', label: 'Offer' },
    { id: 'Rejected', label: 'Rejected' },
    { id: 'Archived', label: 'Archived' },
    { id: 'No link', label: 'No link' },
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
    <div className="space-y-2.5 mb-5">
      
      {/* Top Bar: Search Input + Sort Selection */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#6b7487] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by role, company, or tech stack"
            className="w-full pl-8 pr-8 h-9 rounded-lg bg-white border border-[rgba(17,24,39,0.08)] text-xs text-[#111827] placeholder-[#6b7487] focus:outline-none focus:border-[#2563eb] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b7487] hover:text-[#111827]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date Sort Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[190px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#6b7487] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="w-full appearance-none pl-8 pr-7 h-9 rounded-lg bg-white border border-[rgba(17,24,39,0.08)] text-xs font-normal text-[#111827] focus:outline-none focus:border-[#2563eb] cursor-pointer transition-colors"
            >
              <option value="date-desc">Newest posted</option>
              <option value="date-asc">Oldest posted</option>
              <option value="rank-asc">Match rank</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="h-9 px-3 rounded-lg text-xs font-normal text-[#6b7487] hover:text-[#111827] hover:bg-[#eceff4] border border-[rgba(17,24,39,0.08)] transition-colors"
              title="Reset all filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {statusTabs.map((tab) => {
            const count = filterCounts.status[tab.id] || 0;
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onStatusFilterChange(tab.id)}
                className={`h-8 px-2.5 rounded-lg text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#111827] text-white font-medium'
                    : 'bg-white hover:bg-[#f5f7fa] text-[#4b5565] border border-[rgba(17,24,39,0.08)] font-normal'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[11px] font-mono tabular-nums ${isActive ? 'text-slate-300' : 'text-[#6b7487]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dropdowns for Domain & Location */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Domain Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="flex-1 sm:flex-initial h-8 text-xs px-2.5 rounded-lg bg-white border border-[rgba(17,24,39,0.08)] text-[#4b5565] focus:outline-none focus:border-[#2563eb] cursor-pointer"
          >
            <option value="ALL">All domains ({filterCounts.category.ALL || 0})</option>
            <option value="Frontend & Full-Stack">Frontend & full-stack ({filterCounts.category['Frontend & Full-Stack'] || 0})</option>
            <option value="Backend & Full-Stack">Backend & full-stack ({filterCounts.category['Backend & Full-Stack'] || 0})</option>
            <option value="QA & Testing">QA & testing ({filterCounts.category['QA & Testing'] || 0})</option>
            <option value="Support & Trainee">Support & trainee ({filterCounts.category['Support & Trainee'] || 0})</option>
          </select>

          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => onLocationFilterChange(e.target.value)}
            className="flex-1 sm:flex-initial h-8 text-xs px-2.5 rounded-lg bg-white border border-[rgba(17,24,39,0.08)] text-[#4b5565] focus:outline-none focus:border-[#2563eb] cursor-pointer"
          >
            <option value="ALL">All locations ({filterCounts.location.ALL || 0})</option>
            <option value="Bengaluru">Bengaluru ({filterCounts.location.Bengaluru || 0})</option>
            <option value="Hyderabad">Hyderabad ({filterCounts.location.Hyderabad || 0})</option>
            <option value="Pune">Pune ({filterCounts.location.Pune || 0})</option>
          </select>

          <span className="text-xs text-[#6b7487] hidden lg:inline font-mono tabular-nums">
            {totalFiltered}/{totalCount}
          </span>
        </div>

      </div>

    </div>
  );
};
