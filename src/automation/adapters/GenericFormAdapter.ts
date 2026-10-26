import { fieldLocator, isResumeField } from '../core/FieldLocator';
import { fillField } from '../core/FieldFiller';
import { BasePlatformAdapter } from './BasePlatformAdapter';
import { FormAnalyzer } from '../core/FormAnalyzer';

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
    const processed = new Set<string>();
    let fillErrors = 0;
    // A bounded rescan picks up conditional inputs revealed by earlier answers.
    for (let pass = 0; pass < 3; pass++) {
      const fields = await analyzer.discoverFields();
      stateManager.setDetectedFields(fields);
      stateManager.log('info', `Discovered ${fields.length} candidate form fields`);

      if (fields.length > 0) {
        stateManager.setState('FORM_DETECTED');
      }

      stateManager.setState('FILLING_FORM');

      const pending = fields.filter(field => !processed.has(field.id));
      if (!pending.length) break;
      for (const field of pending) {
        processed.add(field.id);
        // 1. Resume / CV upload
        if (field.type === 'file') {
          if (field.currentValue) continue;
          if (isResumeField(field)) {
            if (!await fileUploader.uploadResume(field.selector, candidate.resumePath, field.framePath)) fillErrors++;
          } else if (field.required) { fillErrors++; stateManager.log('warn', `Attach ${field.label} manually; this is not a resume field.`); }
          continue;
        }

        // 2. Classify and determine answer
        const classification = classifier.classifyAndResolve(field);
        const hasManualValue = !!field.currentValue && !(field.type === 'checkbox' && !field.options?.length && field.currentValue === 'No');
        if (hasManualValue && !classification.fromAnswerBank) continue;
        let chosenAnswer = classification.confidence === 'LOW' ? null : classification.value;

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
            await fillField(fieldLocator(page, field), field.type, chosenAnswer);
            stateManager.recordFilledField(field.label, chosenAnswer);
            stateManager.log('info', `Filled ${field.label}`);
          } catch (fillErr) {
            fillErrors++;
            stateManager.log('warn', `Could not fill ${field.label}: ${fillErr}`);
          }
        }
      }

      await page.waitForTimeout(200);
    }

    // Check for validation errors
    await validationHandler.finishCurrentPage();
    if (fillErrors) stateManager.setState('NEEDS_ATTENTION');

    // Check for next button or review state
    const actions = await analyzer.findActionButtons();
    if (actions.nextButton) {
      stateManager.log('info', `Multi-step application detected (Next button: ${actions.nextButton}). Stopping for human confirmation.`);
    }

    return true;
  }
}
