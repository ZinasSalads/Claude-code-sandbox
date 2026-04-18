-- Migration 006: Fitness Module
-- Goal-driven training, per-exercise result logging, Apple Watch integration

-- Fitness goals (what the user is training toward)
CREATE TABLE IF NOT EXISTS fitness_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    goal_type VARCHAR(50) NOT NULL,          -- running_race, strength, weight_loss, endurance, custom
    target_description TEXT NOT NULL,         -- "Sub-2hr half marathon"
    target_date DATE,
    baseline_description TEXT,               -- "Current best: 2:28"
    priority VARCHAR(20) DEFAULT 'primary',  -- primary, secondary, maintenance
    ai_feasibility JSONB,                    -- { verdict, summary, conditions, timeline_weeks_needed, weekly_requirements, phases, risk_factors }
    status VARCHAR(20) DEFAULT 'active',     -- active, achieved, paused, abandoned
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly training plans (AI-generated from goals)
CREATE TABLE IF NOT EXISTS training_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    goal_id UUID REFERENCES fitness_goals(id) ON DELETE SET NULL,
    week_start DATE NOT NULL UNIQUE,
    phase VARCHAR(30),                                -- base, build, peak, taper, maintenance
    weekly_run_km_target FLOAT,
    weekly_strength_sessions_target INTEGER,
    planned_sessions JSONB,                           -- [{date, day, session_type, title, duration_minutes, description, targets}]
    ai_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's available gym equipment (constrains AI exercise selection)
CREATE TABLE IF NOT EXISTS user_equipment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),             -- machine, barbell, dumbbell, bodyweight, cardio
    equipment_type VARCHAR(100),      -- leg_press, cable_machine, treadmill, etc.
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-exercise set results from strength sessions
CREATE TABLE IF NOT EXISTS workout_sets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_name VARCHAR(100) NOT NULL,
    set_number INTEGER NOT NULL,
    weight_kg FLOAT,
    reps_completed INTEGER,
    rpe FLOAT,       -- Rate of Perceived Exertion 1-10
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (workout_id, exercise_name, set_number)
);

-- Run / cardio session results
CREATE TABLE IF NOT EXISTS run_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE UNIQUE,
    distance_km FLOAT,
    duration_minutes FLOAT,
    avg_pace_per_km FLOAT,   -- minutes per km (e.g. 5.5 = 5:30/km)
    avg_hr INTEGER,
    max_hr INTEGER,
    zone2_pct FLOAT,
    zone3_pct FLOAT,
    zone4_pct FLOAT,
    run_type VARCHAR(30),    -- easy, tempo, long, interval, recovery, race
    rpe INTEGER,
    notes TEXT,
    source VARCHAR(30) DEFAULT 'manual',   -- manual, apple_watch, technogym
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apple Watch workout sessions (staging / enrichment layer)
CREATE TABLE IF NOT EXISTS apple_watch_workouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    apple_uuid VARCHAR(200) UNIQUE,        -- HealthKit UUID for deduplication
    activity_type VARCHAR(100),            -- Running, Traditional Strength Training, Treadmill, etc.
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes FLOAT,
    calories INTEGER,
    distance_km FLOAT,
    avg_hr INTEGER,
    max_hr INTEGER,
    source_app VARCHAR(100),              -- "Technogym", "Apple Watch", "Nike Run Club"
    linked_workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fitness_goals_status ON fitness_goals(status);
CREATE INDEX IF NOT EXISTS idx_training_plans_week ON training_plans(week_start);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(exercise_name);
CREATE INDEX IF NOT EXISTS idx_run_log_workout ON run_log(workout_id);
CREATE INDEX IF NOT EXISTS idx_apple_watch_date ON apple_watch_workouts(date);
CREATE INDEX IF NOT EXISTS idx_apple_watch_linked ON apple_watch_workouts(linked_workout_id);
