import { execFile } from 'child_process';
import path from 'path';
import { randomUUID } from 'crypto';
import { Page } from 'playwright';
import { localDataFile, readLocal, safePortalUrl, writeLocal } from './localData';

export type AuthMethod = 'password' | 'google' | 'linkedin' | 'sso';
interface AccountRecord {
  id: string;
  label: string;
  loginUrl: string;
  origin: string;
  username: string;
  method: AuthMethod;
  encryptedPassword?: string;
  updatedAt: string;
}
export type PortalAccountSummary = Omit<AccountRecord, 'encryptedPassword'> & { hasPassword: boolean };
export interface AccountInput { id?: string; label: string; loginUrl: string; username: string; method: AuthMethod; password?: string }

// Windows DPAPI binds ciphertext to this Windows user. Secrets travel over stdin,
// never shell arguments, logs, Git, browser localStorage, or the QA cloud store.
function protect(value: string, decrypt = false): Promise<string> {
  if (process.platform !== 'win32') return Promise.reject(new Error('Password storage currently requires the Windows desktop app.'));
  const command = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $entropy=[Text.Encoding]::UTF8.GetBytes('AkramJobTracker.Authentication.v1'); $result=[Security.Cryptography.ProtectedData]::${decrypt ? 'Unprotect' : 'Protect'}($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`;
  return new Promise((resolve, reject) => {
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const child = execFile(executable, ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) { reject(new Error('Windows could not unlock or save this credential. Use the Windows account that created it.')); return; }
      resolve(decrypt ? Buffer.from(stdout.trim(), 'base64').toString('utf8') : stdout.trim());
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end(decrypt ? value : Buffer.from(value, 'utf8').toString('base64'));
  });
}

export class PortalAuthentication {
  private file = localDataFile('portal-authentication.json');
  private static pending: Promise<unknown> = Promise.resolve();
  private records(): AccountRecord[] { return readLocal<AccountRecord[]>(this.file, []); }
  public list(): PortalAccountSummary[] {
    return this.records().map(({ encryptedPassword, ...metadata }) => ({ ...metadata, hasPassword: !!encryptedPassword }));
  }
  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const next = PortalAuthentication.pending.then(action, action);
    PortalAuthentication.pending = next.catch(() => {});
    return next;
  }
  public save(input: AccountInput): Promise<PortalAccountSummary[]> {
    return this.serialize(async () => {
      if (!input || typeof input.label !== 'string' || !input.label.trim() || input.label.length > 100 ||
        typeof input.loginUrl !== 'string' || input.loginUrl.length > 2000 || typeof input.username !== 'string' || input.username.length > 300 ||
        !['password','google','linkedin','sso'].includes(input.method) || (input.password !== undefined && (typeof input.password !== 'string' || input.password.length > 1000))) {
        throw new Error('Provide a portal name, HTTPS sign-in URL, account, and sign-in method.');
      }
      const url = safePortalUrl(input.loginUrl);
      const records = this.records();
      const existing = input.id ? records.find(record => record.id === input.id) : records.find(record => record.origin === url.origin && record.username === input.username.trim() && record.method === input.method);
      if (input.id && !existing) throw new Error('Account no longer exists. Reload Authentication.');
      if (existing?.encryptedPassword && existing.origin !== url.origin && !input.password && input.method === 'password') {
        throw new Error('Enter the password again when changing the website.');
      }
      const encryptedPassword = input.method === 'password' ? (input.password ? await protect(input.password) : existing?.encryptedPassword) : undefined;
      if (input.method === 'password' && (!input.username.trim() || !encryptedPassword)) throw new Error('Enter a username and password for this account.');
      const record: AccountRecord = { id: existing?.id || randomUUID(), label: input.label.trim(), loginUrl: url.href, origin: url.origin,
        username: input.username.trim(), method: input.method, encryptedPassword, updatedAt: new Date().toISOString() };
      writeLocal(this.file, [...records.filter(item => item.id !== record.id), record]);
      return this.list();
    });
  }
  public remove(id: string): Promise<PortalAccountSummary[]> {
    return this.serialize(async () => { writeLocal(this.file, this.records().filter(item => item.id !== id)); return this.list(); });
  }
  public account(id: string): PortalAccountSummary {
    const account = this.list().find(item => item.id === id);
    if (!account) throw new Error('Account not found.');
    return account;
  }
  public async fill(id: string, page: Page): Promise<string> {
    const account = this.records().find(item => item.id === id);
    if (!account || account.method !== 'password' || !account.encryptedPassword) throw new Error('Complete this provider sign-in directly in Chromium.');
    if (new URL(page.url()).origin !== account.origin) throw new Error('The browser is on a different website. Open this account’s sign-in page first.');
    // Refuse ambiguous pages rather than filling registration or password-reset forms.
    const passwords = page.locator('input[type="password"]:visible:not([autocomplete="new-password"])');
    const allPasswords = page.locator('input[type="password"]:visible');
    const usernames = page.locator('input[autocomplete="username"]:visible, input[type="email"]:visible, input[name="username"]:visible, input[name="email"]:visible, input[name="login"]:visible');
    const passwordCount = await passwords.count();
    const usernameCount = await usernames.count();
    if (passwordCount > 1 || (await allPasswords.count()) !== passwordCount || usernameCount > 1 || (!passwordCount && !usernameCount)) {
      throw new Error('The login fields are ambiguous. Please enter credentials manually on this page.');
    }
    try {
      if (usernameCount === 1) await usernames.fill(account.username);
      if (passwordCount === 1) {
        // Recheck after any username-driven navigation before releasing a password.
        const password = await protect(account.encryptedPassword, true);
        if (new URL(page.url()).origin !== account.origin) throw new Error('Website changed.');
        await passwords.fill(password);
      }
    } catch {
      // Playwright errors may include a fill value. Do not expose those errors.
      throw new Error('The sign-in page changed or could not be filled. Check the browser and retry.');
    }
    return passwordCount ? 'Login fields filled. Review and sign in in Chromium.' : 'Username filled. Continue in Chromium, then use Fill login for the password step.';
  }
}
