'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle,
  Filter,
  CheckCircle2
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
      } catch (err) {
        setImportError('Failed to parse backup JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Export & Download Options</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {/* Mobile Filter Options Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                Select What to Export
              </label>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {jobsToExport.length} jobs selected
              </span>
            </div>

            {/* Scope Radio Tiles */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-2.5 rounded-lg border text-left transition font-medium ${
                  scope === 'all'
                    ? 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="font-semibold text-slate-900">All Jobs</div>
                <div className="text-[10px] text-slate-500 mt-0.5">All 22 scraped listings</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('applied')}
                className={`p-2.5 rounded-lg border text-left transition font-medium ${
                  scope === 'applied'
                    ? 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="font-semibold text-slate-900">Applied Only</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Applied & Interviewing</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('not-applied')}
                className={`p-2.5 rounded-lg border text-left transition font-medium ${
                  scope === 'not-applied'
                    ? 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="font-semibold text-slate-900">Pending Only</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Unapplied jobs to-do</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`p-2.5 rounded-lg border text-left transition font-medium ${
                  scope === 'filtered'
                    ? 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="font-semibold text-slate-900">Screen Filtered</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Current screen search</div>
              </button>
            </div>

            {/* Optional Domain Filter */}
            <div className="pt-2">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Filter by Tech Domain (Optional):
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-xs py-1.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Domains (No Domain Filter)</option>
                <option value="Frontend & Full-Stack">Frontend & Full-Stack</option>
                <option value="Backend & Full-Stack">Backend & Full-Stack</option>
                <option value="QA & Testing">QA & Testing</option>
                <option value="Support & Trainee">Support & Trainee</option>
              </select>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleExportCSV}
              disabled={jobsToExport.length === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs transition flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Spreadsheet ({jobsToExport.length} rows)</span>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={jobsToExport.length === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium text-xs border border-slate-200 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export Full JSON Backup</span>
            </button>
          </div>

          {/* Restore / Import Section */}
          <div className="pt-3 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Restore from Backup
            </label>
            <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 text-xs text-slate-600 cursor-pointer transition">
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Upload backup JSON file to restore</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {importSuccess && (
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" />
                Data restored successfully!
              </p>
            )}
            {importError && (
              <p className="text-xs text-rose-600 mt-2 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {importError}
              </p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
