import fs from 'fs';
import path from 'path';

export interface PortalAccount {
  id: string;
  domain: string;
  portalName: string;
  authMethod: 'Google' | 'LinkedIn' | 'Email/Password' | 'SSO' | 'Other';
  email?: string;
  username?: string;
  password?: string;
  lastUsed: string;
  notes?: string;
}

export class PortalAccountManager {
  private filePath: string;
  private accounts: PortalAccount[] = [];

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'src', 'automation', 'data', 'portalAccounts.json');
    this.load();
  }

  public load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.accounts = JSON.parse(raw);
      } else {
        this.accounts = [];
      }
    } catch (err) {
      console.error('Failed to load portal accounts:', err);
      this.accounts = [];
    }
  }

  public save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.accounts, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save portal accounts:', err);
    }
  }

  public getAccounts(): PortalAccount[] {
    return this.accounts;
  }

  public findByDomain(urlOrDomain: string): PortalAccount | undefined {
    const clean = urlOrDomain.toLowerCase();
    return this.accounts.find((acc) => clean.includes(acc.domain.toLowerCase()));
  }

  public recordAccount(
    domain: string,
    portalName: string,
    details: {
      authMethod?: 'Google' | 'LinkedIn' | 'Email/Password' | 'SSO' | 'Other';
      email?: string;
      username?: string;
      password?: string;
      notes?: string;
    }
  ): PortalAccount {
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const existingIndex = this.accounts.findIndex((acc) => acc.domain === cleanDomain);

    const account: PortalAccount = {
      id: existingIndex >= 0 ? this.accounts[existingIndex].id : `portal_${Date.now()}`,
      domain: cleanDomain,
      portalName: portalName || cleanDomain,
      authMethod: details.authMethod || 'Email/Password',
      email: details.email || 'iamakram1902@gmail.com',
      username: details.username,
      password: details.password,
      lastUsed: new Date().toISOString(),
      notes: details.notes || 'Recorded from application automation session',
    };

    if (existingIndex >= 0) {
      this.accounts[existingIndex] = {
        ...this.accounts[existingIndex],
        ...account,
      };
    } else {
      this.accounts.push(account);
    }

    this.save();
    return account;
  }
}
