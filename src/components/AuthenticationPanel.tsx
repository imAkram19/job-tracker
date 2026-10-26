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
    const res = await fetch('/api/automation/accounts', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to load Authentication.');
    setAccounts(data.accounts);
  }
  useEffect(() => { void request().catch(err => setError(err.message)); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!form) return;
    setBusy(true); setError('');
    try { await request('POST', form); setForm(null); setNotice('Account saved on this PC.'); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function browserAction(action: string, accountId: string) {
    if (!sessionId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch(`/api/automation/session/${sessionId}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, accountId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to open sign-in.');
      setNotice(data.message);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
  const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500';
  return <section aria-labelledby="authentication-title" className="rounded-xl border border-blue-200 bg-white p-5 space-y-4">
    <div className="flex items-start justify-between gap-3"><div><h4 id="authentication-title" className="flex items-center gap-2 font-semibold text-slate-900"><KeyRound className="h-4 w-4 text-blue-600" />Authentication</h4><p className="mt-1 text-sm text-slate-500">Separate accounts for each portal. Passwords are encrypted for your Windows account.</p></div><button onClick={onClose} disabled={busy} aria-label="Close Authentication" className="p-2 text-slate-500"><X className="h-4 w-4" /></button></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-blue-700">{notice}</p>}
    <button className={`${button} inline-flex items-center gap-2`} disabled={busy} onClick={() => { setForm({ ...empty }); setError(''); setNotice(''); }}><Plus className="h-4 w-4" />Add account</button>
    {form && <form onSubmit={save} autoComplete="off" className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <h5 className="font-semibold text-sm">{form.id ? 'Edit account' : 'New portal account'}</h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm font-medium text-slate-700">Portal name<input required maxLength={100} className={input} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="LinkedIn, Internshala, Workday…" /></label>
        <label className="text-sm font-medium text-slate-700">Sign-in page URL<input required className={input} value={form.loginUrl} onChange={e => setForm({ ...form, loginUrl: e.target.value })} placeholder="https://portal.example.com/login" /></label>
        <label className="text-sm font-medium text-slate-700">Sign-in method<select className={input} value={form.method} onChange={e => setForm({ ...form, method: e.target.value as AccountInput['method'], password: '' })}><option value="password">Username / password</option><option value="google">Continue with Google</option><option value="linkedin">Continue with LinkedIn</option><option value="sso">Other SSO</option></select></label>
        <label className="text-sm font-medium text-slate-700">Email or username<input required={form.method === 'password'} maxLength={300} autoComplete="off" className={input} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label>
      </div>
      {form.method === 'password' ? <label className="block text-sm font-medium text-slate-700">{form.id ? 'New password (leave blank to keep saved password)' : 'Password'}<input required={!form.id || !accounts.find(account => account.id === form.id)?.hasPassword} type="password" maxLength={1000} autoComplete="new-password" className={input} value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} /></label> : <p className="text-sm text-slate-600">Save the portal’s URL. Choose its Google, LinkedIn, or SSO button in Chromium and complete sign-in there. Provider passwords are never captured.</p>}
      <div className="flex gap-2"><button disabled={busy} type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save account'}</button><button disabled={busy} type="button" className={button} onClick={() => setForm(null)}>Cancel</button></div>
    </form>}
    <div className="space-y-3">{!accounts.length && !form && <p className="rounded-lg bg-slate-50 px-4 py-8 text-sm text-slate-500">No portal accounts yet. Add each website’s account separately.</p>}{accounts.map(account => <article key={account.id} className="rounded-lg border border-slate-200 p-4">
      <div className="flex justify-between gap-3"><div className="min-w-0"><h5 className="text-sm font-semibold text-slate-900">{account.label}</h5><p className="text-sm text-slate-600 break-all">{account.username || 'Choose account in browser'}</p><p className="mt-1 text-xs text-slate-500 break-all">{account.origin} · {account.method === 'password' ? (account.hasPassword ? 'Password saved' : 'Password needed') : account.method.toUpperCase()}</p></div><div className="flex items-start gap-1"><button disabled={busy} className="p-2 text-slate-500" aria-label={`Edit ${account.label}`} onClick={() => setForm({ id: account.id, label: account.label, loginUrl: account.loginUrl, username: account.username, method: account.method, password: '' })}><Pencil className="h-4 w-4" /></button><button disabled={busy} className="p-2 text-slate-500 hover:text-red-600" aria-label={`Remove ${account.label}`} onClick={() => setDeleteId(account.id)}><Trash2 className="h-4 w-4" /></button></div></div>
      <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy || disabled || !sessionId} className={button} onClick={() => browserAction('AUTH_OPEN', account.id)}>Open sign-in</button>{account.method === 'password' && <button disabled={busy || disabled || !sessionId} className={button} onClick={() => browserAction('AUTH_FILL', account.id)}>Fill login</button>}</div>
      {deleteId === account.id && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-red-700"><span>Remove this saved account from this PC?</span><button disabled={busy} className={button} onClick={async () => { setBusy(true); try { await request('DELETE', { id: account.id }); setDeleteId(null); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>Remove</button><button className={button} onClick={() => setDeleteId(null)}>Keep account</button></div>}
    </article>)}</div>
    <p className="text-xs text-slate-500">You finish sign-in and any verification in Chromium. Saved credentials remain on this PC; browser sessions may expire or require another login.</p>
  </section>;
}
