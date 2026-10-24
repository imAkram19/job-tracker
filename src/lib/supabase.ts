import { createClient } from '@supabase/supabase-js';
import { TrackingState, UserJobTracking } from '@/types/job';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.includes('supabase.co')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEY = 'akram_job_tracker_data_v2';

/**
 * Fetch tracking state from Supabase if configured, with LocalStorage fallback/cache.
 */
export async function loadTrackingState(): Promise<TrackingState> {
  const localData = getLocalTrackingState();

  if (!supabase || !isSupabaseConfigured) {
    return localData;
  }

  try {
    const { data, error } = await supabase
      .from('job_applications')
      .select('job_id, status, comments, applied_at, updated_at');

    if (error) {
      console.warn('Supabase fetch error, using local fallback:', error.message);
      return localData;
    }

    if (data && data.length > 0) {
      const remoteState: TrackingState = { ...localData };
      data.forEach((row: any) => {
        remoteState[row.job_id] = {
          status: row.status || 'Not Applied',
          comments: row.comments || '',
          appliedDate: row.applied_at || undefined,
          updatedAt: row.updated_at || undefined,
        };
      });
      // Sync merged state into localStorage for instant offline access
      saveLocalTrackingState(remoteState);
      return remoteState;
    }

    return localData;
  } catch (err) {
    console.warn('Supabase network error, fallback to local storage:', err);
    return localData;
  }
}

/**
 * Upsert tracking item to Supabase and LocalStorage.
 */
export async function saveJobTracking(
  jobId: string, 
  tracking: UserJobTracking
): Promise<void> {
  // Update local storage first (instant UX)
  const current = getLocalTrackingState();
  current[jobId] = tracking;
  saveLocalTrackingState(current);

  if (!supabase || !isSupabaseConfigured) {
    return;
  }

  try {
    const { error } = await supabase
      .from('job_applications')
      .upsert(
        {
          job_id: jobId,
          status: tracking.status,
          comments: tracking.comments || '',
          applied_at: tracking.appliedDate || (tracking.status === 'Applied' ? new Date().toISOString() : null),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'job_id' }
      );

    if (error) {
      console.error('Failed to sync to Supabase:', error.message);
    }
  } catch (err) {
    console.error('Supabase upsert error:', err);
  }
}

export function getLocalTrackingState(): TrackingState {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Migrate old v1 format if present
      const oldStatuses = localStorage.getItem('akram_job_statuses');
      if (oldStatuses) {
        const parsed = JSON.parse(oldStatuses);
        const migrated: TrackingState = {};
        for (const [id, status] of Object.entries(parsed)) {
          migrated[id] = {
            status: status as any,
            comments: '',
            updatedAt: new Date().toISOString(),
          };
        }
        return migrated;
      }
      return {};
    }
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

export function saveLocalTrackingState(state: TrackingState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to write to localStorage:', err);
  }
}
