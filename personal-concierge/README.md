# Personal Concierge App

A personal health & life concierge powered by AI. Combines Oura Ring biometric data, Apple Health integration, daily check-ins, blood work analysis, supplement management, environmental intelligence, voice interface, travel intelligence, social health tracking, financial context, habit coaching, career development, wardrobe planning, personality assessment, progressive onboarding, legacy vision, home environment optimization, learning tracking, feedback learning engine, Google Calendar integration, data privacy controls, and Claude AI to deliver a fully personalized daily life plan.

## Architecture

- **Backend:** Python 3.11 + FastAPI + uvicorn
- **Frontend:** Expo React Native with TypeScript
- **Database:** Supabase (Postgres)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Memory:** mem0ai + Supabase life profile for persistent user context
- **Wearable:** Oura Ring API v2
- **Research:** PubMed E-utilities
- **Environment:** OpenWeatherMap / Open-Meteo / Ambee

## Modules

| Module | Description |
|---|---|
| **Core Loop** | Oura sync, check-in, AI fitness agent, AI nutrition agent |
| **Memory & Life Profile** | Progressive user knowledge base, 50 profile questions |
| **Blood Work** | PDF upload, Claude biomarker extraction, optimal ranges, delta reports |
| **Supplement Stack** | Add/manage supplements, interaction checking, adherence tracking |
| **Environmental Intelligence** | UV index, AQI, pollen, outdoor safety assessment |
| **Science Engine** | PubMed research sweeps, relevance grading, evidence evaluation |
| **Longevity Dashboard** | Biological age estimation, composite health scores |
| **Coaching Engine** | Four coaching modes, compliance drift detection |
| **Cross-Module Arbitrator** | Unified daily plan synthesizing all data sources |
| **Reminders** | Time-aware contextual notifications |
| **Voice Interface** | Whisper STT + OpenAI TTS, morning briefing, command processing |
| **Travel Intelligence** | Pre-trip prep, real-time local concierge, post-trip recovery |
| **Social & Life Balance** | Relationship tracking, connection cadence, social health score |
| **Financial Context** | Budget-aware recommendations, subscription audit |
| **1% Growth Engine** | Atomic habits, streak tracking, compound progress coaching |
| **Career & Development** | Burnout monitoring, weekly reflection, health-performance correlation |
| **Style & Wardrobe** | Closet inventory, weather-aware outfit suggestions, wardrobe audit |
| **Push Notifications** | Expo push, morning briefing, habit nudges, supplement reminders |
| **Personality & Values** | MBTI assessment, values orientation, coaching style adaptation |
| **Progressive Onboarding** | 14-step guided setup, celebration milestones, habit seeding |
| **Apple Health** | Gap-filling biometric sync when Oura isn't worn |
| **Google Calendar** | OAuth2 integration, event classification, workout window detection |
| **Feedback Learning** | Preference ratings, pattern extraction, surprise mode |
| **Legacy & Vision** | 10-year goals, milestone timeline, values drift detection |
| **Home Environment** | Air quality, lighting, ergonomics, budget-aware recommendations |
| **Learning & Education** | Books, courses, language goals, streak tracking |
| **Data Privacy** | Full data export, per-category deletion, amnesia mode |

## Setup

### 1. Clone and install

```bash
# Backend
cd personal-concierge/backend
pip install -r requirements.txt

# Mobile
cd personal-concierge/mobile
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` in the project root and fill in:

| Variable | Where to get it | Required |
|---|---|---|
| `SUPABASE_URL` | supabase.com → project settings → API | Yes |
| `SUPABASE_ANON_KEY` | supabase.com → project settings → API (anon/public) | Yes |
| `SUPABASE_SERVICE_KEY` | supabase.com → project settings → API (service_role) | Yes |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Yes |
| `OURA_PERSONAL_ACCESS_TOKEN` | cloud.ouraring.com/personal-access-tokens | Yes |
| `MEM0_API_KEY` | app.mem0.ai → Settings → API Keys | Optional |
| `OPENWEATHER_API_KEY` | openweathermap.org → API Keys | Optional |
| `AMBEE_API_KEY` | api-dashboard.getambee.com | Optional |
| `PUBMED_EMAIL` | Your email (PubMed E-utilities courtesy) | Optional |
| `OPENAI_API_KEY` | platform.openai.com → API Keys (Whisper STT + TTS) | Optional |
| `ELEVENLABS_API_KEY` | elevenlabs.io (premium TTS voice) | Optional |
| `GOOGLE_CALENDAR_CLIENT_ID` | Google Cloud Console → OAuth 2.0 credentials | Optional |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 credentials | Optional |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Your callback URL (e.g. `http://localhost:8000/calendar/callback`) | Optional |

Copy `mobile/.env.example` to `mobile/.env` and fill in:

| Variable | Notes |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The anon key (different from service key) |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` for local dev |

### 3. Set up database

```bash
cd backend
python scripts/run_migrations.py
python scripts/seed_profile_questions.py  # Optional: seed profile questions
```

If the script can't execute DDL via API, copy the contents of `backend/migrations/001_initial_schema.sql`, `002_session2_schema.sql`, `003_session4_schema.sql`, and `004_session5_schema.sql` and paste into the Supabase SQL Editor.

### 4. Sync your Oura data

```bash
cd backend
python scripts/oura_sync.py           # last 30 days
python scripts/oura_sync.py --days 7  # or specify days
```

### 5. Run backend

```bash
cd backend
uvicorn main:app --reload
```

Backend runs at http://localhost:8000. Check http://localhost:8000/health for status.

### 6. Run mobile app

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go on your phone.

## API Endpoints

### Core
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check + service status |
| POST | `/checkin` | Submit morning check-in |
| GET | `/checkin/today` | Get today's check-in |
| GET | `/checkin/history?days=30` | Check-in history |
| GET | `/fitness/today` | Today's workout recommendation |
| POST | `/fitness/complete` | Mark workout complete |
| GET | `/fitness/history?days=14` | Workout history |
| GET | `/nutrition/today` | Today's meal plan |
| POST | `/nutrition/log` | Log a meal as eaten |
| POST | `/sync/oura?days=7` | Trigger Oura data sync |

### Blood Work
| Method | Path | Description |
|---|---|---|
| POST | `/bloodwork/upload` | Upload lab PDF for AI extraction |
| GET | `/bloodwork/biomarkers` | Latest biomarkers with optimal ranges |
| GET | `/bloodwork/biomarkers/{name}/trend` | Historical trend for a biomarker |
| GET | `/bloodwork/delta` | Compare two lab dates |
| GET | `/bloodwork/uploads` | Upload history |
| GET | `/bloodwork/flagged` | Biomarkers outside optimal range |

### Supplements
| Method | Path | Description |
|---|---|---|
| GET | `/supplements/stack` | Current supplement stack |
| POST | `/supplements/add` | Add supplement (with interaction check) |
| PUT | `/supplements/{id}` | Update a supplement |
| DELETE | `/supplements/{id}` | Deactivate a supplement |
| POST | `/supplements/log` | Log adherence |
| GET | `/supplements/today` | Today's supplement log |
| GET | `/supplements/stats` | Adherence statistics |
| GET | `/supplements/schedule` | Supplements by timing |

### Environment
| Method | Path | Description |
|---|---|---|
| GET | `/environment/today` | Today's UV, AQI, pollen, weather |

### Research
| Method | Path | Description |
|---|---|---|
| POST | `/research/sweep` | Run PubMed research sweep |
| GET | `/research/articles` | Saved/relevant articles |
| POST | `/research/articles/{id}/save` | Bookmark article |
| POST | `/research/articles/{id}/dismiss` | Dismiss article |

### Longevity
| Method | Path | Description |
|---|---|---|
| POST | `/longevity/calculate` | Calculate longevity metrics |
| GET | `/longevity/latest` | Most recent calculation |
| GET | `/longevity/history` | Metric history |

### Coaching
| Method | Path | Description |
|---|---|---|
| GET | `/coaching/settings` | Current coaching settings |
| POST | `/coaching/mode` | Set coaching mode |
| GET | `/coaching/modes` | Available coaching modes |
| POST | `/coaching/compliance` | Log compliance event |
| GET | `/coaching/drift` | Drift analysis report |

### Daily Plan & Reminders
| Method | Path | Description |
|---|---|---|
| GET | `/daily/plan` | AI-generated daily plan from all modules |
| GET | `/reminders/pending` | Time-aware pending reminders |

### Voice (Session 4)
| Method | Path | Description |
|---|---|---|
| POST | `/voice/transcribe` | Upload audio → Whisper STT |
| POST | `/voice/synthesize` | Text → TTS (OpenAI, mp3) |
| POST | `/voice/command` | Process voice command via Claude |
| GET | `/voice/morning-briefing` | Generate morning briefing text |
| GET | `/voice/evening-wind-down` | Generate evening wind-down text |
| POST | `/voice/workout-coaching` | Real-time workout coaching cue |
| POST | `/voice/log-session` | Save voice session log |

### Travel (Session 4)
| Method | Path | Description |
|---|---|---|
| GET | `/travel/trips` | List all trips |
| POST | `/travel/trips` | Create a trip |
| GET | `/travel/trips/{id}` | Trip detail |
| PUT | `/travel/trips/{id}` | Update trip |
| GET | `/travel/trips/{id}/prep` | Generate pre-trip plan |
| POST | `/travel/trips/{id}/checkin` | Daily travel check-in |
| GET | `/travel/trips/{id}/post-trip` | Post-trip recovery protocol |
| GET | `/travel/active` | Currently active trip |
| GET | `/travel/suggestions` | Local restaurant/workout suggestions |

### Social (Session 4)
| Method | Path | Description |
|---|---|---|
| GET | `/social/circle` | Get social contacts |
| POST | `/social/circle` | Add contact |
| PUT | `/social/circle/{id}` | Update contact |
| GET | `/social/overdue` | Overdue connections |
| POST | `/social/log` | Log social interaction |
| GET | `/social/score` | Weekly social health score |
| GET | `/social/briefing` | Command Center widget data |
| POST | `/social/suggest/{id}` | Suggest activity for contact |

### Financial (Session 4)
| Method | Path | Description |
|---|---|---|
| GET | `/financial/context` | Financial profile |
| PUT | `/financial/context` | Update financial profile |
| GET | `/financial/subscriptions` | List subscriptions |
| POST | `/financial/subscriptions` | Add subscription |
| PUT | `/financial/subscriptions/{id}` | Update subscription |
| GET | `/financial/audit` | Subscription audit report |

### Growth (Session 4)
| Method | Path | Description |
|---|---|---|
| GET | `/growth/habits` | List habits with status |
| POST | `/growth/habits` | Add habit |
| PUT | `/growth/habits/{id}` | Update habit |
| DELETE | `/growth/habits/{id}` | Deactivate habit |
| GET | `/growth/today` | Today's habits widget |
| POST | `/growth/log` | Log habit completion |
| GET | `/growth/weekly` | Weekly compound report |
| GET | `/growth/suggest` | Claude habit suggestion |
| GET | `/growth/score` | Compound growth score |

### Career (Session 4)
| Method | Path | Description |
|---|---|---|
| GET | `/career/profile` | Career profile |
| PUT | `/career/profile` | Update career profile |
| POST | `/career/reflection` | Log weekly reflection |
| GET | `/career/reflections` | Reflection history |
| GET | `/career/burnout` | Burnout risk assessment |
| GET | `/career/coaching` | Weekly coaching insight |
| GET | `/career/correlations` | Health-performance correlations |

### Wardrobe (Session 4)
| Method | Path | Description |
|---|---|---|
| GET | `/wardrobe/items` | List wardrobe items |
| POST | `/wardrobe/items` | Add item |
| PUT | `/wardrobe/items/{id}` | Update item |
| DELETE | `/wardrobe/items/{id}` | Deactivate item |
| GET | `/wardrobe/suggest` | Today's outfit suggestion |
| GET | `/wardrobe/tomorrow` | Tomorrow's outfit suggestion |
| POST | `/wardrobe/log` | Log outfit worn |
| GET | `/wardrobe/audit` | Wardrobe audit report |

### Notifications (Session 4)
| Method | Path | Description |
|---|---|---|
| POST | `/notifications/register` | Register Expo push token |
| POST | `/notifications/send-morning` | Trigger morning briefing notification |
| POST | `/notifications/send-habits` | Trigger habit nudge |
| POST | `/notifications/schedule` | Run full notification check |

### Apple Health (Session 5)
| Method | Path | Description |
|---|---|---|
| POST | `/sync/apple-health` | Sync Apple Health data (gap-fill) |
| GET | `/sync/gaps` | Get dates with missing biometric data |

### Personality (Session 5)
| Method | Path | Description |
|---|---|---|
| GET | `/personality/questions` | Get MBTI + values assessment questions |
| POST | `/personality/score` | Score completed assessment |
| GET | `/personality/profile` | Get personality profile |
| GET | `/personality/insight` | AI personality insight |
| GET | `/personality/coaching-style` | Coaching style from personality |
| PUT | `/personality/profile` | Update personality profile |

### Onboarding (Session 5)
| Method | Path | Description |
|---|---|---|
| GET | `/onboarding/status` | Onboarding progress status |
| GET | `/onboarding/steps` | All onboarding steps |
| GET | `/onboarding/step/{name}` | Get step content |
| POST | `/onboarding/step/{name}` | Complete a step |
| POST | `/onboarding/step/{name}/skip` | Skip a step |
| GET | `/onboarding/habits-suggest` | Suggest habits from profile |

### Calendar (Session 5)
| Method | Path | Description |
|---|---|---|
| GET | `/calendar/auth` | Get Google OAuth2 authorization URL |
| GET | `/calendar/callback` | OAuth2 callback handler |
| GET | `/calendar/status` | Calendar connection status |
| POST | `/calendar/sync` | Sync calendar events |
| GET | `/calendar/today` | Today's events |
| GET | `/calendar/tomorrow` | Tomorrow's events |
| GET | `/calendar/workout-windows` | Available workout time slots |
| GET | `/calendar/detect-trips` | Detect trips from calendar |
| DELETE | `/calendar/disconnect` | Disconnect Google Calendar |

### Feedback (Session 5)
| Method | Path | Description |
|---|---|---|
| POST | `/feedback/rate` | Submit preference rating |
| GET | `/feedback/patterns` | Get all preference patterns |
| GET | `/feedback/patterns/{category}` | Patterns for one category |
| GET | `/feedback/summary` | Learning summary |

### Legacy (Session 5)
| Method | Path | Description |
|---|---|---|
| GET | `/legacy/profile` | Legacy vision profile |
| PUT | `/legacy/profile` | Update legacy profile |
| GET | `/legacy/milestones` | Life milestones |
| POST | `/legacy/milestones` | Add milestone |
| GET | `/legacy/drift` | Values drift analysis |
| GET | `/legacy/bridge` | Daily bridge moment |
| GET | `/legacy/annual-review` | Annual review |

### Home Environment (Session 5)
| Method | Path | Description |
|---|---|---|
| GET | `/home/profile` | Home environment profile |
| PUT | `/home/profile` | Update home profile |
| GET | `/home/recommendations` | Get recommendations |
| POST | `/home/recommendations/generate` | Generate AI recommendations |
| PUT | `/home/recommendations/{id}/complete` | Mark recommendation complete |
| GET | `/home/correlations` | Health-environment correlations |

### Learning (Session 5)
| Method | Path | Description |
|---|---|---|
| GET | `/learning/profile` | Learning profile |
| PUT | `/learning/profile` | Update learning profile |
| POST | `/learning/log` | Log study session |
| GET | `/learning/today` | Today's recommendation |
| GET | `/learning/books` | Book list |
| POST | `/learning/books` | Add book |
| PUT | `/learning/books/{id}` | Update book |
| GET | `/learning/courses` | Course list |
| POST | `/learning/courses` | Add course |
| PUT | `/learning/courses/{id}` | Update course |
| GET | `/learning/language/{lang}` | Language plan |
| GET | `/learning/weekly` | Weekly learning insight |

### Privacy (Session 5)
| Method | Path | Description |
|---|---|---|
| GET | `/privacy/summary` | Data summary by category |
| POST | `/privacy/export` | Export full profile |
| DELETE | `/privacy/category/{cat}` | Delete category data |
| PUT | `/privacy/sensitivity` | Set sensitivity tier |
| POST | `/privacy/amnesia` | Activate amnesia mode |

## How It Works

1. **Morning:** Open the app, see your Oura readiness score and biometrics
2. **Check-in:** Rate energy, mood, stress, soreness (30 seconds)
3. **Daily Plan:** AI synthesizes all data into one coherent daily plan
4. **Workout:** AI generates a personalized workout based on readiness, recovery, environment
5. **Nutrition:** AI creates a meal plan adjusted for training, biomarkers, and macro targets
6. **Supplements:** Track daily supplement adherence with interaction checking
7. **Blood Work:** Upload lab PDFs for AI extraction and biomarker trend analysis
8. **Research:** PubMed sweeps find relevant studies for your health profile
9. **Longevity:** Track biological age estimation and composite health scores
10. **Coaching:** Adaptive coaching style shifts based on your compliance patterns

## Project Structure

```
personal-concierge/
├── backend/
│   ├── main.py              # FastAPI entry point (155+ routes)
│   ├── config.py            # Environment + Supabase init
│   ├── agents/              # AI agents (fitness, nutrition)
│   ├── routers/             # API endpoints (28 routers)
│   ├── services/            # Business logic (26 services)
│   ├── scripts/             # Migration + sync + seed scripts
│   ├── static/              # Web dashboard (standalone.html)
│   └── migrations/          # SQL schema (4 migration files)
└── mobile/
    ├── App.tsx              # 5-tab navigation root
    ├── screens/             # 22 screens
    │   ├── CommandCenter    # Main dashboard
    │   ├── CheckIn          # Morning check-in
    │   ├── WorkoutDetail    # Exercise breakdown
    │   ├── MealPlan         # Nutrition with macro bars
    │   ├── BloodWork        # Biomarker screen
    │   ├── Supplements      # Supplement manager
    │   ├── Longevity        # Biological age + scores
    │   ├── Research         # PubMed articles
    │   ├── Voice            # Voice commands + briefings
    │   ├── Travel           # Trip management
    │   ├── Social           # Social health tracking
    │   ├── Growth           # 1% habit engine
    │   ├── Career           # Career + burnout monitoring
    │   ├── Wardrobe         # Closet + outfit planning
    │   ├── Financial        # Subscriptions + audit
    │   ├── Personality      # MBTI + values assessment
    │   ├── Onboarding       # Progressive setup flow
    │   ├── AppleHealth      # Health data gap-filling
    │   ├── Legacy           # 10-year vision + milestones
    │   ├── HomeEnvironment  # Air, light, ergonomics
    │   ├── Learning         # Books, courses, languages
    │   └── Privacy          # Data export + deletion
    ├── components/          # ReadinessCircle, MetricCard, etc.
    └── lib/                 # Supabase client, API client
```
