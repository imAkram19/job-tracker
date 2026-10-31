import { randomUUID } from 'crypto';
import { FormField } from '../types/automation';
import { localDataFile, readLocal, writeLocal } from './localData';

export interface PickedField {
  id: string;
  label: string;
  name: string;
  type: string;
  value: string;
  origin: string;
  options?: string[];
  selector?: string;
}

export interface SelectedAnswer extends PickedField {
  answer: string;
  scope: 'site' | 'all';
  updatedAt: string;
  approved?: boolean;
}

export const normalizeQuestion = (text: string) => text.toLowerCase().replace(/\(required\)|\*/g, '').replace(new RegExp('[^\\p{L}\\p{N}]+', 'gu'), ' ').trim();
const sameType = (a: string, b: string) =>
  !a || !b || a === b ||
  (['text', 'textarea', 'email', 'tel', 'string', 'unknown', ''].includes(a) && ['text', 'textarea', 'email', 'tel', 'string', 'unknown', ''].includes(b)) ||
  (['select', 'combobox', 'radio'].includes(a) && ['select', 'combobox', 'radio'].includes(b)) ||
  (['text', 'textarea', ''].includes(a) && ['select', 'combobox', 'radio', 'checkbox'].includes(b));
export function excludedMemoryField(label: string, type = '', name = ''): boolean {
  return ['password', 'search', 'file', 'hidden', 'submit', 'button'].includes(type.toLowerCase()) ||
    /\b(password|passcode|otp|verification code|one time code|search|captcha|authentication|login|log in|sign in|username)\b/i.test(`${label} ${name}`);
}

export class SelectedAnswerMemory {
  private file = localDataFile('selected-answers.json');
  public list(): SelectedAnswer[] { return readLocal<SelectedAnswer[]>(this.file, []); }

  public save(field: PickedField, answer: string, scope: 'site' | 'all' = 'all'): SelectedAnswer {
    if (excludedMemoryField(field.label, field.type, field.name)) throw new Error('Use Authentication for login details. Search boxes cannot be remembered.');
    if (!field.label.trim() || !answer.trim() || answer.length > 10000) throw new Error('Provide a question and an answer (up to 10,000 characters).');
    if (['select', 'combobox'].includes(field.type) && !field.options?.includes(answer)) throw new Error('Choose one of the captured dropdown options.');
    const entries = this.list();
    const key = normalizeQuestion(field.label);
    const existing = entries.find(item => normalizeQuestion(item.label) === key && item.origin === field.origin && item.type === field.type && item.scope === scope);
    const record: SelectedAnswer = { ...field, id: existing?.id || randomUUID(), value: '', answer: answer.trim(), scope, approved: false, updatedAt: new Date().toISOString() };
    writeLocal(this.file, [...entries.filter(item => item.id !== record.id), record]);
    return record;
  }

  public remove(id: string): void { writeLocal(this.file, this.list().filter(item => item.id !== id)); }

  public promote(id: string): void {
    const entries = this.list();
    const chosen = entries.find(entry => entry.id === id);
    if (!chosen) throw new Error('Saved question not found.');
    if (excludedMemoryField(chosen.label, chosen.type, chosen.name)) throw new Error('Search and authentication fields cannot enter the answer bank.');
    if (!chosen.answer.trim()) throw new Error('Save an answer before adding it to Entered fields.');
    // One approved answer per exact question and input type across websites.
    writeLocal(this.file, entries.map(entry => entry.id === id
      ? { ...entry, approved: true, scope: 'all', updatedAt: new Date().toISOString() }
      : normalizeQuestion(entry.label) === normalizeQuestion(chosen.label) && sameType(entry.type, chosen.type)
        ? { ...entry, approved: false } : entry));
  }

  public rememberFilled(field: FormField, answer: string): void {
    if (excludedMemoryField(field.label, field.type, field.name) || !normalizeQuestion(field.label) ||
        !answer.trim() || answer.length > 10000) return;
    const entries = this.list();
    const key = normalizeQuestion(field.label);
    const matches = (entry: SelectedAnswer) => normalizeQuestion(entry.label) === key && sameType(entry.type, field.type);
    const existing = entries.find(entry => entry.approved && matches(entry)) ||
      entries.find(entry => !entry.approved && matches(entry) && entry.origin === field.pageOrigin);
    if (existing?.approved && existing.answer === answer && existing.scope === 'all') return;
    const record: SelectedAnswer = {
      id: existing?.id || randomUUID(), label: field.label, name: field.name, type: field.type,
      value: '', origin: field.pageOrigin || '', options: field.options,
      answer: answer.trim(), scope: 'all', approved: true, updatedAt: new Date().toISOString(),
    };
    writeLocal(this.file, [...entries.filter(entry => entry.id !== record.id).map(entry =>
      matches(entry) ? { ...entry, approved: false } : entry), record]);
  }

  public unapprove(id: string): void {
    writeLocal(this.file, this.list().map(entry => entry.id === id ? { ...entry, approved: false } : entry));
  }

  public updateApproved(id: string, answer: string): void {
    if (!answer.trim() || answer.length > 10000) throw new Error('Provide an answer up to 10,000 characters.');
    const entries = this.list();
    if (!entries.some(entry => entry.id === id && entry.approved)) throw new Error('This question is not in Entered fields.');
    writeLocal(this.file, entries.map(entry => entry.id === id ? { ...entry, answer: answer.trim(), updatedAt: new Date().toISOString() } : entry));
  }

  public find(field: FormField): SelectedAnswer | undefined {
    if (excludedMemoryField(field.label, field.type, field.name)) return;
    const matches = this.list().filter(item => item.approved === true && normalizeQuestion(item.label) === normalizeQuestion(field.label) &&
      sameType(item.type, field.type) && (item.scope === 'all' || item.origin === field.pageOrigin));
    const local = matches.filter(item => item.scope === 'site');
    const preferred = local.length ? local : matches;
    // Conflicting exact memories require review rather than a random winner.
    if (new Set(preferred.map(item => item.answer)).size !== 1) return;
    return preferred[preferred.length - 1];
  }
}
