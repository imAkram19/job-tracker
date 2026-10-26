import { FormAnalyzer } from './FormAnalyzer';
import { Page } from 'playwright';
import { ApplicationStateManager } from './ApplicationStateManager';

export interface ValidationReport {
  hasErrors: boolean;
  errorMessages: string[];
  invalidFieldLabels: string[];
}

export class ValidationHandler {
  private page: Page;
  private stateManager: ApplicationStateManager;

  constructor(page: Page, stateManager: ApplicationStateManager) {
    this.page = page;
    this.stateManager = stateManager;
  }

  public async finishCurrentPage(): Promise<void> {
    const report = await this.validatePage();
    const hasControls = (await new FormAnalyzer(this.page).discoverFields()).length;
    this.stateManager.setState(report.hasErrors || hasControls === 0 ? 'NEEDS_ATTENTION' : 'PAGE_PAUSED');
    this.stateManager.log('info', 'Current page scan finished. Check the browser for missing answers or further steps. Nothing has been submitted.');
  }

  public async validatePage(): Promise<ValidationReport> {
    const reports: ValidationReport[] = [];
    for (const frame of this.page.frames()) {
      if (frame.isDetached()) continue;
      if (frame.parentFrame() && !await (await frame.frameElement()).isVisible()) continue;
      reports.push(await frame.evaluate(() => {
      const errorMessages: string[] = [];
      const invalidFieldLabels: string[] = [];

      const roots: (Document | ShadowRoot)[] = [document];
      for (let i = 0; i < roots.length; i++) for (const el of Array.from(roots[i].querySelectorAll('*'))) if (el.shadowRoot) roots.push(el.shadowRoot);
      const query = (selector: string) => roots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>(selector)));
      function visible(el: HTMLElement): boolean {
        if (!el.getClientRects().length) return false;
        for (let node: HTMLElement | null = el; node;) {
          const style = getComputedStyle(node);
          if (node.hidden || style.display === 'none' || style.visibility === 'hidden' || node.hasAttribute('inert')) return false;
          node = node.parentElement || ((node.getRootNode() as ShadowRoot).host as HTMLElement | undefined) || null;
        }
        return true;
      }
      // Check aria-invalid
      const invalidElements = query('[aria-invalid="true"], :invalid');

      for (const el of invalidElements) {
        if (!el.matches('input,textarea,select,[role="combobox"]') || el.matches(':disabled') || (!visible(el) && !el.matches('input[type="file"]'))) continue;
        const label =
          el.getAttribute('aria-label') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('name') ||
          el.id ||
          'Unnamed field';
        invalidFieldLabels.push(label);
      }

      // Check alert containers
      const alerts = query('[role="alert"], .error-message, .validation-error, [class*="error"]:not(body):not(html)');

      for (const alert of alerts) {
        if (!visible(alert)) continue;
        const text = alert.innerText.trim();
        if (text && text.length > 2 && text.length < 200 && !errorMessages.includes(text)) {
          errorMessages.push(text);
        }
      }

      return {
        hasErrors: invalidFieldLabels.length > 0 || errorMessages.length > 0,
        errorMessages,
        invalidFieldLabels,
      };
      }));
    }
    const report: ValidationReport = {
      hasErrors: reports.some(item => item.hasErrors),
      errorMessages: Array.from(new Set(reports.flatMap(item => item.errorMessages))),
      invalidFieldLabels: Array.from(new Set(reports.flatMap(item => item.invalidFieldLabels))),
    };

    if (report.hasErrors) {
      this.stateManager.log('warn', `Validation notices found on page:`, {
        invalidFields: report.invalidFieldLabels,
        errors: report.errorMessages,
      });
    }

    return report;
  }
}
