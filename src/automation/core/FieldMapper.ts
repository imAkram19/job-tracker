import { CandidateProfileData, FormField } from '../types/automation';

export interface FieldMappingResult {
  isMatch: boolean;
  profileField?: string;
  value?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class FieldMapper {
  private candidate: CandidateProfileData;

  constructor(candidate: CandidateProfileData) {
    this.candidate = candidate;
  }

  /**
   * Normalizes label or name string for comparison
   */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Evaluates if a detected field corresponds to a known candidate profile attribute
   */
  public mapField(field: FormField): FieldMappingResult {
    const normLabel = this.normalize(field.label);
    const normName = this.normalize(field.name);
    const combined = `${normLabel} ${normName}`;

    // 1. Resume / CV upload
    if (
      field.type === 'file' ||
      /\b(resume|cv|curriculum vitae)\b/.test(combined)
    ) {
      return {
        isMatch: true,
        profileField: 'resumePath',
        value: this.candidate.resumePath,
        confidence: 'HIGH',
      };
    }

    // 2. First Name
    if (
      /\b(first name|given name|forename|legal first name)\b/.test(combined) &&
      !combined.includes('last')
    ) {
      return {
        isMatch: true,
        profileField: 'firstName',
        value: this.candidate.firstName,
        confidence: 'HIGH',
      };
    }

    // 3. Last Name
    if (
      /\b(last name|surname|family name|legal last name)\b/.test(combined) &&
      !combined.includes('first')
    ) {
      return {
        isMatch: true,
        profileField: 'lastName',
        value: this.candidate.lastName,
        confidence: 'HIGH',
      };
    }

    // 4. Full Name
    if (
      /\b(full name|legal name|your name|candidate name)\b/.test(combined) ||
      normLabel === 'name' || (!normLabel && normName === 'name')
    ) {
      return {
        isMatch: true,
        profileField: 'fullName',
        value: this.candidate.fullName,
        confidence: 'HIGH',
      };
    }

    // 5. Email
    if (
      field.type === 'email' ||
      /\b(email|email address|e mail)\b/.test(combined)
    ) {
      return {
        isMatch: true,
        profileField: 'email',
        value: this.candidate.email,
        confidence: 'HIGH',
      };
    }

    // 6. Phone / Mobile
    if (
      field.type === 'tel' ||
      /\b(phone|phone number|mobile|mobile number|contact number|cell phone)\b/.test(combined)
    ) {
      return {
        isMatch: true,
        profileField: 'phone',
        value: this.candidate.phone,
        confidence: 'HIGH',
      };
    }

    // 7. LinkedIn
    if (/\b(linkedin|linked in)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'linkedin',
        value: this.candidate.linkedin,
        confidence: 'HIGH',
      };
    }

    // 8. GitHub
    if (/\b(github|git hub)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'github',
        value: this.candidate.github,
        confidence: 'HIGH',
      };
    }

    // 9. Portfolio / Website
    if (/\b(portfolio|website|personal website|personal url|portfolio link)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'portfolio',
        value: this.candidate.portfolio,
        confidence: 'HIGH',
      };
    }

    // 10. Current Company / Employer
    if (/\b(current company|current employer|present organization)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'currentCompany',
        value: this.candidate.currentCompany,
        confidence: 'HIGH',
      };
    }

    // 11. Location / City / State / Country
    if (/\b(current location|location)\b/.test(combined) && !combined.includes('relocate')) {
      return {
        isMatch: true,
        profileField: 'location',
        value: `${this.candidate.city}, ${this.candidate.state}, ${this.candidate.country}`,
        confidence: 'HIGH',
      };
    }

    if (/\b(city|current city|location city)\b/.test(combined) && !combined.includes('country') && !combined.includes('state')) {
      return {
        isMatch: true,
        profileField: 'city',
        value: this.candidate.city,
        confidence: 'HIGH',
      };
    }

    if (/\b(state|province|region)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'state',
        value: this.candidate.state,
        confidence: 'HIGH',
      };
    }

    if (/\b(country|current country)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'country',
        value: this.candidate.country,
        confidence: 'HIGH',
      };
    }

    if (/\b(postal code|zip code|pincode|pin code|zip)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'postalCode',
        value: this.candidate.postalCode,
        confidence: 'HIGH',
      };
    }

    // 12. Education: Degree, University, Graduation Year
    if (/\b(degree|highest degree|qualification)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'degree',
        value: this.candidate.education[0]?.degree || 'MCA',
        confidence: 'HIGH',
      };
    }

    if (/\b(university|college|institution|school)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'university',
        value: this.candidate.education[0]?.university || 'Masterji Degree and PG College',
        confidence: 'HIGH',
      };
    }

    if (/\b(graduation year|year of passing|year graduated)\b/.test(combined)) {
      return {
        isMatch: true,
        profileField: 'graduationYear',
        value: this.candidate.education[0]?.graduationYear || '2026',
        confidence: 'HIGH',
      };
    }

    return {
      isMatch: false,
      confidence: 'LOW',
    };
  }
}
