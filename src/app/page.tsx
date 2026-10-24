'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

const initialJobs: JobItem[] = rawJobsData as JobItem[];

export default function Home() {
  const [jobs, setJobs] = useState<JobItem[]>(initialJobs);
  const [tracking, setTracking] = useState<TrackingState>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');

  // Modals state
  const [selectedJobForNotes, setSelectedJobForNotes] = useState<JobItem | null>(null);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Load tracking state on mount from Supabase / LocalStorage
  useEffect(() => {
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

  // Update Status handler
  const handleUpdateStatus = async (jobId: string, newStatus: JobStatus) => {
    const existing = tracking[jobId] || { status: 'Not Applied', comments: '' };
    
    let appliedDate: string | undefined = existing.appliedDate || undefined;
    if (newStatus === 'Applied') {
      appliedDate = existing.appliedDate || new Date().toISOString();
    } else if (newStatus === 'Not Applied') {
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
        return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
      }
      if (sortOption === 'date-asc') {
        return new Date(a.datePosted).getTime() - new Date(b.datePosted).getTime();
      }
      if (sortOption === 'rank-asc') {
        return a.rank - b.rank;
      }
      return 0;
    });

    return result;
  }, [jobs, tracking, searchQuery, statusFilter, categoryFilter, locationFilter, sortOption]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenDossier={() => setIsDossierOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
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
        />

        {/* View Switching: Desktop Table vs Mobile Cards */}
        <div className="hidden md:block">
          <JobTable
            jobs={filteredAndSortedJobs}
            tracking={tracking}
            onUpdateStatus={handleUpdateStatus}
            onOpenNotes={handleOpenNotes}
          />
        </div>

        <div className="block md:hidden">
          <JobCardList
            jobs={filteredAndSortedJobs}
            tracking={tracking}
            onUpdateStatus={handleUpdateStatus}
            onOpenNotes={handleOpenNotes}
          />
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Curated for <span className="text-slate-800 font-semibold">Mohammad Akram</span> (MCA 2024–2026) • All jobs permanent full-time
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDossierOpen(true)}
              className="hover:text-slate-800 transition"
            >
              Application Cheat Sheet
            </button>
            <span>•</span>
            <button
              onClick={() => setIsExportOpen(true)}
              className="hover:text-slate-800 transition"
            >
              Export CSV
            </button>
            <span>•</span>
            <a
              href="https://github.com/imAkram19/job-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition"
            >
              GitHub Repo ↗
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
    </div>
  );
}
