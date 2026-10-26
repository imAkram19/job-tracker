import { fillField } from '../core/FieldFiller';
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

    let fillErrors = 0;
    for (const field of fields) {
      // 1. Resume / CV upload
      if (field.type === 'file') {
        if (!await fileUploader.uploadResume(field.selector, candidate.resumePath)) fillErrors++;
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
          await fillField(page.locator(field.selector), field.type, chosenAnswer);
          stateManager.recordFilledField(field.label, chosenAnswer);
          stateManager.log('info', `Filled ${field.label}`);
        } catch (fillErr) {
          fillErrors++;
          stateManager.log('warn', `Could not fill ${field.label}: ${fillErr}`);
        }
      }
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
