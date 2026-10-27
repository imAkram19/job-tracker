import { Page, Frame } from 'playwright';
import { randomUUID } from 'crypto';
import { FormField } from '../types/automation';

export class FormAnalyzer {
  constructor(private page: Page) {}

  public async discoverFields(): Promise<FormField[]> {
    const result: FormField[] = [];
    for (const frame of this.page.frames()) {
      const framePath: string[] = [];
      let current: Frame | null = frame;
      let hidden = false;
      while (current?.parentFrame()) {
        const element = await current.frameElement();
        if (!await element.isVisible()) { hidden = true; break; }
        let id = await element.getAttribute('data-akram-frame');
        if (!id) { id = randomUUID(); await element.evaluate((el, value) => (el as Element).setAttribute('data-akram-frame', value), id); }
        framePath.unshift(`[data-akram-frame="${id}"]`);
        current = current.parentFrame();
      }
      if (hidden) continue;
      try { result.push(...await this.scanFrame(frame, framePath)); }
      catch {
        if (frame.isDetached()) continue;
        await frame.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {});
        // A failed scan is not an empty, successfully processed application.
        result.push(...await this.scanFrame(frame, framePath));
      }
    }
    return result;
  }

  private async scanFrame(frame: Frame, framePath: string[]): Promise<FormField[]> {
    return frame.evaluate(({ prefix, framePath }) => {
      const roots: (Document | ShadowRoot)[] = [document];
      for (let i = 0; i < roots.length; i++) {
        for (const el of Array.from(roots[i].querySelectorAll('*'))) if (el.shadowRoot) roots.push(el.shadowRoot);
      }
      const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]),textarea,select,[role="combobox"],[aria-haspopup="listbox"]';
      const elements = roots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>(selector)));
      function visible(el: HTMLElement): boolean {
        for (let node: HTMLElement | null = el; node;) {
          const style = getComputedStyle(node);
          if (node.hidden || node.hasAttribute('inert') || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
          node = node.parentElement || ((node.getRootNode() as ShadowRoot).host as HTMLElement | undefined) || null;
        }
        return el.getClientRects().length > 0;
      }
      function enabled(el: HTMLElement): boolean {
        return !el.matches(':disabled,[disabled],[aria-disabled="true"]') &&
          (el.matches('[role="combobox"],[aria-haspopup="listbox"]') || !el.matches('[readonly],[aria-readonly="true"]'));
      }
      function labelText(el: Element): string {
        const clone = el.cloneNode(true) as Element;
        clone.querySelectorAll('input,textarea,select,button,[role="listbox"],[hidden],script,style').forEach(child => child.remove());
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
      }
      function label(el: HTMLElement): string {
        const root = el.getRootNode() as Document | ShadowRoot;
        const question = el.closest('.application-question,.custom-question')?.querySelector('.application-label');
        if (question) return labelText(question);
        const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
        const referenced = ids.map(id => root.querySelector(`#${CSS.escape(id)}`)).filter(Boolean) as Element[];
        if (referenced.length) return referenced.map(labelText).join(' ');
        if (el.getAttribute('aria-label')?.trim()) return el.getAttribute('aria-label')!.trim();
        const wrapping = el.closest('label');
        if (wrapping && labelText(wrapping)) return labelText(wrapping);
        const labels = Array.from((el as HTMLInputElement).labels || []);
        if (labels.length) return labels.map(labelText).join(' ');
        const group = el.closest('fieldset,.form-group,[role="group"],[class*="question"],[class*="form-item"],.field');
        const heading = group?.querySelector('legend,label,.application-label,[class*="label"],h3,h4');
        if (heading && labelText(heading)) return labelText(heading);
        return el.getAttribute('placeholder') || el.getAttribute('name') || '';
      }
      function eligible(el: HTMLElement): boolean {
        const meta = `${label(el)} ${el.getAttribute('name') || ''}`;
        if (!enabled(el) || (!visible(el) && !(el.matches('input[type="file"]') && el.parentElement && visible(el.parentElement)))) return false;
        if (el.matches('input[type="password"],input[type="search"],[autocomplete="username"],[autocomplete="one-time-code"],[autocomplete="current-password"],[autocomplete="new-password"]')) return false;
        return !el.closest('[role="search"],form:has(input[type="password"])') &&
          !/\b(search|password|passcode|verification code|captcha)\b/i.test(meta) &&
          !/\/(login|signin|sign-in|sign_in|auth|authenticate|register)(\/|$)/i.test(location.pathname);
      }
      const seen = new Set<HTMLElement>();
      const found: any[] = [];
      let sequence = 0;
      for (const el of elements) {
        if (seen.has(el) || !eligible(el)) continue;
        let type = el instanceof HTMLSelectElement ? 'select' : el instanceof HTMLTextAreaElement ? 'textarea' :
          el.matches('[role="combobox"],[aria-haspopup="listbox"]') ? 'combobox' : (el as HTMLInputElement).type || 'text';
        if (!['select','textarea','combobox','radio','checkbox','file','email','tel','number','date'].includes(type)) type = 'text';
        const input = el as HTMLInputElement;
        const choices = ['radio','checkbox'].includes(type) && input.name ? elements.filter(other => {
          const candidate = other as HTMLInputElement;
          return candidate.type === type && candidate.name === input.name && candidate.form === input.form && candidate.getRootNode() === input.getRootNode() && eligible(other);
        }) as HTMLInputElement[] : [];
        const grouped = type === 'radio' || (type === 'checkbox' && choices.length > 1);
        const members: HTMLElement[] = grouped && choices.length ? choices : [el];
        let rawLabel = label(el);
        if (grouped) {
          const group = el.closest('fieldset,[role="radiogroup"],.application-question,.custom-question,.form-group,[class*="question"]');
          const heading = group?.querySelector('legend,.application-label,[class*="label"]');
          rawLabel = heading ? labelText(heading) : group?.getAttribute('aria-label') || input.name || rawLabel;
        }
        const required = members.some(member => member.hasAttribute('required') || member.getAttribute('aria-required') === 'true') || /[*✱]|\(required\)\s*$/i.test(rawLabel);
        const cleaned = rawLabel.replace(/[*✱]/g,'').replace(/\(required\)\s*$/i,'').replace(/\s+/g,' ').trim();
        const token = el.getAttribute('data-akram-field') || `${prefix}-${sequence++}`;
        for (const member of members) { member.setAttribute('data-akram-field',token); seen.add(member); }
        let options: string[] | undefined;
        let value = input.value || '';
        if (grouped) {
          options = members.map(member => labelText((member as HTMLInputElement).labels?.[0] || member) || (member as HTMLInputElement).value);
          value = members.map((member,i) => (member as HTMLInputElement).checked ? options![i] : '').filter(Boolean).join('; ');
        } else if (el instanceof HTMLSelectElement) {
          options = Array.from(el.options).filter(o => o.value && !o.disabled && !(o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled)).map(o=>o.text.trim());
          value = el.value ? el.selectedOptions[0]?.text.trim() || '' : '';
        } else if (type === 'checkbox') value = input.checked ? 'Yes' : 'No';
        found.push({ id: token, name: input.name || '', label: cleaned || input.name || `Field ${found.length+1}`, type, required, options,
          selector: `[data-akram-field="${token}"]`, framePath, pageOrigin: self.origin, currentValue: value });
      }
      return found;
    }, { prefix: randomUUID(), framePath });
  }

  public async findActionButtons(): Promise<{submitButton: string | null; nextButton: string | null}> {
    // Navigation remains manual. These selectors are only used to explain the next step.
    const result = { submitButton: null as string | null, nextButton: null as string | null };
    const buttons = this.page.getByRole('button');
    for (let i=0;i<await buttons.count();i++) {
      const button=buttons.nth(i); if (!await button.isVisible() || !await button.isEnabled()) continue;
      const text=(await button.innerText()).trim();
      if (/submit|send application|apply now/i.test(text)) result.submitButton=text;
      else if (/next|continue|proceed/i.test(text)) result.nextButton=text;
    }
    return result;
  }
}
