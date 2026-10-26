import { fieldLocator } from './FieldLocator';
import fs from 'fs';
import { Page } from 'playwright';
import { ApplicationStateManager } from './ApplicationStateManager';

export class FileUploader {
  private page: Page;
  private stateManager: ApplicationStateManager;

  constructor(page: Page, stateManager: ApplicationStateManager) {
    this.page = page;
    this.stateManager = stateManager;
  }

  public async uploadResume(fileInputSelector: string, resumePath: string, framePath?: string[]): Promise<boolean> {
    this.stateManager.log('info', `Attempting resume upload to selector: ${fileInputSelector}`);

    if (!fs.existsSync(resumePath)) {
      this.stateManager.log('error', `Resume PDF file not found at: ${resumePath}`);
      return false;
    }

    try {
      const fileInput = fieldLocator(this.page, { selector: fileInputSelector, framePath });

      // Ensure input exists
      const count = await fileInput.count();
      if (count !== 1) {
        this.stateManager.log('warn', 'Resume input is missing or ambiguous. Rescan the page.');
        return false;
      }

      await fileInput.setInputFiles(resumePath);
      this.stateManager.log('info', `Resume uploaded successfully: ${resumePath}`);
      this.stateManager.recordFilledField('Resume / CV', resumePath);

      // Wait a moment for any upload spinners or progress animations to settle
      await this.page.waitForTimeout(1500);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.stateManager.log('error', `Failed to upload resume: ${msg}`);
      return false;
    }
  }
}
