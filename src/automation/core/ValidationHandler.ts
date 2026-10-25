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

  public async validatePage(): Promise<ValidationReport> {
    const report = await this.page.evaluate(() => {
      const errorMessages: string[] = [];
      const invalidFieldLabels: string[] = [];

      // Check aria-invalid
      const invalidElements = Array.from(
        document.querySelectorAll('[aria-invalid="true"], :invalid')
      ) as HTMLElement[];

      for (const el of invalidElements) {
        if (el.tagName.toLowerCase() === 'form') continue;
        const label =
          el.getAttribute('aria-label') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('name') ||
          el.id ||
          'Unnamed field';
        invalidFieldLabels.push(label);
      }

      // Check alert containers
      const alerts = Array.from(
        document.querySelectorAll(
          '[role="alert"], .error-message, .validation-error, [class*="error"]:not(body):not(html)'
        )
      ) as HTMLElement[];

      for (const alert of alerts) {
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
    });

    if (report.hasErrors) {
      this.stateManager.log('warn', `Validation notices found on page:`, {
        invalidFields: report.invalidFieldLabels,
        errors: report.errorMessages,
      });
    }

    return report;
  }
}
