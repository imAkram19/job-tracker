'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle,
  Filter
} from 'lucide-react';
import { JobItem, TrackingState } from '@/types/job';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobItem[];
  filteredJobs?: JobItem[];
  tracking: TrackingState;
  onImportState: (newState: TrackingState) => void;
}

export type ExportScope = 'all' | 'filtered' | 'applied' | 'not-applied';

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  jobs,
  filteredJobs = jobs,
  tracking,
  onImportState,
}) => {
  const [scope, setScope] = useState<ExportScope>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Compute jobs matching export filters
  const jobsToExport = useMemo(() => {
    let list: JobItem[] = [];

    if (scope === 'all') {
      list = [...jobs];
    } else if (scope === 'filtered') {
      list = [...filteredJobs];
    } else if (scope === 'applied') {
      list = jobs.filter((j) => {
        const s = tracking[j.id]?.status;
        return s === 'Applied' || s === 'Interviewing' || s === 'Offer';
      });
    } else if (scope === 'not-applied') {
      list = jobs.filter((j) => {
        const s = tracking[j.id]?.status || 'Not Applied';
        return s === 'Not Applied';
      });
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter((j) => j.category === selectedCategory);
    }

    return list;
  }, [jobs, filteredJobs, tracking, scope, selectedCategory]);

  if (!isOpen) return null;

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Rank',
      'Date Posted',
      'Company',
      'Job Title',
      'Category',
      'Location',
      'Work Mode',
      'Experience',
      'Salary',
      'Application Status',
      'Notes',
      'Applied Date',
      'Application Link',
    ];

    const rows = jobsToExport.map((j) => {
      const track = tracking[j.id] || { status: 'Not Applied', comments: '' };
      return [
        j.rank,
        `"${j.datePosted}"`,
        `"${j.company.replace(/"/g, '""')}"`,
        `"${j.title.replace(/"/g, '""')}"`,
        `"${j.category.replace(/"/g, '""')}"`,
        `"${j.location.replace(/"/g, '""')}"`,
        `"${j.workMode.replace(/"/g, '""')}"`,
        `"${j.experience.replace(/"/g, '""')}"`,
        `"${j.salary.replace(/"/g, '""')}"`,
        `"${track.status}"`,
        `"${(track.comments || '').replace(/"/g, '""')}"`,
        `"${track.appliedDate || ''}"`,
        `"${j.applyUrl.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Akram_Job_Applications_${scope}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON backup
  const handleExportJSON = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      scope,
      category: selectedCategory,
      totalCount: jobsToExport.length,
      jobs: jobsToExport.map((j) => ({
        ...j,
        tracking: tracking[j.id] || { status: 'Not Applied', comments: '' },
      })),
      rawTrackingState: tracking,
    };

    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(exportData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `akram_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import JSON backup
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.rawTrackingState) {
          onImportState(parsed.rawTrackingState);
        } else if (typeof parsed === 'object' && parsed !== null) {
          onImportState(parsed);
        }
        setImportSuccess(true);
        setImportError(null);
        setTimeout(() => {
          setImportSuccess(false);
          onClose();
        }, 1200);
      } catch {
        setImportError('Failed to parse backup JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[2px]">
      <div 
        className="w-full max-w-lg rounded-xl bg-white border border-[rgba(17,24,39,0.08)] shadow-lg overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[rgba(17,24,39,0.08)] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#2563eb]" />
            <h3 className="text-sm font-semibold text-[#111827]">Export and backup options</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#6b7487] hover:text-[#111827] hover:bg-[#f5f7fa] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {/* Scope selection */}
          <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[rgba(17,24,39,0.08)] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#4b5565] flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#6b7487]" />
                Dataset scope
              </label>
              <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-md bg-white border border-[rgba(17,24,39,0.08)] text-[#111827]">
                {jobsToExport.length} selected
              </span>
            </div>

            {/* Scope Radio Tiles */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  scope === 'all'
                    ? 'bg-white border-[#111827] text-[#111827]'
                    : 'bg-white text-[#4b5565] border-[rgba(17,24,39,0.08)] hover:bg-[#f5f7fa]'
                }`}
              >
                <div className="font-medium text-[#111827]">All roles</div>
                <div className="text-[11px] text-[#6b7487] mt-0.5 font-mono tabular-nums">{jobs.length} total listings</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('applied')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  scope === 'applied'
                    ? 'bg-white border-[#111827] text-[#111827]'
                    : 'bg-white text-[#4b5565] border-[rgba(17,24,39,0.08)] hover:bg-[#f5f7fa]'
                }`}
              >
                <div className="font-medium text-[#111827]">Applied only</div>
                <div className="text-[11px] text-[#6b7487] mt-0.5">Applied and interview</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('not-applied')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  scope === 'not-applied'
                    ? 'bg-white border-[#111827] text-[#111827]'
                    : 'bg-white text-[#4b5565] border-[rgba(17,24,39,0.08)] hover:bg-[#f5f7fa]'
                }`}
              >
                <div className="font-medium text-[#111827]">Pending only</div>
                <div className="text-[11px] text-[#6b7487] mt-0.5">Unapplied roles to-do</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  scope === 'filtered'
                    ? 'bg-white border-[#111827] text-[#111827]'
                    : 'bg-white text-[#4b5565] border-[rgba(17,24,39,0.08)] hover:bg-[#f5f7fa]'
                }`}
              >
                <div className="font-medium text-[#111827]">Current filter</div>
                <div className="text-[11px] text-[#6b7487] mt-0.5">Matching active view</div>
              </button>
            </div>

            {/* Optional Domain Filter */}
            <div className="pt-1">
              <label className="block text-[11px] text-[#6b7487] mb-1">
                Filter by domain (optional)
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-8 text-xs px-2.5 rounded-lg bg-white border border-[rgba(17,24,39,0.08)] text-[#111827] focus:outline-none focus:border-[#2563eb]"
              >
                <option value="ALL">All domains</option>
                <option value="Frontend & Full-Stack">Frontend & full-stack</option>
                <option value="Backend & Full-Stack">Backend & full-stack</option>
                <option value="QA & Testing">QA & testing</option>
                <option value="Support & Trainee">Support & trainee</option>
              </select>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleExportCSV}
              disabled={jobsToExport.length === 0}
              className="w-full h-9 px-4 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV spreadsheet ({jobsToExport.length} rows)</span>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={jobsToExport.length === 0}
              className="w-full h-9 px-4 rounded-lg bg-white hover:bg-[#f5f7fa] disabled:opacity-40 text-[#111827] font-normal text-xs border border-[rgba(17,24,39,0.08)] transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-[#6b7487]" />
              <span>Export full JSON backup</span>
            </button>
          </div>

          {/* Restore / Import Section */}
          <div className="pt-3 border-t border-[rgba(17,24,39,0.08)]">
            <label className="block text-xs font-normal text-[#4b5565] mb-1.5">
              Restore from backup file
            </label>
            <label className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-[rgba(17,24,39,0.16)] hover:border-[#111827] bg-[#f8fafc] text-xs text-[#4b5565] cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-[#6b7487]" />
              <span>Upload backup JSON file to restore</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {importSuccess && (
              <p className="text-xs text-[#16a34a] mt-2 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Data restored successfully
              </p>
            )}
            {importError && (
              <p className="text-xs text-[#dc2626] mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {importError}
              </p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgba(17,24,39,0.08)] bg-white flex justify-end">
          <button
            onClick={onClose}
            className="h-8 px-3.5 rounded-lg text-xs font-normal text-[#4b5565] hover:text-[#111827] hover:bg-[#f5f7fa] border border-[rgba(17,24,39,0.08)] transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
