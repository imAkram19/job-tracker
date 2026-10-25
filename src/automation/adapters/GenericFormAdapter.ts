import { BasePlatformAdapter } from './BasePlatformAdapter';
import { FormAnalyzer } from '../core/FormAnalyzer';
import { FormField } from '../types/automation';

export class GenericFormAdapter extends BasePlatformAdapter {
  public readonly name = 'GenericForm';

  public async matches(): Promise<boolean> {
    // Universal fallback
    return true;
  }

  public async execute(): Promise<boolean> {
    const { page, candidate, stateManager, classifier, humanManager, fileUploader, validationHandler } = this.ctx;

    stateManager.log('info', 'Executing Generic Form adapter');

    const analyzer = new FormAnalyzer(page);
    const fields = await analyzer.discoverFields();
    stateManager.setDetectedFields(fields);
    stateManager.log('info', `Discovered ${fields.length} candidate form fields`);

    if (fields.length > 0) {
      stateManager.setState('FORM_DETECTED');
    }

    stateManager.setState('FILLING_FORM');

    for (const field of fields) {
      // 1. Resume / CV upload
      if (field.type === 'file') {
        await fileUploader.uploadResume(field.selector, candidate.resumePath);
        continue;
      }

      // 2. Classify and determine answer
      const classification = classifier.classifyAndResolve(field);
      let chosenAnswer = classification.value;

      // 3. If required and unknown, or confidence LOW, pause for human input
      if ((!chosenAnswer || classification.confidence === 'LOW') && field.required) {
        const resolution = await humanManager.promptHuman(field);
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

      // 4. Fill field if answer is available
      if (chosenAnswer) {
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
                combined.includes(chosenAnswer.toLowerCase()) ||
                (chosenAnswer.toLowerCase() === 'yes' && (rVal === '1' || rVal.toLowerCase() === 'yes'))
              ) {
                await radio.check({ force: true });
                clicked = true;
                break;
              }
            }
            if (!clicked && count > 0) {
              await radios.first().check({ force: true });
            }
            stateManager.recordFilledField(field.label, chosenAnswer);
            stateManager.log('info', `Selected radio for ${field.label}: ${chosenAnswer}`);
          } else {
            const locator = page.locator(field.selector).first();
            if ((await locator.count()) > 0 && (await locator.isVisible())) {
              if (field.type === 'select') {
                try {
                  await locator.selectOption({ label: chosenAnswer });
                } catch {
                  try {
                    await locator.selectOption({ value: chosenAnswer });
                  } catch {
                    // Try selecting by index if found in field.options
                    const optIndex = field.options?.findIndex(
                      (o) => o.toLowerCase().trim() === chosenAnswer!.toLowerCase().trim()
                    );
                    if (optIndex !== undefined && optIndex >= 0) {
                      await locator.selectOption({ index: optIndex });
                    }
                  }
                }
              } else if (field.type === 'checkbox') {
                if (chosenAnswer.toLowerCase() === 'yes' || chosenAnswer.toLowerCase() === 'true') {
                  await locator.check();
                }
              } else {
                await locator.fill(chosenAnswer);
              }

              stateManager.recordFilledField(field.label, chosenAnswer);
              stateManager.log('info', `Filled ${field.label}: ${chosenAnswer}`);
            }
          }
        } catch (fillErr) {
          stateManager.log('warn', `Could not fill ${field.label}: ${fillErr}`);
        }
      }
    }

    // Check for validation errors
    await validationHandler.finishCurrentPage();

    // Check for next button or review state
    const actions = await analyzer.findActionButtons();
    if (actions.nextButton) {
      stateManager.log('info', `Multi-step application detected (Next button: ${actions.nextButton}). Stopping for human confirmation.`);
    }

    return true;
  }
}
