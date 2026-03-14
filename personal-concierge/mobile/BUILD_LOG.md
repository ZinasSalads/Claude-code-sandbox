# Build Log - Mobile App Audit & Fixes

## Session: 2026-03-13/14

### 1. Expo SDK 54 Crash Fix
- **Issue**: App crashed on launch with "main has not been registered"
- **Root cause**: `package.json` had `"main": "App.tsx"` (wrong for SDK 54) and `expo-router` was installed but unused (hijacks entry point)
- **Fix**: Changed main to `"node_modules/expo/AppEntry.js"`, removed `expo-router` from dependencies, removed unused `registerRootComponent` and `useCallback` imports from App.tsx
- **Commit**: `88e9692`

### 2. API Base URL
- **Issue**: `lib/api.ts` and `.env.example` pointed to `localhost:8000`
- **Fix**: Changed fallback to `https://claude-code-sandbox-production.up.railway.app`
- **Commit**: `8ac4c37`

### 3. Cross-Tab Navigation (Round 1)
- **Issue**: CommandCenter module cards used `navigate('BloodWork')` etc. which can't reach screens in other tab stacks
- **Fix**: Changed to nested navigation syntax: `navigate('Health', { screen: 'BloodWork' })`
- **Affected**: BloodWork, Supplements, Longevity, Research (Health tab), CheckIn (Profile tab)
- **Commit**: `1a160d1`

### 4. Dashboard Hub Screens + API_URL Consolidation
- **Issue**: Each tab landed directly on a single screen (e.g. Health tab = BloodWork). No way to reach other modules. Back button always showed "Blood Work". 11 screens had hardcoded `localhost:8000`.
- **Fix**:
  - Created 4 dashboard hub screens: `HealthDashboard`, `LifeDashboard`, `VoiceDashboard`, `ProfileDashboard`
  - Each tab now lands on its hub, which lists all sub-modules with descriptions
  - Back button now goes to the hub instead of a random module
  - All 11 screens now import `API_URL` from shared `lib/api.ts`
  - Fixed `tsconfig.json` moduleResolution for SDK 54
- **Commit**: `aff4bd7`

### 5. Health Data Endpoint Fix
- **Issue**: `getTodayHealth()` called `/health` which is the backend service health check (returns `{status: "ok", services: {...}}`), not user health data
- **Fix**: Changed to `/dashboard/summary` which returns `{ today: {readiness_score, hrv, ...}, history: [...] }`
- **Added**: `getHealthHistory()` function for 7-day trends
- **Commit**: `69742cf`

### 6. Unsafe Array Operations (Crash Fixes)
- **Issue**: `products.sort()` in Skincare.tsx crashed when products was undefined. Similar issues in 14 other screens.
- **Fix**: Added `|| []` guards on all array operations that could receive null/undefined from API responses
- **Affected screens**: Skincare, Relationships, BloodWork, CommandCenter, Financial, Growth, HealthDashboard, Learning, Reviews, DigitalIdentity, Social, Travel, Wardrobe, Career, Supplements
- **Commit**: `d0a500d`

### 7. API Functions + Sync Fix
- **Issue**: Supplement endpoints had no functions in `api.ts` (screens used direct fetch). `syncOura()` used POST but backend accepts GET. Missing `getGrowthHabits()`.
- **Fix**:
  - Added 6 supplement functions: `getSupplements`, `addSupplement`, `deleteSupplement`, `logSupplementIntake`, `getTodaySupplementLogs`, `getSupplementStats`
  - Added `getGrowthHabits()` for GET /growth/habits
  - Changed `syncOura()` from POST to GET
- **Commit**: `6d413f0`

### 8. Tab Restructure + Environment Screen + Chat FAB
- **Issue**: Tab structure didn't match spec. Environment screen missing. Chat FAB did nothing. Workout/nutrition showed blank "No data" with no guidance.
- **Fix**:
  - Created `Environment.tsx` screen (air quality, UV, pollen)
  - Health tab: added Environment
  - Life tab: removed Financial and HomeEnvironment (moved to Profile)
  - Profile tab: added Financial and HomeEnvironment
  - Chat FAB now navigates to Conversation screen using navigationRef
  - Workout/nutrition empty states now say "Complete your morning check-in" with a CTA button
- **Commit**: `1fcdffa`

---

### Registered Screen Inventory

**Home tab**: CommandCenter, WorkoutDetail, MealPlan, Conversation
**Health tab**: HealthHub (dashboard), BloodWork, Supplements, Longevity, Research, AppleHealth, Skincare, Environment
**Life tab**: LifeHub (dashboard), Social, Relationships, Growth, Career, Travel, Wardrobe, Hobbies, Learning, Legacy
**Voice tab**: VoiceHub (dashboard), VoiceMain, Reviews, ContextualIntel
**Profile tab**: ProfileHub (dashboard), CheckIn, Personality, Onboarding, HomeEnv, Financial, DigitalIdentity, FinancialPlanning, Privacy

**Total**: 34 screen files, 4 dashboard hubs, 7 reusable components
