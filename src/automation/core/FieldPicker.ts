import { FormAnalyzer } from './FormAnalyzer';
import { readDropdownOptions } from './DropdownControl';
import type { FormField } from '../types/automation';
import { randomUUID } from 'crypto';
import { Page, Frame } from 'playwright';
import { PickedField, excludedMemoryField } from './SelectedAnswerMemory';

type PickerState = { active: boolean; selected: PickedField | null; error?: string };

export class FieldPicker {
  private page?: Page;
  private discovered: FormField[] = [];
  private token = '';
  private binding = `__akramPick_${randomUUID().replace(/-/g, '')}`;
  private boundPages = new WeakSet<Page>();
  private state: PickerState = { active: false, selected: null };
  private timer?: ReturnType<typeof setTimeout>;
  private onFrame = (frame: Frame) => { if (this.state.active) void this.install(frame).catch(() => {}); };
  private onClose = () => { void this.cancel(); };
  public status(): PickerState { return this.state; }

  public async start(page: Page): Promise<void> {
    await this.cancel();
    this.page = page;
    this.discovered = await new FormAnalyzer(page).discoverFields();
    this.token = randomUUID();
    this.state = { active: true, selected: null };
    if (!this.boundPages.has(page)) {
      await page.exposeBinding(this.binding, async ({ frame }, token: string, field: Omit<PickedField, 'id' | 'origin'> | null, error?: string) => {
        if (!this.state.active || token !== this.token) return;
        if (error) { this.state.error = error; return; }
        if (!field) { await this.cancel(); return; }
        if (excludedMemoryField(field.label, field.type, field.name)) { this.state.error = 'Choose an application question, not a search or login field.'; return; }
        let origin: string;
        try { origin = await frame.evaluate(() => self.origin); } catch { return; }
        if (!origin.startsWith('https://') && !origin.startsWith('http://')) return;
        if (['select', 'combobox'].includes(field.type)) {
          try {
            if (field.type === 'combobox') await this.clearOverlays();
            if (!field.selector) throw new Error('Choose this dropdown again to read its options.');
            field.options = await readDropdownOptions(frame.locator(field.selector));
            if (!this.state.active || token !== this.token) return;
          } catch (err) {
            if (!this.state.active || token !== this.token) return;
            await this.cancel();
            this.state.error = err instanceof Error ? err.message : 'Unable to read dropdown options.';
            return;
          }
        }
        const selected: PickedField = { ...field, id: randomUUID(), origin };
        await this.clearOverlays();
        if (!this.state.active || token !== this.token) return;
        if (this.timer) clearTimeout(this.timer);
        this.state = { active: false, selected };
      });
      this.boundPages.add(page);
    }
    page.on('framenavigated', this.onFrame);
    page.on('frameattached', this.onFrame);
    page.on('close', this.onClose);
    const installed = await Promise.allSettled(page.frames().map(frame => this.install(frame)));
    if (!installed.some(result => result.status === 'fulfilled')) {
      await this.cancel();
      throw new Error('This page cannot be inspected yet. Wait for the application form to load and try again.');
    }
    this.timer = setTimeout(() => { void this.cancel(); }, 120000);
    await page.bringToFront();
  }

  public async cancel(): Promise<void> {
    this.state = { active: false, selected: null };
    this.token = '';
    if (this.timer) clearTimeout(this.timer);
    await this.clearOverlays();
  }

  private async clearOverlays(): Promise<void> {
    if (!this.page) return;
    this.page.off('framenavigated', this.onFrame);
    this.page.off('frameattached', this.onFrame);
    this.page.off('close', this.onClose);
    await Promise.allSettled(this.page.frames().map(frame => frame.evaluate(() => {
      (window as any).__akramPickerCleanup?.();
    })));
  }

  private async install(frame: Frame): Promise<void> {
    await frame.evaluate(({ binding, token, fields }) => {
      (window as any).__akramPickerCleanup?.();
      const hint = document.createElement('div');
      hint.textContent = 'Select a question field · Esc to cancel';
      hint.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#2563eb;color:white;padding:12px 18px;border-radius:10px;font:14px system-ui;pointer-events:none;box-shadow:0 4px 24px #0f172a33';
      const outline = document.createElement('div');
      outline.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #2563eb;background:#2563eb18;border-radius:4px;display:none';
      document.documentElement.append(hint, outline);
      const selector = 'input,textarea,select,[role="combobox"],[aria-haspopup="listbox"],[role="radio"],[role="checkbox"],[contenteditable="true"]';
      function target(event: Event): HTMLElement | null {
        for (const node of event.composedPath()) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(selector)) return node;
          const label = node.closest('label') as HTMLLabelElement | null;
          if (label?.control instanceof HTMLElement) return label.control;
        }
        return null;
      }
      function knownField(el: HTMLElement) {
        const marker = el.getAttribute('data-akram-field');
        return marker ? fields.find(field => field.selector === `[data-akram-field="${marker}"]`) : undefined;
      }
      function labelFor(el: HTMLElement): string {
        const known = knownField(el); if (known) return known.label;
        if (el instanceof HTMLInputElement && ['radio','checkbox'].includes(el.type) && el.name) {
          const group = el.closest('fieldset,[role="radiogroup"],.application-question,.custom-question,.form-group,[class*="question"]') || el.closest('[class*="field"],div');
          const legend = group?.querySelector('legend, .application-label, label, h4, h5, [class*="label"]') as HTMLElement | null;
          if (legend?.innerText.trim()) return legend.innerText.trim();
        }
        // Portal question text takes precedence over generic "Type your response" placeholders.
        const questionLabel = el.closest('.application-question,.custom-question')?.querySelector('.application-label')?.textContent?.trim();
        if (questionLabel) return questionLabel;
        // 1. Check aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

        // 2. Check aria-labelledby
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          const labelText = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim() || '').join(' ').trim();
          if (labelText) return labelText;
        }

        // 3. Check for explicitly linked <label for="id">
        if (el.id) {
          const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`) as HTMLElement;
          if (labelEl && labelEl.innerText.trim()) return labelEl.innerText.trim();
        }

        // 4. Check wrapping <label>
        const parentLabel = el.closest('label');
        if (parentLabel && parentLabel.innerText.trim()) {
          const clone = parentLabel.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('input, select, textarea').forEach((n) => n.remove());
          if (clone.innerText.trim()) return clone.innerText.trim();
        }

        // 5. Check placeholder
        const placeholder = el.getAttribute('placeholder');
        if (placeholder && placeholder.trim()) return placeholder.trim();

        // 6. Check closest preceding label, heading, or fieldset legend
        const container = el.closest(
          'fieldset, .form-group, .field, [class*="field"], [class*="form-item"], [class*="question"], li, div'
        );
        if (container) {
          const legend = container.querySelector(
            'legend, label, h3, h4, h5, [class*="label"], [class*="title"]'
          ) as HTMLElement;
          if (legend && legend.innerText.trim() && !legend.contains(el)) {
            return legend.innerText.trim();
          }
        }

        // 7. Check name attribute
        const nameAttr = el.getAttribute('name');
        if (nameAttr) return nameAttr;

        return '';
      }
      function blocked(el: HTMLElement): boolean {
        const input = el as HTMLInputElement;
        const dropdown = el.matches('[role="combobox"],[aria-haspopup="listbox"]');
        return el.matches(':disabled,[aria-disabled="true"]') || (!dropdown && el.hasAttribute('readonly')) ||
          ['password','search','file','hidden','submit','reset'].includes(input.type) || (!dropdown && input.type === 'button') ||
          !!el.closest('[role="search"],form:has(input[type="password"])') ||
          /\b(password|passcode|otp|verification code|search|captcha|username|sign in|log in)\b/i.test(`${labelFor(el)} ${input.name || ''}`) ||
          ['current-password','new-password','one-time-code','username'].includes(el.getAttribute('autocomplete') || '');
      }
      const move = (event: Event) => {
        const el = target(event);
        if (!el) { outline.style.display = 'none'; return; }
        const rect = el.getBoundingClientRect();
        Object.assign(outline.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderColor: blocked(el) ? '#dc2626' : '#2563eb' });
      };
      const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
      const click = (event: Event) => {
        const el = target(event);
        stop(event);
        if (!el) return;
        if (blocked(el)) { hint.textContent = 'Search and sign-in fields are excluded. Select an application question.'; return; }
        const input = el as HTMLInputElement;
        const label = labelFor(el).replace(/\s+/g, ' ').replace(/[*✱]/g, '').trim();
        if (!label) { hint.textContent = 'This field has no question label. Choose a labelled field.'; return; }
        const rawType = input.type || el.getAttribute('role') || 'text';
        const type = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : el.matches('[role="combobox"],[aria-haspopup="listbox"]') ? 'combobox' : (['email','tel','checkbox','radio','date','number','text'].includes(rawType) ? rawType : 'text');
        let value = input.value || el.textContent || '';
        let options: string[] | undefined;
        if (el instanceof HTMLSelectElement) { options = Array.from(el.options).filter(o => !o.disabled && o.value).map(o => o.text.trim()); value = el.selectedOptions[0]?.value ? el.selectedOptions[0].text.trim() : ''; }
        if (input.type === 'checkbox') value = input.checked ? 'Yes' : 'No';
        if (input.type === 'radio' || (input.type === 'checkbox' && document.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(input.name)}"]`).length > 1)) {
          const root = el.getRootNode() as Document | ShadowRoot;
          const known = knownField(el);
          const group = Array.from(root.querySelectorAll<HTMLInputElement>(known?.selector || `input[type="${input.type}"][name="${CSS.escape(input.name)}"]`));
          const optionLabel = (radio: HTMLInputElement) => Array.from(radio.labels || []).map(l => l.textContent?.trim()).join(' ') || radio.value;
          options = group.map(optionLabel);
          value = group.find(r => r.checked) ? optionLabel(group.find(r => r.checked)!) : '';
        }
        const known = knownField(el);
        if (known?.options) options = known.options;
        if (!el.hasAttribute('data-akram-field')) el.setAttribute('data-akram-field', `pick-${token}`);
        const fieldSelector = `[data-akram-field="${el.getAttribute('data-akram-field')}"]`;
        void (window as any)[binding](token, { label, name: input.name || '', type, value: value.slice(0,10000), options, selector: fieldSelector });
      };
      const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { stop(event); void (window as any)[binding](token, null); } };
      document.addEventListener('pointermove', move, true);
      document.addEventListener('pointerdown', stop, true);
      document.addEventListener('mousedown', stop, true);
      document.addEventListener('click', click, true);
      document.addEventListener('keydown', key, true);
      (window as any).__akramPickerCleanup = () => {
        hint.remove(); outline.remove();
        document.removeEventListener('pointermove', move, true);
        document.removeEventListener('pointerdown', stop, true);
        document.removeEventListener('mousedown', stop, true);
        document.removeEventListener('click', click, true);
        document.removeEventListener('keydown', key, true);
        delete (window as any).__akramPickerCleanup;
      };
    }, { binding: this.binding, token: this.token, fields: this.discovered });
  }
}
