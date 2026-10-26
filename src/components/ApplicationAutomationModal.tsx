'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  KeyRound,
  Database,
  Pencil,
  Check,
  Trash2
} from 'lucide-react';
import { JobItem, JobStatus } from '@/types/job';
import { AutomationSessionStatus, AutomationState, HumanQuestionRequest } from '@/automation/types/automation';
import { StatusDropdown } from './StatusDropdown';
import { RememberFieldPanel } from './RememberFieldPanel';
import { EnteredFieldsPanel } from './EnteredFieldsPanel';
import { AuthenticationPanel } from './AuthenticationPanel';
import type { SelectedAnswer } from '@/automation/core/SelectedAnswerMemory';

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
  const [rememberAnswer, setRememberAnswer] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

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
  const [batchRemember, setBatchRemember] = useState(false);
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);
  const [savedMemories, setSavedMemories] = useState<SelectedAnswer[]>([]);
  const [memoryError, setMemoryError] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [learnedToast, setLearnedToast] = useState<string | null>(null);

  useEffect(() => {
    setSavedMemories([]); setMemoryError('');
    if (!session?.sessionId) return;
    let active = true;
    fetch(`/api/automation/session/${session.sessionId}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'MEMORY_LIST' }) })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); if (active) setSavedMemories(data.entries); })
      .catch(err => { if (active) setMemoryError(err.message); });
    return () => { active = false; };
  }, [session?.sessionId]);

  // Editable filled fields state
  const [editingFieldLabel, setEditingFieldLabel] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState('');
  const [isUpdatingField, setIsUpdatingField] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !(event.target instanceof HTMLInputElement)) { onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [isOpen, onClose]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      const container = logsEndRef.current.parentElement;
      if (container) container.scrollTop = container.scrollHeight;
    }
  }, [session?.logs, showLogs]);

  const startSession = useCallback(async (forceNew = false) => {
    if (!job) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setMemoryOpen(true); setAuthOpen(false); setIsPicking(false);
    setIsLoading(true);
    setError(null);
    setBatchOverview(null);

    try {
      const res = await fetch('/api/automation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, forceNew }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start automation session');
      }

      const data = await res.json();
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
        setError(null);
        const statusData: AutomationSessionStatus = JSON.parse(e.data);
        setSession({
          ...statusData,
          filledFields: deduplicateFields(statusData.filledFields || []),
        });
      });

      sse.addEventListener('stateChange', (e) => {
        const payload = JSON.parse(e.data);
        const sess: AutomationSessionStatus = payload.session;
        setSession({
          ...sess,
          filledFields: deduplicateFields(sess.filledFields || []),
        });
      });

      sse.addEventListener('log', (e) => {
        const logItem = JSON.parse(e.data);
        setSession((prev) => prev ? { ...prev, logs: [...prev.logs, logItem] } : null);
      });

      sse.addEventListener('fieldFilled', (e) => {
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
        const question: HumanQuestionRequest = JSON.parse(e.data);
        setSession((prev) => prev ? { ...prev, pendingQuestion: question, state: 'WAITING_FOR_HUMAN' } : null);
        setHumanAnswer(question.suggestedAnswer || '');
      });

      sse.onerror = () => {
        setError('Lost connection to the desktop automation server. Reopen the EXE if it stopped, then restart this automation session.');
        if (sse.readyState === EventSource.CLOSED) sse.close();
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsLoading(false);
    }
  }, [job]);

  // Start automation when modal opens for a job
  useEffect(() => {
    if (!isOpen || !job) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setMemoryOpen(true); setAuthOpen(false); setIsPicking(false);
      setSession(null);
      setError(null);
      setBatchOverview(null);
      return;
    }

    startSession(false);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen, job, startSession]);

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

  const handleRelaunchBrowser = async () => {
    if (!session) {
      startSession(true);
      return;
    }
    try {
      const res = await fetch(`/api/automation/session/${session.sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RELAUNCH_BROWSER' }),
      });
      if (!res.ok) {
        startSession(true);
      }
    } catch {
      startSession(true);
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
      case 'PAGE_PAUSED':
      case 'READY_FOR_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Check current page
          </span>
        );
      case 'NEEDS_ATTENTION':
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"><AlertCircle className="h-3.5 w-3.5" />Page needs attention</span>;
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
    <div className="fixed inset-0 z-50 bg-slate-50">
      <div 
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="assistant-title" tabIndex={-1}
        className="w-full h-[100dvh] bg-white overflow-hidden flex flex-col outline-none [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-blue-600"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-8 py-5 shrink-0 border-b border-slate-200 bg-white flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="assistant-title" className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
                  Application assistant
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  Job #{job.rank || job.id}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 break-words">
                {job.title} • {job.company}
              </p>
            </div>
          </div>
          {/* Status Bar */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 min-w-0 xl:ml-auto">
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
            <div className="space-y-0.5 min-w-[130px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Application Status
              </span>
              <StatusDropdown
                currentStatus={status}
                onChange={handleLocalStatusChange}
                className="w-full text-xs shadow-2xs"
              />
            </div>

            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Submission
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                Manual submission
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            title="Close assistant" aria-label="Close assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-5 py-6 sm:px-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Current application page</h4>
              <p className="mt-1 text-xs text-slate-500">Review your answers and continue in the browser.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleRelaunchBrowser} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"><ExternalLink className="h-4 w-4" />Show browser</button>
              <button type="button" onClick={() => { setAuthOpen(false); setMemoryOpen(true); }} disabled={!session || isPicking || isScanning || isApplyingBatch || ['STARTING', 'OPENING_APPLICATION', 'FILLING_FORM'].includes(session.state)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"><BookmarkPlus className="h-4 w-4" />Remember a field</button>
              <button type="button" onClick={() => { setMemoryOpen(false); setAuthOpen(open => !open); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"><KeyRound className="h-4 w-4" />Authentication</button>
              <button type="button" onClick={handleScanAndFillPage} disabled={!session || isPicking || isScanning || isApplyingBatch || ['STARTING', 'OPENING_APPLICATION', 'FILLING_FORM', 'WAITING_FOR_HUMAN'].includes(session.state)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Sparkles className="h-4 w-4" />{isScanning || isApplyingBatch || session?.state === 'FILLING_FORM' ? 'Filling…' : 'Scan & fill'}</button>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <section className="min-w-0 space-y-5" aria-label="Application fields">
          {memoryOpen && session && <RememberFieldPanel key={session.sessionId} sessionId={session.sessionId} entries={savedMemories} onEntriesChange={setSavedMemories} disabled={isScanning || isApplyingBatch || ['STARTING', 'OPENING_APPLICATION', 'FORM_DETECTED', 'FILLING_FORM', 'CONTINUING'].includes(session.state)} onClose={() => setMemoryOpen(false)} onPickingChange={setIsPicking} />}
          {authOpen && <AuthenticationPanel sessionId={session?.sessionId} disabled={isPicking || isScanning || isApplyingBatch || !session || ['STARTING', 'OPENING_APPLICATION', 'FILLING_FORM', 'WAITING_FOR_HUMAN'].includes(session.state)} onClose={() => setAuthOpen(false)} />}
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
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => startSession(true)}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-2xs transition active:scale-95"
                >
                  Relaunch Browser
                </button>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-800 p-0.5 transition"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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

              <div className="space-y-3.5 space-y-3">
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

          {session && ['PAGE_PAUSED', 'NEEDS_ATTENTION', 'READY_FOR_REVIEW'].includes(session.state) && (
            <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-semibold">{session.state === 'NEEDS_ATTENTION' ? 'Check the current page' : 'Page scan finished'}</p>
              <p className="mt-1 text-blue-800">{session.state === 'NEEDS_ATTENTION' ? 'Some fields need attention, or no form was found. Open the browser to continue.' : 'Check the entered values in the browser. If another step appears, scan that page next.'}</p>
            </div>
          )}

          {memoryError && <p role="alert" className="text-sm text-red-700">{memoryError}</p>}
          {session && <EnteredFieldsPanel sessionId={session.sessionId} entries={savedMemories} onEntriesChange={setSavedMemories} />}
          <details className="rounded-xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Filled on this page ({deduplicateFields(session?.filledFields || []).length})</summary>
            <p className="mt-2 text-xs text-slate-500">Results from the current application. Your reusable answers are in Entered fields above.</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">{deduplicateFields(session?.filledFields || []).map(field => <div key={field.label} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">{field.label}</p><p className="mt-1 text-sm text-slate-600 break-words">{field.value}</p></div>)}</div>
          </details>

          </section>
          <aside className="min-w-0 xl:sticky xl:top-0" aria-label="Automation activity">
          {/* Collapsible Logs Drawer */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              aria-expanded={showLogs} className="w-full px-5 py-4 bg-white hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700 transition"
            >
              <span>Activity ({session?.logs.length || 0})</span>
              {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showLogs && (
              <div className="p-4 bg-white text-slate-700 font-mono text-[11px] max-h-[60dvh] overflow-y-auto space-y-3 border-t border-slate-100">
                {session?.logs.map((log, i) => (
                  <div key={i} className="flex flex-wrap items-start gap-x-2 leading-relaxed">
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
                    <span className="text-slate-600 break-words">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
          </aside>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-8 py-3.5 shrink-0 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 underline truncate max-w-[50vw] sm:max-w-lg"
            >
              Open original listing
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
              Back to tracker
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
