'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import rawJobsData from '@/data/jobs.json';
import { JobItem, JobStatus, TrackingState, UserJobTracking } from '@/types/job';
import { 
  loadTrackingState, 
  saveJobTracking, 
  saveLocalTrackingState 
} from '@/lib/supabase';
import { Header } from '@/components/Header';
import { StatsDashboard } from '@/components/StatsDashboard';
import { FilterControls, SortOption } from '@/components/FilterControls';
import { JobTable } from '@/components/JobTable';
import { JobCardList } from '@/components/JobCardList';
import { NotesModal } from '@/components/NotesModal';
import { CandidateModal } from '@/components/CandidateModal';
import { ExportImportModal } from '@/components/ExportImportModal';
import { ApplicationAutomationModal } from '@/components/ApplicationAutomationModal';
import { 
  SkeletonStatsDashboard, 
  SkeletonFilterControls, 
  SkeletonJobTable, 
  SkeletonJobCardList 
} from '@/components/SkeletonLoader';

function parseJobDate(d?: string): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
}

const initialJobs: JobItem[] = rawJobsData as JobItem[];
const PAGE_SIZE = 50;

export default function Home() {
  const [jobs, setJobs] = useState<JobItem[]>(initialJobs);
  const [tracking, setTracking] = useState<TrackingState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');

  // Progressive / Lazy Loading pagination state
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Modals state
  const [selectedJobForNotes, setSelectedJobForNotes] = useState<JobItem | null>(null);
  const [automationJob, setAutomationJob] = useState<JobItem | null>(null);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Load tracking state on mount from Supabase / LocalStorage
  useEffect(() => {
    setIsMounted(true);
    async function initData() {
      setIsLoading(true);
      try {
        const state = await loadTrackingState();
        setTracking(state);
      } catch (err) {
        console.error('Failed to load initial tracker state:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initData();
  }, []);

  // Reset lazy load visible count whenever search or filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, statusFilter, categoryFilter, locationFilter, sortOption]);

  // Update Status handler
  const handleUpdateStatus = async (jobId: string, newStatus: JobStatus) => {
    const existing = tracking[jobId] || { status: 'Not Applied', comments: '' };
    
    let appliedDate: string | undefined = existing.appliedDate || undefined;
    if (newStatus === 'Applied') {
      appliedDate = existing.appliedDate || new Date().toISOString();
    } else if (newStatus === 'Not Applied' || newStatus === 'No link') {
      appliedDate = undefined; // Explicitly clear applied date
    }

    const updated: UserJobTracking = {
      ...existing,
      status: newStatus,
      appliedDate,
      updatedAt: new Date().toISOString(),
    };

    setTracking((prev) => ({
      ...prev,
      [jobId]: updated,
    }));

    await saveJobTracking(jobId, updated);
  };

  // Save Notes handler
  const handleSaveNotes = async (jobId: string, updated: UserJobTracking) => {
    setTracking((prev) => ({
      ...prev,
      [jobId]: updated,
    }));
    await saveJobTracking(jobId, updated);
  };

  // Open Notes Modal
  const handleOpenNotes = (job: JobItem) => {
    setSelectedJobForNotes(job);
    setIsNotesOpen(true);
  };

  // Restore imported backup state
  const handleImportState = (newState: TrackingState) => {
    setTracking(newState);
    saveLocalTrackingState(newState);
  };

  // Filter and Sort Jobs
  const filteredAndSortedJobs = useMemo(() => {
    let result = jobs.filter((job) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        job.company.toLowerCase().includes(q) ||
        job.title.toLowerCase().includes(q) ||
        job.notes.toLowerCase().includes(q) ||
        job.category.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.source.toLowerCase().includes(q);

      const jobTrack = tracking[job.id] || { status: 'Not Applied' };
      const currentStatus = jobTrack.status || 'Not Applied';

      const matchesStatus =
        statusFilter === 'ALL' || currentStatus === statusFilter;

      const matchesCategory =
        categoryFilter === 'ALL' || job.category === categoryFilter;

      const matchesLocation =
        locationFilter === 'ALL' || job.location.includes(locationFilter);

      return matchesSearch && matchesStatus && matchesCategory && matchesLocation;
    });

    result.sort((a, b) => {
      if (sortOption === 'date-desc') {
        const diff = parseJobDate(b.datePosted) - parseJobDate(a.datePosted);
        if (diff !== 0) return diff;
        return a.rank - b.rank;
      }
      if (sortOption === 'date-asc') {
        const diff = parseJobDate(a.datePosted) - parseJobDate(b.datePosted);
        if (diff !== 0) return diff;
        return a.rank - b.rank;
      }
      if (sortOption === 'rank-asc') {
        return a.rank - b.rank;
      }
      return a.rank - b.rank;
    });

    return result;
  }, [jobs, tracking, searchQuery, statusFilter, categoryFilter, locationFilter, sortOption]);

  // Sliced jobs for progressive lazy rendering
  const visibleJobs = useMemo(() => {
    return filteredAndSortedJobs.slice(0, visibleCount);
  }, [filteredAndSortedJobs, visibleCount]);

  // Handler for lazy loading more jobs
  const handleLoadMore = useCallback(() => {
    if (visibleCount >= filteredAndSortedJobs.length || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredAndSortedJobs.length));
      setIsLoadingMore(false);
    }, 120);
  }, [visibleCount, filteredAndSortedJobs.length, isLoadingMore]);

  const filterCounts = useMemo(() => {
    const status: Record<string, number> = { ALL: jobs.length };
    const category: Record<string, number> = { ALL: jobs.length };
    const location: Record<string, number> = {
      ALL: jobs.length,
      Bengaluru: 0,
      Hyderabad: 0,
      Pune: 0,
    };

    jobs.forEach((job) => {
      const currentStatus = tracking[job.id]?.status || 'Not Applied';
      status[currentStatus] = (status[currentStatus] || 0) + 1;
      category[job.category] = (category[job.category] || 0) + 1;

      Object.keys(location).forEach((city) => {
        if (city !== 'ALL' && job.location.includes(city)) {
          location[city] += 1;
        }
      });
    });

    return { status, category, location };
  }, [jobs, tracking]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7fa] text-[#111827] selection:bg-[#2563eb] selection:text-white">
      {/* Top Header */}
      <Header
        onOpenDossier={() => setIsDossierOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        
        {isLoading || !isMounted ? (
          /* High-End Skeleton Structure before everything loads up */
          <>
            <SkeletonStatsDashboard />
            <SkeletonFilterControls />
            <div className="hidden md:block">
              <SkeletonJobTable rows={8} />
            </div>
            <div className="block md:hidden">
              <SkeletonJobCardList cards={5} />
            </div>
          </>
        ) : (
          /* Live Dashboard with Lazy Progressive Reloading & Interactive Hyperlinks */
          <>
            {/* Stats Dashboard */}
            <StatsDashboard jobs={jobs} tracking={tracking} />

            {/* Filter & Sorting Controls */}
            <FilterControls
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              locationFilter={locationFilter}
              onLocationFilterChange={setLocationFilter}
              sortOption={sortOption}
              onSortChange={setSortOption}
              totalFiltered={filteredAndSortedJobs.length}
              totalCount={jobs.length}
              filterCounts={filterCounts}
            />

            {/* View Switching: Desktop Table vs Mobile Cards */}
            <div className="hidden md:block">
              <JobTable
                jobs={visibleJobs}
                tracking={tracking}
                onUpdateStatus={handleUpdateStatus}
                onOpenNotes={handleOpenNotes}
                onAutoApply={(job) => setAutomationJob(job)}
                hasMore={visibleCount < filteredAndSortedJobs.length}
                isLoadingMore={isLoadingMore}
                onLoadMore={handleLoadMore}
                totalCount={filteredAndSortedJobs.length}
              />
            </div>

            <div className="block md:hidden">
              <JobCardList
                jobs={visibleJobs}
                tracking={tracking}
                onUpdateStatus={handleUpdateStatus}
                onOpenNotes={handleOpenNotes}
                onAutoApply={(job) => setAutomationJob(job)}
                hasMore={visibleCount < filteredAndSortedJobs.length}
                isLoadingMore={isLoadingMore}
                onLoadMore={handleLoadMore}
                totalCount={filteredAndSortedJobs.length}
              />
            </div>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-[rgba(17,24,39,0.08)] bg-white py-4 text-xs text-[#6b7487] mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Curated for <span className="text-[#111827] font-medium">Mohammad Akram</span> (MCA 2024–2026) • Permanent technology roles
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDossierOpen(true)}
              className="hover:text-[#111827] transition-colors"
            >
              Candidate dossier
            </button>
            <span className="text-[#9ca3af]">•</span>
            <button
              onClick={() => setIsExportOpen(true)}
              className="hover:text-[#111827] transition-colors"
            >
              Export dataset
            </button>
            <span className="text-[#9ca3af]">•</span>
            <a
              href="https://github.com/imAkram19/job-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#111827] transition-colors"
            >
              Repository
            </a>
          </div>
        </div>
      </footer>

      {/* Notes / Comments Modal */}
      <NotesModal
        job={selectedJobForNotes}
        trackingItem={selectedJobForNotes ? tracking[selectedJobForNotes.id] : undefined}
        isOpen={isNotesOpen}
        onClose={() => {
          setIsNotesOpen(false);
          setSelectedJobForNotes(null);
        }}
        onSave={handleSaveNotes}
      />

      {/* Candidate Dossier & ATS Modal */}
      <CandidateModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
      />

      {/* Export / Backup Modal with Mobile-Friendly Filtering Options */}
      <ExportImportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        jobs={jobs}
        filteredJobs={filteredAndSortedJobs}
        tracking={tracking}
        onImportState={handleImportState}
      />

      {/* Playwright Application Automation Assistant Modal */}
      <ApplicationAutomationModal
        job={automationJob}
        isOpen={!!automationJob}
        onClose={() => setAutomationJob(null)}
        currentStatus={automationJob ? (tracking[automationJob.id]?.status || 'Not Applied') : 'Not Applied'}
        onStatusChange={(status) => {
          if (automationJob) {
            handleUpdateStatus(automationJob.id, status);
          }
        }}
      />
    </div>
  );
}
