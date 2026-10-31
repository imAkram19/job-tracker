'use client';
import React, { useEffect, useState } from 'react';
import { X, Plus, Pencil, Trash2, KeyRound } from 'lucide-react';
import type { AccountInput, PortalAccountSummary } from '@/automation/core/PortalAuthentication';

const empty: AccountInput = { label: '', loginUrl: '', username: '', method: 'password', password: '' };

export function AuthenticationPanel({ sessionId, disabled, onClose }: { sessionId?: string; disabled: boolean; onClose: () => void }) {
  const [accounts, setAccounts] = useState<PortalAccountSummary[]>([]);
  const [form, setForm] = useState<AccountInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function request(method = 'GET', body?: unknown) {
    const res = await fetch('/api/automation/accounts', { 
      method, 
      headers: { 'Content-Type': 'application/json' }, 
      body: body ? JSON.stringify(body) : undefined, 
      cache: 'no-store' 
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to load authentication');
    setAccounts(data.accounts);
  }

  useEffect(() => { 
    void request().catch(err => setError(err.message)); 
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault(); 
    if (!form) return;
    setBusy(true); 
    setError('');
    try { 
      await request('POST', form); 
      setForm(null); 
      setNotice('Account saved locally on this machine'); 
    } catch (err) { 
      setError((err as Error).message); 
    } finally { 
      setBusy(false); 
    }
  }

  async function browserAction(action: string, accountId: string) {
    if (!sessionId) return;
    setBusy(true); 
    setError(''); 
    setNotice('');
    try {
      const res = await fetch(`/api/automation/session/${sessionId}/respond`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ action, accountId }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to open sign-in');
      setNotice(data.message);
    } catch (err) { 
      setError((err as Error).message); 
    } finally { 
      setBusy(false); 
    }
  }

  const secondaryBtn = 'h-8 px-3 rounded-lg border border-[rgba(17,24,39,0.08)] bg-white text-xs font-normal text-[#4b5565] hover:bg-[#f5f7fa] disabled:opacity-40 transition-colors';
  const inputStyle = 'mt-1 w-full h-8 rounded-lg border border-[rgba(17,24,39,0.08)] bg-white px-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#2563eb]';

  return (
    <section aria-labelledby="authentication-title" className="rounded-xl border border-[rgba(17,24,39,0.08)] bg-white p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 id="authentication-title" className="flex items-center gap-1.5 text-xs font-semibold text-[#111827]">
            <KeyRound className="h-3.5 w-3.5 text-[#2563eb]" />
            Portal credentials
          </h4>
          <p className="mt-0.5 text-xs text-[#6b7487]">Credentials stored locally on this machine for candidate portal auto-login.</p>
        </div>
        <button onClick={onClose} disabled={busy} aria-label="Close authentication" className="p-1 rounded-md text-[#6b7487] hover:bg-[#f5f7fa]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-[#dc2626] font-normal">{error}</p>}
      {notice && <p role="status" className="text-xs text-[#2563eb] font-normal">{notice}</p>}

      <button 
        className={`${secondaryBtn} inline-flex items-center gap-1.5`} 
        disabled={busy} 
        onClick={() => { setForm({ ...empty }); setError(''); setNotice(''); }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add account
      </button>

      {form && (
        <form onSubmit={save} autoComplete="off" className="rounded-lg border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] p-3.5 space-y-3">
          <h5 className="font-medium text-xs text-[#111827]">{form.id ? 'Edit portal account' : 'New portal account'}</h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <label className="text-xs font-normal text-[#4b5565]">
              Portal name
              <input required maxLength={100} className={inputStyle} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="LinkedIn, Workday, Greenhouse…" />
            </label>
            <label className="text-xs font-normal text-[#4b5565]">
              Sign-in page URL
              <input required className={inputStyle} value={form.loginUrl} onChange={e => setForm({ ...form, loginUrl: e.target.value })} placeholder="https://portal.example.com/login" />
            </label>
            <label className="text-xs font-normal text-[#4b5565]">
              Sign-in method
              <select className={inputStyle} value={form.method} onChange={e => setForm({ ...form, method: e.target.value as AccountInput['method'], password: '' })}>
                <option value="password">Username and password</option>
                <option value="google">Continue with Google</option>
                <option value="linkedin">Continue with LinkedIn</option>
                <option value="sso">Single sign-on (SSO)</option>
              </select>
            </label>
            <label className="text-xs font-normal text-[#4b5565]">
              Email or username
              <input required={form.method === 'password'} maxLength={300} autoComplete="off" className={inputStyle} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
            </label>
          </div>

          {form.method === 'password' ? (
            <label className="block text-xs font-normal text-[#4b5565]">
              {form.id ? 'New password (leave blank to keep current)' : 'Password'}
              <input required={!form.id || !accounts.find(account => account.id === form.id)?.hasPassword} type="password" maxLength={1000} autoComplete="new-password" className={inputStyle} value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} />
            </label>
          ) : (
            <p className="text-xs text-[#6b7487]">Complete sign-in through OAuth in the Chromium window.</p>
          )}

          <div className="flex gap-2 pt-1">
            <button disabled={busy} type="submit" className="h-8 px-3 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-xs font-medium text-white disabled:opacity-40 transition-colors">
              {busy ? 'Saving…' : 'Save account'}
            </button>
            <button disabled={busy} type="button" className={secondaryBtn} onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {!accounts.length && !form && (
          <p className="rounded-lg bg-[#f8fafc] border border-[rgba(17,24,39,0.08)] px-4 py-6 text-xs text-[#6b7487]">
            No portal accounts configured yet.
          </p>
        )}
        {accounts.map(account => (
          <article key={account.id} className="rounded-lg border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] p-3 space-y-2">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h5 className="text-xs font-medium text-[#111827]">{account.label}</h5>
                <p className="text-xs text-[#4b5565] break-all">{account.username || 'Browser authentication'}</p>
                <p className="mt-0.5 text-[10px] text-[#6b7487] font-mono break-all">
                  {account.origin} · {account.method === 'password' ? (account.hasPassword ? 'Password stored' : 'Password needed') : account.method}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button disabled={busy} className="p-1 rounded text-[#6b7487] hover:text-[#111827] transition-colors" aria-label={`Edit ${account.label}`} onClick={() => setForm({ id: account.id, label: account.label, loginUrl: account.loginUrl, username: account.username, method: account.method, password: '' })}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button disabled={busy} className="p-1 rounded text-[#6b7487] hover:text-[#dc2626] transition-colors" aria-label={`Remove ${account.label}`} onClick={() => setDeleteId(account.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[rgba(17,24,39,0.06)]">
              <button disabled={busy || disabled || !sessionId} className={secondaryBtn} onClick={() => browserAction('AUTH_OPEN', account.id)}>
                Open portal
              </button>
              {account.method === 'password' && (
                <button disabled={busy || disabled || !sessionId} className={secondaryBtn} onClick={() => browserAction('AUTH_FILL', account.id)}>
                  Fill login
                </button>
              )}
            </div>

            {deleteId === account.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#dc2626]">
                <span>Remove saved credentials for this portal?</span>
                <button disabled={busy} className={secondaryBtn} onClick={async () => { setBusy(true); try { await request('DELETE', { id: account.id }); setDeleteId(null); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>
                  Confirm removal
                </button>
                <button className={secondaryBtn} onClick={() => setDeleteId(null)}>
                  Cancel
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
