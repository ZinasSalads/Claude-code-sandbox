# Personal Concierge App

A personal health concierge powered by AI. Combines Oura Ring biometric data, daily check-ins, blood work analysis, supplement management, environmental intelligence, and Claude AI to deliver a comprehensive daily health plan.

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

If the script can't execute DDL via API, copy the contents of `backend/migrations/001_initial_schema.sql` and `002_session2_schema.sql` and paste into the Supabase SQL Editor.

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
│   ├── main.py              # FastAPI entry point (44 routes)
│   ├── config.py            # Environment + Supabase init
│   ├── agents/              # AI agents (fitness, nutrition)
│   ├── routers/             # API endpoints (12 routers)
│   ├── services/            # Business logic (10 services)
│   ├── scripts/             # Migration + sync + seed scripts
│   └── migrations/          # SQL schema (2 migration files)
└── mobile/
    ├── App.tsx              # Navigation root
    ├── screens/             # 8 screens
    │   ├── CommandCenter    # Main dashboard with module grid
    │   ├── CheckIn          # Morning check-in
    │   ├── WorkoutDetail    # Exercise breakdown
    │   ├── MealPlan         # Nutrition with macro bars
    │   ├── BloodWork        # 4-tab biomarker screen
    │   ├── Supplements      # 4-tab supplement manager
    │   ├── Longevity        # Biological age + scores
    │   └── Research         # PubMed articles
    ├── components/          # ReadinessCircle, MetricCard, etc.
    └── lib/                 # Supabase client, API client
```
