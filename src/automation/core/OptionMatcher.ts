export type FieldConcept =
  | 'EXPERIENCE_YEARS'
  | 'NOTICE_PERIOD'
  | 'WORK_AUTHORIZATION'
  | 'RELOCATION'
  | 'EDUCATION_DEGREE'
  | 'GENDER'
  | 'GENERIC';

export interface OptionMatchResult {
  matchedOption: string | null;
  score: number; // 0 to 1
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

export class OptionMatcher {
  /**
   * Finds the best matching option from a list of select or radio options
   */
  public static matchOption(
    concept: FieldConcept,
    targetValue: string | number,
    options: string[]
  ): OptionMatchResult {
    if (!options || options.length === 0) {
      return { matchedOption: null, score: 0, confidence: 'LOW', reasoning: 'No options available' };
    }

    // Filter out placeholder options like "Select...", "Choose..."
    const validOptions = options.filter(
      (opt) => opt && !opt.toLowerCase().startsWith('select') && !opt.toLowerCase().startsWith('choose')
    );

    if (validOptions.length === 0) {
      return { matchedOption: null, score: 0, confidence: 'LOW', reasoning: 'Only placeholder options' };
    }

    // 1. Direct exact or lowercase match
    const strTarget = String(targetValue).toLowerCase().trim();
    for (const opt of validOptions) {
      if (opt.toLowerCase().trim() === strTarget) {
        return { matchedOption: opt, score: 1.0, confidence: 'HIGH', reasoning: 'Exact match' };
      }
    }

    // 2. Concept-specific semantic evaluation
    switch (concept) {
      case 'EXPERIENCE_YEARS':
        return this.matchExperienceYears(Number(targetValue), validOptions);

      case 'NOTICE_PERIOD':
        return this.matchNoticePeriod(strTarget, validOptions);

      case 'WORK_AUTHORIZATION':
        return this.matchWorkAuthorization(strTarget, validOptions);

      case 'RELOCATION':
        return this.matchRelocation(strTarget, validOptions);

      case 'EDUCATION_DEGREE':
        return this.matchEducationDegree(strTarget, validOptions);

      case 'GENDER':
        return this.matchGender(strTarget, validOptions);

      default:
        return this.matchFuzzyTokens(strTarget, validOptions);
    }
  }

  /**
   * Evaluates numerical experience ranges (e.g. target 0 years)
   */
  private static matchExperienceYears(years: number, options: string[]): OptionMatchResult {
    // If target is 0 (Fresher):
    if (years === 0) {
      for (const opt of options) {
        const lower = opt.toLowerCase();

        // Check range patterns: < 1, 0-1, 0 - 1, 0 to 1, 0-2, less than 1
        if (
          lower.includes('< 1') ||
          lower.includes('<1') ||
          lower.includes('less than 1') ||
          lower.includes('0-1') ||
          lower.includes('0 - 1') ||
          lower.includes('0 to 1') ||
          lower.includes('0-2') ||
          lower.includes('0 - 2') ||
          lower.includes('fresher') ||
          lower.includes('entry level') ||
          lower.includes('no experience') ||
          lower === '0' ||
          lower === 'none'
        ) {
          return {
            matchedOption: opt,
            score: 0.95,
            confidence: 'HIGH',
            reasoning: `Matched 0 years experience to range option "${opt}"`,
          };
        }
      }
    }

    // General range parser: e.g. "1-3", "3 to 5"
    for (const opt of options) {
      const match = opt.match(/(\d+)\s*(?:-|to)\s*(\d+)/i);
      if (match) {
        const min = parseInt(match[1], 10);
        const max = parseInt(match[2], 10);
        if (years >= min && years <= max) {
          return {
            matchedOption: opt,
            score: 0.9,
            confidence: 'HIGH',
            reasoning: `Years (${years}) falls within range [${min}, ${max}] in option "${opt}"`,
          };
        }
      }
    }

    return this.matchFuzzyTokens(String(years), options);
  }

  /**
   * Evaluates notice period options (e.g. Immediate, 0 days, < 15 days)
   */
  private static matchNoticePeriod(target: string, options: string[]): OptionMatchResult {
    const isImmediate = target.includes('immediate') || target.includes('0') || target.includes('today');

    if (isImmediate) {
      for (const opt of options) {
        const lower = opt.toLowerCase();
        if (
          lower.includes('immediate') ||
          lower.includes('0 days') ||
          lower.includes('0-15') ||
          lower.includes('0 - 15') ||
          lower.includes('< 15') ||
          lower.includes('less than 15') ||
          lower.includes('< 1 month') ||
          lower.includes('less than 1 month') ||
          lower.includes('serving notice')
        ) {
          return {
            matchedOption: opt,
            score: 0.95,
            confidence: 'HIGH',
            reasoning: `Matched immediate availability to option "${opt}"`,
          };
        }
      }
    }

    return this.matchFuzzyTokens(target, options);
  }

  /**
   * Evaluates work authorization options
   */
  private static matchWorkAuthorization(target: string, options: string[]): OptionMatchResult {
    const isAuthorized = target.includes('yes') || target.includes('authorized') || target.includes('citizen');

    for (const opt of options) {
      const lower = opt.toLowerCase();
      if (isAuthorized) {
        if (
          lower === 'yes' ||
          lower.includes('citizen') ||
          lower.includes('permanent resident') ||
          (lower.includes('authorized') && !lower.includes('not authorized')) ||
          (lower.includes('do not require sponsorship') || lower.includes('without sponsorship'))
        ) {
          return {
            matchedOption: opt,
            score: 0.95,
            confidence: 'HIGH',
            reasoning: `Matched work authorization to option "${opt}"`,
          };
        }
      } else {
        if (lower === 'no' || lower.includes('require sponsorship')) {
          return {
            matchedOption: opt,
            score: 0.95,
            confidence: 'HIGH',
            reasoning: `Matched option "${opt}"`,
          };
        }
      }
    }

    return this.matchFuzzyTokens(target, options);
  }

  /**
   * Evaluates relocation options
   */
  private static matchRelocation(target: string, options: string[]): OptionMatchResult {
    const isWilling = target.includes('yes') || target.includes('willing') || target.includes('true');

    for (const opt of options) {
      const lower = opt.toLowerCase();
      if (isWilling) {
        if (
          lower === 'yes' ||
          lower.includes('willing') ||
          lower.includes('open to relocate') ||
          lower.includes('yes, immediately')
        ) {
          return {
            matchedOption: opt,
            score: 0.95,
            confidence: 'HIGH',
            reasoning: `Matched relocation willingness to "${opt}"`,
          };
        }
      }
    }

    return this.matchFuzzyTokens(target, options);
  }

  /**
   * Evaluates degree level options (MCA / Master's)
   */
  private static matchEducationDegree(target: string, options: string[]): OptionMatchResult {
    const isMaster = target.includes('mca') || target.includes('master');

    for (const opt of options) {
      const lower = opt.toLowerCase();
      if (isMaster) {
        if (
          lower.includes('master') ||
          lower.includes('mca') ||
          lower.includes('post graduate') ||
          lower.includes('postgraduate')
        ) {
          return {
            matchedOption: opt,
            score: 0.95,
            confidence: 'HIGH',
            reasoning: `Matched MCA/Master degree to option "${opt}"`,
          };
        }
      }
    }

    return this.matchFuzzyTokens(target, options);
  }

  /**
   * Evaluates voluntary gender options
   */
  private static matchGender(target: string, options: string[]): OptionMatchResult {
    const isMale = target.includes('male') && !target.includes('female');

    for (const opt of options) {
      const lower = opt.toLowerCase();
      if (isMale && (lower === 'male' || lower.startsWith('man') || lower.startsWith('male'))) {
        return {
          matchedOption: opt,
          score: 0.95,
          confidence: 'HIGH',
          reasoning: `Matched Male gender to "${opt}"`,
        };
      }
    }

    return this.matchFuzzyTokens(target, options);
  }

  /**
   * Fallback fuzzy token matcher
   */
  private static matchFuzzyTokens(target: string, options: string[]): OptionMatchResult {
    const targetTokens = target.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    let bestOption: string | null = null;
    let highestScore = 0;

    for (const opt of options) {
      const lowerOpt = opt.toLowerCase();
      if (lowerOpt.includes(target.toLowerCase())) {
        return {
          matchedOption: opt,
          score: 0.85,
          confidence: 'HIGH',
          reasoning: `Sub-string match: "${target}" in "${opt}"`,
        };
      }

      let matches = 0;
      for (const token of targetTokens) {
        if (lowerOpt.includes(token)) matches++;
      }

      const score = targetTokens.length > 0 ? matches / targetTokens.length : 0;
      if (score > highestScore) {
        highestScore = score;
        bestOption = opt;
      }
    }

    if (highestScore >= 0.5 && bestOption) {
      return {
        matchedOption: bestOption,
        score: highestScore,
        confidence: highestScore >= 0.75 ? 'HIGH' : 'MEDIUM',
        reasoning: `Token overlap (${Math.round(highestScore * 100)}%) with option "${bestOption}"`,
      };
    }

    return {
      matchedOption: null,
      score: 0,
      confidence: 'LOW',
      reasoning: 'No matching option found',
    };
  }
}
