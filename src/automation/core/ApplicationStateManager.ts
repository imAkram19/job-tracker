import { EventEmitter } from 'events';
import { 
  AutomationState, 
  AutomationLog, 
  FormField, 
  HumanQuestionRequest, 
  AutomationSessionStatus 
} from '../types/automation';

export class ApplicationStateManager extends EventEmitter {
  private sessionId: string;
  private jobId: string;
  private company: string;
  private jobTitle: string;
  private applyUrl: string;
  private state: AutomationState = 'STARTING';
  private logs: AutomationLog[] = [];
  private detectedFields: FormField[] = [];
  private filledFields: Array<{ label: string; value: string }> = [];
  private pendingQuestion?: HumanQuestionRequest;
  private error?: string;
  private autoSubmit: boolean = false;

  constructor(jobId: string, company: string, jobTitle: string, applyUrl: string, autoSubmit: boolean = false) {
    super();
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.jobId = jobId;
    this.company = company;
    this.jobTitle = jobTitle;
    this.applyUrl = applyUrl;
    this.autoSubmit = autoSubmit;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getState(): AutomationState {
    return this.state;
  }

  public setState(newState: AutomationState): void {
    const oldState = this.state;
    this.state = newState;
    this.log('info', `State transitioned from ${oldState} to ${newState}`);
    this.emit('stateChange', { oldState, newState, session: this.getStatus() });
  }

  public log(level: AutomationLog['level'], message: string, details?: Record<string, unknown>): void {
    const logItem: AutomationLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    };
    this.logs.push(logItem);
    this.emit('log', logItem);
  }

  public setDetectedFields(fields: FormField[]): void {
    this.detectedFields = fields;
    this.emit('fieldsDetected', fields);
  }

  public recordFilledField(label: string, value: string, field?: FormField): void {
    const existingIndex = this.filledFields.findIndex(
      (f) => f.label.toLowerCase().trim() === label.toLowerCase().trim()
    );
    if (existingIndex >= 0) {
      this.filledFields[existingIndex].value = value;
    } else {
      this.filledFields.push({ label, value });
    }
    this.emit('fieldFilled', { label, value });
    if (field) this.emit('rememberableFieldFilled', { field, value });
  }

  public removeFilledField(label: string): void {
    this.filledFields = this.filledFields.filter(
      (f) => f.label.toLowerCase().trim() !== label.toLowerCase().trim()
    );
  }

  public setPendingQuestion(question: HumanQuestionRequest): void {
    this.pendingQuestion = question;
    this.setState('WAITING_FOR_HUMAN');
    this.emit('humanQuestionRequired', question);
  }

  public clearPendingQuestion(): void {
    this.pendingQuestion = undefined;
  }

  public setError(err: string): void {
    this.error = err;
    this.setState('FAILED');
    this.log('error', `Application automation encountered an error: ${err}`);
  }

  public getStatus(): AutomationSessionStatus {
    return {
      sessionId: this.sessionId,
      jobId: this.jobId,
      company: this.company,
      jobTitle: this.jobTitle,
      applyUrl: this.applyUrl,
      state: this.state,
      logs: this.logs,
      detectedFields: this.detectedFields,
      filledFields: this.filledFields,
      pendingQuestion: this.pendingQuestion,
      error: this.error,
      autoSubmit: this.autoSubmit,
    };
  }
}
