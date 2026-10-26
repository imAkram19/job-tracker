import type { Page, FrameLocator, Locator } from 'playwright';
import type { FormField } from '../types/automation';

export function fieldLocator(page: Page, field: Pick<FormField, 'selector' | 'framePath'>): Locator {
  let scope: Page | FrameLocator = page;
  for (const frame of field.framePath || []) scope = scope.frameLocator(frame);
  return scope.locator(field.selector);
}

export function isResumeField(field: FormField): boolean {
  return field.type === 'file' && /\b(resume|cv|curriculum vitae)\b/i.test(`${field.label} ${field.name}`) &&
    !/\b(cover letter|photo|passport|certificate|transcript)\b/i.test(`${field.label} ${field.name}`);
}
