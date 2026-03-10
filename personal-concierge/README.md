# Personal Concierge App

A personal health concierge powered by AI. Combines Oura Ring biometric data, daily check-ins, and Claude AI to deliver personalized workout recommendations and meal plans every day.

## Architecture

- **Backend:** Python 3.11 + FastAPI + uvicorn
- **Frontend:** Expo React Native with TypeScript
- **Database:** Supabase (Postgres)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Memory:** mem0ai for persistent user context
- **Wearable:** Oura Ring API v2

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
```

If the script can't execute DDL via API, copy the contents of `backend/migrations/001_initial_schema.sql` and paste into the Supabase SQL Editor.

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

## How It Works

1. **Morning:** Open the app, see your Oura readiness score and biometrics
2. **Check-in:** Rate energy, mood, stress, soreness (30 seconds)
3. **Workout:** AI generates a personalized workout based on your readiness, recent training, and check-in
4. **Nutrition:** AI creates a meal plan adjusted for your training day, biomarkers, and macro targets
5. **Track:** Mark workouts complete, log meals eaten
6. **Learn:** The AI builds persistent memory about your preferences and patterns over time

## Project Structure

```
personal-concierge/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # Environment + Supabase init
│   ├── agents/              # AI agents (fitness, nutrition)
│   ├── routers/             # API endpoints
│   ├── services/            # Oura client, memory service
│   ├── scripts/             # Migration + sync scripts
│   └── migrations/          # SQL schema
└── mobile/
    ├── App.tsx              # Navigation root
    ├── screens/             # CommandCenter, CheckIn, WorkoutDetail, MealPlan
    ├── components/          # ReadinessCircle, MetricCard, etc.
    └── lib/                 # Supabase client, API client
```
