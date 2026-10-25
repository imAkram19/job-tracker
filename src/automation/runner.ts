import { JobItem } from '@/types/job';
import { candidateProfile } from './data/candidateProfile';
import { ApplicationStateManager } from './core/ApplicationStateManager';
import { BrowserManager } from './core/BrowserManager';
import { FieldMapper } from './core/FieldMapper';
import { AnswerManager } from './core/AnswerManager';
import { QuestionClassifier } from './core/QuestionClassifier';
import { HumanInteractionManager } from './core/HumanInteractionManager';
import { FileUploader } from './core/FileUploader';
import { ValidationHandler } from './core/ValidationHandler';
import { ApplicationDetector } from './core/ApplicationDetector';

export interface AutomationRunOptions {
  headless?: boolean;
  autoClose?: boolean;
}

export class AutomationSession {
  public readonly stateManager: ApplicationStateManager;
  public readonly browserManager: BrowserManager;
  public readonly humanManager: HumanInteractionManager;
  public readonly answerManager: AnswerManager;
  public readonly job: JobItem;

  constructor(job: JobItem) {
    this.job = job;
    this.stateManager = new ApplicationStateManager(
      job.id,
      job.company,
      job.title,
      job.applyUrl,
      false // AUTO_SUBMIT = false strictly
    );
    this.browserManager = new BrowserManager(this.stateManager);
    this.answerManager = new AnswerManager();
    this.humanManager = new HumanInteractionManager(this.stateManager, this.answerManager);
  }

  public async run(options: AutomationRunOptions = {}): Promise<boolean> {
    try {
      this.stateManager.setState('STARTING');
      this.stateManager.log('info', `Starting automation for Job #${this.job.rank || this.job.id}: ${this.job.title} at ${this.job.company}`);

      // 1. Launch headed browser
      const page = await this.browserManager.launch({
        headless: options.headless ?? false,
      });

      // 2. Navigate to application URL
      await this.browserManager.navigate(this.job.applyUrl);

      // 3. Initialize analysis & classification helpers
      const fieldMapper = new FieldMapper(candidateProfile);
      const classifier = new QuestionClassifier(fieldMapper, this.answerManager);
      const fileUploader = new FileUploader(page, this.stateManager);
      const validationHandler = new ValidationHandler(page, this.stateManager);

      // 4. Detect platform and select adapter
      const adapterContext = {
        page,
        candidate: candidateProfile,
        stateManager: this.stateManager,
        classifier,
        humanManager: this.humanManager,
        fileUploader,
        validationHandler,
      };

      const adapter = await ApplicationDetector.selectAdapter(adapterContext, this.job.applyUrl);
      this.stateManager.log('info', `Selected adapter: ${adapter.name}`);

      // 5. Execute adapter
      const success = await adapter.execute();

      if (options.autoClose) {
        await this.browserManager.close();
      } else {
        this.stateManager.log(
          'info',
          'Browser is left open for manual inspection. Close the browser window when finished.'
        );
      }

      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.stateManager.setError(msg);
      return false;
    }
  }

  public async fillActivePage(): Promise<{ filledCount: number }> {
    try {
      this.stateManager.setState('FILLING_FORM');
      const page = await this.browserManager.ensureActivePage(this.job.applyUrl);
      const currentUrl = page.url();
      this.stateManager.log('info', `Scanning and filling active page in Chrome: ${currentUrl}`);

      const fieldMapper = new FieldMapper(candidateProfile);
      const classifier = new QuestionClassifier(fieldMapper, this.answerManager);
      const fileUploader = new FileUploader(page, this.stateManager);
      const validationHandler = new ValidationHandler(page, this.stateManager);

      const adapterContext = {
        page,
        candidate: candidateProfile,
        stateManager: this.stateManager,
        classifier,
        humanManager: this.humanManager,
        fileUploader,
        validationHandler,
      };

      const adapter = await ApplicationDetector.selectAdapter(adapterContext, currentUrl);
      this.stateManager.log('info', `Running ${adapter.name} analyzer on current page`);
      await adapter.execute();

      return {
        filledCount: this.stateManager.getStatus().filledFields.length,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.stateManager.log('error', `Error filling active page: ${msg}`);
      throw err;
    }
  }

  public async scanPageOverview(): Promise<{
    url: string;
    totalDiscovered: number;
    autoMapped: any[];
    unresolved: any[];
  }> {
    const page = await this.browserManager.ensureActivePage(this.job.applyUrl);
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
    } catch {
      // Ignore timeout if already hydrated
    }
    const url = page.url();
    this.stateManager.log('info', `Scanning active page for all fields: ${url}`);

    const { FormAnalyzer } = await import('./core/FormAnalyzer');
    const analyzer = new FormAnalyzer(page);
    const fields = await analyzer.discoverFields();
    this.stateManager.setDetectedFields(fields);

    const fieldMapper = new FieldMapper(candidateProfile);
    const classifier = new QuestionClassifier(fieldMapper, this.answerManager);

    const autoMapped: any[] = [];
    const unresolved: any[] = [];

    for (const field of fields) {
      if (field.type === 'file') {
        autoMapped.push({
          id: field.id,
          name: field.name,
          label: field.label,
          type: field.type,
          required: field.required,
          suggestedAnswer: 'Mohammad_Akram_Resume.pdf',
          confidence: 'HIGH',
          isProfileField: true,
          selector: field.selector,
        });
        continue;
      }

      const classification = classifier.classifyAndResolve(field);

      const fieldData = {
        id: field.id,
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options,
        suggestedAnswer: classification.value || classification.suggestedOption || '',
        confidence: classification.confidence,
        isProfileField: classification.isProfileField,
        selector: field.selector,
      };

      if (classification.value && (classification.confidence === 'HIGH' || classification.confidence === 'MEDIUM')) {
        autoMapped.push(fieldData);
      } else {
        unresolved.push(fieldData);
      }
    }

    this.stateManager.log(
      'info',
      `Page analysis: ${autoMapped.length} fields auto-mapped, ${unresolved.length} fields require review.`
    );

    return {
      url,
      totalDiscovered: fields.length,
      autoMapped,
      unresolved,
    };
  }

  public async applyBatchFields(
    resolutions: Array<{ fieldId: string; answer: string; remember?: boolean }>
  ): Promise<{ filledCount: number; errorCount: number }> {
    this.stateManager.setState('FILLING_FORM');
    const page = await this.browserManager.ensureActivePage(this.job.applyUrl);

    const resolutionMap = new Map<string, { answer: string; remember: boolean }>();
    for (const res of resolutions) {
      resolutionMap.set(res.fieldId, { answer: res.answer, remember: res.remember ?? true });
    }

    const { FormAnalyzer } = await import('./core/FormAnalyzer');
    const analyzer = new FormAnalyzer(page);
    const fields = await analyzer.discoverFields();
    const fieldMapper = new FieldMapper(candidateProfile);
    const classifier = new QuestionClassifier(fieldMapper, this.answerManager);
    const fileUploader = new FileUploader(page, this.stateManager);
    const validationHandler = new ValidationHandler(page, this.stateManager);

    let filledCount = 0;
    let errorCount = 0;

    for (const field of fields) {
      if (field.type === 'file') {
        try {
          await fileUploader.uploadResume(field.selector, candidateProfile.resumePath);
          filledCount++;
        } catch {
          errorCount++;
        }
        continue;
      }

      let answerToFill: string | null = null;
      const userRes = resolutionMap.get(field.id) || resolutionMap.get(field.name);
      if (userRes && userRes.answer) {
        answerToFill = userRes.answer;
        if (userRes.remember) {
          this.answerManager.addApprovedAnswer(field.label, userRes.answer, 'HIGH');
          this.stateManager.log('info', `Saved answer for future: "${field.label}" -> "${userRes.answer}"`);
        }
      } else {
        const classification = classifier.classifyAndResolve(field);
        if (classification.value && classification.confidence !== 'LOW') {
          answerToFill = classification.value;
        }
      }

      if (!answerToFill) continue;

      try {
        if (field.type === 'radio') {
          const radios = page.locator(field.selector);
          const count = await radios.count();
          let clicked = false;
          for (let i = 0; i < count; i++) {
            const radio = radios.nth(i);
            const rVal = (await radio.getAttribute('value')) || '';
            const rId = await radio.getAttribute('id');
            let rLabel = '';
            if (rId) {
              rLabel = await page.locator(`label[for="${CSS.escape(rId)}"]`).innerText().catch(() => '');
            }
            if (!rLabel) {
              rLabel = await radio.locator('xpath=ancestor::label').innerText().catch(() => '');
            }
            const combined = `${rLabel} ${rVal}`.toLowerCase().trim();
            if (
              combined.includes(answerToFill.toLowerCase()) ||
              (answerToFill.toLowerCase() === 'yes' && (rVal === '1' || rVal.toLowerCase() === 'yes'))
            ) {
              await radio.check({ force: true });
              clicked = true;
              break;
            }
          }
          if (!clicked && count > 0) {
            await radios.first().check({ force: true });
          }
          this.stateManager.recordFilledField(field.label, answerToFill);
          filledCount++;
        } else {
          const locator = page.locator(field.selector).first();
          if ((await locator.count()) > 0) {
            if (field.type === 'select') {
              try {
                await locator.selectOption({ label: answerToFill });
              } catch {
                try {
                  await locator.selectOption({ value: answerToFill });
                } catch {
                  const optIdx = field.options?.findIndex(
                    (o) => o.toLowerCase().trim() === answerToFill!.toLowerCase().trim()
                  );
                  if (optIdx !== undefined && optIdx >= 0) {
                    await locator.selectOption({ index: optIdx });
                  }
                }
              }
            } else if (field.type === 'checkbox') {
              if (answerToFill.toLowerCase() === 'yes' || answerToFill.toLowerCase() === 'true') {
                await locator.check();
              }
            } else {
              await locator.fill(answerToFill);
            }
            this.stateManager.recordFilledField(field.label, answerToFill);
            filledCount++;
          }
        }
      } catch (err) {
        errorCount++;
        this.stateManager.log('warn', `Could not fill ${field.label}: ${err}`);
      }
    }

    await validationHandler.validatePage();
    this.stateManager.setState('READY_FOR_REVIEW');
    this.stateManager.log(
      'success',
      `Filled ${filledCount} fields in batch. Application ready for final review [AUTO_SUBMIT = false].`
    );

    return { filledCount, errorCount };
  }

  public async learnFromActivePage(): Promise<{
    learnedCount: number;
    learnedFields: Array<{ label: string; value: string }>;
    portalSaved?: string;
  }> {
    const page = await this.browserManager.ensureActivePage(this.job.applyUrl);
    const currentUrl = page.url();
    this.stateManager.log('info', `Reading active page to learn and remember entered data: ${currentUrl}`);

    const { FormAnalyzer } = await import('./core/FormAnalyzer');
    const { PortalAccountManager } = await import('./core/PortalAccountManager');

    const analyzer = new FormAnalyzer(page);
    const fields = await analyzer.discoverFields();

    const learnedFields: Array<{ label: string; value: string }> = [];
    const portalMgr = new PortalAccountManager();

    let detectedEmail = '';
    let detectedPassword = '';

    for (const field of fields) {
      const val = (field.currentValue || '').trim();
      if (!val) continue;

      // Track login/credential fields
      if (field.type === 'password' || field.label.toLowerCase().includes('password')) {
        detectedPassword = val;
      }
      if (field.type === 'email' || field.label.toLowerCase().includes('email')) {
        detectedEmail = val;
      }

      // Save question-answer pair into approved answers
      this.answerManager.addApprovedAnswer(field.label, val, 'HIGH');
      learnedFields.push({ label: field.label, value: val });
    }

    let portalSaved: string | undefined;
    if (detectedPassword || detectedEmail) {
      try {
        const domain = new URL(currentUrl).hostname;
        portalMgr.recordAccount(domain, this.job.company || domain, {
          email: detectedEmail || candidateProfile.email,
          password: detectedPassword,
          notes: `Learned during application for ${this.job.title} at ${this.job.company}`,
        });
        portalSaved = domain;
        this.stateManager.log('info', `Recorded portal account credentials for: ${domain}`);
      } catch {
        // Ignore URL parsing errors
      }
    }

    this.stateManager.log(
      'success',
      `Learned and remembered ${learnedFields.length} field values from active page into permanent memory.`
    );

    return {
      learnedCount: learnedFields.length,
      learnedFields,
      portalSaved,
    };
  }

  public async updateFieldValue(
    fieldLabel: string,
    newValue: string,
    refillInBrowser: boolean = true
  ): Promise<boolean> {
    this.stateManager.recordFilledField(fieldLabel, newValue);
    this.answerManager.addApprovedAnswer(fieldLabel, newValue, 'HIGH');
    this.stateManager.log('info', `Updated "${fieldLabel}" to: "${newValue}"`);

    if (refillInBrowser) {
      try {
        const page = await this.browserManager.ensureActivePage(this.job.applyUrl);
        const { FormAnalyzer } = await import('./core/FormAnalyzer');
        const analyzer = new FormAnalyzer(page);
        const fields = await analyzer.discoverFields();
        const target = fields.find(
          (f) =>
            f.label.toLowerCase().trim() === fieldLabel.toLowerCase().trim() ||
            fieldLabel.toLowerCase().includes(f.label.toLowerCase()) ||
            f.label.toLowerCase().includes(fieldLabel.toLowerCase())
        );

        if (target) {
          const locator = page.locator(target.selector).first();
          if ((await locator.count()) > 0) {
            if (target.type === 'select') {
              try {
                await locator.selectOption({ label: newValue });
              } catch {
                try {
                  await locator.selectOption({ value: newValue });
                } catch {
                  const optIdx = target.options?.findIndex(
                    (o) => o.toLowerCase().trim() === newValue.toLowerCase().trim()
                  );
                  if (optIdx !== undefined && optIdx >= 0) {
                    await locator.selectOption({ index: optIdx });
                  }
                }
              }
            } else if (target.type === 'radio') {
              const radios = page.locator(target.selector);
              const count = await radios.count();
              for (let i = 0; i < count; i++) {
                const radio = radios.nth(i);
                const val = (await radio.getAttribute('value')) || '';
                if (val.toLowerCase().includes(newValue.toLowerCase())) {
                  await radio.check({ force: true });
                  break;
                }
              }
            } else {
              await locator.fill(newValue);
            }
            this.stateManager.log('success', `Refilled "${fieldLabel}" in browser with: "${newValue}"`);
          }
        }
      } catch (err) {
        this.stateManager.log('warn', `Could not refill field in browser: ${err}`);
      }
    }
    return true;
  }

  public async removeField(fieldLabel: string): Promise<boolean> {
    this.stateManager.removeFilledField(fieldLabel);
    this.stateManager.log('info', `Removed field "${fieldLabel}" from list.`);

    try {
      const page = await this.browserManager.ensureActivePage(this.job.applyUrl);
      const { FormAnalyzer } = await import('./core/FormAnalyzer');
      const analyzer = new FormAnalyzer(page);
      const fields = await analyzer.discoverFields();
      const target = fields.find(
        (f) =>
          f.label.toLowerCase().trim() === fieldLabel.toLowerCase().trim() ||
          fieldLabel.toLowerCase().includes(f.label.toLowerCase()) ||
          f.label.toLowerCase().includes(fieldLabel.toLowerCase())
      );
      if (target && target.type !== 'file') {
        const locator = page.locator(target.selector).first();
        if ((await locator.count()) > 0) {
          await locator.fill('');
        }
      }
    } catch {
      // Ignore if browser not active
    }
    return true;
  }

  public async abort(): Promise<void> {
    this.stateManager.setError('Automation aborted by user');
    await this.browserManager.close();
  }
}

// Global in-memory registry of active sessions for API communication across Next.js bundles
const globalAny = globalThis as unknown as { __automationSessions?: Map<string, AutomationSession> };
if (!globalAny.__automationSessions) {
  globalAny.__automationSessions = new Map<string, AutomationSession>();
}
const sessions: Map<string, AutomationSession> = globalAny.__automationSessions;

export function registerSession(session: AutomationSession): void {
  sessions.set(session.stateManager.getSessionId(), session);
}

export function getSession(sessionId: string): AutomationSession | undefined {
  return sessions.get(sessionId);
}

export function getActiveSessionByJobId(jobId: string): AutomationSession | undefined {
  const activeSessions = Array.from(sessions.values());
  for (const session of activeSessions) {
    if (
      String(session.job.id) === String(jobId) &&
      session.stateManager.getState() !== 'READY_FOR_REVIEW' &&
      session.stateManager.getState() !== 'FAILED' &&
      session.browserManager.isAlive()
    ) {
      return session;
    }
  }
  return undefined;
}
