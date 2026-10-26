import { Page } from 'playwright';
import { FormField, InputElementType } from '../types/automation';

export class FormAnalyzer {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Scans the active DOM using reliable accessible labeling heuristics
   * to discover interactive form fields, labels, requirements, and options.
   */
  public async discoverFields(): Promise<FormField[]> {
    try {
      return await this.evaluateFields();
    } catch {
      // If page was navigating/reloading (e.g. immediately after Google login completes),
      // wait a short moment for DOM to settle and retry
      try {
        await this.page.waitForTimeout(1500);
        return await this.evaluateFields();
      } catch {
        return [];
      }
    }
  }

  private async evaluateFields(): Promise<FormField[]> {
    return await this.page.evaluate(() => {
      const discovered: any[] = [];
      const seen = new Set<Element>();
      const processedRadioNames = new Set<string>();

      // Heuristic helper to find label text for an element
      function findLabel(el: HTMLElement): string {
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

      function cleanLabel(raw: string): { label: string; required: boolean } {
        let isRequired = false;
        let text = raw.replace(/\n+/g, ' ').trim();
        if (/[*✱]/.test(text) || /required/i.test(text)) {
          isRequired = true;
          text = text.replace(/[*✱]/g, '').replace(/\(required\)/gi, '').trim();
        }
        return { label: text, required: isRequired };
      }

      // Collect all inputs, textareas, selects, and file inputs
      const elements = Array.from(
        document.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, input[type="file"]'
        )
      ) as HTMLElement[];

      let index = 0;
      for (const el of elements) {
        const meta = [findLabel(el), el.getAttribute('name') || '', el.getAttribute('autocomplete') || ''].join(' ');
        if (el.matches('input[type="password"],input[type="search"],input[autocomplete="username"],input[autocomplete="one-time-code"],input[autocomplete="current-password"],input[autocomplete="new-password"]') ||
          el.closest('[role="search"],form:has(input[type="password"])') ||
          /\b(search|password|passcode|verification code|captcha)\b/i.test(meta) ||
          /\/(login|signin|sign-in|sign_in|auth|authenticate|register)(\/|$)/i.test(location.pathname)) continue;
        const isFileInput = el instanceof HTMLInputElement && el.type === 'file';
        if (!isFileInput) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            continue;
          }
        }

        if (seen.has(el)) continue;

        // Group radio buttons by name into a single FormField
        if (el instanceof HTMLInputElement && el.name && (el.type === 'radio' || (el.type === 'checkbox' && document.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(el.name)}"]`).length > 1))) {
          if (processedRadioNames.has(el.name)) {
            continue;
          }
          processedRadioNames.add(el.name);

          const radios = Array.from(
            document.querySelectorAll(`input[type="${el.type}"][name="${CSS.escape(el.name)}"]`)
          ) as HTMLInputElement[];

          radios.forEach((r) => seen.add(r));

          // Find container label / question text for the radio group
          const groupContainer = el.closest('fieldset,[role="radiogroup"],.application-question,.custom-question,.form-group,[class*="question"]') || el.closest('[class*="field"],div');
          let groupLabel = '';
          if (groupContainer) {
            const legend = groupContainer.querySelector('legend, .application-label, label, h4, h5, [class*="label"]') as HTMLElement;
            if (legend && legend.innerText.trim()) {
              groupLabel = legend.innerText.trim();
            }
          }
          if (!groupLabel) groupLabel = findLabel(el);

          const { label: cleanedGroupLabel, required: req } = cleanLabel(groupLabel);

          const options: string[] = [];
          let currentValue = '';

          radios.forEach((r) => {
            const rLabel =
              r.closest('label')?.textContent?.trim() ||
              document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent?.trim() ||
              r.value;
            if (rLabel) options.push(rLabel);
            if (r.checked) currentValue = rLabel || r.value;
          });

          discovered.push({
            pageOrigin: location.origin,
            id: el.name,
            name: el.name,
            label: cleanedGroupLabel || el.name,
            type: el.type,
            required: req || radios.some((r) => r.required),
            options,
            selector: `input[type="radio"][name="${CSS.escape(el.name)}"]`,
            currentValue,
          });

          index++;
          continue;
        }

        seen.add(el);

        const rawLabel = findLabel(el);
        const { label, required: labelReq } = cleanLabel(rawLabel);

        const htmlRequired =
          el.hasAttribute('required') ||
          el.getAttribute('aria-required') === 'true' ||
          el.classList.contains('required') ||
          labelReq;

        let type: InputElementType = 'text';
        let options: string[] | undefined;

        if (el instanceof HTMLTextAreaElement) {
          type = 'textarea';
        } else if (el instanceof HTMLSelectElement) {
          type = 'select';
          options = Array.from(el.options)
            .map((o) => o.text.trim())
            .filter((t) => t && !t.toLowerCase().startsWith('select') && !t.toLowerCase().startsWith('choose'));
        } else if (el instanceof HTMLInputElement) {
          const rawType = el.type.toLowerCase();
          if (rawType === 'file') type = 'file';
          else if (rawType === 'password') type = 'password';
          else if (rawType === 'email') type = 'email';
          else if (rawType === 'tel') type = 'tel';
          else if (rawType === 'checkbox') type = 'checkbox';
          else if (rawType === 'date') type = 'date';
          else if (rawType === 'number') type = 'number';
          else type = 'text';
        }

        let selector = '';
        if (el.id) {
          selector = `#${CSS.escape(el.id)}`;
        } else if (el.getAttribute('name')) {
          selector = `[name="${CSS.escape(el.getAttribute('name')!)}"]`;
        } else {
          selector = `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
        }

        let currentVal = (el as HTMLInputElement).value || '';
        if (el instanceof HTMLSelectElement) {
          const selected = el.selectedOptions[0];
          if (selected && !selected.text.toLowerCase().startsWith('select') && !selected.text.toLowerCase().startsWith('choose')) {
            currentVal = selected.text.trim() || selected.value.trim();
          }
        } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
          currentVal = el.checked ? 'Yes' : 'No';
        }

        discovered.push({
            pageOrigin: location.origin,
          id: el.id || el.getAttribute('name') || `field_${index}`,
          name: el.getAttribute('name') || '',
          label: label || el.getAttribute('placeholder') || el.getAttribute('name') || `Field ${index + 1}`,
          type,
          required: htmlRequired,
          options,
          selector,
          currentValue: currentVal,
        });

        index++;
      }

      return discovered;
    });
  }

  public async findActionButtons(): Promise<{
    submitButton: string | null;
    nextButton: string | null;
  }> {
    return await this.page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, [role="button"]')
      ) as HTMLElement[];

      let submitSelector: string | null = null;
      let nextSelector: string | null = null;

      for (const btn of buttons) {
        const text = (btn.innerText || (btn as HTMLInputElement).value || btn.getAttribute('aria-label') || '').toLowerCase().trim();

        if (
          text.includes('submit') ||
          text.includes('send application') ||
          text.includes('apply now') ||
          text.includes('review application')
        ) {
          if (!submitSelector) {
            submitSelector = btn.id ? `#${btn.id}` : btn.className ? `button.${btn.className.split(' ')[0]}` : 'button[type="submit"]';
          }
        } else if (
          text.includes('next') ||
          text.includes('continue') ||
          text.includes('proceed') ||
          text.includes('save & continue')
        ) {
          if (!nextSelector) {
            nextSelector = btn.id ? `#${btn.id}` : btn.className ? `button.${btn.className.split(' ')[0]}` : 'button';
          }
        }
      }

      return { submitButton: submitSelector, nextButton: nextSelector };
    });
  }
}
