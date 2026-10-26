'use client';
import React, { useEffect, useState } from 'react';
import { MousePointer2, X, Trash2, Check } from 'lucide-react';
import type { PickedField, SelectedAnswer } from '@/automation/core/SelectedAnswerMemory';

export function RememberFieldPanel({ sessionId, entries, onEntriesChange, disabled = false, onClose, onPickingChange }: {
  sessionId: string; entries: SelectedAnswer[]; onEntriesChange: (entries: SelectedAnswer[]) => void; disabled?: boolean; onClose: () => void; onPickingChange: (active: boolean) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<PickedField | null>(null);
  const [answer, setAnswer] = useState('');
  const [scope, setScope] = useState<'site' | 'all'>('all');
  const setEntries = onEntriesChange;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const endpoint = `/api/automation/session/${sessionId}/respond`;
  async function request(action: string, body: Record<string, unknown> = {}) {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to update field memory.');
    return data;
  }
  useEffect(() => {
    let alive = true;
    void request('MEMORY_LIST').then(data => { if (alive) setEntries(data.entries); }).catch(err => { if (alive) setError(err.message); });
    return () => {
      alive = false;
      onPickingChange(false);
      void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'MEMORY_PICK_CANCEL' }), keepalive: true }).catch(() => {});
    };
    // A panel belongs to exactly one application session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
  useEffect(() => {
    if (!picking) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const data = await request('MEMORY_PICK_STATUS');
        if (cancelled) return;
        if (data.picker.error) setError(data.picker.error);
        if (!data.picker.active) {
          setPicking(false); onPickingChange(false);
          if (data.picker.selected) { setSelected(data.picker.selected); setAnswer(data.picker.selected.value || ''); setScope('all'); }
          else setNotice('Selection cancelled or timed out. Choose a field to try again.');
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Field picker disconnected.'); setPicking(false); onPickingChange(false); return;
      }
      timer = setTimeout(poll, 700);
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking, sessionId]);

  async function choose() {
    setError(''); setNotice(''); setSelected(null); setBusy(true); onPickingChange(true);
    try { await request('MEMORY_PICK_START'); setPicking(true); }
    catch (err) { setError((err as Error).message); onPickingChange(false); }
    finally { setBusy(false); }
  }
  async function cancel() {
    try { await request('MEMORY_PICK_CANCEL'); }
    catch (err) { setError((err as Error).message); }
    setPicking(false); onPickingChange(false); setSelected(null);
  }
  async function save() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const data = await request('MEMORY_SAVE', { selectedId: selected.id, answer, scope });
      setEntries(data.entries); setSelected(null); setAnswer(''); setNotice('Question saved. Click its ✓ button below to add it to Entered fields for autofill.');
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
  return <section aria-labelledby="memory-title" className="rounded-xl border border-blue-200 bg-white p-5 space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><h4 id="memory-title" className="font-semibold text-slate-900">Remember a specific question</h4><p className="mt-1 text-sm text-slate-500">Choose a field in Chromium, then confirm its answer here.</p></div>
      <button onClick={onClose} disabled={busy} aria-label="Close field memory" className="p-2 text-slate-500"><X className="h-4 w-4" /></button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-blue-700">{notice}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={choose} disabled={disabled || busy || picking} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><MousePointer2 className="h-4 w-4" />{picking ? 'Select a field in Chromium…' : 'Choose a specific field in browser'}</button>
      {(picking || selected) && <button onClick={cancel} disabled={busy} className={button}>Cancel selection</button>}
    </div>
    {picking && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Hover to highlight a field, then click it. Return here to save. Press Esc in Chromium to cancel. Search boxes and login fields are excluded.</p>}
    {selected && <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div><p className="text-xs font-medium text-slate-500">Selected question · {selected.origin}</p><p className="mt-1 text-sm font-semibold text-slate-900 break-words">{selected.label}</p></div>
      <label className="block text-sm font-medium text-slate-700">Answer to remember
        {selected.options?.length ? <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" value={answer} onChange={e => setAnswer(e.target.value)}><option value="">Choose an answer</option>{selected.options.map((option, i) => <option key={i} value={option}>{option}</option>)}</select> : <textarea className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" rows={2} value={answer} maxLength={10000} onChange={e => setAnswer(e.target.value)} />}
      </label>
      <label className="block text-sm text-slate-700">Use this answer
        <select className="ml-2 rounded-lg border border-slate-300 bg-white p-2" value={scope} onChange={e => setScope(e.target.value as 'site' | 'all')}><option value="all">For this exact question on any website</option></select>
      </label>
      <button onClick={save} disabled={busy || !answer.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" />{busy ? 'Saving…' : 'Save question'}</button>
    </div>}
    <details open className="border-t border-slate-100 pt-3"><summary className="cursor-pointer text-sm font-medium text-slate-700">Saved questions ({entries.length})</summary>
      <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100">{!entries.length && <p className="py-3 text-sm text-slate-500">No selected questions saved yet.</p>}{entries.map(entry => <div key={entry.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-medium break-words">{entry.label}</p><p className="text-sm text-slate-600 break-words">{entry.answer}</p><p className="text-xs text-slate-400">{entry.scope === 'all' ? 'Exact question · any website' : entry.origin}</p></div><div className="flex shrink-0 items-center gap-1"><button type="button" disabled={busy || !!entry.approved} aria-label={entry.approved ? `Added to Entered fields: ${entry.label}` : `Add ${entry.label} to Entered fields`} title="Add this answer to Entered fields for use on any website" className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${entry.approved ? 'bg-emerald-50 text-emerald-700' : 'text-blue-600 hover:bg-blue-50'} disabled:cursor-default`} onClick={async () => { setBusy(true); setError(''); try { const data = await request('MEMORY_PROMOTE', { id: entry.id }); setEntries(data.entries); setNotice('Added to Entered fields. Scan & fill will use this answer for the exact question on any website.'); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}><Check className="h-4 w-4" />{entry.approved ? 'Added' : 'Add'}</button><button disabled={busy} aria-label={`Forget ${entry.label}`} className="p-2 text-slate-400 hover:text-red-600" onClick={async () => { setBusy(true); try { const data = await request('MEMORY_DELETE', { id: entry.id }); setEntries(data.entries); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
    </details>
  </section>;
}
