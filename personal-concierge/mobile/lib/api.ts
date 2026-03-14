export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://claude-code-sandbox-production.up.railway.app';

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

interface DashboardSummary {
  today: HealthData | null;
  history: HealthData[];
}

export async function getTodayHealth(): Promise<HealthData | null> {
  const summary = await fetchApi<DashboardSummary>('/dashboard/summary');
  return summary?.today ?? null;
}

export async function getHealthHistory(): Promise<HealthData[]> {
  const summary = await fetchApi<DashboardSummary>('/dashboard/summary');
  return summary?.history ?? [];
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
  return fetchApi('/sync/oura');
}

export async function logMeal(mealId: string): Promise<{ status: string } | null> {
  return fetchApi('/nutrition/log', {
    method: 'POST',
    body: JSON.stringify({ meal_id: mealId }),
  });
}

// --- Supplements ---

export async function getSupplements(): Promise<any[]> {
  return (await fetchApi<any[]>('/supplements')) || [];
}

export async function addSupplement(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/supplements', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteSupplement(id: string): Promise<any | null> {
  return fetchApi(`/supplements/${id}`, { method: 'DELETE' });
}

export async function logSupplementIntake(supplementId: string): Promise<any | null> {
  return fetchApi('/supplements/log', { method: 'POST', body: JSON.stringify({ supplement_id: supplementId }) });
}

export async function getTodaySupplementLogs(): Promise<any[]> {
  return (await fetchApi<any[]>('/supplements/today')) || [];
}

export async function getSupplementStats(): Promise<any | null> {
  return fetchApi('/supplements/stats');
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

// --- Session 4: Voice ---

interface VoiceCommandResult {
  response_text: string;
  action: string | null;
  action_data: Record<string, unknown>;
}

export async function getMorningBriefing(): Promise<{ text: string } | null> {
  return fetchApi('/voice/morning-briefing');
}

export async function getEveningWindDown(): Promise<{ text: string } | null> {
  return fetchApi('/voice/evening-wind-down');
}

export async function processVoiceCommand(transcript: string, sessionType: string = 'command'): Promise<VoiceCommandResult | null> {
  return fetchApi('/voice/command', {
    method: 'POST',
    body: JSON.stringify({ transcript, session_type: sessionType }),
  });
}

// --- Session 4: Travel ---

interface Trip {
  id: string;
  destination: string;
  departure_date: string;
  return_date: string;
  trip_type: string;
  travel_companions: string;
  status: string;
  prep_done: boolean;
  notes: string | null;
}

export async function getTrips(): Promise<Trip[]> {
  return (await fetchApi<Trip[]>('/travel/trips')) || [];
}

export async function getActiveTrip(): Promise<Trip | null> {
  return fetchApi('/travel/active');
}

export async function createTrip(data: Partial<Trip>): Promise<Trip | null> {
  return fetchApi('/travel/trips', { method: 'POST', body: JSON.stringify(data) });
}

export async function getPreTripPlan(tripId: string): Promise<Record<string, unknown> | null> {
  return fetchApi(`/travel/trips/${tripId}/prep`);
}

// --- Session 4: Social ---

interface SocialContact {
  id: string;
  name: string;
  relationship_type: string | null;
  importance_weight: number;
  target_contact_days: number;
  last_contact_date: string | null;
  days_since_contact: number | null;
  is_overdue: boolean;
  preferred_activities: string[] | null;
}

interface SocialBriefing {
  score: number;
  overdue_connections: SocialContact[];
  nudge: string | null;
}

interface SocialScore {
  score: number;
  connection_score: number;
  quality_score: number;
  leisure_score: number;
  balance_score: number;
  nudges: string[];
}

export async function getSocialCircle(): Promise<SocialContact[]> {
  return (await fetchApi<SocialContact[]>('/social/circle')) || [];
}

export async function getSocialBriefing(): Promise<SocialBriefing | null> {
  return fetchApi('/social/briefing');
}

export async function getSocialScore(): Promise<SocialScore | null> {
  return fetchApi('/social/score');
}

export async function addSocialContact(data: Partial<SocialContact>): Promise<SocialContact | null> {
  return fetchApi('/social/circle', { method: 'POST', body: JSON.stringify(data) });
}

export async function logSocialConnection(contactId: string, data: Record<string, unknown>): Promise<unknown> {
  return fetchApi('/social/log', { method: 'POST', body: JSON.stringify({ contact_id: contactId, ...data }) });
}

// --- Session 4: Financial ---

interface FinancialContext {
  monthly_lifestyle_budget: number | null;
  city_tier: string | null;
  socioeconomic_tier: string | null;
}

interface Subscription {
  id: string;
  service_name: string;
  category: string | null;
  monthly_cost: number;
  usage_frequency: string | null;
  active: boolean;
}

interface SubscriptionAudit {
  total_monthly_cost: number;
  dormant_subscriptions: Subscription[];
  cancellation_candidates: Subscription[];
  monthly_savings_potential: number;
}

export async function getFinancialContext(): Promise<FinancialContext | null> {
  return fetchApi('/financial/context');
}

export async function getSubscriptions(): Promise<Subscription[]> {
  return (await fetchApi<Subscription[]>('/financial/subscriptions')) || [];
}

export async function getSubscriptionAudit(): Promise<SubscriptionAudit | null> {
  return fetchApi('/financial/audit');
}

export async function addSubscription(data: Partial<Subscription>): Promise<Subscription | null> {
  return fetchApi('/financial/subscriptions', { method: 'POST', body: JSON.stringify(data) });
}

// --- Session 4: Growth ---

interface GrowthHabit {
  id: string;
  name: string;
  category: string;
  description: string | null;
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  completed_today: boolean;
  active: boolean;
}

interface TodayHabits {
  habits: GrowthHabit[];
  completion_rate: number;
  completed: number;
  total: number;
  streak_at_risk: GrowthHabit[];
}

interface CompoundScore {
  score: number;
  domains: Record<string, number>;
}

export async function getTodayHabits(): Promise<TodayHabits | null> {
  return fetchApi('/growth/today');
}

export async function getGrowthHabits(): Promise<GrowthHabit[]> {
  return (await fetchApi<GrowthHabit[]>('/growth/habits')) || [];
}

export async function logHabitCompletion(habitId: string, completed: boolean = true): Promise<unknown> {
  return fetchApi('/growth/log', { method: 'POST', body: JSON.stringify({ habit_id: habitId, completed }) });
}

export async function getGrowthScore(): Promise<CompoundScore | null> {
  return fetchApi('/growth/score');
}

export async function suggestNextHabit(): Promise<Record<string, unknown> | null> {
  return fetchApi('/growth/suggest');
}

export async function addGrowthHabit(data: Partial<GrowthHabit>): Promise<GrowthHabit | null> {
  return fetchApi('/growth/habits', { method: 'POST', body: JSON.stringify(data) });
}

// --- Session 4: Career ---

interface CareerProfile {
  role_title: string | null;
  industry: string | null;
  years_experience: number | null;
  career_goals: string[] | null;
  skills_to_develop: string[] | null;
  skills_strong: string[] | null;
  satisfaction_score: number | null;
  stress_level: number | null;
  next_milestone: string | null;
}

interface BurnoutRisk {
  risk_score: number;
  risk_level: string;
  contributing_factors: string[];
  recommendations: string[];
}

export async function getCareerProfile(): Promise<CareerProfile | null> {
  return fetchApi('/career/profile');
}

export async function getBurnoutRisk(): Promise<BurnoutRisk | null> {
  return fetchApi('/career/burnout');
}

export async function getCareerCoaching(): Promise<{ coaching: string } | null> {
  return fetchApi('/career/coaching');
}

export async function logCareerReflection(data: Record<string, unknown>): Promise<unknown> {
  return fetchApi('/career/reflection', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCareerProfile(data: Record<string, unknown>): Promise<unknown> {
  return fetchApi('/career/profile', { method: 'PUT', body: JSON.stringify(data) });
}

// --- Session 4: Wardrobe ---

interface WardrobeItem {
  id: string;
  item_name: string;
  category: string | null;
  color: string | null;
  times_worn: number;
  condition: string;
  active: boolean;
}

interface OutfitSuggestion {
  outfit_items: { id: string; name: string; category: string }[];
  reasoning: string;
  weather_appropriate: boolean;
}

export async function getWardrobeItems(): Promise<WardrobeItem[]> {
  return (await fetchApi<WardrobeItem[]>('/wardrobe/items')) || [];
}

export async function getOutfitSuggestion(occasion: string = 'casual'): Promise<OutfitSuggestion | null> {
  return fetchApi(`/wardrobe/suggest?occasion=${occasion}`);
}

export async function getTomorrowOutfit(): Promise<OutfitSuggestion | null> {
  return fetchApi('/wardrobe/tomorrow');
}

export async function addWardrobeItem(data: Partial<WardrobeItem>): Promise<WardrobeItem | null> {
  return fetchApi('/wardrobe/items', { method: 'POST', body: JSON.stringify(data) });
}

export async function getWardrobeAudit(): Promise<Record<string, unknown> | null> {
  return fetchApi('/wardrobe/audit');
}

// --- Session 5: Personality ---

interface PersonalityProfile {
  id?: string;
  mbti_type: string | null;
  mbti_label: string | null;
  mbti_dimensions: { EI: number; SN: number; TF: number; JP: number } | null;
  energy_source: string | null;
  decision_style: string | null;
  structure_preference: string | null;
  stress_response: string | null;
  urban_nature_score: number | null;
  style_orientation: string | null;
  comfort_appearance_balance: number | null;
  reassess_due: string | null;
}

interface CoachingStyle {
  communication_style: string;
  motivation_frame: string;
  feedback_preference: string;
  structure_preference: string;
  surprise_tolerance: number;
}

export async function getPersonalityQuestions(): Promise<any | null> {
  return fetchApi('/personality/questions');
}

export async function scorePersonalityAssessment(responses: any[]): Promise<PersonalityProfile | null> {
  return fetchApi('/personality/score', { method: 'POST', body: JSON.stringify({ responses }) });
}

export async function getPersonalityProfile(): Promise<PersonalityProfile | null> {
  return fetchApi('/personality/profile');
}

export async function getPersonalityInsight(): Promise<{ insight: string } | null> {
  return fetchApi('/personality/insight');
}

export async function getCoachingStyle(): Promise<CoachingStyle | null> {
  return fetchApi('/personality/coaching-style');
}

export async function updatePersonalityProfile(data: Partial<PersonalityProfile>): Promise<PersonalityProfile | null> {
  return fetchApi('/personality/profile', { method: 'PUT', body: JSON.stringify(data) });
}

// --- Session 5: Apple Health ---

export async function getHealthGaps(): Promise<string[]> {
  return (await fetchApi<string[]>('/sync/gaps')) || [];
}

export async function syncAppleHealth(days: any[]): Promise<{ synced: number } | null> {
  return fetchApi('/sync/apple-health', { method: 'POST', body: JSON.stringify({ days }) });
}

// --- Session 5: Onboarding ---

interface OnboardingStatus {
  total_steps: number;
  completed_steps: number;
  completion_percent: number;
  next_step: string | null;
  skipped_steps: string[];
  is_complete: boolean;
}

export async function getOnboardingStatus(): Promise<OnboardingStatus | null> {
  return fetchApi('/onboarding/status');
}

export async function getStepContent(name: string): Promise<any | null> {
  return fetchApi(`/onboarding/step/${name}`);
}

export async function completeOnboardingStep(name: string, data?: Record<string, any>): Promise<any | null> {
  return fetchApi(`/onboarding/step/${name}`, { method: 'POST', body: JSON.stringify({ data: data || {} }) });
}

export async function skipOnboardingStep(name: string): Promise<any | null> {
  return fetchApi(`/onboarding/step/${name}/skip`, { method: 'POST' });
}

export async function getOnboardingHabitSuggestions(): Promise<any[]> {
  return (await fetchApi<any[]>('/onboarding/habits-suggest')) || [];
}

// --- Session 5: Feedback Learning ---

interface RatingSubmit {
  category: string;
  item_id: string;
  item_description: string;
  rating: string;
  explicit_feedback?: string;
}

export async function submitRating(data: RatingSubmit): Promise<any | null> {
  return fetchApi('/feedback/rate', { method: 'POST', body: JSON.stringify(data) });
}

export async function getPreferencePatterns(category?: string): Promise<any | null> {
  const path = category ? `/feedback/patterns/${category}` : '/feedback/patterns';
  return fetchApi(path);
}

export async function getLearningSummary(): Promise<any | null> {
  return fetchApi('/feedback/summary');
}

// --- Session 5: Legacy ---

export async function getLegacyProfile(): Promise<any | null> {
  return fetchApi('/legacy/profile');
}

export async function saveLegacyProfile(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/legacy/profile', { method: 'PUT', body: JSON.stringify(data) });
}

export async function getLegacyMilestones(limit: number = 20): Promise<any[]> {
  return (await fetchApi<any[]>(`/legacy/milestones?limit=${limit}`)) || [];
}

export async function logLegacyMilestone(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/legacy/milestones', { method: 'POST', body: JSON.stringify(data) });
}

export async function getLegacyDrift(): Promise<any | null> {
  return fetchApi('/legacy/drift');
}

export async function getLegacyBridge(): Promise<any | null> {
  return fetchApi('/legacy/bridge');
}

// --- Session 5: Home Environment ---

export async function getHomeProfile(): Promise<any | null> {
  return fetchApi('/home/profile');
}

export async function updateHomeProfile(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/home/profile', { method: 'PUT', body: JSON.stringify(data) });
}

export async function getHomeRecommendations(completed: boolean = false): Promise<any[]> {
  return (await fetchApi<any[]>(`/home/recommendations?completed=${completed}`)) || [];
}

export async function generateHomeRecommendations(): Promise<any[]> {
  return (await fetchApi<any[]>('/home/recommendations/generate', { method: 'POST' })) || [];
}

export async function completeHomeRecommendation(id: string): Promise<any | null> {
  return fetchApi(`/home/recommendations/${id}/complete`, { method: 'PUT' });
}

export async function getHomeCorrelations(): Promise<any[]> {
  return (await fetchApi<any[]>('/home/correlations')) || [];
}

// --- Session 5: Learning ---

export async function getLearningProfile(): Promise<any | null> {
  return fetchApi('/learning/profile');
}

export async function getLearningToday(): Promise<any | null> {
  return fetchApi('/learning/today');
}

export async function getLearningBooks(status?: string): Promise<any[]> {
  const q = status ? `?status=${status}` : '';
  return (await fetchApi<any[]>(`/learning/books${q}`)) || [];
}

export async function addLearningBook(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/learning/books', { method: 'POST', body: JSON.stringify(data) });
}

export async function getLearningCourses(status?: string): Promise<any[]> {
  const q = status ? `?status=${status}` : '';
  return (await fetchApi<any[]>(`/learning/courses${q}`)) || [];
}

export async function addLearningCourse(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/learning/courses', { method: 'POST', body: JSON.stringify(data) });
}

export async function logLearningSession(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/learning/log', { method: 'POST', body: JSON.stringify(data) });
}

export async function getLearningWeekly(): Promise<any | null> {
  return fetchApi('/learning/weekly');
}

// --- Session 5: Privacy ---

export async function getDataSummary(): Promise<any | null> {
  return fetchApi('/privacy/summary');
}

export async function exportData(): Promise<any | null> {
  return fetchApi('/privacy/export', { method: 'POST' });
}

export async function deleteCategory(category: string, confirm: boolean = false): Promise<any | null> {
  return fetchApi(`/privacy/category/${category}?confirm=${confirm}`, { method: 'DELETE' });
}

export async function amnesia(category: string, confirm: boolean = false): Promise<any | null> {
  return fetchApi('/privacy/amnesia', { method: 'POST', body: JSON.stringify({ category, confirm }) });
}

// --- Notifications ---

export async function registerPushToken(token: string, platform: string = 'ios'): Promise<unknown> {
  return fetchApi('/notifications/register', { method: 'POST', body: JSON.stringify({ token, platform }) });
}

// --- Session 6: Skincare ---

export async function getSkinProfile(): Promise<any | null> {
  return fetchApi('/skincare/profile');
}

export async function getSkincareProducts(): Promise<any[]> {
  return (await fetchApi<any[]>('/skincare/products')) || [];
}

export async function addSkincareProduct(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/skincare/products', { method: 'POST', body: JSON.stringify(data) });
}

export async function getMorningRoutine(): Promise<any[]> {
  return (await fetchApi<any[]>('/skincare/routine/morning')) || [];
}

export async function getEveningRoutine(): Promise<any[]> {
  return (await fetchApi<any[]>('/skincare/routine/evening')) || [];
}

export async function logSkinCheckin(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/skincare/checkin', { method: 'POST', body: JSON.stringify(data) });
}

export async function getSkinCorrelations(): Promise<any[]> {
  return (await fetchApi<any[]>('/skincare/correlations')) || [];
}

export async function getWeeklySkinSummary(): Promise<any | null> {
  return fetchApi('/skincare/weekly');
}

// --- Session 6: Relationships ---

export async function getRelationships(): Promise<any[]> {
  return (await fetchApi<any[]>('/relationships')) || [];
}

export async function getRelationshipHealth(): Promise<any | null> {
  return fetchApi('/relationships/health');
}

export async function getRelationshipBriefing(): Promise<any | null> {
  return fetchApi('/relationships/briefing');
}

export async function logRelationshipCheckin(contactId: string, data: Record<string, any>): Promise<any | null> {
  return fetchApi(`/relationships/${contactId}/checkin`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getRelationshipCoaching(contactId: string): Promise<any | null> {
  return fetchApi(`/relationships/${contactId}/coaching`);
}

// --- Session 6: Digital Identity ---

export async function getDigitalProfile(): Promise<any | null> {
  return fetchApi('/digital/profile');
}

export async function generateLinkedInAudit(): Promise<any | null> {
  return fetchApi('/digital/linkedin-audit', { method: 'POST' });
}

export async function getBrandStatement(): Promise<any | null> {
  return fetchApi('/digital/brand-statement');
}

export async function getContentSuggestions(): Promise<any[]> {
  return (await fetchApi<any[]>('/digital/content-suggestions')) || [];
}

// --- Session 6: Financial Planning ---

export async function getFinancialGoals(): Promise<any[]> {
  return (await fetchApi<any[]>('/financial-planning/goals')) || [];
}

export async function addFinancialGoal(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/financial-planning/goals', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateGoalProgress(goalId: string, currentAmount: number): Promise<any | null> {
  return fetchApi(`/financial-planning/goals/${goalId}/progress`, {
    method: 'PUT', body: JSON.stringify({ current_amount: currentAmount }),
  });
}

export async function logFinancialStress(stressLevel: number, stressor?: string): Promise<any | null> {
  return fetchApi('/financial-planning/stress', {
    method: 'POST', body: JSON.stringify({ stress_level: stressLevel, primary_stressor: stressor }),
  });
}

export async function getFinancialStressFlag(): Promise<any | null> {
  return fetchApi('/financial-planning/stress-flag');
}

export async function getGoalTimeline(): Promise<any | null> {
  return fetchApi('/financial-planning/timeline');
}

export async function getGoalAlignment(): Promise<any[]> {
  return (await fetchApi<any[]>('/financial-planning/alignment')) || [];
}

// --- Session 6: Hobbies ---

export async function getHobbies(status?: string): Promise<any[]> {
  const q = status ? `?status=${status}` : '';
  return (await fetchApi<any[]>(`/hobbies${q}`)) || [];
}

export async function addHobby(data: Record<string, any>): Promise<any | null> {
  return fetchApi('/hobbies', { method: 'POST', body: JSON.stringify(data) });
}

export async function logHobbySession(hobbyId: string, data: Record<string, any>): Promise<any | null> {
  return fetchApi(`/hobbies/${hobbyId}/log`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getDormantHobbies(): Promise<any[]> {
  return (await fetchApi<any[]>('/hobbies/dormant')) || [];
}

export async function getHobbyHealthScore(): Promise<any | null> {
  return fetchApi('/hobbies/health-score');
}

export async function getHobbyBriefing(): Promise<any | null> {
  return fetchApi('/hobbies/briefing');
}

// --- Session 6: Contextual Intelligence ---

export async function submitContextSignal(signalText: string): Promise<any | null> {
  return fetchApi('/context/signal', {
    method: 'POST', body: JSON.stringify({ signal_text: signalText }),
  });
}

export async function getRecentSignals(days: number = 7): Promise<any[]> {
  return (await fetchApi<any[]>(`/context/signals?days=${days}`)) || [];
}

export async function getAnomalies(): Promise<any[]> {
  return (await fetchApi<any[]>('/context/anomalies')) || [];
}

// --- Session 6: Conversation ---

export async function sendConversationMessage(
  message: string,
  sessionId?: string,
  history?: { role: string; content: string }[]
): Promise<any | null> {
  return fetchApi('/conversation/message', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId, history }),
  });
}

export async function getConversationSessions(limit: number = 5): Promise<any[]> {
  return (await fetchApi<any[]>(`/conversation/sessions?limit=${limit}`)) || [];
}

export async function getConversationHistory(sessionId: string): Promise<any[]> {
  return (await fetchApi<any[]>(`/conversation/sessions/${sessionId}`)) || [];
}

// --- Session 6: Reviews ---

export async function getWeeklyReview(): Promise<any | null> {
  return fetchApi('/reviews/weekly');
}

export async function getMonthlyReview(): Promise<any | null> {
  return fetchApi('/reviews/monthly');
}

export async function generateWeeklyReview(): Promise<any | null> {
  return fetchApi('/reviews/weekly/generate', { method: 'POST' });
}

export async function generateMonthlyReview(): Promise<any | null> {
  return fetchApi('/reviews/monthly/generate', { method: 'POST' });
}

export async function getWeeklyReviewHistory(): Promise<any[]> {
  return (await fetchApi<any[]>('/reviews/history/weekly')) || [];
}

export async function getMonthlyReviewHistory(): Promise<any[]> {
  return (await fetchApi<any[]>('/reviews/history/monthly')) || [];
}

// --- Session 6: Daily Plan (Council) ---

export async function getDailyPlan(): Promise<any | null> {
  return fetchApi('/daily/plan');
}

export async function refreshDailyPlan(): Promise<any | null> {
  return fetchApi('/daily/plan?refresh=true');
}

export async function getCouncilDebug(): Promise<any | null> {
  return fetchApi('/daily/council-debug');
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
  VoiceCommandResult,
  Trip,
  SocialContact,
  SocialBriefing,
  SocialScore,
  FinancialContext,
  Subscription,
  SubscriptionAudit,
  GrowthHabit,
  TodayHabits,
  CompoundScore,
  CareerProfile,
  BurnoutRisk,
  WardrobeItem,
  OutfitSuggestion,
};
