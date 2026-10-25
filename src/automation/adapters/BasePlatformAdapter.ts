import { Page } from 'playwright';
import { CandidateProfileData } from '../types/automation';
import { ApplicationStateManager } from '../core/ApplicationStateManager';
import { QuestionClassifier } from '../core/QuestionClassifier';
import { HumanInteractionManager } from '../core/HumanInteractionManager';
import { FileUploader } from '../core/FileUploader';
import { ValidationHandler } from '../core/ValidationHandler';

export interface AdapterContext {
  page: Page;
  candidate: CandidateProfileData;
  stateManager: ApplicationStateManager;
  classifier: QuestionClassifier;
  humanManager: HumanInteractionManager;
  fileUploader: FileUploader;
  validationHandler: ValidationHandler;
}

export abstract class BasePlatformAdapter {
  public abstract readonly name: string;
  protected ctx: AdapterContext;

  constructor(ctx: AdapterContext) {
    this.ctx = ctx;
  }

  public abstract matches(url: string): Promise<boolean>;

  public abstract execute(): Promise<boolean>;
}
