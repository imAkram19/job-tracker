export type JobCategory = 
  | 'Frontend & Full-Stack' 
  | 'Backend & Full-Stack' 
  | 'QA & Testing' 
  | 'Support & Trainee';

export type JobStatus = 
  | 'Not Applied' 
  | 'No link'
  | 'Review'
  | 'Applied' 
  | 'Interviewing' 
  | 'Offer' 
  | 'Rejected' 
  | 'Archived';

export interface JobItem {
  id: string;
  rank: number;
  company: string;
  title: string;
  category: JobCategory;
  location: string;
  workMode: 'Onsite' | 'Hybrid' | 'Remote';
  experience: string;
  salary: string;
  employmentType: string;
  datePosted: string; // ISO date YYYY-MM-DD, or "Not disclosed" when the source omits it
  source: string;
  applyUrl: string;
  assessment: 'Ready to apply' | 'Needs review';
  notes: string;
}

export interface UserJobTracking {
  status: JobStatus;
  comments: string;
  appliedDate?: string | null;
  updatedAt?: string | null;
}

export type TrackingState = Record<string, UserJobTracking>;
