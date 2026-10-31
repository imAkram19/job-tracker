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
  const drafts = entries.filter(entry => !entry.approved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const endpoint = `/api/automation/session/${sessionId}/respond`;

  async function request(action: string, body: Record<string, unknown> = {}) {
    const response = await fetch(endpoint, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ action, ...body }) 
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to update field memory');
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
          setPicking(false); 
          onPickingChange(false);
          if (data.picker.selected) {
            const field: PickedField = data.picker.selected;
            setSelected(field);
            setAnswer(['select', 'combobox'].includes(field.type) ? (field.options?.includes(field.value) ? field.value : '') : field.value || '');
            setScope('all');
          } else {
            setNotice('Selection cancelled or timed out. Choose a field to try again');
          }
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Field picker disconnected'); 
        setPicking(false); 
        onPickingChange(false); 
        return;
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
      setEntries(data.entries); 
      setSelected(null); 
      setAnswer(''); 
      setNotice('Question saved. Confirm it to add to entered fields');
    } catch (err) { 
      setError((err as Error).message); 
    } finally { 
      setBusy(false); 
    }
  }

  const secondaryBtn = 'h-8 px-3 rounded-lg border border-[rgba(17,24,39,0.08)] bg-white text-xs font-normal text-[#4b5565] hover:bg-[#f5f7fa] disabled:opacity-40 transition-colors';

  return (
    <section aria-labelledby="memory-title" className="rounded-xl border border-[rgba(17,24,39,0.08)] bg-white p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 id="memory-title" className="text-xs font-semibold text-[#111827]">Remember custom field</h4>
          <p className="text-xs text-[#6b7487] mt-0.5">Pick any input in the Chromium browser window, then configure its answer.</p>
        </div>
        <button onClick={onClose} disabled={busy} aria-label="Close field memory" className="p-1 rounded-md text-[#6b7487] hover:bg-[#f5f7fa]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-[#dc2626] font-normal">{error}</p>}
      {notice && <p role="status" className="text-xs text-[#2563eb] font-normal">{notice}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button 
          onClick={choose} 
          disabled={disabled || busy || picking} 
          className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] px-3 text-xs font-medium text-white disabled:opacity-40 transition-colors"
        >
          <MousePointer2 className="h-3.5 w-3.5" />
          {picking ? 'Select a field in browser…' : 'Pick field in browser'}
        </button>
        {(picking || selected) && (
          <button onClick={cancel} disabled={busy} className={secondaryBtn}>
            Cancel selection
          </button>
        )}
      </div>

      {picking && (
        <p role="status" className="rounded-lg bg-[#f8fafc] border border-[rgba(17,24,39,0.08)] p-3 text-xs text-[#4b5565]">
          Hover to highlight a field in Chromium, then click it. Return here to configure the answer.
        </p>
      )}

      {selected && (
        <div className="rounded-lg border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] p-3 space-y-2.5">
          <div>
            <p className="text-[10px] text-[#6b7487] font-mono">Selected question · {selected.origin}</p>
            <p className="text-xs font-medium text-[#111827] mt-0.5 break-words">{selected.label}</p>
          </div>
          
          {['select', 'combobox'].includes(selected.type) && (
            <p className="text-xs text-[#2563eb]">Dropdown detected with {selected.options?.length || 0} choices.</p>
          )}

          <div>
            <label className="block text-xs font-normal text-[#4b5565] mb-1">
              Answer to remember
            </label>
            {selected.options?.length ? (
              <select 
                className="w-full h-8 rounded-md border border-[rgba(17,24,39,0.08)] bg-white px-2 text-xs text-[#111827] focus:outline-none focus:border-[#2563eb]" 
                value={answer} 
                onChange={e => setAnswer(e.target.value)}
              >
                <option value="">Choose an answer</option>
                {selected.options.map((option, i) => (
                  <option key={i} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <textarea 
                className="w-full rounded-md border border-[rgba(17,24,39,0.08)] bg-white p-2 text-xs text-[#111827] focus:outline-none focus:border-[#2563eb]" 
                rows={2} 
                value={answer} 
                maxLength={10000} 
                onChange={e => setAnswer(e.target.value)} 
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-xs text-[#6b7487]">
              <span>Scope:</span>
              <select 
                className="h-7 rounded-md border border-[rgba(17,24,39,0.08)] bg-white px-2 text-xs text-[#111827]" 
                value={scope} 
                onChange={e => setScope(e.target.value as 'site' | 'all')}
              >
                <option value="all">Universal (any website)</option>
              </select>
            </div>

            <button 
              onClick={save} 
              disabled={busy || !answer.trim()} 
              className="inline-flex items-center gap-1 h-7 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-3 text-xs font-medium text-white disabled:opacity-40 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{busy ? 'Saving…' : 'Save'}</span>
            </button>
          </div>
        </div>
      )}

      <details open className="border-t border-[rgba(17,24,39,0.08)] pt-2.5">
        <summary className="cursor-pointer text-xs font-medium text-[#4b5565] flex items-center gap-1">
          <span>Saved custom questions</span>
          <span className="font-mono text-[#6b7487] tabular-nums">({drafts.length})</span>
        </summary>
        
        <div className="mt-2.5 max-h-60 overflow-y-auto divide-y divide-[rgba(17,24,39,0.06)]">
          {!drafts.length && (
            <p className="py-2.5 text-xs text-[#6b7487]">No pending picked questions saved yet.</p>
          )}
          {drafts.map(entry => (
            <div key={entry.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#111827] break-words">{entry.label}</p>
                <p className="text-xs text-[#4b5565] break-words">{entry.answer}</p>
                <p className="text-[10px] text-[#6b7487] font-mono mt-0.5">
                  {entry.scope === 'all' ? 'Universal question · all portals' : entry.origin}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button 
                  type="button" 
                  disabled={busy} 
                  aria-label={`Add ${entry.label} to entered fields`} 
                  className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-[#2563eb] hover:bg-[#f5f7fa] font-medium transition-colors" 
                  onClick={async () => { 
                    setBusy(true); 
                    setError(''); 
                    try { 
                      const data = await request('MEMORY_PROMOTE', { id: entry.id }); 
                      setEntries(data.entries); 
                      setNotice('Promoted to approved memory'); 
                    } catch (err) { 
                      setError((err as Error).message); 
                    } finally { 
                      setBusy(false); 
                    } 
                  }}
                >
                  <Check className="h-3 w-3" />
                  Approve
                </button>
                <button 
                  disabled={busy} 
                  aria-label={`Forget ${entry.label}`} 
                  className="p-1 rounded text-[#6b7487] hover:text-[#dc2626] transition-colors" 
                  onClick={async () => { 
                    setBusy(true); 
                    try { 
                      const data = await request('MEMORY_DELETE', { id: entry.id }); 
                      setEntries(data.entries); 
                    } catch (err) { 
                      setError((err as Error).message); 
                    } finally { 
                      setBusy(false); 
                    } 
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
