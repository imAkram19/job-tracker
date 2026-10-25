'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Bot, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  HelpCircle, 
  Send, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  Pause,
  Play,
  Sparkles,
  BookmarkPlus,
  Database,
  Pencil,
  Check,
  Trash2
} from 'lucide-react';
import { JobItem, JobStatus } from '@/types/job';
import { AutomationSessionStatus, AutomationState, HumanQuestionRequest } from '@/automation/types/automation';
import { StatusDropdown } from './StatusDropdown';

function deduplicateFields(fields: Array<{ label: string; value: string }>) {
  if (!fields) return [];
  const map = new Map<string, { label: string; value: string }>();
  for (const f of fields) {
    if (!f || !f.label) continue;
    map.set(f.label.toLowerCase().trim(), f);
  }
  return Array.from(map.values());
}

interface ApplicationAutomationModalProps {
  job: JobItem | null;
  isOpen: boolean;
  onClose: () => void;
  currentStatus?: JobStatus;
  onStatusChange?: (status: JobStatus) => void;
}

export const ApplicationAutomationModal: React.FC<ApplicationAutomationModalProps> = ({
  job,
  isOpen,
  onClose,
  currentStatus = 'Not Applied',
  onStatusChange,
}) => {
  const [status, setStatus] = useState<JobStatus>(currentStatus);
  useEffect(() => {
    if (currentStatus) setStatus(currentStatus);
  }, [currentStatus]);

  const [session, setSession] = useState<AutomationSessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [humanAnswer, setHumanAnswer] = useState('');
  const [rememberAnswer, setRememberAnswer] = useState(true);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Batch review state
  const [batchOverview, setBatchOverview] = useState<{
    url: string;
    totalDiscovered: number;
    autoMappedCount: number;
    unresolved: Array<{
      id: string;
      name: string;
      label: string;
      type: string;
      required: boolean;
      options?: string[];
      suggestedAnswer: string | null;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
      selector: string;
    }>;
  } | null>(null);
  const [batchAnswers, setBatchAnswers] = useState<Record<string, string>>({});
  const [batchRemember, setBatchRemember] = useState(true);
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [learnedToast, setLearnedToast] = useState<string | null>(null);

  // Editable filled fields state
  const [editingFieldLabel, setEditingFieldLabel] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState('');
  const [isUpdatingField, setIsUpdatingField] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.logs, showLogs]);

  // Start automation when modal opens for a job
  useEffect(() => {
    if (!isOpen || !job) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setSession(null);
      setError(null);
      setBatchOverview(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setBatchOverview(null);

    async function startSession() {
      try {
        const res = await fetch('/api/automation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job!.id }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to start automation session');
        }

        const data = await res.json();
        if (!isMounted) return;

        const initialStatus: AutomationSessionStatus = data.status;
        setSession({
          ...initialStatus,
          filledFields: deduplicateFields(initialStatus.filledFields || []),
        });
        setIsLoading(false);

        // Open SSE connection
        const sse = new EventSource(`/api/automation/session/${data.sessionId}/stream`);
        eventSourceRef.current = sse;

        sse.addEventListener('status', (e) => {
          if (!isMounted) return;
          const statusData: AutomationSessionStatus = JSON.parse(e.data);
          setSession({
            ...statusData,
            filledFields: deduplicateFields(statusData.filledFields || []),
          });
        });

        sse.addEventListener('stateChange', (e) => {
          if (!isMounted) return;
          const payload = JSON.parse(e.data);
          const sess: AutomationSessionStatus = payload.session;
          setSession({
            ...sess,
            filledFields: deduplicateFields(sess.filledFields || []),
          });
        });

        sse.addEventListener('log', (e) => {
          if (!isMounted) return;
          const logItem = JSON.parse(e.data);
          setSession((prev) => prev ? { ...prev, logs: [...prev.logs, logItem] } : null);
        });

        sse.addEventListener('fieldFilled', (e) => {
          if (!isMounted) return;
          const field = JSON.parse(e.data);
          setSession((prev) => {
            if (!prev) return null;
            const existingIdx = prev.filledFields.findIndex(
              (f) => f.label.toLowerCase().trim() === field.label.toLowerCase().trim()
            );
            if (existingIdx >= 0) {
              const updated = [...prev.filledFields];
              updated[existingIdx] = field;
              return { ...prev, filledFields: updated };
            }
            return { ...prev, filledFields: [...prev.filledFields, field] };
          });
        });

        sse.addEventListener('humanQuestionRequired', (e) => {
          if (!isMounted) return;
          const question: HumanQuestionRequest = JSON.parse(e.data);
          setSession((prev) => prev ? { ...prev, pendingQuestion: question, state: 'WAITING_FOR_HUMAN' } : null);
          setHumanAnswer(question.suggestedAnswer || '');
        });

        sse.onerror = () => {
          // SSE disconnected
        };
      } catch (err) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setIsLoading(false);
      }
    }

    startSession();

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen, job]);

  if (!isOpen || !job) return null;

  const handleSendAnswer = async (action: 'CONTINUE' | 'SKIP_FIELD' | 'SKIP_APPLICATION' | 'ABORT') => {
    if (!session) return;
    setIsSubmittingAnswer(true);

    try {
      const res = await fetch(`/api/automation/session/${session.sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          answer: action === 'CONTINUE' ? humanAnswer : undefined,
          rememberAnswer,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit answer');
      }

      setHumanAnswer('');
    } catch (err) {
      console.error('Error submitting answer:', err);
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleScanAndFillPage = async () => {
    if (!session) return;
    setIsScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/automation/session/${session.sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SCAN_PAGE_OVERVIEW' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to scan page');
      }
      const data = await res.json();
      const overview = data.overview;

      if (!overview || overview.totalDiscovered === 0) {
        // Fall back to direct scan & fill if no form fields discovered yet
        await fetch(`/api/automation/session/${session.sessionId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SCAN_AND_FILL' }),
        });
        return;
      }

      if (overview.unresolved && overview.unresolved.length === 0) {
        // All fields were auto-mapped with high confidence! Fill immediately in batch
        await fetch(`/api/automation/session/${session.sessionId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'APPLY_BATCH_FIELDS', resolutions: [] }),
        });
      } else {
        // Needs review for ambiguous or unknown fields
        const initialAnswers: Record<string, string> = {};
        for (const item of overview.unresolved) {
          initialAnswers[item.id] =
            item.suggestedAnswer || (item.options && item.options.length > 0 ? item.options[0] : '');
        }
        setBatchAnswers(initialAnswers);
        setBatchOverview({
          url: overview.url,
          totalDiscovered: overview.totalDiscovered,
          autoMappedCount: overview.autoMapped.length,
          unresolved: overview.unresolved,
        });
      }
    } catch (err) {
      console.error('Error triggering scan and overview:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmBatch = async () => {
    if (!session || !batchOverview) return;
    setIsApplyingBatch(true);
    try {
      const resolutions = Object.entries(batchAnswers).map(([fieldId, answer]) => ({
        fieldId,
        answer,
        remember: batchRemember,
      }));

      const res = await fetch(`/api/automation/session/${session.sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPLY_BATCH_FIELDS',
          resolutions,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to apply batch fields');
      }

      setBatchOverview(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsApplyingBatch(false);
    }
  };

  const handleLearnFromPage = async () => {
    if (!session) return;
    setIsLearning(true);
    setLearnedToast(null);
    try {
      const res = await fetch(`/api/automation/session/${session.sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LEARN_FROM_PAGE' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to learn from page');
      }
      const data = await res.json();
      let msg = `Successfully remembered ${data.learnedCount} fields from active page!`;
      if (data.portalSaved) {
        msg += ` (Also recorded portal login for ${data.portalSaved})`;
      }
      setLearnedToast(msg);
      setTimeout(() => setLearnedToast(null), 6000);
    } catch (err) {
      console.error('Error learning from page:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLearning(false);
    }
  };

  const handleLocalStatusChange = (newStatus: JobStatus) => {
    setStatus(newStatus);
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
  };

  const handleSaveEditedField = async (label: string, newValue: string) => {
    if (!session) return;
    setIsUpdatingField(true);
    try {
      const res = await fetch(`/api/automation/session/${session.sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_FIELD_VALUE',
          fieldLabel: label,
          newValue,
          refillInBrowser: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update field');
      }

      setSession((prev) => {
        if (!prev) return null;
        const updated = prev.filledFields.map((f) =>
          f.label.toLowerCase().trim() === label.toLowerCase().trim()
            ? { ...f, value: newValue }
            : f
        );
        return { ...prev, filledFields: updated };
      });

      setEditingFieldLabel(null);
    } catch (err) {
      console.error('Error updating field:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsUpdatingField(false);
    }
  };

  const handleRemoveField = async (label: string) => {
    if (!session) return;
    try {
      setSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          filledFields: prev.filledFields.filter(
            (f) => f.label.toLowerCase().trim() !== label.toLowerCase().trim()
          ),
        };
      });

      await fetch(`/api/automation/session/${session.sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REMOVE_FIELD',
          fieldLabel: label,
        }),
      });
    } catch (err) {
      console.error('Error removing field:', err);
    }
  };

  const getStateBadge = (state: AutomationState) => {
    switch (state) {
      case 'WAITING_FOR_HUMAN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <HelpCircle className="w-3.5 h-3.5" />
            Human Input Required
          </span>
        );
      case 'READY_FOR_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ready for Human Review (Stopped)
          </span>
        );
      case 'FILLING_FORM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Bot className="w-3.5 h-3.5 animate-spin" />
            Filling Form Fields...
          </span>
        );
      case 'OPENING_APPLICATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <Clock className="w-3.5 h-3.5" />
            Opening Browser & Page...
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            <AlertCircle className="w-3.5 h-3.5" />
            Failed / Paused
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            Skipped
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Bot className="w-3.5 h-3.5" />
            {state}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Playwright Application Assistant
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  Job #{job.rank || job.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-md">
                {job.title} • {job.company}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            title="Minimize Assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status Bar */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Automation Status
              </span>
              <div>
                {session ? getStateBadge(session.state) : (
                  <span className="text-xs text-slate-500 font-medium">Initializing Playwright...</span>
                )}
              </div>
            </div>

            {/* In-Modal Application Status Dropdown */}
            <div className="space-y-0.5 min-w-[150px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Application Status
              </span>
              <StatusDropdown
                currentStatus={status}
                onChange={handleLocalStatusChange}
                className="w-full text-xs shadow-2xs"
              />
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Submission Lock
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                AUTO_SUBMIT = OFF
              </span>
            </div>
          </div>

          {/* Interactive On-Demand Auto-Fill & Page Learning Action */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-blue-50/90 border border-blue-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-0.5 max-w-md">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>On-Demand Page Actions</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Use <strong>Scan & Fill</strong> to automatically populate fields. If you manually created an account or filled custom answers in Chrome, click <strong>Remember Page Data</strong> to permanently memorize them for future jobs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLearnFromPage}
                disabled={isLearning || session?.state === 'FILLING_FORM'}
                title="Reads whatever you entered in Chrome (including custom answers & portal passwords) and saves them to permanent memory"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 shadow-2xs hover:shadow-xs transition active:scale-95 disabled:opacity-50"
              >
                {isLearning ? (
                  <>
                    <Bot className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    <span>Memorizing...</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Remember Page Data</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleScanAndFillPage}
                disabled={isScanning || session?.state === 'FILLING_FORM'}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow transition active:scale-95 disabled:opacity-50"
              >
                {isScanning || session?.state === 'FILLING_FORM' ? (
                  <>
                    <Bot className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning & Filling...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Scan & Fill Current Page</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {learnedToast && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center justify-between gap-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{learnedToast}</span>
              </div>
              <button onClick={() => setLearnedToast(null)} className="text-emerald-700 hover:text-emerald-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Automation Error</p>
                  <p className="mt-0.5 text-red-700">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-800 p-0.5 transition"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* WHOLE-PAGE BATCH FIELD REVIEW CARD */}
          {batchOverview && batchOverview.unresolved.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/90 to-blue-50/90 border-2 border-indigo-300 shadow-md space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-1 border-b border-indigo-200">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wide">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Whole-Page Batch Review ({batchOverview.autoMappedCount} auto-mapped, {batchOverview.unresolved.length} questions need your review)
                </div>
                <button
                  type="button"
                  onClick={() => setBatchOverview(null)}
                  className="text-xs text-indigo-500 hover:text-indigo-800 font-medium"
                >
                  Dismiss
                </button>
              </div>

              <p className="text-[11px] text-slate-600">
                The assistant inspected the entire page. Confirm or select your preferred answers below. Clicking <strong>Confirm & Fill All</strong> will apply them in Chrome, attach your resume, and remember your choices for future jobs.
              </p>

              <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
                {batchOverview.unresolved.map((field) => (
                  <div key={field.id} className="p-3 rounded-lg bg-white border border-indigo-200/80 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {field.type}
                      </span>
                    </div>

                    {/* Options pills for dropdown/radio */}
                    {field.options && field.options.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {field.options.map((opt, optIdx) => {
                            const isSelected = batchAnswers[field.id] === opt;
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => setBatchAnswers((prev) => ({ ...prev, [field.id]: opt }))}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={batchAnswers[field.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchAnswers((prev) => ({ ...prev, [field.id]: val }));
                        }}
                        placeholder={`Enter value for ${field.label}...`}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-indigo-200">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchRemember}
                    onChange={(e) => setBatchRemember(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Save answers to Knowledge Base for future applications</span>
                </label>

                <button
                  type="button"
                  onClick={handleConfirmBatch}
                  disabled={isApplyingBatch}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isApplyingBatch ? (
                    <>
                      <Bot className="w-3.5 h-3.5 animate-spin" />
                      <span>Filling Page Fields...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Confirm & Fill All Page Fields</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* HUMAN IN THE LOOP PROMPT CARD */}
          {session?.state === 'WAITING_FOR_HUMAN' && session.pendingQuestion && (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 shadow-sm space-y-3 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                Human Input Required
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-800 mb-1">
                  Question from Application:
                </p>
                <div className="p-2.5 rounded-lg bg-white border border-amber-200 text-xs font-medium text-slate-900">
                  "{session.pendingQuestion.question}"
                </div>
              </div>

              {/* Options pills if select/radio */}
              {session.pendingQuestion.options && session.pendingQuestion.options.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-600">Select an option:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {session.pendingQuestion.options.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setHumanAnswer(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                          humanAnswer === opt
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Your Answer:</label>
                  <input
                    type="text"
                    value={humanAnswer}
                    onChange={(e) => setHumanAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && humanAnswer.trim()) {
                        handleSendAnswer('CONTINUE');
                      }
                    }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberAnswer}
                    onChange={(e) => setRememberAnswer(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Save answer for future applications</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendAnswer('SKIP_FIELD')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                  >
                    Skip Question
                  </button>
                  <button
                    disabled={!humanAnswer.trim() || isSubmittingAnswer}
                    onClick={() => handleSendAnswer('CONTINUE')}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>Submit & Continue</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* READY FOR REVIEW CARD */}
          {session?.state === 'READY_FOR_REVIEW' && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Application Ready For Human Review
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                All known fields have been filled and your verified resume PDF is attached. 
                The Playwright Chromium window is currently open on your screen at the final review page.
              </p>
              <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200 text-xs text-slate-700">
                👉 <strong>Action Required:</strong> Look at the open browser window on your desktop, verify all fields, and click the final <strong>"Submit Application"</strong> button manually when you are ready.
              </div>
            </div>
          )}

          {/* Filled Fields Section */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Form Fields Progress ({deduplicateFields(session?.filledFields || []).length} completed)
              </span>
            </h4>

            {session?.filledFields && deduplicateFields(session.filledFields).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                {deduplicateFields(session.filledFields).map((field, idx) => {
                  const isEditing = editingFieldLabel === field.label;
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border transition text-xs flex flex-col justify-between gap-1.5 ${
                        isEditing
                          ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700 truncate max-w-[190px]">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFieldLabel(field.label);
                                  setEditingFieldValue(field.value);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200/80 rounded transition"
                                title="Edit and refill this field in Chrome"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveField(field.label)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Remove this field from list"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : null}
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="text"
                            value={editingFieldValue}
                            onChange={(e) => setEditingFieldValue(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-white border border-blue-400 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
                            autoFocus
                            placeholder="Type new value..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEditedField(field.label, editingFieldValue);
                              } else if (e.key === 'Escape') {
                                setEditingFieldLabel(null);
                              }
                            }}
                          />
                          <button
                            type="button"
                            disabled={isUpdatingField}
                            onClick={() => handleSaveEditedField(field.label, editingFieldValue)}
                            className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition disabled:opacity-50 shrink-0"
                            title="Save & Refill in Browser"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingFieldLabel(null)}
                            className="p-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 transition shrink-0"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono truncate">
                          {field.value || <em className="text-slate-400">Empty</em>}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
                Fields will appear here as Playwright analyzes and fills them in real time.
              </div>
            )}
          </div>

          {/* Collapsible Logs Drawer */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition"
            >
              <span>Live Automation Logs ({session?.logs.length || 0})</span>
              {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showLogs && (
              <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] max-h-44 overflow-y-auto space-y-1">
                {session?.logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`shrink-0 font-bold ${
                        log.level === 'error'
                          ? 'text-red-400'
                          : log.level === 'warn'
                          ? 'text-amber-400'
                          : log.level === 'success'
                          ? 'text-emerald-400'
                          : 'text-blue-400'
                      }`}
                    >
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 underline truncate max-w-xs"
            >
              {job.applyUrl}
            </a>
          </div>

          <div className="flex items-center gap-2">
            {session && session.state !== 'READY_FOR_REVIEW' && session.state !== 'FAILED' && (
              <button
                onClick={() => handleSendAnswer('ABORT')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition"
              >
                Abort
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-800 transition"
            >
              Close Window
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
