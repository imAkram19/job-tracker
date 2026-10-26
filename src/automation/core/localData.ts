import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

export function localDataFile(name: string): string {
  const root = process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share');
  return path.join(root, 'AkramJobTracker', name);
}

export function readLocal<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  // A corrupt store must never be silently overwritten with an empty one.
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function writeLocal(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

export function safePortalUrl(raw: string): URL {
  const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) {
    throw new Error('Enter an HTTPS website address without credentials.');
  }
  url.hash = '';
  return url;
}
