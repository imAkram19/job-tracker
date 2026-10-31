'use client';
import { useState } from 'react';
import { Check, Pencil, Trash2, X, Database } from 'lucide-react';
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
    setBusy(true); 
    setError('');
    try {
      const res = await fetch(`/api/automation/session/${sessionId}/respond`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ action, id, answer }) 
      });
      const data = await res.json(); 
      if (!res.ok) throw new Error(data.error || 'Unable to update entered fields');
      onEntriesChange(data.entries); 
      setEditing(null);
    } catch (err) { 
      setError((err as Error).message); 
    } finally { 
      setBusy(false); 
    }
  }

  return (
    <section aria-labelledby="entered-fields-title" className="rounded-xl border border-[rgba(17,24,39,0.08)] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <h4 id="entered-fields-title" className="flex items-center gap-1.5 text-xs font-semibold text-[#111827]">
          <Database className="h-3.5 w-3.5 text-[#2563eb]" />
          Approved answer memory ({approved.length})
        </h4>
        <span className="text-[11px] font-mono text-[#6b7487] tabular-nums">
          {approved.length} patterns
        </span>
      </div>
      <p className="mb-4 text-xs text-[#6b7487]">Persistent knowledge base for auto-filling recurring questions across job boards.</p>
      
      {error && <p role="alert" className="mb-3 text-xs text-[#dc2626] font-normal">{error}</p>}
      
      {!approved.length ? (
        <p className="rounded-lg bg-[#f8fafc] border border-[rgba(17,24,39,0.08)] p-4 text-xs text-[#6b7487]">
          No approved custom answers yet. Confirm answers during application sessions to save them here.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {approved.map(entry => (
            <article key={entry.id} className="rounded-lg border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-[#111827] break-words">{entry.label}</p>
                <div className="flex shrink-0 gap-1">
                  <button 
                    disabled={busy} 
                    aria-label={`Edit answer for ${entry.label}`} 
                    onClick={() => { setEditing(entry.id); setAnswer(entry.answer); }} 
                    className="p-1 rounded text-[#6b7487] hover:text-[#111827] hover:bg-white transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    disabled={busy} 
                    aria-label={`Remove ${entry.label} from entered fields`} 
                    title="Remove from answer bank" 
                    onClick={() => update('MEMORY_UNAPPROVE', entry.id)} 
                    className="p-1 rounded text-[#6b7487] hover:text-[#dc2626] hover:bg-white transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              
              {editing === entry.id ? (
                <div className="space-y-2 pt-1">
                  <textarea 
                    aria-label={`Answer for ${entry.label}`} 
                    rows={2} 
                    maxLength={10000} 
                    value={answer} 
                    onChange={e => setAnswer(e.target.value)} 
                    className="w-full rounded-md border border-[#2563eb] bg-white p-2 text-xs text-[#111827] focus:outline-none" 
                  />
                  <div className="flex gap-1.5">
                    <button 
                      disabled={busy || !answer.trim()} 
                      onClick={() => update('MEMORY_UPDATE_APPROVED', entry.id)} 
                      className="inline-flex items-center gap-1 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-2.5 py-1 text-xs text-white disabled:opacity-40 transition-colors font-medium"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button 
                      disabled={busy} 
                      aria-label="Cancel answer edit" 
                      onClick={() => setEditing(null)} 
                      className="h-7 px-2 rounded-md text-xs text-[#6b7487] hover:bg-white border border-[rgba(17,24,39,0.08)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#4b5565] whitespace-pre-wrap break-words">{entry.answer}</p>
              )}
              
              <p className="text-[10px] text-[#6b7487] font-mono">
                {entry.scope === 'all' ? 'Universal question · all portals' : entry.origin}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
