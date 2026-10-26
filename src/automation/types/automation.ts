export type AutomationState =
  | 'STARTING'
  | 'OPENING_APPLICATION'
  | 'FORM_DETECTED'
  | 'FILLING_FORM'
  | 'WAITING_FOR_HUMAN'
  | 'CONTINUING'
  | 'READY_FOR_REVIEW'
  | 'PAGE_PAUSED'
  | 'NEEDS_ATTENTION'
  | 'SUBMITTED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CAPTCHA_REQUIRED'
  | 'LOGIN_REQUIRED';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type InputElementType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'date'
  | 'number'
  | 'password'
  | 'unknown';

export interface FormField {
  pageOrigin?: string;
  id: string;
  name: string;
  label: string;
  type: InputElementType;
  required: boolean;
  options?: string[]; // for select, radio groups
  selector: string;
  currentValue?: string;
  mappedField?: string;
  suggestedAnswer?: string;
  confidence?: ConfidenceLevel;
}

export interface CandidateEducation {
  degree: string;
  fieldOfStudy: string;
  university: string;
  startYear: string;
  graduationYear: string;
}

export interface CandidateProfileData {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  tagline: string;
  linkedin: string;
  github: string;
  portfolio: string;
  currentCompany: string;
  education: CandidateEducation[];
  yearsOfExperience: number;
  yearsWithReact: number;
  resumePath: string;
  skills: string[];
}

export interface ApprovedAnswer {
  id: string;
  questionKeywords: string[];
  normalizedQuestion: string;
  answer: string;
  confidence: ConfidenceLevel;
  notes?: string;
}

export interface HumanQuestionRequest {
  id: string;
  sessionId: string;
  company: string;
  jobTitle: string;
  question: string;
  type: InputElementType;
  options?: string[];
  suggestedAnswer?: string;
  confidence: ConfidenceLevel;
  fieldId: string;
}

export interface AutomationLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: Record<string, unknown>;
}

export interface AutomationSessionStatus {
  sessionId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  applyUrl: string;
  state: AutomationState;
  logs: AutomationLog[];
  detectedFields: FormField[];
  filledFields: Array<{ label: string; value: string }>;
  pendingQuestion?: HumanQuestionRequest;
  error?: string;
  autoSubmit: boolean;
}
