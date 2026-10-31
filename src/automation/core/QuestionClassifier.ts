import { isResumeField } from './FieldLocator';
import { excludedMemoryField } from './SelectedAnswerMemory';
import { FormField, ConfidenceLevel } from '../types/automation';
import { FieldMapper } from './FieldMapper';
import { AnswerManager } from './AnswerManager';
import { OptionMatcher, FieldConcept } from './OptionMatcher';

export interface ClassificationResult {
  fromAnswerBank?: boolean;
  isProfileField: boolean;
  isScreeningQuestion: boolean;
  value: string | null;
  confidence: ConfidenceLevel;
  profileField?: string;
  matchedQuestion?: string;
  suggestedOption?: string | null;
}

export class QuestionClassifier {
  private fieldMapper: FieldMapper;
  private answerManager: AnswerManager;

  constructor(fieldMapper: FieldMapper, answerManager: AnswerManager) {
    this.fieldMapper = fieldMapper;
    this.answerManager = answerManager;
  }

  private detectConcept(label: string, name: string): FieldConcept {
    const combined = `${label} ${name}`.toLowerCase();
    if (combined.includes('experience') || combined.includes('years of')) return 'EXPERIENCE_YEARS';
    if (combined.includes('notice') || combined.includes('availability') || combined.includes('start date')) return 'NOTICE_PERIOD';
    if (combined.includes('sponsor') || combined.includes('authoriz') || combined.includes('visa')) return 'WORK_AUTHORIZATION';
    if (combined.includes('relocat')) return 'RELOCATION';
    if (combined.includes('degree') || combined.includes('education') || combined.includes('qualification')) return 'EDUCATION_DEGREE';
    if (combined.includes('gender')) return 'GENDER';
    return 'GENERIC';
  }

  public classifyAndResolve(field: FormField): ClassificationResult {
    if (excludedMemoryField(field.label, field.type, field.name) && field.type !== 'file') {
      return { isProfileField: false, isScreeningQuestion: false, value: null, confidence: 'LOW' };
    }
    if (field.type === 'file' && !isResumeField(field)) return { isProfileField: false, isScreeningQuestion: false, value: null, confidence: 'LOW' };
    const selected = this.answerManager.findSelected(field);
    if (selected) {
      const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
      const dropdown = ['select', 'combobox', 'radio'].includes(field.type);
      const matching = field.options?.filter(option => dropdown ? normalize(option) === normalize(selected.answer) : option === selected.answer);
      const optionExists = !field.options?.length || matching?.length === 1;
      return { isProfileField: false, isScreeningQuestion: true, value: optionExists ? (matching?.[0] || selected.answer) : null,
        confidence: optionExists ? 'HIGH' : 'LOW', matchedQuestion: selected.label, fromAnswerBank: true };
    }
    const concept = this.detectConcept(field.label, field.name);

    // 1. Check candidate profile mapping
    const profileMatch = this.fieldMapper.mapField(field);
    if (profileMatch.isMatch && profileMatch.value !== undefined) {
      let resolvedValue = profileMatch.value;
      let conf: ConfidenceLevel = profileMatch.confidence;

      // If the field has options (select or radio group), resolve to best option
      if (field.options && field.options.length > 0) {
        const optionMatch = OptionMatcher.matchOption(concept, profileMatch.value, field.options);
        if (optionMatch.matchedOption) {
          resolvedValue = optionMatch.matchedOption;
          conf = optionMatch.confidence;
        } else {
          conf = 'LOW';
        }
      }

      return {
        isProfileField: true,
        isScreeningQuestion: false,
        value: resolvedValue,
        confidence: conf,
        profileField: profileMatch.profileField,
        suggestedOption: resolvedValue,
      };
    }

    // 2. Check approved answers knowledge base
    const query = `${field.label} ${field.name}`;
    const exactLabel = this.answerManager.findAnswer(field.label);
    const answerMatch = exactLabel.answer ? exactLabel : this.answerManager.findAnswer(query);
    if (answerMatch.answer) {
      let resolvedValue = answerMatch.answer;
      let conf: ConfidenceLevel = answerMatch.confidence;

      if (field.options && field.options.length > 0) {
        const optionMatch = OptionMatcher.matchOption(concept, answerMatch.answer, field.options);
        if (optionMatch.matchedOption) {
          resolvedValue = optionMatch.matchedOption;
          conf = optionMatch.confidence;
        } else {
          conf = 'LOW';
        }
      }

      return {
        isProfileField: false,
        isScreeningQuestion: true,
        value: resolvedValue,
        confidence: conf,
        matchedQuestion: answerMatch.approvedItem?.normalizedQuestion,
        suggestedOption: resolvedValue,
      };
    }

    // 3. Concept heuristic fallback for options (e.g. experience = 0 for dropdown with "< 1")
    if (field.options && field.options.length > 0) {
      if (concept === 'EXPERIENCE_YEARS') {
        const optMatch = OptionMatcher.matchOption('EXPERIENCE_YEARS', 0, field.options);
        if (optMatch.matchedOption && optMatch.confidence === 'HIGH') {
          return {
            isProfileField: true,
            isScreeningQuestion: true,
            value: optMatch.matchedOption,
            confidence: 'HIGH',
            suggestedOption: optMatch.matchedOption,
          };
        }
      } else if (concept === 'NOTICE_PERIOD') {
        const optMatch = OptionMatcher.matchOption('NOTICE_PERIOD', 'Immediate', field.options);
        if (optMatch.matchedOption && optMatch.confidence === 'HIGH') {
          return {
            isProfileField: true,
            isScreeningQuestion: true,
            value: optMatch.matchedOption,
            confidence: 'HIGH',
            suggestedOption: optMatch.matchedOption,
          };
        }
      } else if (concept === 'RELOCATION') {
        const optMatch = OptionMatcher.matchOption('RELOCATION', 'Yes', field.options);
        if (optMatch.matchedOption && optMatch.confidence === 'HIGH') {
          return {
            isProfileField: true,
            isScreeningQuestion: true,
            value: optMatch.matchedOption,
            confidence: 'HIGH',
            suggestedOption: optMatch.matchedOption,
          };
        }
      }
    }

    // 4. Unknown question
    return {
      isProfileField: false,
      isScreeningQuestion: true,
      value: null,
      confidence: 'LOW',
      suggestedOption: field.options && field.options.length > 0 ? field.options[0] : null,
    };
  }
}
