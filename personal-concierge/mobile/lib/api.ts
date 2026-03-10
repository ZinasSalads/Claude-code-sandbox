const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

interface HealthData {
  date: string;
  readiness_score: number | null;
  hrv: number | null;
  resting_heart_rate: number | null;
  sleep_score: number | null;
  sleep_duration: number | null;
  activity_score: number | null;
  steps: number | null;
}

interface CheckIn {
  id: string;
  date: string;
  energy: number;
  mood: number;
  stress: number;
  soreness: number;
  notes: string | null;
}

interface CheckInSubmit {
  energy: number;
  mood: number;
  stress: number;
  soreness: number;
  notes?: string;
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  weight_guidance: string;
  notes: string;
}

interface WarmupCooldown {
  exercise: string;
  duration_or_sets: string;
}

interface Workout {
  id?: string;
  date?: string;
  workout_type: string;
  title: string;
  intensity: string;
  duration_minutes: number;
  ai_reasoning: string;
  warmup?: WarmupCooldown[];
  exercises: Exercise[];
  cooldown?: WarmupCooldown[];
  coaching_note?: string;
  completed?: boolean;
  readiness_at_recommendation?: number;
}

interface Meal {
  id?: string;
  meal_type: string;
  title: string;
  description: string;
  key_ingredients?: string[];
  ingredients?: string[];
  estimated_calories?: number;
  calories?: number;
  estimated_protein?: number;
  protein_g?: number;
  estimated_carbs?: number;
  carbs_g?: number;
  estimated_fat?: number;
  fat_g?: number;
  prep_time_minutes?: number;
  notes?: string;
  logged?: boolean;
}

interface MealPlan {
  daily_targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  meals: Meal[];
  ai_reasoning: string;
  hydration_target_ml?: number;
  nutrition_note?: string;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const resp = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!resp.ok) {
      console.error(`API error ${resp.status}: ${path}`);
      return null;
    }
    return await resp.json();
  } catch (e) {
    console.error(`API fetch failed: ${path}`, e);
    return null;
  }
}

export async function getTodayHealth(): Promise<HealthData | null> {
  // Fetch from Supabase directly or via backend
  return fetchApi<HealthData>('/health');
}

export async function getTodayCheckIn(): Promise<CheckIn | null> {
  return fetchApi<CheckIn>('/checkin/today');
}

export async function submitCheckIn(data: CheckInSubmit): Promise<{ status: string } | null> {
  return fetchApi('/checkin', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getTodayWorkout(): Promise<Workout | null> {
  return fetchApi<Workout>('/fitness/today');
}

export async function getTodayMeals(): Promise<MealPlan | null> {
  return fetchApi<MealPlan>('/nutrition/today');
}

export async function completeWorkout(notes?: string): Promise<{ status: string } | null> {
  return fetchApi('/fitness/complete', {
    method: 'POST',
    body: JSON.stringify({ notes: notes || '' }),
  });
}

export async function syncOura(): Promise<{ status: string; days_synced: number } | null> {
  return fetchApi('/sync/oura', { method: 'POST' });
}

export async function logMeal(mealId: string): Promise<{ status: string } | null> {
  return fetchApi('/nutrition/log', {
    method: 'POST',
    body: JSON.stringify({ meal_id: mealId }),
  });
}

// --- Blood Work ---

interface Biomarker {
  name: string;
  value: number;
  unit: string;
  date: string;
  flag: string;
  reference_min?: number | null;
  reference_max?: number | null;
  optimal_min?: number;
  optimal_max?: number;
  optimal_status?: 'optimal' | 'suboptimal' | 'high' | 'low';
}

interface BloodWorkUpload {
  id: string;
  upload_date: string;
  lab_name: string;
  test_date: string;
  pdf_filename: string;
  biomarker_count: number;
  processing_status: string;
}

interface UploadResult {
  upload_id: string;
  lab_name: string;
  test_date: string;
  biomarkers_found: number;
  biomarkers_saved: number;
  biomarkers: Biomarker[];
}

interface DeltaEntry {
  name: string;
  old_value?: number;
  new_value?: number;
  old_date?: string;
  new_date?: string;
  unit?: string;
  change?: number;
  change_pct?: number;
  direction?: string;
}

interface DeltaReport {
  date_old: string;
  date_new: string;
  deltas: DeltaEntry[];
  total_markers: number;
  error?: string;
}

export async function uploadBloodWork(file: { uri: string; name: string; type: string }): Promise<UploadResult | null> {
  try {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    const resp = await fetch(`${API_URL}/bloodwork/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.error('Blood work upload failed:', e);
    return null;
  }
}

export async function getBiomarkers(): Promise<Biomarker[]> {
  return (await fetchApi<Biomarker[]>('/bloodwork/biomarkers')) || [];
}

export async function getBiomarkerTrend(name: string, days?: number): Promise<{ name: string; data: Biomarker[] } | null> {
  const q = days ? `?days=${days}` : '';
  return fetchApi(`/bloodwork/biomarkers/${encodeURIComponent(name)}/trend${q}`);
}

export async function getBloodWorkDelta(date1?: string, date2?: string): Promise<DeltaReport | null> {
  const params = new URLSearchParams();
  if (date1) params.set('date1', date1);
  if (date2) params.set('date2', date2);
  const q = params.toString() ? `?${params}` : '';
  return fetchApi(`/bloodwork/delta${q}`);
}

export async function getBloodWorkUploads(): Promise<BloodWorkUpload[]> {
  return (await fetchApi<BloodWorkUpload[]>('/bloodwork/uploads')) || [];
}

export async function getFlaggedBiomarkers(): Promise<Biomarker[]> {
  return (await fetchApi<Biomarker[]>('/bloodwork/flagged')) || [];
}

export type {
  HealthData,
  CheckIn,
  CheckInSubmit,
  Exercise,
  WarmupCooldown,
  Workout,
  Meal,
  MealPlan,
  Biomarker,
  BloodWorkUpload,
  UploadResult,
  DeltaEntry,
  DeltaReport,
};
