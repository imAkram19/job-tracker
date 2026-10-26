'use client';
import { useState } from 'react';
import { Brain, Check, Pencil, Trash2, X } from 'lucide-react';
import type { SelectedAnswer } from '@/automation/core/SelectedAnswerMemory';

export function EnteredFieldsPanel({ sessionId, entries, onEntriesChange }: {
  sessionId: string; entries: SelectedAnswer[]; onEntriesChange: (entries: SelectedAnswer[]) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const approved = entries.filter(entry => entry.approved);
  async function update(action: string, id: string) {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/automation/session/${sessionId}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, answer }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Unable to update Entered fields.');
      onEntriesChange(data.entries); setEditing(null);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="entered-fields-title" className="rounded-xl border border-blue-200 bg-white p-5 sm:p-6">
    <h4 id="entered-fields-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Brain className="h-4 w-4 text-blue-600" />Entered fields ({approved.length})</h4>
    <p className="mt-2 mb-5 text-sm text-slate-500">Your answer bank. Scan &amp; fill uses these answers first for matching questions, including future applications.</p>
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
    {!approved.length ? <p className="rounded-lg bg-slate-50 p-6 text-sm text-slate-500">Click ✓ beside a Saved question to add it here.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{approved.map(entry => <article key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-700 break-words">{entry.label}</p><div className="flex shrink-0 gap-1">
        <button disabled={busy} aria-label={`Edit answer for ${entry.label}`} onClick={() => { setEditing(entry.id); setAnswer(entry.answer); }} className="p-1 text-slate-500 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
        <button disabled={busy} aria-label={`Remove ${entry.label} from Entered fields`} title="Remove from answer bank; keep in Saved questions" onClick={() => update('MEMORY_UNAPPROVE', entry.id)} className="p-1 text-slate-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
      </div></div>
      {editing === entry.id ? <div className="space-y-2"><textarea aria-label={`Answer for ${entry.label}`} rows={2} maxLength={10000} value={answer} onChange={e => setAnswer(e.target.value)} className="w-full rounded-lg border border-blue-300 bg-white p-2 text-sm" /><div className="flex gap-2"><button disabled={busy || !answer.trim()} onClick={() => update('MEMORY_UPDATE_APPROVED', entry.id)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"><Check className="h-4 w-4" />Save answer</button><button disabled={busy} aria-label="Cancel answer edit" onClick={() => setEditing(null)} className="p-2 text-slate-500"><X className="h-4 w-4" /></button></div></div> : <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{entry.answer}</p>}
      <p className="text-xs text-blue-600">{entry.scope === 'all' ? 'Exact question · any website' : entry.origin}</p>
    </article>)}</div>}
  </section>;
}
