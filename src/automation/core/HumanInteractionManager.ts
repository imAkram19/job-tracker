import { EventEmitter } from 'events';
import { HumanQuestionRequest, FormField, AutomationSessionStatus } from '../types/automation';
import { ApplicationStateManager } from './ApplicationStateManager';
import { AnswerManager } from './AnswerManager';

export interface HumanResolution {
  action: 'CONTINUE' | 'SKIP_FIELD' | 'SKIP_APPLICATION' | 'ABORT';
  answer?: string;
  rememberAnswer?: boolean;
}

export class HumanInteractionManager extends EventEmitter {
  private stateManager: ApplicationStateManager;
  private answerManager: AnswerManager;
  private pendingResolver: ((resolution: HumanResolution) => void) | null = null;
  private currentRequest: HumanQuestionRequest | null = null;

  constructor(stateManager: ApplicationStateManager, answerManager: AnswerManager) {
    super();
    this.stateManager = stateManager;
    this.answerManager = answerManager;
  }

  /**
   * Freezes execution and requests human input.
   * Returns a promise that resolves only when user answers or skips.
   */
  public async promptHuman(
    field: FormField,
    suggestedAnswer?: string
  ): Promise<HumanResolution> {
    const status = this.stateManager.getStatus();

    const request: HumanQuestionRequest = {
      id: `q_${Date.now()}`,
      sessionId: status.sessionId,
      company: status.company,
      jobTitle: status.jobTitle,
      question: field.label,
      type: field.type,
      options: field.options,
      suggestedAnswer,
      confidence: field.confidence || 'LOW',
      fieldId: field.id,
    };

    this.currentRequest = request;
    this.stateManager.setPendingQuestion(request);
    this.stateManager.log(
      'warn',
      `Paused for human answer on question: "${field.label}" (Field: ${field.name || field.id})`
    );

    return new Promise<HumanResolution>((resolve) => {
      this.pendingResolver = resolve;
    });
  }

  /**
   * Called by API route or CLI runner when the user supplies an answer or control action
   */
  public resolvePrompt(resolution: HumanResolution): boolean {
    if (!this.pendingResolver || !this.currentRequest) {
      return false;
    }

    if (resolution.action === 'CONTINUE' && resolution.answer) {
      if (resolution.rememberAnswer === true) {
        this.answerManager.addApprovedAnswer(
          this.currentRequest.question,
          resolution.answer,
          'HIGH'
        );
        this.stateManager.log(
          'info',
          `Saved approved answer for future applications: "${this.currentRequest.question}" -> "${resolution.answer}"`
        );
      }
    }

    this.stateManager.clearPendingQuestion();
    this.stateManager.setState('CONTINUING');

    const resolver = this.pendingResolver;
    this.pendingResolver = null;
    this.currentRequest = null;

    resolver(resolution);
    return true;
  }

  public getPendingRequest(): HumanQuestionRequest | null {
    return this.currentRequest;
  }
}
