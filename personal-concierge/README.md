# Personal Concierge App

A comprehensive personal health & life concierge powered by AI. Synthesizes data from every domain of a human life — health, fitness, nutrition, sleep, skin, supplements, blood work, longevity, environment, mental health, social connections, relationships, hobbies, career, learning, travel, wardrobe, finances, legacy, home, digital identity, and growth — into a single coherent daily plan delivered by a 10-agent council, accessible through voice and conversation, and tracked across weeks and months in reviews that connect daily actions to a 10-year vision.

## Architecture

```
personal-concierge/
├── backend/
│   ├── main.py              # FastAPI app, 36 routers, 210+ endpoints
│   ├── config.py             # Environment variables, service status
│   ├── requirements.txt      # Python dependencies
│   ├── agents/
│   │   └── council.py        # 10-agent parallel council + arbitrator
│   ├── routers/              # 36 API routers
│   ├── services/             # 34 business logic services
│   ├── migrations/           # 5 SQL migration files (55+ tables)
│   └── static/
│       ├── index.html        # Backend-served dashboard
│       └── standalone.html   # Self-contained dashboard (27 tabs)
└── mobile/
    ├── App.tsx               # 5-tab navigation + floating chat
    ├── screens/              # 30 React Native screens
    ├── components/           # Reusable components
    └── lib/
        ├── api.ts            # 80+ typed API functions
        └── supabase.ts       # Supabase client
```

### Tech Stack

- **Backend:** Python 3.11 + FastAPI + uvicorn
- **Frontend:** Expo React Native with TypeScript
- **Database:** Supabase (Postgres, 55+ tables)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Memory:** mem0ai + Supabase life profile
- **Wearable:** Oura Ring API v2
- **Voice:** OpenAI Whisper (STT) + TTS
- **Research:** PubMed E-utilities
- **Environment:** OpenWeatherMap / Open-Meteo / Ambee
- **Calendar:** Google Calendar OAuth2

## Modules

| Domain | Active Modules |
|---|---|
| **Health** | Fitness (goals, training plan, workout logging, progress), Supplements, Apple Health, Blood Work |
| **Life** | Social, Relationships, Growth, Career, Travel, Wardrobe, Hobbies, Learning, Legacy, Home |
| **Intelligence** | Voice, Conversation, Personality, Feedback Learning, Reviews |
| **Admin** | Onboarding, Privacy, Notifications |
| **Today Tab** | Command Center (readiness/sleep scores, AI insight, environment/weather/forecast, workout plan, flag) |

### Planned (not yet active in UI)
- Skincare, Longevity, GP, Research (backend services exist)
- Contextual Intelligence Engine (backend exists at `/context/*`, removed from UI pending clearer purpose)
- Subscriptions/Financial (backend exists at `/financial/*`, removed from UI)
- Digital Identity (backend exists at `/digital/*`)
- Blood work Apple Health connection + quarterly reminders

## API Endpoints (210+)

### Core
- `GET /health` — Service status
- `GET /dashboard/summary` — Today's data + 7-day history
- `GET /daily/plan` — 10-agent council daily plan
- `GET /daily/council-debug` — Agent positions + conflicts

### Health
- `POST /checkin` — Daily check-in
- `GET /fitness/today` — AI workout
- `GET /nutrition/today` — AI meal plan
- `GET/POST /sync/oura` — Oura data sync
- `POST /sync/apple-health` — Apple Health merge
- `POST /bloodwork/upload` — Blood work PDF upload
- `GET /supplements/stack` — Supplement management
- `GET /skincare/routine/morning|evening` — Skincare routines
- `POST /skincare/analyze-photo` — Claude Vision skin analysis
- `GET /skincare/correlations` — Health-skin correlations
- `POST /longevity/calculate` — Biological age estimation

### Life
- `GET /social/circle` — Social contacts
- `GET /relationships/health` — Relationship health scoring
- `GET /growth/today` — Habit tracking
- `GET /career/burnout` — Burnout risk detection
- `GET /travel/trips` — Trip management
- `GET /wardrobe/suggest` — Outfit suggestions
- `GET /hobbies/health-score` — Hobby portfolio health
- `GET /hobbies/conflicts` — Priority conflict detection
- `GET /learning/today` — Learning recommendations
- `GET /legacy/drift` — Values drift detection

### Intelligence
- `POST /voice/command` — Voice commands
- `GET /voice/morning-briefing` — Morning briefing
- `POST /conversation/message` — AI chat
- `POST /context/signal` — Contextual signal expansion
- `GET /context/anomalies` — Data anomaly detection
- `GET /reviews/weekly` — Weekly review synthesis
- `GET /reviews/monthly` — Monthly review synthesis

### Profile & Admin
- `GET /personality/profile` — MBTI + values
- `GET /onboarding/status` — Setup progress
- `GET /digital/profile` — Digital identity
- `POST /digital/linkedin-audit` — LinkedIn audit
- `GET /financial-planning/goals` — Savings goals
- `GET /financial-planning/stress-flag` — Financial stress flag
- `POST /privacy/export` — Full data export
- `GET /calendar/events` — Google Calendar sync

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `SUPABASE_ANON_KEY` | No | Supabase anon key (for mobile) |
| `ANTHROPIC_API_KEY` | Yes | Claude API for AI features |
| `OURA_PERSONAL_ACCESS_TOKEN` | No | Oura Ring data sync |
| `OPENAI_API_KEY` | No | Voice (Whisper STT + TTS) |
| `ELEVENLABS_API_KEY` | No | Alternative TTS |
| `OPENWEATHER_API_KEY` | No | Weather data |
| `AMBEE_API_KEY` | No | Pollen/air quality |
| `PUBMED_EMAIL` | No | PubMed research |
| `MEM0_API_KEY` | No | Memory service (optional) |
| `GOOGLE_CALENDAR_CLIENT_ID` | No | Calendar integration |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | No | Calendar integration |
| `GOOGLE_CALENDAR_REDIRECT_URI` | No | Calendar OAuth callback |

## Database Schema (55+ tables)

**Migration 001 (Session 1):** health_data, check_ins, workouts, meals, user_profile, memories, profile_questions
**Migration 002 (Session 2):** biomarkers, bloodwork_uploads, supplements, supplement_log, environmental_data, research_articles, longevity_scores, coaching_settings, compliance_events
**Migration 003 (Session 4):** social_contacts, social_log, subscriptions, growth_habits, growth_habit_log, career_profiles, career_reflections, wardrobe_items, outfit_log, trips, trip_checkins, voice_sessions, push_tokens, financial_context
**Migration 004 (Session 5):** personality_profiles, onboarding_progress, preference_ratings, preference_patterns, legacy_profile, legacy_milestones, home_profile, home_recommendations, learning_profile, books, courses, learning_sessions, calendar_tokens, calendar_events, sensitivity_settings
**Migration 005 (Session 6):** skincare_products, skincare_conflicts, skin_log, skin_profile, relationships, relationship_checkins, digital_identity, digital_audit_log, financial_goals, financial_stress_log, hobbies, hobby_log, priority_conflicts, context_signals, conversations, weekly_reviews, monthly_reviews

## Setup

```bash
# Backend
cd personal-concierge/backend
pip install -r requirements.txt
cp .env.example .env  # Fill in credentials
uvicorn main:app --reload

# Mobile
cd personal-concierge/mobile
npm install
npx expo start

# Database
# Run migrations 001-005 in Supabase SQL Editor
```

## Deployed

- **Backend:** https://claude-code-sandbox-production.up.railway.app
- **Dashboard:** https://claude-code-sandbox-production.up.railway.app/ (served by FastAPI)

## Build History

- **Session 1:** Core loop (Oura, check-in, fitness agent, nutrition agent, mobile foundation)
- **Session 2:** Health intelligence (blood work, supplements, environment, longevity, coaching, arbitrator)
- **Session 3:** Deployment (Railway, web dashboard, Supabase)
- **Session 4:** Life intelligence (voice, travel, social, financial, growth, career, wardrobe, notifications)
- **Session 5:** Personality layer (MBTI, onboarding, Apple Health, calendar, feedback, legacy, home, learning, privacy)
- **Session 6:** Final session (skincare, relationships, digital identity, financial planning, hobbies, contextual intelligence, conversation, reviews, 10-agent council)
- **Session 7:** Mobile audit (API path fixes, crash fixes, dashboard hubs, navigation restructure)
- **Session 8:** Fitness hub overhaul (training plan merge, 3-week icon strip, imperial units, equipment-aware plans, manual/view modes, workout history edit/delete, feasibility fix). UX improvements (Me tab cleanup, privacy record browsing, personality retake, onboarding review, HRV fix, environment on Today tab with forecast, flag something in fitness)
