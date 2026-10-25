import { BasePlatformAdapter } from './BasePlatformAdapter';
import { FormField } from '../types/automation';

export class LeverAdapter extends BasePlatformAdapter {
  public readonly name = 'Lever';

  public async matches(url: string): Promise<boolean> {
    if (url.includes('jobs.lever.co') || url.includes('lever.co/')) {
      return true;
    }
    // Also check page content for Lever signature
    try {
      const isLever = await this.ctx.page.evaluate(() => {
        return !!(
          document.querySelector('.lever-job-posting') ||
          document.querySelector('form#application-form') ||
          document.querySelector('.postings-btn-wrapper') ||
          document.querySelector('a[href*="lever.co"]')
        );
      });
      return isLever;
    } catch {
      return false;
    }
  }

  public async execute(): Promise<boolean> {
    const { page, candidate, stateManager, classifier, humanManager, fileUploader, validationHandler } = this.ctx;

    stateManager.log('info', 'Executing Lever platform adapter');

    // 1. If we are on the job overview page, click the "Apply" / "Apply for this job" button to open the form
    const applyButton = page.locator('a.postings-btn, .postings-btn-wrapper a, a:has-text("Apply for this job")').first();
    if ((await applyButton.count()) > 0 && (await applyButton.isVisible())) {
      stateManager.log('info', 'Clicking "Apply for this job" button');
      await applyButton.click();
      await page.waitForTimeout(1500);
    }

    // Wait for the application form container
    try {
      await page.waitForSelector('form#application-form, .application-form, form', { timeout: 10000 });
      stateManager.setState('FORM_DETECTED');
    } catch {
      stateManager.log('warn', 'Form container not immediately detected, continuing with available elements');
    }

    stateManager.setState('FILLING_FORM');

    // 2. Upload Resume / CV
    const resumeInput = page.locator('input[type="file"], input[name="resume"]').first();
    if ((await resumeInput.count()) > 0) {
      await fileUploader.uploadResume('input[type="file"], input[name="resume"]', candidate.resumePath);
    }

    // 3. Fill Standard Personal Information Fields
    const standardFields = [
      { selector: 'input[name="name"], input#name', value: candidate.fullName, label: 'Full Name' },
      { selector: 'input[name="email"], input#email', value: candidate.email, label: 'Email' },
      { selector: 'input[name="phone"], input#phone', value: candidate.phone, label: 'Phone' },
      { selector: 'input[name="org"], input#org', value: candidate.currentCompany, label: 'Current Company' },
      { selector: 'input[name="urls[LinkedIn]"], input[name*="LinkedIn" i]', value: candidate.linkedin, label: 'LinkedIn URL' },
      { selector: 'input[name="urls[GitHub]"], input[name*="GitHub" i]', value: candidate.github, label: 'GitHub URL' },
      { selector: 'input[name="urls[Portfolio]"], input[name*="Portfolio" i], input[name="urls[Other]"]', value: candidate.portfolio, label: 'Portfolio URL' },
      { selector: 'input[name="location"], input#location', value: `${candidate.city}, ${candidate.state}, ${candidate.country}`, label: 'Current Location' },
    ];

    for (const field of standardFields) {
      try {
        const input = page.locator(field.selector).first();
        if ((await input.count()) > 0 && (await input.isVisible())) {
          await input.fill(field.value);
          stateManager.recordFilledField(field.label, field.value);
          stateManager.log('info', `Filled ${field.label}: ${field.value}`);
        }
      } catch (err) {
        stateManager.log('warn', `Could not fill standard field ${field.label}: ${err}`);
      }
    }

    // 4. Handle Custom Screening Questions on Lever
    const questionSections = await page.$$('.application-question, .custom-question, .application-field:not(.main-field)');
    stateManager.log('info', `Found ${questionSections.length} additional question section(s)`);

    for (const section of questionSections) {
      // Find question text
      const questionText = await section.evaluate((el) => {
        const labelEl = el.querySelector('.application-label, .text, label, h4, h5');
        return labelEl ? labelEl.textContent?.trim() || '' : '';
      });

      if (!questionText) continue;

      // Detect input within this question section
      const inputInfo = await section.evaluate((el) => {
        const textInput = el.querySelector('input[type="text"], textarea') as HTMLInputElement | HTMLTextAreaElement | null;
        if (textInput) {
          const hasVal = Boolean(textInput.value && textInput.value.trim().length > 0);
          return {
            type: textInput.tagName.toLowerCase() === 'textarea' ? 'textarea' : 'text',
            name: textInput.name || textInput.id,
            id: textInput.id || textInput.name,
            required: textInput.required || el.querySelector('.application-label')?.textContent?.includes('*') || false,
            hasValue: hasVal,
          };
        }

        const select = el.querySelector('select') as HTMLSelectElement | null;
        if (select) {
          const hasVal = Boolean(select.value && select.value !== '' && !select.value.toLowerCase().includes('select'));
          return {
            type: 'select',
            name: select.name || select.id,
            id: select.id || select.name,
            options: Array.from(select.options).map((o) => o.text.trim()).filter((t) => t && !t.includes('Select')),
            required: select.required || false,
            hasValue: hasVal,
          };
        }

        const radioInputs = Array.from(el.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
        if (radioInputs.length > 0) {
          const hasChecked = radioInputs.some((r) => r.checked);
          return {
            type: 'radio',
            name: radioInputs[0].name || radioInputs[0].id,
            id: radioInputs[0].name || radioInputs[0].id,
            options: radioInputs.map((r) => {
              const label = r.closest('label')?.textContent?.trim() || r.value;
              return label;
            }),
            required: radioInputs[0].required || false,
            hasValue: hasChecked,
          };
        }

        return null;
      });

      if (!inputInfo || inputInfo.hasValue) continue;

      const formField: FormField = {
        id: inputInfo.id,
        name: inputInfo.name,
        label: questionText.replace(/\*/g, '').trim(),
        type: inputInfo.type as any,
        required: inputInfo.required,
        options: inputInfo.options,
        selector: '',
      };

      // Classify question using knowledge base and candidate profile
      const classification = classifier.classifyAndResolve(formField);
      let chosenAnswer = classification.value;

      if (!chosenAnswer || classification.confidence === 'LOW') {
        // Human-in-the-loop: Prompt the user
        const resolution = await humanManager.promptHuman(formField);
        if (resolution.action === 'ABORT') {
          stateManager.setError('Application aborted by user');
          return false;
        }
        if (resolution.action === 'SKIP_APPLICATION') {
          stateManager.setState('SKIPPED');
          return false;
        }
        if (resolution.action === 'SKIP_FIELD') {
          continue;
        }
        chosenAnswer = resolution.answer || null;
      }

      if (chosenAnswer) {
        // Fill the field based on type
        try {
          if (formField.type === 'textarea' || formField.type === 'text') {
            const inputLoc = await section.$('input[type="text"], textarea');
            if (inputLoc) {
              await inputLoc.fill(chosenAnswer);
              stateManager.recordFilledField(formField.label, chosenAnswer);
              stateManager.log('info', `Answered question "${formField.label}": ${chosenAnswer}`);
            }
          } else if (formField.type === 'select') {
            const selectLoc = await section.$('select');
            if (selectLoc) {
              try {
                await selectLoc.selectOption({ label: chosenAnswer });
              } catch {
                await selectLoc.selectOption({ value: chosenAnswer });
              }
              stateManager.recordFilledField(formField.label, chosenAnswer);
              stateManager.log('info', `Selected option for "${formField.label}": ${chosenAnswer}`);
            }
          } else if (formField.type === 'radio') {
            const radios = await section.$$('input[type="radio"]');
            for (const radio of radios) {
              const val = await radio.getAttribute('value');
              const label = await radio.evaluate((r) => r.closest('label')?.textContent?.trim() || '');
              if (
                (val && val.toLowerCase() === chosenAnswer.toLowerCase()) ||
                (label && label.toLowerCase().includes(chosenAnswer.toLowerCase()))
              ) {
                await radio.click();
                stateManager.recordFilledField(formField.label, chosenAnswer);
                stateManager.log('info', `Selected radio for "${formField.label}": ${chosenAnswer}`);
                break;
              }
            }
          }
        } catch (fillErr) {
          stateManager.log('warn', `Failed to apply answer to "${formField.label}": ${fillErr}`);
        }
      }
    }

    await validationHandler.finishCurrentPage();
    return true;
  }
}
